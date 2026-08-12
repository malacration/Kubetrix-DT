import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  kubernetesPodCpuThrottling,
  kubernetesPodResourceLimits,
  kubernetesPodResourceUsage,
  kubernetesWorkload,
} from 'app/services/k8s/WorkloadService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { ChartProps } from '../filters/BarChartProps';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import { Button } from '@dynatrace/strato-components/buttons';
import { CHART_COLORS, BASELINE_LABEL, currentBaselinePalette, podSeriesColor } from './style/ChartColors';
import { pickPairedResolutions, pickResolution } from 'app/components/timeframe/resolution';
import { convertQueryResultToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { isQueryResult } from 'app/services/core/GrailConverter';
import { Text } from '@dynatrace/strato-components/typography';
import { units } from '@dynatrace-sdk/units';
import { workloadPodBaseline, workloadPodLimitFallback } from './workload/WorkloadPodBaseline';
import {
  podResourceScopeAvailability,
  ResourceScope,
  ResourceScopeHeaderAction,
} from './workload/ResourceScopeToggle';
import {
  useHighlightedPod,
  useNodeSelected,
  useSetHighlightedPod,
  useSetNodeSelected,
} from '../context/FilterK8sContext';
import { podNodeSeriesActions, toPodNodeTimeseries } from './workload/PodNodeSeriesActions';
import {
  buildPodResourceThresholds,
  PodResourceThreshold,
} from './workload/PodResourceThreshold';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { FilterOutIcon, ThresholdIcon } from '@dynatrace/strato-icons';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from '../dashboard/DashboardWidgetHeaderActions';
import Colors from '@dynatrace/strato-design-tokens/colors';



interface WorkloadCpuUsageProps extends ChartProps {
  desejado?: boolean;
}

type PodThrottlingScope = 'general' | 'pod';

function aggregateThrottling(series: Timeseries[]): Timeseries | undefined {
  if (series.length === 0) return undefined;

  const datapoints = new Map<number, Timeseries['datapoints'][number]>();
  series.forEach(item => {
    item.datapoints.forEach(point => {
      const key = point.start.getTime();
      const current = datapoints.get(key);
      datapoints.set(key, {
        start: point.start,
        end: point.end,
        value: (current?.value ?? 0) + point.value,
      });
    });
  });

  return {
    name: ['Throttling geral'],
    unit: units.unspecified.millicore,
    datapoints: Array.from(datapoints.values()).sort(
      (left, right) => left.start.getTime() - right.start.getTime(),
    ),
  };
}

function WorkloadCpuUsage({
  filters,
  lastRefreshedAt,
  desejado = false,
  onHeaderActionsChange,
}: WorkloadCpuUsageProps) {
  const nodeSelected = useNodeSelected();
  const setNodeSelected = useSetNodeSelected();
  const highlightedPod = useHighlightedPod();
  const setHighlightedPod = useSetHighlightedPod();
  const [resourceScope, setResourceScope] = useState<ResourceScope>('workload');
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [throttled, setThrottled] = useState<Timeseries>();
  const [podThrottledSeries, setPodThrottledSeries] = useState<Timeseries[]>([]);
  const [podThresholds, setPodThresholds] = useState<PodResourceThreshold[]>([]);
  const [podThrottlingScope, setPodThrottlingScope] = useState<PodThrottlingScope>('general');
  const [currentName, setCurrentName] = useState('Atual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)
  const [threshold, setThreshold] = useState<number>(0);

  const [showThreshold, setShowThreshold] = useState<boolean>(true);
  const podAvailability = useMemo(
    () => podResourceScopeAvailability(filters),
    [filters],
  );
  const hasHighlightedPod = highlightedPod !== 'all';
  const activeResourceScope: ResourceScope =
    podAvailability.enabled && (resourceScope === 'pod' || hasHighlightedPod)
      ? 'pod'
      : 'workload';

  const changeResourceScope = useCallback((next: ResourceScope) => {
    if (next === 'workload') setHighlightedPod('all');
    setResourceScope(next);
  }, [setHighlightedPod]);

  // A seleção pode partir tanto deste gráfico quanto do gráfico de memória.
  // useLayoutEffect garante que o throttling já esteja no recorte por pod antes
  // de o navegador pintar o estado com o pod em evidência.
  useLayoutEffect(() => {
    if (hasHighlightedPod) setPodThrottlingScope('pod');
  }, [hasHighlightedPod, highlightedPod]);

  useEffect(() => {
    if (!podAvailability.enabled && resourceScope === 'pod') {
      setResourceScope('workload');
    }
  }, [podAvailability.enabled, resourceScope]);

  useEffect(() => {
    if (!filters) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setSeries([]);
      setThrottled(undefined);
      setPodThrottledSeries([]);
      setPodThresholds([]);
      setError(null);

      try {
        const { cluster, namespace, workload, timeframe, resolution } = {
          cluster:   filters.cluster?.value,
          namespace: filters.namespace?.value,
          workload:  filters.workload?.value,
          timeframe: filters.timeframe?.value,
          resolution: filters.resolution?.value,
        };

        if (!timeframe) return;

        // "now" e baseline calculadas juntas: garante que a baseline suba pra uma
        // resolução que a API de fato atende pra dado de até 21 dias atrás (mesmo
        // com resolução manual fina demais) e que "now" não fique absurdamente mais
        // fina que ela.
        const { now: nowResolution, baseline: baselineResolution } = pickPairedResolutions(timeframe, resolution);

        if (activeResourceScope === 'pod') {
          const [podResult, podThrottlingResult, podLimitsResult] = await Promise.all([
            kubernetesPodResourceUsage(
              'cpu', cluster as string, namespace as string, workload as string,
              timeframe as never, nowResolution, nodeSelected,
            ),
            kubernetesPodCpuThrottling(
              cluster as string, namespace as string, workload as string,
              timeframe as never, nowResolution, nodeSelected,
            ),
            kubernetesPodResourceLimits(
              'cpu', cluster as string, namespace as string, workload as string,
              timeframe as never, nowResolution, nodeSelected,
            ),
          ]);
          if (!isQueryResult(podResult)) throw new Error(podResult.error);

          const podSeries = convertQueryResultToTimeseries(podResult)
            .sort((left, right) => String(left.name).localeCompare(String(right.name)))
            .map((item, index) => ({
              ...toPodNodeTimeseries(item),
              color: podSeriesColor(index),
              unit: units.unspecified.millicore,
            }));

          let podThrottlingSeries: Timeseries[] = [];
          if (isQueryResult(podThrottlingResult)) {
            podThrottlingSeries = convertQueryResultToTimeseries(podThrottlingResult)
              .map(item => ({
                ...toPodNodeTimeseries(item, 'throttling'),
                unit: units.unspecified.millicore,
              }))
              .filter(item => item.datapoints.some(point => point.value > 0));
          } else {
            console.warn('Throttling por pod indisponível', podThrottlingResult.error);
          }

          const directPodLimits = Array.isArray(podLimitsResult) ? podLimitsResult : [];
          if (!Array.isArray(podLimitsResult)) {
            console.warn('Limites de CPU por pod indisponíveis', podLimitsResult.error);
          }
          const podNames = podSeries
            .map(item => item.podName)
            .filter((name): name is string => Boolean(name));
          const podsWithoutDirectLimit = podNames.some(
            pod => !directPodLimits.some(limit => limit.pod === pod),
          );

          let fallbackLimit: number | undefined;
          if (podsWithoutDirectLimit) {
            try {
              fallbackLimit = await workloadPodLimitFallback(
                'cpu', cluster as string, namespace as string, workload as string,
                timeframe as never, nowResolution,
              );
            } catch (fallbackError) {
              console.warn('Erro ao calcular limite estimado de CPU por pod', fallbackError);
            }
          }
          const resourceThresholds = buildPodResourceThresholds(
            podNames,
            directPodLimits,
            fallbackLimit,
          );

          let baselineSeries: Timeseries[] = [];
          try {
            const podBaseline = await workloadPodBaseline(
              'cpu',
              cluster as string,
              namespace as string,
              workload as string,
              timeframe as never,
              nowResolution,
              baselineResolution,
            );
            baselineSeries = podBaseline.series;
          } catch (baselineError) {
            console.warn('Erro ao calcular baseline de CPU por pod', baselineError);
          }

          if (cancelled) return;
          setThreshold(0);
          setSeries([...podSeries, ...baselineSeries]);
          setPodThrottledSeries(podThrottlingSeries);
          setPodThresholds(resourceThresholds);
          if (podSeries.length === 0) {
            setError('Nenhum dado por pod foi encontrado para os filtros e período selecionados.');
          }
          return;
        }

        const result = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)", false, undefined, nowResolution);
        // Baseline com a mesma janela de 21 dias (média de 7/14/21 dias atrás) usada
        // nos KPIs — não os 7 dias fixos de antes. cpu_usage é um gauge (média por
        // bucket, não soma acumulada), então, diferente do Throughput, não precisa de
        // renormalização por resolução ao suavizar.
        // Pods são efêmeros: comparar o nome de um pod atual com o mesmo nome há
        // 7/14/21 dias normalmente não produz uma baseline útil. No modo por pod,
        // a referência é aproximada pela baseline do workload / pods desejados.
        const baseline = await classicBaseLineBy(result, timeframe, "", "", 3, baselineResolution);
        const throttled = await kubernetesWorkload("cpu_throttled",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)", false, undefined, nowResolution);

        const name = workload?.toString() ?? "All";
        // Unidade passada explicitamente (igual ao Throughput com "Count"): sem isso,
        // metricDataToTimeseries tenta descobrir a unidade consultando a API pelo
        // metricId da série — que pra baseline é a expressão composta inteira
        // ((...):timeshift(-7d)+...)/3, não um metric ID válido, e a consulta some
        // com 404. A query já converte pra Cores via toUnit(MilliCores,Cores).
        const ts   = await result.metricDataToTimeseries(name, "Cores");
        const tsAgo = baseline ? await baseline.metricDataToTimeseries(BASELINE_LABEL, "Cores") : [];
        const tsThrottled = throttled ? await throttled.metricDataToTimeseries("Throttled", "Cores") : [];


        // Resolução própria, NÃO a "nowResolution" (pareada/suavizada com a
        // baseline): limits_cpu é um snapshot estático (limite do pod, não varia
        // minuto a minuto), buscado com :last. Com default(0,always), QUALQUER
        // bucket sem dado vira 0 — inclusive o último, se ainda estiver incompleto
        // no momento da consulta. Quanto mais grosso o bucket (ex.: 1h, que a
        // resolução pareada pode escolher pra timeframes maiores), maior a chance
        // do último bucket estar "em andamento" e :last pegar esse 0 em vez do
        // valor real — threshold sumia ou vinha errado por causa disso.
        const limits = await kubernetesWorkload(
          "limits_cpu",cluster, namespace, workload, timeframe,
          "max:fold(max):toUnit(MilliCores,Cores):last", false, undefined, pickResolution(0, timeframe, resolution)
        );

        if (cancelled) return;

        setThreshold(limits?.getFirstValueOfFirstMetric()?.value ?? 0)

        if (desejado && throttled) {
          result.plus(throttled)
        }

        setCurrentName(name);
        setSeries([...ts,...tsAgo,]);
        setThrottled(tsThrottled[0]);
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao buscar métricas', err);
          setError(err instanceof Error ? err.message : 'Erro ao consultar CPU por pod.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filters, lastRefreshedAt, activeResourceScope, desejado, nodeSelected]);

  const visibleSeries = useMemo(() => {
    if (activeResourceScope !== 'pod' || !hasHighlightedPod) return series;
    return series.map(item => {
      const podName = (item as ReturnType<typeof toPodNodeTimeseries>).podName;
      // Baseline e demais referências sem identidade de pod continuam visíveis.
      if (!podName || podName === highlightedPod) return item;

      // O Strato mantém séries sem datapoints na legenda. Assim a linha fica
      // oculta, mas o pod continua disponível para navegação e troca de foco.
      return {
        ...item,
        datapoints: [],
        color: Colors.Text.Neutral.Subdued,
      };
    });
  }, [activeResourceScope, hasHighlightedPod, highlightedPod, series]);

  const visiblePodThrottling = useMemo(() => {
    if (activeResourceScope !== 'pod') return [];
    const focusedSeries = hasHighlightedPod
      ? podThrottledSeries.map(item => {
        const podName = (item as ReturnType<typeof toPodNodeTimeseries>).podName;
        return podName === highlightedPod
          ? item
          : { ...item, datapoints: [], color: Colors.Text.Neutral.Subdued };
      })
      : podThrottledSeries;
    if (podThrottlingScope === 'pod') return focusedSeries;
    const seriesToAggregate = hasHighlightedPod
      ? podThrottledSeries.filter(
        item => (item as ReturnType<typeof toPodNodeTimeseries>).podName === highlightedPod,
      )
      : podThrottledSeries;
    const general = aggregateThrottling(seriesToAggregate);
    return general ? [general] : [];
  }, [
    activeResourceScope,
    hasHighlightedPod,
    highlightedPod,
    podThrottledSeries,
    podThrottlingScope,
  ]);

  const visiblePodThresholds = useMemo(() => {
    if (!hasHighlightedPod) return podThresholds;
    return podThresholds.filter(item => item.pods.includes(highlightedPod));
  }, [hasHighlightedPod, highlightedPod, podThresholds]);

  const visibleThresholdMax = useMemo(() => {
    if (!showThreshold) return 0;
    if (activeResourceScope === 'pod') {
      return visiblePodThresholds.reduce((current, item) => Math.max(current, item.value), 0);
    }
    return threshold;
  }, [activeResourceScope, showThreshold, threshold, visiblePodThresholds]);

  const resourceSeriesActions = useCallback(
    (item: unknown) => podNodeSeriesActions(item, {
      selectedNode: nodeSelected,
      onSelectNode: setNodeSelected,
      highlightedPod,
      onHighlightPod: setHighlightedPod,
    }),
    [highlightedPod, nodeSelected, setHighlightedPod, setNodeSelected],
  );

  const headerActions = useMemo(() => {
    const throttlingEnabled = activeResourceScope === 'pod';

    return (
      <DashboardWidgetHeaderActions>
        <ResourceScopeHeaderAction
          value={activeResourceScope}
          onChange={changeResourceScope}
          podAvailability={podAvailability}
        />

        <Tooltip
          text={hasHighlightedPod
            ? `Mostrar todos os pods. Em evidência: ${highlightedPod}`
            : 'Coloque um pod em evidência pela linha ou pela legenda do gráfico.'}
          placement="top"
        >
          <span style={{ display: 'inline-flex' }}>
            <DashboardWidgetHeaderActionGroup label="Pod">
              <Button
                size="condensed"
                color="primary"
                variant={hasHighlightedPod ? 'emphasized' : 'default'}
                style={dashboardWidgetHeaderButtonStyle(hasHighlightedPod)}
                disabled={!hasHighlightedPod}
                onClick={() => setHighlightedPod('all')}
              >
                <Button.Prefix><FilterOutIcon /></Button.Prefix>
                Todos
              </Button>
            </DashboardWidgetHeaderActionGroup>
          </span>
        </Tooltip>

        <Tooltip
          text={throttlingEnabled
            ? 'Escolha como agrupar o throttling'
            : 'Disponível somente ao exibir por Pods'}
          placement="top"
        >
          <span style={{ display: 'inline-flex' }}>
            <DashboardWidgetHeaderActionGroup label="Throttling">
              <Button
                size="condensed"
                color="primary"
                variant={podThrottlingScope === 'general' ? 'emphasized' : 'default'}
                style={dashboardWidgetHeaderButtonStyle(podThrottlingScope === 'general')}
                disabled={!throttlingEnabled}
                aria-pressed={podThrottlingScope === 'general'}
                onClick={() => setPodThrottlingScope('general')}
              >
                Geral
              </Button>
              <Button
                size="condensed"
                color="primary"
                variant={podThrottlingScope === 'pod' ? 'emphasized' : 'default'}
                style={dashboardWidgetHeaderButtonStyle(podThrottlingScope === 'pod')}
                disabled={!throttlingEnabled}
                aria-pressed={podThrottlingScope === 'pod'}
                onClick={() => setPodThrottlingScope('pod')}
              >
                Pods
              </Button>
            </DashboardWidgetHeaderActionGroup>
          </span>
        </Tooltip>

        <DashboardWidgetHeaderActionGroup>
          <Tooltip
            text={showThreshold ? 'Ocultar threshold' : 'Mostrar threshold'}
            placement="top"
          >
            <Button
              size="condensed"
              color="primary"
              variant={showThreshold ? 'emphasized' : 'default'}
              style={dashboardWidgetHeaderButtonStyle(showThreshold)}
              aria-pressed={showThreshold}
              aria-label={showThreshold ? 'Ocultar threshold' : 'Mostrar threshold'}
              onClick={() => setShowThreshold(current => !current)}
            >
              <Button.Prefix><ThresholdIcon /></Button.Prefix>
              Threshold
            </Button>
          </Tooltip>
        </DashboardWidgetHeaderActionGroup>
      </DashboardWidgetHeaderActions>
    );
  }, [
    activeResourceScope,
    changeResourceScope,
    hasHighlightedPod,
    highlightedPod,
    podAvailability,
    podThrottlingScope,
    setHighlightedPod,
    showThreshold,
  ]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

  useEffect(() => {
    const arr = [
      ...visibleSeries,
      ...visiblePodThrottling,
      ...(throttled != null ? [throttled] : []),
    ];
    let minMax : { min, max }
    if(showThreshold){
      minMax = new TimeSeriesMinMax(arr,visibleThresholdMax).padded
      setMax(Math.max(minMax.max, visibleThresholdMax))
    }
    else{
      minMax = new TimeSeriesMinMax(arr).padded
      setMax(minMax.max)
    }
      setMin(Math.min(minMax.min))
  },[visibleSeries,showThreshold,throttled,visiblePodThrottling,visibleThresholdMax])

  return (
    <div>
    {!onHeaderActionsChange && headerActions}
    {activeResourceScope === 'pod' && error && (
      <Text style={{ color: '#c81920', marginBottom: 8 }}>{error}</Text>
    )}
    <TimeseriesChart
      loading={loading}
      data={visibleSeries}
      height={300}
      colorPalette={currentBaselinePalette(currentName)}
      seriesActions={activeResourceScope === 'pod' ? resourceSeriesActions : undefined}
    >
        {activeResourceScope === 'workload' && throttled && (
          <TimeseriesChart.Bar data={throttled} color={CHART_COLORS.critical} />
        )}
        {visiblePodThrottling.map(item => (
          <TimeseriesChart.Bar
            key={Array.isArray(item.name) ? item.name.join('|') : item.name}
            data={item}
            color={item.color as string | undefined ?? CHART_COLORS.critical}
          />
        ))}
        <TimeseriesChart.YAxis min={min} max={max} />
        {activeResourceScope === 'workload' && showThreshold && (
          <TimeseriesChart.Threshold
            data={{ value: threshold }}
            color={CHART_COLORS.threshold}
            label="Limits"
          />
        )}
        {activeResourceScope === 'pod' && showThreshold && visiblePodThresholds.map(item => (
          <TimeseriesChart.Threshold
            key={`${item.label}-${item.value}`}
            data={{ value: item.value }}
            color={CHART_COLORS.threshold}
            label={item.label}
          />
        ))}
        <TimeseriesChart.Legend position="bottom" />
      </TimeseriesChart>
      </div>
  );
}


(WorkloadCpuUsage as any).dashboardWidget = true;

export { WorkloadCpuUsage };
