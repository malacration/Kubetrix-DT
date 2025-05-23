import { HoneycombChart, HoneycombTileNumericData, Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { NodesCpuOverload } from 'src/app/services/k8s/NodeServices';
import { percentOverloadColorScheme } from './style/Palette';
import { ChartProps } from '../filters/BarChartProps';


function NodeCpuOverload({ filters, refreshToken }: ChartProps, showLabels = true) {
  const [metric, setMetric] = useState<HoneycombTileNumericData[] | null>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    const cluster = filters?.cluster?.value;
    const namespace = filters?.namespace?.value;
    const workload = filters?.workload?.value;
    const timeframe = filters?.timeframe?.value;
  
    if (!cluster || !namespace || !workload || !timeframe) return;
  
    setLoading(true);
    NodesCpuOverload(cluster, namespace, workload, timeframe).then((it) => {
      setMetric(it.getHoneycomb("k8s.node.name"));
      setLoading(false);
    });
  }, [
    filters?.cluster?.value,
    filters?.namespace?.value,
    filters?.workload?.value,
    filters?.timeframe?.value,
    refreshToken
  ]);

  return (
    <div>
        <HoneycombChart loading={loading}
            data={metric?.sort((a, b) => b.value - a.value)}
            showLabels={showLabels}
            colorScheme={percentOverloadColorScheme}
            unit={"percentage"}
        />
    </div>
  );
}

(NodeCpuOverload as any).dashboardWidget = true;

export { NodeCpuOverload };
