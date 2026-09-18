import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@dynatrace/strato-components/buttons';
import { Container } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { SharedChartInteractions, TimeseriesChart, type Timeseries } from '@dynatrace/strato-components-preview/charts';
import { useClusterSelected, useSetClusterSelected } from '../../context/FilterK8sContext';
import { loadGrowthHistory } from 'app/services/k8s/GrowthCapacity';
import { forecastSignal } from 'app/services/k8s/GrowthForecast';
import { getClusters } from 'app/services/k8s/kubernetsService';
import { annualWindow, capacityOutlook, changePercent, DAY_MS, describeHistory, FORECAST_DAYS, FORECAST_KEYS, ForecastKey, GrowthHistory, SignalForecast } from 'app/model/GrowthCapacity';
import './GrowthCapacity.css';

const LABELS: Record<ForecastKey, string> = { cpuUsed: 'CPU usada', memoryUsed: 'Memória usada', throughput: 'Throughput', latency: 'Resposta média' };
const number = (value?: number, suffix = '') => value === undefined || !Number.isFinite(value)
  ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
const metric = (key: ForecastKey, value?: number) => key === 'cpuUsed' ? number(value === undefined ? undefined : value / 1000, ' cores')
  : key === 'memoryUsed' ? number(value === undefined ? undefined : value / (1024 ** 3), ' GiB')
    : number(value, key === 'latency' ? ' ms' : ' req/s');
const date = (time: number) => new Date(time).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const change = (value?: number) => value === undefined ? 'Variação indisponível' : `${value > 0 ? '+' : ''}${number(value, '%')}`;
const defined = (series: (Timeseries | undefined)[]): Timeseries[] => series.filter((s): s is Timeseries => !!s);

type ForecastState = { result?: SignalForecast; error?: string; loading: boolean };

function forecastSeries(history: GrowthHistory, key: ForecastKey, forecast?: SignalForecast): Timeseries[] {
  if (!forecast) return [];
  return (['point', 'lower', 'upper'] as const).map(bound => ({
    name: bound === 'point' ? 'Previsão central' : bound === 'lower' ? 'Limite inferior · 90%' : 'Limite superior · 90%',
    unit: history.signals[key]?.unit,
    datapoints: forecast.points.map(p => ({ start: new Date(p.time), end: new Date(p.time + DAY_MS), value: p[bound] })),
  }));
}

function ForecastChart({ history, signalKey, forecast }: { history: GrowthHistory; signalKey: ForecastKey; forecast?: SignalForecast }) {
  const capacityKey = signalKey === 'cpuUsed' ? 'cpuCapacity' : signalKey === 'memoryUsed' ? 'memoryCapacity' : undefined;
  const reservedKey = signalKey === 'cpuUsed' ? 'cpuReserved' : signalKey === 'memoryUsed' ? 'memoryReserved' : undefined;
  const capacity = capacityKey ? history.signals[capacityKey] : undefined;
  const currentCapacity = capacityKey ? describeHistory(history, capacityKey) : undefined;
  const capacityProjection: Timeseries | undefined = capacity && currentCapacity?.latestTime === history.to - DAY_MS && currentCapacity.latest !== undefined
    ? { ...capacity, name: 'Capacidade mantida na projeção', datapoints: [0, FORECAST_DAYS].map(day => ({ start: new Date(history.to + day * DAY_MS), value: currentCapacity.latest as number })) } : undefined;
  const series = defined([history.signals[signalKey], capacity, reservedKey ? history.signals[reservedKey] : undefined,
    ...forecastSeries(history, signalKey, forecast), ...(forecast ? [capacityProjection] : [])]);
  return <Container className="growth-chart">
    <Heading level={4}>{LABELS[signalKey]} · histórico e previsão</Heading>
    <p className="growth-muted">12 meses de histórico diário. Previsão a partir de {date(history.to)}; limites com cobertura-alvo de 90%.</p>
    {series.length ? <TimeseriesChart data={series} height={300} curve="linear" gapPolicy="gap"
      colorPalette={{ 'Previsão central': '#8e52cc', 'Limite inferior · 90%': '#b799db', 'Limite superior · 90%': '#b799db', 'Capacidade mantida na projeção': '#2a9d8f' }}>
      <TimeseriesChart.Legend position="bottom" />
      <TimeseriesChart.YAxis min={0} />
      <TimeseriesChart.XAxis min={history.from} max={history.to + FORECAST_DAYS * DAY_MS} />
    </TimeseriesChart> : <p className="growth-empty">Sem dados para este sinal no cluster.</p>}
  </Container>;
}

