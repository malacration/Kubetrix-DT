import { subDays } from 'date-fns';
import React, { useEffect, useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { ClusterSelection } from './properties/ClusterSelect';
import { NameSpaceSelection } from './properties/NameSpacesSelect';
import { WorkloadsSelection } from './properties/WorkloadsSelect';
import { TimeFrame } from '../timeframe/Timeframe';
import { getDefaultTimeframe } from '../timeframe/DefaultTimeframe';


interface FilterBarProps {
  onFiltersChange?: (f: FilterItemValues) => void;
}

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


export const FiltersK8s = ({ onFiltersChange }: FilterBarProps) => {

    const [clusterSelecionado, setClusterSelecionado] = useState("all");
    const [namespaceSelecionado, setNamespaceSelecionado] = useState("all");
    const [workloadSelecionado, setWorkloadSelecionado] = useState("all");
    const [timeframe, setTimeframe] = useState<TimeframeV2>(getDefaultTimeframe);

    const [allProps, setAllProps] = useState<FilterItemValues>({
      cluster:   { value: 'all'},
      namespace: { value: 'all'},
      workload:  { value: 'all'},
      timeframe: { value: timeframe},
    });
 

    useEffect(() => {
      onFiltersChange?.(allProps);
    }, [allProps,clusterSelecionado,namespaceSelecionado,timeframe]);

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
    </FilterBar>
  );
};


export class Filter{
  label
}
