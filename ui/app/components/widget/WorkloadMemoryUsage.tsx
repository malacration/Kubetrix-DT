import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartProps } from '../filters/BarChartProps';
import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import {
  kubernetesPodResourceLimits,
  kubernetesPodResourceUsage,
  kubernetesWorkload,
} from 'app/services/k8s/WorkloadService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
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


type WorkloadMemoryUsageProps = ChartProps;

function WorkloadMemoryUsage({
  filters,
  lastRefreshedAt,
  onHeaderActionsChange,
}: WorkloadMemoryUsageProps) {
  const nodeSelected = useNodeSelected();
  const setNodeSelected = useSetNodeSelected();
  const highlightedPod = useHighlightedPod();
  const setHighlightedPod = useSetHighlightedPod();
  const [resourceScope, setResourceScope] = useState<ResourceScope>('workload');
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [currentName, setCurrentName] = useState('Atual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState<number>(0);
  const [podThresholds, setPodThresholds] = useState<PodResourceThreshold[]>([]);
  const [showThreshold, setShowThreshold] = useState<boolean>(true);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)
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
          const [podResult, podLimitsResult] = await Promise.all([
            kubernetesPodResourceUsage(
              'memory', cluster as string, namespace as string, workload as string,
              timeframe as never, nowResolution, nodeSelected,
            ),
            kubernetesPodResourceLimits(
              'memory', cluster as string, namespace as string, workload as string,
              timeframe as never, nowResolution, nodeSelected,
            ),
          ]);
          if (!isQueryResult(podResult)) throw new Error(podResult.error);

          const podSeries = convertQueryResultToTimeseries(podResult)
            .sort((left, right) => String(left.name).localeCompare(String(right.name)))
            .map((item, index) => ({
              ...toPodNodeTimeseries(item),
              color: podSeriesColor(index),
              unit: units.data.byte,
            }));

          const directPodLimits = Array.isArray(podLimitsResult) ? podLimitsResult : [];
          if (!Array.isArray(podLimitsResult)) {
            console.warn('Limites de memória por pod indisponíveis', podLimitsResult.error);
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
                'memory', cluster as string, namespace as string, workload as string,
                timeframe as never, nowResolution,
              );
            } catch (fallbackError) {
              console.warn('Erro ao calcular limite estimado de memória por pod', fallbackError);
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
              'memory',
              cluster as string,
              namespace as string,
              workload as string,
              timeframe as never,
              nowResolution,
              baselineResolution,
            );
            baselineSeries = podBaseline.series;
          } catch (baselineError) {
            console.warn('Erro ao calcular baseline de memória por pod', baselineError);
          }

          if (cancelled) return;
          setThreshold(0);
          setSeries([...podSeries, ...baselineSeries]);
          setPodThresholds(resourceThresholds);
          if (podSeries.length === 0) {
            setError('Nenhum dado por pod foi encontrado para os filtros e período selecionados.');
          }
          return;
        }

        const result = await kubernetesWorkload("memory_working_set",cluster, namespace, workload, timeframe, "sum:toUnit(Byte,GibiByte)", false, undefined, nowResolution);
        // Baseline com a mesma janela de 21 dias (média de 7/14/21 dias atrás) usada
        // nos KPIs — não os 7 dias fixos de antes. memory_working_set é um gauge
        // (média por bucket, não soma acumulada), então não precisa de
        // renormalização por resolução ao suavizar (diferente do Throughput).
        const baseline = await classicBaseLineBy(result, timeframe, "", "", 3, baselineResolution);

        const name = workload?.toString() ?? "All";
        // Unidade explícita (mesmo motivo do WorkloadCpuUsage.tsx): sem isso,
        // metricDataToTimeseries tenta buscar a unidade na API usando o metricId da
        // baseline, que é a expressão composta ((...):timeshift(-7d)+...)/3 — não um
        // metric ID válido — e a consulta falha com 404. Já convertida pra GibiByte
        // via toUnit(Byte,GibiByte).
        const ts   = await result.metricDataToTimeseries(name, "GibiByte");
        const tsAgo = baseline ? await baseline.metricDataToTimeseries(BASELINE_LABEL, "GibiByte") : [];


        // Resolução própria, NÃO a "nowResolution" (pareada/suavizada com a
        // baseline): limits_memory é um snapshot estático (limite do pod, não varia
        // minuto a minuto), buscado com :last. Com default(0,always), QUALQUER
        // bucket sem dado vira 0 — inclusive o último, se ainda estiver incompleto
        // no momento da consulta. Quanto mais grosso o bucket (ex.: 1h, que a
        // resolução pareada pode escolher pra timeframes maiores), maior a chance
        // do último bucket estar "em andamento" e :last pegar esse 0 em vez do
        // valor real — threshold sumia ou vinha errado por causa disso.
        const limits = await kubernetesWorkload(
          "limits_memory",cluster, namespace,
          workload, timeframe,
          "max:default(0,always):fold(max):toUnit(Byte,GibiByte):last", false, undefined, pickResolution(0, timeframe, resolution)
        );

        if (cancelled) return;

        setThreshold(limits?.getFirstValueOfFirstMetric()?.value ?? 0)

        setCurrentName(name);
        setSeries([...ts,...tsAgo]);
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao buscar métricas', err);
          setError(err instanceof Error ? err.message : 'Erro ao consultar memória por pod.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filters,lastRefreshedAt,activeResourceScope,nodeSelected]);

  const visibleSeries = useMemo(() => {
    if (activeResourceScope !== 'pod' || !hasHighlightedPod) return series;
    return series.map(item => {
      const podName = (item as ReturnType<typeof toPodNodeTimeseries>).podName;
      // A baseline não possui identidade de pod e continua como referência.
      if (!podName || podName === highlightedPod) return item;

      // Mantém o pod na legenda, mas sem desenhar sua linha enquanto outro pod
      // estiver em evidência.
      return {
        ...item,
        datapoints: [],
        color: Colors.Text.Neutral.Subdued,
      };
    });
  }, [activeResourceScope, hasHighlightedPod, highlightedPod, series]);

  const visiblePodThresholds = useMemo(() => {
    if (!hasHighlightedPod) return podThresholds;
    return podThresholds.filter(item => item.pods.includes(highlightedPod));
  }, [hasHighlightedPod, highlightedPod, podThresholds]);

  useEffect(() => {
    const visibleThreshold = activeResourceScope === 'pod'
      ? visiblePodThresholds.reduce((current, item) => Math.max(current, item.value), 0)
      : threshold;
    const minMax = new TimeSeriesMinMax(visibleSeries, showThreshold ? visibleThreshold : 0)
    setMin(minMax.rawMin)
    if(showThreshold)
      setMax(Math.max(minMax.rawMax, visibleThreshold))
    else
      setMax(minMax.rawMax)
  },[activeResourceScope,visiblePodThresholds,visibleSeries,threshold,showThreshold])

  const resourceSeriesActions = useCallback(
    (item: unknown) => podNodeSeriesActions(item, {
      selectedNode: nodeSelected,
      onSelectNode: setNodeSelected,
      highlightedPod,
      onHighlightPod: setHighlightedPod,
    }),
    [highlightedPod, nodeSelected, setHighlightedPod, setNodeSelected],
  );

  const headerActions = useMemo(() => (
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
  ), [
    activeResourceScope,
    changeResourceScope,
    hasHighlightedPod,
    highlightedPod,
    podAvailability,
    setHighlightedPod,
    showThreshold,
  ]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

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
        { activeResourceScope === 'workload' && showThreshold ?
            <TimeseriesChart.Threshold
            data={{ value: threshold }}
            color={CHART_COLORS.threshold}
            label="Limits"></TimeseriesChart.Threshold>
            : <></>
        }
        {activeResourceScope === 'pod' && showThreshold && visiblePodThresholds.map(item => (
          <TimeseriesChart.Threshold
            key={`${item.label}-${item.value}`}
            data={{ value: item.value }}
            color={CHART_COLORS.threshold}
            label={item.label}
          />
        ))}
        <TimeseriesChart.YAxis min={min * 0.95} max={max * 1.05} />
        <TimeseriesChart.Legend position="bottom" />
        </TimeseriesChart>
      </div>
  );
}


(WorkloadMemoryUsage as any).dashboardWidget = true;

export { WorkloadMemoryUsage };
