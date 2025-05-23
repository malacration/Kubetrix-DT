import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'src/app/services/k8s/WorkloadService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { AppCard } from '@dynatrace/strato-components-preview/navigation';



function WorkloadCpuMemoryUsage({ filters, refreshToken}: ChartProps) {
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

        const result = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum():toUnit(MilliCores,Cores)");
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


(WorkloadCpuMemoryUsage as any).dashboardWidget = true;

export { WorkloadCpuMemoryUsage };