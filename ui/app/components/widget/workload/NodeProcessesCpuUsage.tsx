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
import { Text } from '@dynatrace/strato-components/typography';
import { CopyIcon, FilterOutIcon } from '@dynatrace/strato-icons';
import { units } from '@dynatrace-sdk/units';
import { ChartProps } from 'app/components/filters/BarChartProps';
import {
  useNodeSelected,
  useSetNodeSelected,
} from 'app/components/context/FilterK8sContext';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from 'app/components/dashboard/DashboardWidgetHeaderActions';
import { podSeriesColor } from 'app/components/widget/style/ChartColors';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import { isQueryResult } from 'app/services/core/GrailConverter';
import {
  nodeHostNames,
  nodeProcessesCpuUsageOverTime,
} from 'app/services/k8s/NodeServices';

interface ProcessTimeseries extends Timeseries {
  processName?: string;
  hostName?: string;
}

function dimensionValue(series: TimeseriesWithDimensions, fieldName: string): string | undefined {
  const value = series.userData.dimensions.find(
    dimension => dimension.field.name === fieldName,
  )?.value;

  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

function selectedNodeNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .filter(node => node.trim() !== '' && node !== 'all');
  }
  return typeof value === 'string' && value.trim() !== '' && value !== 'all'
    ? [value]
    : [];
}

function copy(value: string) {
  void navigator.clipboard.writeText(value);
}

function average(series: Timeseries): number {
  if (series.datapoints.length === 0) return 0;
  return series.datapoints.reduce((total, point) => total + point.value, 0)
    / series.datapoints.length;
}

/** CPU dos processos do host que sustenta exatamente um node Kubernetes. */
function NodeProcessesCpuUsage({
  filters,
  lastRefreshedAt,
  onHeaderActionsChange,
}: ChartProps) {
  const nodeSelected = useNodeSelected();
  const setNodeSelected = useSetNodeSelected();
  const selectedNodes = useMemo(() => selectedNodeNames(nodeSelected), [nodeSelected]);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  const [series, setSeries] = useState<ProcessTimeseries[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filters || !selectedNode) {
      setSeries([]);
      setHosts([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timeframe = filters.timeframe?.value;
    const cluster = filters.cluster?.value as string | undefined;
    const resolution = filters.resolution?.value as string | undefined;
    if (!timeframe) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setSeries([]);
      setHosts([]);
      setError(null);

      try {
        const [result, hostResult] = await Promise.all([
          nodeProcessesCpuUsageOverTime(
            selectedNode,
            cluster,
            timeframe as never,
            resolution,
          ),
          nodeHostNames(selectedNode, cluster, timeframe as never),
        ]);
        if (!isQueryResult(result)) throw new Error(result.error);

        const resolvedHosts = isQueryResult(hostResult)
          ? Array.from(new Set(
            (hostResult.records ?? [])
              .map(record => record?.host)
              .filter((host): host is string => typeof host === 'string' && host !== ''),
          )).sort()
          : [];

        const converted = convertQueryResultToTimeseries(result)
          .map((item, index): ProcessTimeseries => {
            const processName = dimensionValue(item, 'process')
              ?? (Array.isArray(item.name) ? String(item.name[0]) : String(item.name));
            const hostName = dimensionValue(item, 'host')
              ?? (resolvedHosts.length === 1 ? resolvedHosts[0] : undefined);
            return {
              ...item,
              name: processName,
              processName,
              hostName,
              color: podSeriesColor(index),
              unit: units.percentage.percent,
            };
          })
          .sort((left, right) => average(right) - average(left));

        if (cancelled) return;
        setSeries(converted);
        setHosts(resolvedHosts);
        if (!isQueryResult(hostResult)) {
          setError(`Não foi possível resolver o host do node: ${hostResult.error}`);
        } else if (resolvedHosts.length === 0) {
          setError('O node selecionado não foi localizado como HOST no Smartscape.');
        } else if (converted.length === 0) {
          setError(
            `Host resolvido (${resolvedHosts.join(', ')}), mas nenhum PROCESS com dt.process.cpu.usage foi encontrado no período selecionado.`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao buscar CPU dos processos do node', err);
          setError(err instanceof Error ? err.message : 'Erro ao consultar os processos do node.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [filters, lastRefreshedAt, selectedNode]);

  const seriesActions = useCallback((item: unknown) => {
    const { processName, hostName } = item as ProcessTimeseries;
    if (!processName && !hostName) return <></>;

    return (
      <ChartSeriesAction aria-label="Identificação do processo">
        <ChartSeriesAction.Label>
          {hostName ? `Host: ${hostName}` : 'Host não identificado'}
        </ChartSeriesAction.Label>
        {processName && (
          <ChartSeriesAction.Item onSelect={() => copy(processName)}>
            <ChartSeriesAction.ItemIcon><CopyIcon /></ChartSeriesAction.ItemIcon>
            Copiar processo
          </ChartSeriesAction.Item>
        )}
        {hostName && (
          <ChartSeriesAction.Item onSelect={() => copy(hostName)}>
            <ChartSeriesAction.ItemIcon><CopyIcon /></ChartSeriesAction.ItemIcon>
            Copiar host
          </ChartSeriesAction.Item>
        )}
      </ChartSeriesAction>
    );
  }, []);

  const headerActions = useMemo(() => (
    <DashboardWidgetHeaderActions>
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
  ), [selectedNode, setNodeSelected]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

  const yMax = useMemo(
    () => Math.max(100, new TimeSeriesMinMax(series).rawMax),
    [series],
  );

  if (selectedNodes.length !== 1) {
    return (
      <Flex flexDirection="column" gap={8}>
        {!onHeaderActionsChange && headerActions}
        <Text>
          Selecione exatamente um node em “Ocupação dos nodes” para carregar os processos.
          Nenhuma consulta de processos é executada sem esse recorte.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={8}>
      {!onHeaderActionsChange && headerActions}
      <Flex flexDirection="row" flexWrap="wrap" gap={8}>
        <Chip color="primary">node: {selectedNode}</Chip>
        {hosts.map(host => <Chip key={host}>host: {host}</Chip>)}
      </Flex>
      {error && <Text style={{ color: '#c81920' }}>{error}</Text>}
      <TimeseriesChart
        loading={loading}
        data={series}
        height={360}
        seriesActions={seriesActions}
        truncationMode="middle"
      >
        <TimeseriesChart.YAxis min={0} max={yMax} />
        <TimeseriesChart.Legend position="right" ratio={35} />
      </TimeseriesChart>
    </Flex>
  );
}

Object.assign(NodeProcessesCpuUsage, { dashboardWidget: true });

export { NodeProcessesCpuUsage };
