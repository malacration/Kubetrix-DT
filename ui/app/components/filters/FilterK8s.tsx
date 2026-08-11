import { subDays } from 'date-fns';
import React, { useEffect, useMemo, useState, useCallback } from 'react';

import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { ClusterSelection } from './properties/ClusterSelect';
import { NameSpaceSelection } from './properties/NameSpacesSelect';
import { WorkloadsSelection } from './properties/WorkloadsSelect';
import { TimeFrame } from '../timeframe/Timeframe';
import { getDefaultTimeframe } from '../timeframe/DefaultTimeframe';
import { availableResolutionOptions } from '../timeframe/resolution';
import { FilterBarProps } from '../dashboard/DashBoard';
import { SelectComponent } from '../form/Select';
import { useSearchParams } from 'react-router-dom';
import { useAutoRefreshMs, useClusterSelected, useNamespaceSelected, useResolution, useSetAutoRefreshMs, useSetClusterSelected, useSetNamespaceSelected, useSetResolution, useSetTimeFrame, useSetWorkloadSelected, useTimeFrame, useWorkloadSelected } from '../context/FilterK8sContext';

function mergeFilterValues(prev: FilterItemValues, next: FilterItemValues): FilterItemValues {
  const merged = { ...prev };
  for (const [key, val] of Object.entries(next)) {
    if (val && 'value' in val && val.value !== undefined && val.value !== null) {
      merged[key as keyof FilterItemValues] = val;
    }
  }
  return merged;
}

export const FiltersK8s = ({ onFiltersChange }: FilterBarProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  
  const setClusterSelecionado = useSetClusterSelected()
  const setNamespaceSelecionado = useSetNamespaceSelected()
  const setWorkloadSelecionado = useSetWorkloadSelected()
  const timeframe = useSetTimeFrame()
  const setAutoRefreshMs = useSetAutoRefreshMs()
  const autoRefresh = useAutoRefreshMs()
  const setResolutionSelecionado = useSetResolution()
  const resolution = useResolution()
  const currentTimeframe = useTimeFrame()

  // Esconde do seletor qualquer resolução mais fina do que a API realmente consegue
  // atender pro timeframe selecionado (considerando que a baseline de 7/14/21 dias
  // alcança até 21 dias além do início do timeframe) — evita escolher algo que
  // sempre voltaria vazio pra baseline de CPU/Memória/Throughput/Response Time.
  const resolutionOptions = useMemo(
    () => availableResolutionOptions(currentTimeframe),
    [currentTimeframe],
  );

  const [allProps, setAllProps] = useState<FilterItemValues>({
    cluster:   { value: useClusterSelected() },
    namespace: { value: useNamespaceSelected() },
    workload:  { value: useWorkloadSelected() },
    timeframe: { value: useTimeFrame() },
    resolution: { value: useResolution() },
  });

  useEffect(() => {
    onFiltersChange?.(allProps);
  }, [allProps, onFiltersChange]);


  return (
    <FilterBar
      onFilterChange={(props) => {
        setAllProps((prev) => mergeFilterValues(prev, props));

        if (typeof props.cluster?.value === 'string')
          setClusterSelecionado(props.cluster.value);

        if (typeof props.namespace?.value === 'string')
          setNamespaceSelecionado(props.namespace.value);

        if (typeof props.workload?.value === 'string')
          setWorkloadSelecionado(props.workload.value);

        if (typeof props.resolution?.value === 'string')
          setResolutionSelecionado(props.resolution.value);

        // tempo de auto-refresh
        const maybeTime = Number(props.time?.value);
        if (maybeTime && !Number.isNaN(maybeTime))
          setAutoRefreshMs(maybeTime);

        // @ts-expect-error framework garante a tipagem
        if (props.timeframe?.value) timeframe(props.timeframe.value);
      }}
    >
      <FilterBar.Item name="cluster" label="Cluster">
        <ClusterSelection/>
      </FilterBar.Item>

      <FilterBar.Item name="namespace" label="NameSpace">
        <NameSpaceSelection/>
      </FilterBar.Item>

      <FilterBar.Item name="workload" label="Workloads">
        <WorkloadsSelection/>
      </FilterBar.Item>

      <FilterBar.Item name="timeframe" label="timeframe">
        <TimeFrame />
      </FilterBar.Item>

      <FilterBar.Item name="resolution" label="Resolution">
        <SelectComponent
          defaultValue={resolution}
          options={resolutionOptions}
          clearable={false}
        />
      </FilterBar.Item>

      <FilterBar.Item name="time" label="Auto Refresh">
        <SelectComponent
          defaultValue={autoRefresh.toString()}
          options={[
            new Option("10m", "600000"),
            new Option("5m", "300000"),
            new Option("1m", "60000"),
          ]}
          clearable={false}
        />
      </FilterBar.Item>
    </FilterBar>
  );
};

export class Filter {
  label: string | undefined;
}