import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChartSeriesAction,
  Timeseries,
  TimeseriesChart,
} from '@dynatrace/strato-components-preview/charts';
import {
  convertQueryResultToTimeseries,
  TimeseriesWithDimensions,
} from '@dynatrace/strato-components-preview/conversion-utilities';
import { Button } from '@dynatrace/strato-components/buttons';
import { Chip } from '@dynatrace/strato-components-preview/content';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { CopyIcon, FilterIcon, FilterOutIcon } from '@dynatrace/strato-icons';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { units } from '@dynatrace-sdk/units';
import { ChartProps } from '../../filters/BarChartProps';
import { useNodeSelected, useSetNodeSelected } from 'app/components/context/FilterK8sContext';
import { podSeriesColor } from 'app/components/widget/style/ChartColors';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import { isQueryResult } from 'app/services/core/GrailConverter';
import {
  NodeAllocatable,
  nodesAllocatableCapacity,
  nodesResourceUsageOverTime,
} from 'app/services/k8s/NodeServices';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from 'app/components/dashboard/DashboardWidgetHeaderActions';

interface NodeTimeseries extends Timeseries {
  nodeName?: string;
}

type ResourceScale = 'absolute' | 'percentage';

interface CapacityThreshold {
  value: number;
  label: string;
}

