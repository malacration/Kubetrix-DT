import React from 'react';
import { ChartSeriesAction, Timeseries } from '@dynatrace/strato-components-preview/charts';
import type { TimeseriesWithDimensions } from '@dynatrace/strato-components-preview/conversion-utilities';
import { CopyIcon, FilterIcon, FilterOutIcon } from '@dynatrace/strato-icons';

export interface PodNodeTimeseries extends Timeseries {
  podName?: string;
  nodeName?: string;
}

function dimensionValue(series: TimeseriesWithDimensions, fieldName: string): string | undefined {
  const value = series.userData.dimensions.find(
    dimension => dimension.field.name === fieldName,
  )?.value;

  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

/**
 * Mantém o nome mostrado na legenda curto e transporta pod/node separadamente
 * para as ações contextuais do tooltip e da própria legenda.
 */
export function toPodNodeTimeseries(
  series: TimeseriesWithDimensions,
  suffix?: string,
): PodNodeTimeseries {
  const fallbackName = Array.isArray(series.name) ? series.name[0] : series.name;
  const podName = dimensionValue(series, 'pod') ?? fallbackName;
  const nodeName = dimensionValue(series, 'node');

  return {
    ...series,
    name: suffix ? `${podName} • ${suffix}` : podName,
    podName,
    nodeName,
  };
}

function copy(value: string) {
  void navigator.clipboard.writeText(value);
}

interface PodNodeSeriesActionOptions {
  selectedNode?: string;
  onSelectNode?: (node: string) => void;
  highlightedPod?: string;
  onHighlightPod?: (pod: string) => void;
}

export function podNodeSeriesActions(
  series: unknown,
  options: PodNodeSeriesActionOptions = {},
) {
  const { podName, nodeName } = series as PodNodeTimeseries;
  const { selectedNode, onSelectNode, highlightedPod, onHighlightPod } = options;
  if (!podName && !nodeName) return <></>;

  return (
    <ChartSeriesAction aria-label="Identificação do pod">
      <ChartSeriesAction.Label>
        {podName
          ? `Pod: ${podName}${nodeName ? ` • Node: ${nodeName}` : ''}`
          : nodeName ? `Node: ${nodeName}` : 'Node não identificado'}
      </ChartSeriesAction.Label>
      {podName && onHighlightPod && highlightedPod !== podName && (
        <ChartSeriesAction.Item onSelect={() => onHighlightPod(podName)}>
          <ChartSeriesAction.ItemIcon><FilterIcon /></ChartSeriesAction.ItemIcon>
          Colocar este pod em evidência
        </ChartSeriesAction.Item>
      )}
      {podName && onHighlightPod && highlightedPod === podName && (
        <ChartSeriesAction.Item onSelect={() => onHighlightPod('all')}>
          <ChartSeriesAction.ItemIcon><FilterOutIcon /></ChartSeriesAction.ItemIcon>
          Mostrar todos os pods
        </ChartSeriesAction.Item>
      )}
      {podName && (
        <ChartSeriesAction.Item onSelect={() => copy(podName)}>
          <ChartSeriesAction.ItemIcon><CopyIcon /></ChartSeriesAction.ItemIcon>
          Copiar pod
        </ChartSeriesAction.Item>
      )}
      {nodeName && (
        <ChartSeriesAction.Item onSelect={() => copy(nodeName)}>
          <ChartSeriesAction.ItemIcon><CopyIcon /></ChartSeriesAction.ItemIcon>
          Copiar node
        </ChartSeriesAction.Item>
      )}
      {nodeName && onSelectNode && selectedNode !== nodeName && (
        <ChartSeriesAction.Item onSelect={() => onSelectNode(nodeName)}>
          <ChartSeriesAction.ItemIcon><FilterIcon /></ChartSeriesAction.ItemIcon>
          Filtrar por este node
        </ChartSeriesAction.Item>
      )}
      {nodeName && onSelectNode && selectedNode === nodeName && (
        <ChartSeriesAction.Item onSelect={() => onSelectNode('all')}>
          <ChartSeriesAction.ItemIcon><FilterOutIcon /></ChartSeriesAction.ItemIcon>
          Limpar filtro do node
        </ChartSeriesAction.Item>
      )}
    </ChartSeriesAction>
  );
}
