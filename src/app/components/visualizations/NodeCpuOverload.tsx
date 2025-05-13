import { HoneycombChart, HoneycombTileNumericData, Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { NodesCpuOverload } from 'src/app/services/k8s/NodeServices';
import { units, type Unit } from '@dynatrace-sdk/units';
import { percentOverloadColorScheme } from './style/Palette';


interface BarChartProps {
  filters?: FilterItemValues; // será injetado pelo Dashboard
}

export function NodeCpuOverload({ filters }: BarChartProps) {
  const [metric, setMetric] = useState<HoneycombTileNumericData[] | null>([]);
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    if (!filters) return;
    
    setLoading(true);
    
    const { cluster, namespace, workload, timeframe } = {
        cluster:   filters.cluster?.value,
        namespace: filters.namespace?.value,
        workload:  filters.workload?.value,
        timeframe: filters.timeframe?.value,
      };

    NodesCpuOverload(cluster, namespace, workload, timeframe).then(it => {
        setMetric(it.getHoneycomb("k8s.node.name"));
        setLoading(false);
    });
  }, [filters]);

  return (
    <div>
        <HoneycombChart loading={loading}
            data={metric?.sort((a, b) => b.value - a.value)}
            showLabels
            colorScheme={percentOverloadColorScheme}
            unit={"percentage"}
        />
    </div>
  );
}
