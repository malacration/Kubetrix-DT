import { HoneycombChart, HoneycombTileNumericData, Timeseries, TimeseriesAnnotations, type TimeseriesAnnotationsMarkerProps, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';

import { ThumbsDownIcon, ViewIcon } from '@dynatrace/strato-icons';
import { kubernetesMetrics } from 'src/app/services/k8s/kubernetsService';




function OutOfMemory({ filters, refreshToken}: ChartProps) {
  const [metric, setMetric] = useState<HoneycombTileNumericData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filters) return;

    const { cluster, namespace, workload, timeframe } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
    };

    const load = async () => {
      setLoading(true);
      try {
        const oomMetric = await kubernetesMetrics("container.oom_kills",cluster, namespace, workload, timeframe,`splitBy("k8s.workload.name"):sum()`);
        setMetric(oomMetric.getHoneycomb("k8s.workload.name"));
        
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters,refreshToken]);

  return (
    <HoneycombChart loading={loading}
            data={metric?.sort((a, b) => b.value - a.value)}
            showLabels={true}
        />
  );
}

(OutOfMemory as any).dashboardWidget = true;

export { OutOfMemory };

