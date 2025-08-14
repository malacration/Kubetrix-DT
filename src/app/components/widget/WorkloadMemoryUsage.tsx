import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { kubernetesWorkload } from 'src/app/services/k8s/WorkloadService';



function WorkloadMemoryUsage({ filters, refreshToken}: ChartProps) {
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

        const result = await kubernetesWorkload("memory_working_set",cluster, namespace, workload, timeframe, "avg:toUnit(Bit,GibiByte)");
        const sevenDaysAgo = await kubernetesWorkload("memory_working_set",cluster, namespace, workload, timeframe, "avg:toUnit(Bit,GibiByte)",true);

        const ts   = await result.metricDataToTimeseries(workload);
        const tsAgo  = await sevenDaysAgo.metricDataToTimeseries("7 Days Ago");
        setSeries([...ts,...tsAgo]);
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
      
    >
      <TimeseriesChart.Legend hidden={true} />
      </TimeseriesChart>
  );
}


(WorkloadMemoryUsage as any).dashboardWidget = true;

export { WorkloadMemoryUsage };