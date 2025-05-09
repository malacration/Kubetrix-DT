import { subDays } from 'date-fns';
import React, { useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar } from '@dynatrace/strato-components-preview/filters';
import {
  SelectV2,
  TextInput,
} from '@dynatrace/strato-components-preview/forms';
import { ClusterSelection } from './filters/ClusterSelect';
import { NameSpaceSelection } from './filters/NameSpacesSelect';
import { WorkloadsSelection } from './filters/WorkloadsSelect';
import { TimeFrame } from './timeframe/Timeframe';
import { getDefaultTimeframe } from './timeframe/DefaultTimeframe';

const countries = ['Austria', 'Estonia', 'Poland', 'Spain'];
const cities = [
  'Linz',
  'Graz',
  'Hagenberg',
  'Innsbruck',
  'Klagenfurt',
  'Vienna',
  'Tallinn',
  'Gdansk',
  'Barcelona',
];
export interface Teste{
  teste
}

export const Filters = () => {

    const [clusterSelecionado, setClusterSelecionado] = useState("all");
    const [namespaceSelecionado, setNamespaceSelecionado] = useState("all");
    const [workloadSelecionado, setWorkloadSelecionado] = useState("all");
    const [timeframe, setTimeframe] = useState<TimeframeV2>(getDefaultTimeframe);

  return (
    <FilterBar
      onFilterChange={(props) => {
        if(typeof props.cluster.value === 'string')
          setClusterSelecionado(props.cluster.value)

        if(typeof props.namespace.value === 'string')
          setNamespaceSelecionado(props.namespace.value)

        if(typeof props.workload.value === 'string')
          setWorkloadSelecionado(props.workload.value)

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
