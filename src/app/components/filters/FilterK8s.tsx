import { subDays } from 'date-fns';
import React, { useEffect, useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { ClusterSelection } from './properties/ClusterSelect';
import { NameSpaceSelection } from './properties/NameSpacesSelect';
import { WorkloadsSelection } from './properties/WorkloadsSelect';
import { TimeFrame } from '../timeframe/Timeframe';
import { getDefaultTimeframe } from '../timeframe/DefaultTimeframe';
import { FilterBarProps } from '../dashboard/DashBoard';
import { SelectComponent } from '../form/Select';

function mergeFilterValues(
  prev: FilterItemValues,
  next: FilterItemValues,
): FilterItemValues {
  const merged = { ...prev };

  for (const [key, val] of Object.entries(next)) {
    if (val && 'value' in val && val.value !== undefined && val.value !== null) {
      merged[key as keyof FilterItemValues] = val;
    }
  }
  return merged;
}

function updateQuery(cb: (p: URLSearchParams) => void) {
  const p = new URLSearchParams(window.location.search);
  cb(p);
  const newUrl = `${window.location.pathname}?${p.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

export const FiltersK8s = ({ onFiltersChange, refreshIntervalMs, setRefreshIntervalMs }: FilterBarProps) => {

  const initialParams = new URLSearchParams(window.location.search);


  const [clusterSelecionado, setClusterSelecionado] = useState(initialParams.get('cluster')   ?? 'all');
  const [namespaceSelecionado, setNamespaceSelecionado] = useState(initialParams.get('namespace')   ?? 'all');
  const [workloadSelecionado, setWorkloadSelecionado] = useState(initialParams.get('workload')   ?? 'all');
  const [timeframe, setTimeframe] = useState<TimeframeV2>(getDefaultTimeframe);

  const [allProps, setAllProps] = useState<FilterItemValues>({
    cluster:   { value: 'all'},
    namespace: { value: 'all'},
    workload:  { value: 'all'},
    timeframe: { value: timeframe},
  });
 

  useEffect(() => {
    updateQuery(p => {
      p.set('cluster',   clusterSelecionado);
      p.set('namespace', namespaceSelecionado);
      p.set('workload',  workloadSelecionado);
      // timeframeToParams(timeframe, p);
    });
    onFiltersChange?.(allProps);
  }, [allProps,clusterSelecionado,namespaceSelecionado,workloadSelecionado,timeframe]);

  return (
    <FilterBar
      onFilterChange={(props) => {
        setAllProps((prev) => mergeFilterValues(prev, props));

        if(typeof props.cluster.value === 'string')
          setClusterSelecionado(props.cluster.value)

        if(typeof props.namespace.value === 'string')
          setNamespaceSelecionado(props.namespace.value)

        if(typeof props.workload.value === 'string')
          setWorkloadSelecionado(props.workload.value)

        if(new Number(props.time.value) && setRefreshIntervalMs)
          setRefreshIntervalMs(props.time.value)

        // @ts-expect-error o framework garante a tipagem
        setTimeframe(props.timeframe.value)
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
            new Option("5m","300000"),
            new Option("1m","60000"),
            new Option("30s","30000")
          ]}
          clearable={false}
        />
      </FilterBar.Item>
    </FilterBar>
  );
};


export class Filter{
  label
}
