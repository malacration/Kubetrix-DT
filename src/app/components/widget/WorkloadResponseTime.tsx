import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { responseTime } from 'src/app/services/k8s/WorkloadService';
import { ChartProps } from '../filters/BarChartProps';



function WorkloadResponseTime({ filters, refreshToken, title = "windson" }: ChartProps) {
  const [metric, setMetric] = useState<MetricResult | null>(null);
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filters) return;

    const load = async () => {
      setLoading(true);

      try {
        const { cluster, namespace, workload, timeframe } = {
          cluster:   filters.cluster?.value,
          namespace: filters.namespace?.value,
          workload:  filters.workload?.value,
          timeframe: filters.timeframe?.value,
        };

        const result = await responseTime(cluster, namespace, workload, timeframe);
        setMetric(result);
        const ts   = await result.metricDataToTimeseries(workload);
        setSeries(ts);
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters,refreshToken]);

  return (
    <TimeseriesChart
      loading={loading}
      data={series}
    />
  );
}

(WorkloadResponseTime as any).dashboardWidget = true;

export { WorkloadResponseTime };

