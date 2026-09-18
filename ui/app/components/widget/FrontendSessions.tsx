import { CHART_COLORS, podSeriesColor } from './style/ChartColors';
import React, { useEffect, useMemo, useState } from 'react';
import { Select } from '@dynatrace/strato-components-preview/forms';
import { TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { ChartProps } from '../filters/BarChartProps';
import { discoverSessionFrontends, FrontendOption, FrontendScope, loadFrontendSessions } from 'app/services/FrontendSessions';

function ScopedSessions({ filters, lastRefreshedAt, scope }: ChartProps & { scope: FrontendScope }) {
  const timeframe = filters?.timeframe?.value as Timeframe | undefined;
  const resolution = filters?.resolution?.value as string | undefined;
  const requestKey = JSON.stringify([scope, timeframe, lastRefreshedAt]);
  const [discovery, setDiscovery] = useState<{ key: string; options: FrontendOption[]; error?: string }>();
  const [selection, setSelection] = useState<string[] | null>(null);
  const [mode, setMode] = useState('total');
  const options = useMemo(() => discovery?.key === requestKey ? discovery.options : [], [discovery, requestKey]);
  const selected = useMemo(() => options.filter(f => selection === null || selection.includes(f.id)), [options, selection]);
  const metricKey = JSON.stringify([requestKey, selected.map(f => f.id), resolution]);
  const [metrics, setMetrics] = useState<{ key: string; data?: Awaited<ReturnType<typeof loadFrontendSessions>>; error?: string }>();

  useEffect(() => {
    if (!timeframe) return;
    let cancelled = false;
    discoverSessionFrontends(scope, timeframe).then(options => {
      if (!cancelled) setDiscovery({ key: requestKey, options });
    }).catch(error => {
      if (!cancelled) setDiscovery({ key: requestKey, options: [], error: String(error.message ?? error) });
    });
    return () => { cancelled = true; };
  }, [requestKey, scope, timeframe]);

  useEffect(() => {
    if (!timeframe || !selected.length) return;
    let cancelled = false;
    loadFrontendSessions(selected, timeframe, resolution).then(data => {
      if (!cancelled) setMetrics({ key: metricKey, data });
    }).catch(error => {
      if (!cancelled) setMetrics({ key: metricKey, error: String(error.message ?? error) });
    });
    return () => { cancelled = true; };
  }, [metricKey, selected, timeframe, resolution]);

  const current = metrics?.key === metricKey ? metrics : undefined;
  const discovering = !!timeframe && discovery?.key !== requestKey;
  const error = discovery?.key === requestKey ? discovery.error || current?.error : undefined;
  const data = current?.data?.[mode === 'total' ? 'total' : 'individual'] ?? [];
  const baseline = current?.data?.[mode === 'total' ? 'baselineTotal' : 'baselineIndividual'] ?? [];
  const palette = Object.fromEntries([...data.map((s, i) => [s.name, podSeriesColor(i)]), ...baseline.map(s => [s.name, CHART_COLORS.baseline])]);
  return <div style={{ width: '100%' }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
      <Select multiple clearable value={selected.map(f => f.id)} onChange={value => setSelection(Array.isArray(value) ? value : [])}>
        <Select.Filter />
        <Select.Trigger aria-label="Frontends" placeholder="Selecione os frontends" style={{ minWidth: 260 }} />
        <Select.Content loading={discovering} showSelectedOptionsFirst>
          {options.map(f => <Select.Option key={f.id} value={f.id} textValue={f.name}>{f.name}</Select.Option>)}
        </Select.Content>
      </Select>
      <button type="button" onClick={() => setSelection(null)}>Todos</button>
      <span>{selected.length} de {options.length} frontends</span>
      <Select value={mode} onChange={value => setMode(String(value))}>
        <Select.Trigger aria-label="Visualização das sessões" />
        <Select.Content>
          <Select.Option value="total">Total selecionado</Select.Option>
          <Select.Option value="individual">Por frontend</Select.Option>
        </Select.Content>
      </Select>
    </div>
    <p>Sessões com atividade confirmada em cada intervalo (estimativa RUM), não sessões de login abertas.
      Os filtros Kubernetes identificam os frontends vinculados aos serviços; a contagem inclui toda a atividade desses frontends.</p>
    {error ? <p role="alert">Não foi possível consultar sessões: {error}</p>
      : !timeframe ? <p>Selecione um período.</p>
      : discovering ? <p role="status">Buscando frontends relacionados…</p>
      : !options.length ? <p>Nenhum frontend relacionado aos serviços deste filtro.</p>
      : !selected.length ? <p>Selecione um ou mais frontends para visualizar as sessões.</p>
      : <>
        {current && !data.some(s => s.datapoints.length) && <p>Sem dados de sessões no período selecionado.</p>}
        <TimeseriesChart data={[...data, ...baseline]} colorPalette={palette} loading={!current} gapPolicy="gap">
          <TimeseriesChart.YAxis min={0} />
          <TimeseriesChart.Legend position="bottom" />
        </TimeseriesChart>
        {current?.data?.notices?.map(notice => <p role="status" key={notice}>{notice}</p>)}
        {current?.data && !baseline.some(s => s.datapoints.length) && <p>Baseline indisponível: sem histórico completo das três semanas de referência para esta seleção.</p>}
        <p>Baseline (21d): média dos mesmos intervalos de 7, 14 e 21 dias atrás, para os frontends selecionados. Atual e baseline usam a mesma resolução; lacunas históricas não são tratadas como zero.</p>
        {current?.data && <small>Intervalo: {current.data.resolution}. Total calculado pela métrica de cardinalidade, sem somar contagens dos frontends.</small>}
      </>}
  </div>;
}

export const FrontendSessions = Object.assign(function FrontendSessions(props: ChartProps) {
  const cluster = props.filters?.cluster?.value as string | undefined;
  const namespace = props.filters?.namespace?.value as string | undefined;
  const workload = props.filters?.workload?.value as string | undefined;
  const scope = useMemo(() => ({ cluster, namespace, workload }), [cluster, namespace, workload]);
  return <ScopedSessions key={JSON.stringify(scope)} {...props} scope={scope} />;
}, { dashboardWidget: true });