export function GrowthCapacityPanel() {
  const cluster = useClusterSelected();
  const setCluster = useSetClusterSelected();
  const [clusters, setClusters] = useState<string[]>([]);
  const [clusterError, setClusterError] = useState('');
  const [anchor, setAnchor] = useState(() => new Date());
  const [state, setState] = useState<{ key: string; data?: GrowthHistory; error?: string; loading: boolean }>({ key: '', loading: false });
  const [forecasts, setForecasts] = useState<{ key: string; signals: Partial<Record<ForecastKey, ForecastState>> }>({ key: '', signals: {} });
  const selected = !!cluster && cluster !== 'all';
  const key = JSON.stringify([cluster, anchor.toISOString()]);
  const window = useMemo(() => annualWindow(anchor), [anchor]);

  useEffect(() => {
    let cancelled = false;
    getClusters().then(rows => {
      if (!cancelled) {
        setClusters([...new Set(rows.map(row => row['k8s.cluster.name']).filter((value): value is string => typeof value === 'string' && value !== 'all'))].sort());
        setClusterError('');
      }
    }).catch(() => { if (!cancelled) setClusterError('Não foi possível listar os clusters. Tente atualizar a análise.'); });
    return () => { cancelled = true; };
  }, [anchor]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setForecasts({ key, signals: {} });
    if (!selected) { setState({ key, loading: false }); return () => controller.abort(); }
    setState({ key, loading: true });
    loadGrowthHistory(cluster, anchor).then(async data => {
      if (cancelled) return;
      setState({ key, data, loading: false });
      const update = (signalKey: ForecastKey, value: ForecastState) => {
        if (!cancelled) setForecasts(previous => ({ key, signals: { ...previous.signals, [signalKey]: value } }));
      };
      // Two analyzer workers bound concurrency; signals fail independently.
      let next = 0;
      const worker = async () => {
        while (!cancelled && next < FORECAST_KEYS.length) {
          const signalKey = FORECAST_KEYS[next++];
          update(signalKey, { loading: true });
          try {
            const result = await forecastSignal(data, signalKey, controller.signal);
            update(signalKey, { result, loading: false });
          } catch (error) {
            update(signalKey, { loading: false, error: error instanceof Error ? error.message : 'Não foi possível gerar a previsão.' });
          }
        }
      };
      await Promise.all([worker(), worker()]);
    }).catch((error: unknown) => {
      if (!cancelled) setState({ key, loading: false, error: error instanceof Error ? error.message : 'Falha ao carregar o histórico.' });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [key, selected, cluster, anchor]);

  const data = state.key === key ? state.data : undefined;
  const loading = selected && (state.key !== key || state.loading);
  const results = forecasts.key === key ? forecasts.signals : {};
  const forecasting = !!data && FORECAST_KEYS.some(signalKey => !results[signalKey] || results[signalKey]?.loading);
  const cpu = data ? capacityOutlook(data, results.cpuUsed?.result, 'cpuCapacity') : undefined;
  const memory = data ? capacityOutlook(data, results.memoryUsed?.result, 'memoryCapacity') : undefined;
  const options = [...new Set([...clusters, ...(selected ? [cluster] : [])])];
  const crossingLabel = (time?: number) => time === undefined ? 'Não previsto em 90 dias' : time <= window.to ? 'Já atingido na base atual' : date(time);

  return <div className="growth-capacity">
    <header className="growth-header">
      <div><span className="growth-eyebrow">PREVISÃO AUTOMÁTICA · CLUSTERS KUBERNETES</span>
        <Heading level={2}>Crescimento e capacidade da infraestrutura</Heading>
        <p>12 meses de histórico. Previsões independentes de CPU, memória, throughput e resposta para os próximos 90 dias.</p>
      </div>
      <Button onClick={() => setAnchor(new Date())} disabled={loading || forecasting}>Atualizar análise</Button>
    </header>
    <div className="growth-controls growth-cluster-control">
      <label>Cluster Kubernetes / OpenShift / EKS
        <select value={cluster ?? 'all'} onChange={event => setCluster(event.target.value)}>
          <option value="all">Selecione um cluster</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <p>Histórico fixo: <strong>{date(window.from)} — {date(window.to - DAY_MS)}</strong><br />Dias completos em UTC · sem parâmetros de previsão</p>
    </div>
    {clusterError && <p role="alert">{clusterError}</p>}
    {!selected ? <Container><Heading level={4}>Selecione o cluster para iniciar</Heading><p>O modelo é ajustado automaticamente com os últimos 12 meses. Recursos fora do cluster não entram na análise.</p></Container> : <>
      <p className="growth-muted">Todos os namespaces e workloads de <strong>{cluster}</strong>. Throughput inclui chamadas internas aos serviços monitorados, não usuários únicos.</p>
      {loading && <p role="status">Consultando os últimos 12 meses de métricas…</p>}
      {forecasting && <p role="status">Aprendendo o comportamento dos sinais e validando a previsão contra os últimos 28 dias…</p>}
      {state.key === key && state.error && <p role="alert" className="growth-notice">{state.error}</p>}
      {data && <>
        {!!data.issues.length && <div className="growth-notice"><strong>Disponibilidade dos dados</strong><ul>{data.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        <div className="growth-stats">
          {FORECAST_KEYS.map(signalKey => {
            const description = describeHistory(data, signalKey);
            return <Container key={signalKey}><span>{LABELS[signalKey]} · últimos 30 dias</span>
              <strong className="growth-value">{metric(signalKey, description.recentMean)}</strong>
              <small>{change(description.yearChange)} · primeiro × último mês</small>
              <small>{description.count} de {Math.round((data.to - data.from) / DAY_MS)} dias disponíveis ({number(description.coverage * 100, '%')})</small>
            </Container>;
          })}
        </div>
        <Container>
          <Heading level={3}>Quando a capacidade atual pode ficar insuficiente?</Heading>
          <p>A previsão aprende o consumo de cada recurso. A capacidade alocável do último dia completo é mantida como referência futura.</p>
          <div className="growth-table-scroll"><table className="growth-table"><thead><tr>
            <th>Recurso</th><th>Ocupação atual</th><th>Ocupação em 90 dias</th><th>Margem de planejamento (80%)</th><th>Capacidade (100%)</th><th>Risco pela faixa superior (100%)</th>
          </tr></thead><tbody>{([['CPU', cpu], ['Memória', memory]] as const).map(([label, outlook]) => <tr key={label}>
            <th>{label}</th><td>{number(outlook?.currentPercent, '%')}</td><td>{number(outlook?.finalPercent, '%')}</td>
            <td>{outlook ? crossingLabel(outlook.planningDate) : 'Indisponível'}</td>
            <td>{outlook ? crossingLabel(outlook.saturationDate) : 'Indisponível'}</td>
            <td>{outlook ? crossingLabel(outlook.possibleSaturationDate) : 'Indisponível'}</td>
          </tr>)}</tbody></table></div>
          <p className="growth-muted">80% é uma margem fixa de planejamento; 100% é a capacidade alocável. Ausência de cruzamento não garante suporte a picos, limites dos pods ou gargalos locais.</p>
        </Container>
        <Container>
          <Heading level={3}>Previsões para 30, 60 e 90 dias</Heading>
          <p>Valores centrais e faixa de previsão com cobertura-alvo de 90%. Cada sinal usa o próprio histórico, sem taxa de crescimento informada.</p>
          <div className="growth-table-scroll"><table className="growth-table"><thead><tr>
            <th>Sinal</th><th>Último observado</th><th>Em 30 dias</th><th>Em 60 dias</th><th>Em 90 dias</th><th>Tendência em 90 dias</th><th>Validação nos últimos 28 dias</th>
          </tr></thead><tbody>{FORECAST_KEYS.map(signalKey => {
            const result = results[signalKey]?.result;
            const description = describeHistory(data, signalKey);
            return <tr key={signalKey}><th>{LABELS[signalKey]}</th>
              <td>{metric(signalKey, description.latest)}<small>{description.latestTime !== undefined ? date(description.latestTime) : 'Sem observação'}</small></td>
              {[30, 60, 90].map(day => { const point = result?.points[day - 1]; return <td key={day}>
                {metric(signalKey, point?.point)}{point && <small>{metric(signalKey, point.lower)} — {metric(signalKey, point.upper)}</small>}
              </td>; })}
              <td>{change(changePercent(description.latest, result?.points.at(-1)?.point))}</td>
              <td>{result?.validation ? <><span>Erro: {number(result.validation.wape, '%')}</span><small>Na faixa: {number(result.validation.intervalCoverage, '%')} dos dias</small></> : results[signalKey]?.loading ? 'Calculando…' : 'Indisponível'}</td>
            </tr>;
          })}</tbody></table></div>
          {FORECAST_KEYS.map(signalKey => {
            const status = results[signalKey];
            const validation = status?.result?.validation;
            return <React.Fragment key={signalKey}>
              {status?.error && <p className="growth-notice" role="status"><strong>{LABELS[signalKey]}:</strong> {status.error}</p>}
              {status?.result?.warnings.map((warning, index) => <p className="growth-notice" key={index}>{LABELS[signalKey]}: {warning}</p>)}
              {validation && ((validation.wape ?? 0) > 30 || validation.intervalCoverage < 70) && <p className="growth-notice">{LABELS[signalKey]}: a validação mostrou erro elevado ou baixa cobertura da faixa. Use a previsão com cautela no planejamento.</p>}
            </React.Fragment>;
          })}
        </Container>
        <SharedChartInteractions><div className="growth-charts">
          {FORECAST_KEYS.map(signalKey => <ForecastChart key={signalKey} history={data} signalKey={signalKey} forecast={results[signalKey]?.result} />)}
        </div></SharedChartInteractions>
        <Container><details className="growth-method"><summary>Modelo, validação e limites da análise</summary>
          <p>O forecast nativo do Dynatrace escolhe automaticamente entre um modelo sazonal por amostragem e extrapolação linear. São usadas 200 trajetórias, horizonte de 90 dias e cobertura-alvo de 90%. CPU, memória, throughput e resposta são previstos separadamente: correlação visual não implica causalidade.</p>
          <p>O histórico é sempre consultado desde 12 meses atrás até ontem, com um ponto diário. Lacunas permanecem ausentes; não viram zero. A previsão exige cobertura de pelo menos 80%, dados no primeiro mês e no último dia. Se a retenção não cobrir a janela, o sinal fica explicitamente sem previsão.</p>
          <p>A validação reserva os últimos 28 dias: o modelo é treinado somente com dias anteriores e comparado com os valores observados. Erro é WAPE (soma dos erros absolutos / soma dos valores reais); para valores todos zero, só o erro absoluto é definido. A validação de 28 dias não garante acurácia em 90 dias.</p>
          <p>CPU é uso dos containers em cores; memória é RSS em GiB. Requests são reservas, não consumo. As médias diárias não dimensionam picos intradiários. A referência de capacidade fica fixa; HPA, novos nodes e mudanças de aplicação não são previstos. Um único ano não permite validar repetição anual; o modelo pode aprender ciclos mais curtos.</p>
          <p>Referências: <a href="https://docs.dynatrace.com/docs/dynatrace-intelligence/reference/ai-models/forecast-analysis" target="_blank" rel="noreferrer">modelo nativo Dynatrace</a>, <a href="https://otexts.com/fpp3/holt-winters.html" target="_blank" rel="noreferrer">Holt-Winters / ETS</a> e <a href="https://facebook.github.io/prophet/docs/diagnostics.html" target="_blank" rel="noreferrer">validação temporal no Prophet</a>.</p>
        </details></Container>
      </>}
    </>}
  </div>;
}
