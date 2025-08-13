import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'src/app/services/k8s/WorkloadService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';



function WorkloadCpuUsage({ filters, refreshToken}: ChartProps, desejado : boolean = false) {
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [throttled, setThrottled] = useState<Timeseries>();
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
        const sevenDaysAgo = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum():toUnit(MilliCores,Cores)",true);
        
        const throttled = await kubernetesWorkload("cpu_throttled",cluster, namespace, workload, timeframe, "sum():toUnit(MilliCores,Cores)");

        const ts   = await result.metricDataToTimeseries(workload?.toString()?? "All");
        const tsAgo   = await sevenDaysAgo.metricDataToTimeseries("7 Days Ago");
        const tsThrottled   = await throttled.metricDataToTimeseries("Throttled");

        if(desejado){
          result.plus(throttled)
        }

        setSeries([...ts,...tsAgo,]);
        setThrottled(tsThrottled[0]);
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
      {throttled ? <TimeseriesChart.Bar data={throttled}  /> : <></>}
      <TimeseriesChart.Legend position="bottom" />
      </TimeseriesChart>
  );
}


(WorkloadCpuUsage as any).dashboardWidget = true;

export { WorkloadCpuUsage };