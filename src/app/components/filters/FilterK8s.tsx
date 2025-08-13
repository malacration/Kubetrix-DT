import { subDays } from 'date-fns';
import React, { useEffect, useMemo, useState, useCallback } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { ClusterSelection } from './properties/ClusterSelect';
import { NameSpaceSelection } from './properties/NameSpacesSelect';
import { WorkloadsSelection } from './properties/WorkloadsSelect';
import { TimeFrame } from '../timeframe/Timeframe';
import { getDefaultTimeframe } from '../timeframe/DefaultTimeframe';
import { FilterBarProps } from '../dashboard/DashBoard';
import { SelectComponent } from '../form/Select';
import { useSearchParams } from 'react-router-dom';

function mergeFilterValues(prev: FilterItemValues, next: FilterItemValues): FilterItemValues {
  const merged = { ...prev };
  for (const [key, val] of Object.entries(next)) {
    if (val && 'value' in val && val.value !== undefined && val.value !== null) {
      merged[key as keyof FilterItemValues] = val;
    }
  }
  return merged;
}

export const FiltersK8s = ({ onFiltersChange, refreshIntervalMs, setRefreshIntervalMs }: FilterBarProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados iniciais lendo da URL atual (uma única vez via função initializer)
  const [clusterSelecionado, setClusterSelecionado]   = useState(() => searchParams.get('cluster')   ?? 'all');
  const [namespaceSelecionado, setNamespaceSelecionado] = useState(() => searchParams.get('namespace') ?? 'all');
  const [workloadSelecionado, setWorkloadSelecionado] = useState(() => searchParams.get('workload')  ?? 'all');
  const [timeframe, setTimeframe] = useState<TimeframeV2>(getDefaultTimeframe);

  const [allProps, setAllProps] = useState<FilterItemValues>({
    cluster:   { value: clusterSelecionado },
    namespace: { value: namespaceSelecionado },
    workload:  { value: workloadSelecionado },
    timeframe: { value: timeframe },
  });

  // Mantém estados sincronizados caso a URL mude por fora (voltar do histórico, etc.)
  useEffect(() => {
    const sCluster = searchParams.get('cluster')   ?? 'all';
    const sNs      = searchParams.get('namespace') ?? 'all';
    const sWl      = searchParams.get('workload')  ?? 'all';

    if (sCluster !== clusterSelecionado)   setClusterSelecionado(sCluster);
    if (sNs !== namespaceSelecionado)      setNamespaceSelecionado(sNs);
    if (sWl !== workloadSelecionado)       setWorkloadSelecionado(sWl);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Atualiza a URL via React Router (preserva params desconhecidos) — nada de window.history
  const updateQuery = useCallback((mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    const before = searchParams.toString();
    const after  = next.toString();
    if (after !== before) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Escreve os filtros na URL sempre que mudarem
  useEffect(() => {
    updateQuery(p => {
      p.set('cluster',   clusterSelecionado);
      p.set('namespace', namespaceSelecionado);
      p.set('workload',  workloadSelecionado);
      // timeframeToParams(timeframe, p); // se/quando quiser persistir timeframe
    });
  }, [clusterSelecionado, namespaceSelecionado, workloadSelecionado, timeframe, updateQuery]);

  // Notifica o pai quando o conjunto de filtros muda
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

        // tempo de auto-refresh
        const maybeTime = Number(props.time?.value);
        if (!Number.isNaN(maybeTime) && setRefreshIntervalMs)
          setRefreshIntervalMs(maybeTime);

        // timeframe (seu componente já garante o tipo)
        // @ts-expect-error framework garante a tipagem
        if (props.timeframe?.value) setTimeframe(props.timeframe.value);
      }}
    >
      <FilterBar.Item name="cluster" label="Cluster">
        <ClusterSelection timeFrame={timeframe}/>
      </FilterBar.Item>

      <FilterBar.Item name="namespace" label="NameSpace">
        <NameSpaceSelection timeFrame={timeframe} k8sName={clusterSelecionado}/>
      </FilterBar.Item>

      <FilterBar.Item name="workload" label="Workloads">
        <WorkloadsSelection
          timeFrame={timeframe}
          nameSpace={namespaceSelecionado}
          k8sName={clusterSelecionado}
        />
      </FilterBar.Item>

      <FilterBar.Item name="timeframe" label="">
        <TimeFrame />
      </FilterBar.Item>

      <FilterBar.Item name="time" label="Auto Refresh">
        <SelectComponent
          defaultValue="300000"
          options={[
            new Option("5m", "300000"),
            new Option("1m", "60000"),
            new Option("30s","30000"),
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