function dimensionValue(series: TimeseriesWithDimensions, fieldName: string): string | undefined {
  const value = series.userData.dimensions.find(
    dimension => dimension.field.name === fieldName,
  )?.value;

  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

function nodeNameOf(series: TimeseriesWithDimensions): string {
  return dimensionValue(series, 'node')
    ?? (Array.isArray(series.name) ? String(series.name[0]) : String(series.name));
}

function copy(value: string) {
  void navigator.clipboard.writeText(value);
}

function capacityMap(
  capacities: NodeAllocatable[],
  resource: 'cpu' | 'memory',
): Map<string, number> {
  return new Map(capacities.flatMap(item => {
    const value = item[resource];
    return value != null && Number.isFinite(value) && value > 0
      ? [[item.node, value] as const]
      : [];
  }));
}

function percentageSeries(
  series: NodeTimeseries[],
  capacities: Map<string, number>,
): NodeTimeseries[] {
  return series.flatMap(item => {
    const capacity = item.nodeName ? capacities.get(item.nodeName) : undefined;
    if (!capacity) return [];
    return [{
      ...item,
      unit: units.percentage.percent,
      datapoints: item.datapoints.map(point => ({
        ...point,
        value: (point.value / capacity) * 100,
      })),
    }];
  });
}

/** Agrupa nodes de mesma capacidade para não duplicar thresholds idênticos. */
function capacityThresholds(
  series: NodeTimeseries[],
  capacities: Map<string, number>,
): CapacityThreshold[] {
  const grouped = new Map<number, string[]>();
  series.forEach(item => {
    if (!item.nodeName) return;
    const value = capacities.get(item.nodeName);
    if (!value) return;
    grouped.set(value, [...(grouped.get(value) ?? []), item.nodeName]);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([value, nodes]) => ({
      value,
      label: nodes.length === 1
        ? `${nodes[0]} · alocável`
        : `${nodes.length} nodes · alocável`,
    }));
}

/**
 * Compara o consumo agregado dos containers de cada node.
 * Um node pressionado junto do throttling aponta para contenção no node; throttling
 * com o node folgado aponta para o limite/cgroup configurado no Kubernetes.
 */
function WorkloadNodeResourceUsage({
  filters,
  lastRefreshedAt,
  onHeaderActionsChange,
}: ChartProps) {
  const [cpuSeries, setCpuSeries] = useState<NodeTimeseries[]>([]);
  const [memorySeries, setMemorySeries] = useState<NodeTimeseries[]>([]);
  const [allocatable, setAllocatable] = useState<NodeAllocatable[]>([]);
  const [resourceScale, setResourceScale] = useState<ResourceScale>('absolute');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nodeSelected = useNodeSelected();
  const setNodeSelected = useSetNodeSelected();

  useEffect(() => {
    if (!filters) return;

    let cancelled = false;
    const cluster = filters.cluster?.value as string | undefined;
    const timeframe = filters.timeframe?.value;
    const resolution = filters.resolution?.value as string | undefined;

    if (!timeframe) {
      setCpuSeries([]);
      setMemorySeries([]);
      setAllocatable([]);
      setError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      setCpuSeries([]);
      setMemorySeries([]);
      setAllocatable([]);

      try {
        const [cpuResult, memoryResult, capacityResult] = await Promise.all([
          nodesResourceUsageOverTime(
            'cpu', cluster, timeframe as never, resolution, nodeSelected,
          ),
          nodesResourceUsageOverTime(
            'memory', cluster, timeframe as never, resolution, nodeSelected,
          ),
          nodesAllocatableCapacity(cluster, timeframe as never),
        ]);
        const cpuConverted = isQueryResult(cpuResult)
          ? convertQueryResultToTimeseries(cpuResult)
          : [];
        const memoryConverted = isQueryResult(memoryResult)
          ? convertQueryResultToTimeseries(memoryResult)
          : [];
        const converted = [...cpuConverted, ...memoryConverted];
        const nodeNames = Array.from(new Set(converted.map(nodeNameOf))).sort(
          (left, right) => left.localeCompare(right),
        );
        const colors = new Map(nodeNames.map((node, index) => [node, podSeriesColor(index)]));
        const toNodeTimeseries = (
          item: TimeseriesWithDimensions,
          unit: Timeseries['unit'],
        ): NodeTimeseries => {
          const nodeName = nodeNameOf(item);
          return {
            ...item,
            name: nodeName,
            nodeName,
            color: colors.get(nodeName),
            unit,
          };
        };

        const cpu = cpuConverted.map(item => toNodeTimeseries(
          item, units.unspecified.millicore,
        ));
        const memory = memoryConverted.map(item => toNodeTimeseries(
          item, units.data.byte,
        ));

        if (!cancelled) {
          setCpuSeries(cpu);
          setMemorySeries(memory);
          setAllocatable(capacityResult);
          const failures = [
            !isQueryResult(cpuResult) ? `CPU: ${cpuResult.error}` : '',
            !isQueryResult(memoryResult) ? `Memória: ${memoryResult.error}` : '',
          ].filter(Boolean);
          if (failures.length > 0) {
            setError(failures.join(' · '));
          } else if (cpu.length === 0 && memory.length === 0) {
            setError('Nenhum uso de CPU ou memória foi encontrado para os nodes no período selecionado.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao buscar uso temporal dos nodes', err);
          setError(err instanceof Error ? err.message : 'Erro ao consultar o uso dos nodes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [filters, lastRefreshedAt, nodeSelected]);

  const seriesActions = useCallback((series: unknown) => {
    const nodeName = (series as NodeTimeseries).nodeName;
    if (!nodeName) return <></>;

    return (
      <ChartSeriesAction aria-label="Ações do node">
        <ChartSeriesAction.Label>Node: {nodeName}</ChartSeriesAction.Label>
        <ChartSeriesAction.Item onSelect={() => copy(nodeName)}>
          <ChartSeriesAction.ItemIcon><CopyIcon /></ChartSeriesAction.ItemIcon>
          Copiar node
        </ChartSeriesAction.Item>
        {nodeSelected !== nodeName ? (
          <ChartSeriesAction.Item onSelect={() => setNodeSelected(nodeName)}>
            <ChartSeriesAction.ItemIcon><FilterIcon /></ChartSeriesAction.ItemIcon>
            Filtrar por este node
          </ChartSeriesAction.Item>
        ) : (
          <ChartSeriesAction.Item onSelect={() => setNodeSelected('all')}>
            <ChartSeriesAction.ItemIcon><FilterOutIcon /></ChartSeriesAction.ItemIcon>
            Limpar filtro do node
          </ChartSeriesAction.Item>
        )}
      </ChartSeriesAction>
    );
  }, [nodeSelected, setNodeSelected]);

  const selectedNode = nodeSelected && nodeSelected !== 'all' ? nodeSelected : undefined;
  const headerActions = useMemo(() => (
    <DashboardWidgetHeaderActions>
      <DashboardWidgetHeaderActionGroup label="Escala">
        <Button
          size="condensed"
          color="primary"
          variant={resourceScale === 'absolute' ? 'emphasized' : 'default'}
          style={dashboardWidgetHeaderButtonStyle(resourceScale === 'absolute')}
          aria-pressed={resourceScale === 'absolute'}
          onClick={() => setResourceScale('absolute')}
        >
          Valor
        </Button>
        <Button
          size="condensed"
          color="primary"
          variant={resourceScale === 'percentage' ? 'emphasized' : 'default'}
          style={dashboardWidgetHeaderButtonStyle(resourceScale === 'percentage')}
          aria-pressed={resourceScale === 'percentage'}
          onClick={() => setResourceScale('percentage')}
        >
          Percentual
        </Button>
      </DashboardWidgetHeaderActionGroup>
      <DashboardWidgetHeaderActionGroup label="Node">
        <Button
          size="condensed"
          color="primary"
          variant={selectedNode ? 'emphasized' : 'default'}
          style={dashboardWidgetHeaderButtonStyle(Boolean(selectedNode))}
          disabled={!selectedNode}
          onClick={() => setNodeSelected('all')}
        >
          <Button.Prefix><FilterOutIcon /></Button.Prefix>
          Limpar recorte
        </Button>
      </DashboardWidgetHeaderActionGroup>
    </DashboardWidgetHeaderActions>
  ), [resourceScale, selectedNode, setNodeSelected]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

  const cpuCapacity = useMemo(() => capacityMap(allocatable, 'cpu'), [allocatable]);
  const memoryCapacity = useMemo(() => capacityMap(allocatable, 'memory'), [allocatable]);
  const visibleCpuSeries = useMemo(
    () => resourceScale === 'absolute'
      ? cpuSeries
      : percentageSeries(cpuSeries, cpuCapacity),
    [cpuCapacity, cpuSeries, resourceScale],
  );
  const visibleMemorySeries = useMemo(
    () => resourceScale === 'absolute'
      ? memorySeries
      : percentageSeries(memorySeries, memoryCapacity),
    [memoryCapacity, memorySeries, resourceScale],
  );
  const cpuThresholds = useMemo(
    () => capacityThresholds(cpuSeries, cpuCapacity),
    [cpuCapacity, cpuSeries],
  );
  const memoryThresholds = useMemo(
    () => capacityThresholds(memorySeries, memoryCapacity),
    [memoryCapacity, memorySeries],
  );
  const cpuYAxis = useMemo(() => ({
    min: 0,
    max: resourceScale === 'absolute'
      ? Math.max(new TimeSeriesMinMax(cpuSeries).rawMax, ...cpuThresholds.map(item => item.value))
      : Math.max(100, new TimeSeriesMinMax(visibleCpuSeries).rawMax),
  }), [cpuSeries, cpuThresholds, resourceScale, visibleCpuSeries]);
  const memoryYAxis = useMemo(() => ({
    min: 0,
    max: resourceScale === 'absolute'
      ? Math.max(new TimeSeriesMinMax(memorySeries).rawMax, ...memoryThresholds.map(item => item.value))
      : Math.max(100, new TimeSeriesMinMax(visibleMemorySeries).rawMax),
  }), [memorySeries, memoryThresholds, resourceScale, visibleMemorySeries]);
  const missingCapacity = resourceScale === 'percentage' && (
    visibleCpuSeries.length < cpuSeries.length ||
    visibleMemorySeries.length < memorySeries.length
  );

  return (
    <Flex flexDirection="column" gap={8}>
      {!onHeaderActionsChange && headerActions}
      <Text>
        {resourceScale === 'absolute'
          ? 'Consumo total dos containers; o eixo usa a capacidade alocável total dos nodes.'
          : 'Percentual do consumo dos containers sobre a capacidade alocável de cada node.'}
      </Text>
      {selectedNode && (
        <Chip color="primary">node: {selectedNode}</Chip>
      )}
      {error && <Text style={{ color: '#c81920' }}>{error}</Text>}
      {missingCapacity && (
        <Text style={{ color: '#8a5d00' }}>
          Alguns nodes não possuem capacidade alocável disponível e foram omitidos no percentual.
        </Text>
      )}
      <Flex flexDirection="row" flexWrap="wrap" width="100%" gap={16}>
        <Flex flexDirection="column" gap={4} style={{ minWidth: '24rem', flex: '1 1 24rem' }}>
          <Heading level={5}>CPU utilizada por node</Heading>
          <TimeseriesChart
            loading={loading}
            data={visibleCpuSeries}
            height={300}
            seriesActions={seriesActions}
          >
            <TimeseriesChart.YAxis min={cpuYAxis.min} max={cpuYAxis.max} />
            {resourceScale === 'absolute' && cpuThresholds.map(item => (
              <TimeseriesChart.Threshold
                key={`${item.label}-${item.value}`}
                data={{ value: item.value }}
                color={Colors.Charts.Threshold.Bad.Default}
                label={item.label}
              />
            ))}
            {resourceScale === 'percentage' && (
              <TimeseriesChart.Threshold
                data={{ value: 100 }}
                color={Colors.Charts.Threshold.Bad.Default}
                label="Capacidade alocável"
              />
            )}
            <TimeseriesChart.Legend position="bottom" />
          </TimeseriesChart>
        </Flex>

        <Flex flexDirection="column" gap={4} style={{ minWidth: '24rem', flex: '1 1 24rem' }}>
          <Heading level={5}>Memória utilizada por node</Heading>
          <TimeseriesChart
            loading={loading}
            data={visibleMemorySeries}
            height={300}
            seriesActions={seriesActions}
          >
            <TimeseriesChart.YAxis min={memoryYAxis.min} max={memoryYAxis.max} />
            {resourceScale === 'absolute' && memoryThresholds.map(item => (
              <TimeseriesChart.Threshold
                key={`${item.label}-${item.value}`}
                data={{ value: item.value }}
                color={Colors.Charts.Threshold.Bad.Default}
                label={item.label}
              />
            ))}
            {resourceScale === 'percentage' && (
              <TimeseriesChart.Threshold
                data={{ value: 100 }}
                color={Colors.Charts.Threshold.Bad.Default}
                label="Capacidade alocável"
              />
            )}
            <TimeseriesChart.Legend position="bottom" />
          </TimeseriesChart>
        </Flex>
      </Flex>
    </Flex>
  );
}

Object.assign(WorkloadNodeResourceUsage, { dashboardWidget: true });

export { WorkloadNodeResourceUsage };
