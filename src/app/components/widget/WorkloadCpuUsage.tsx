import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'src/app/services/k8s/WorkloadService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { TimeSeriesMinMax } from 'src/app/model/TimeSeriesMinMax';
import { Colors } from '@dynatrace/strato-design-tokens';
import { Button } from '@dynatrace/strato-components';



function WorkloadCpuUsage({ filters, lastRefreshedAt}: ChartProps, desejado : boolean = false) {
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [throttled, setThrottled] = useState<Timeseries>();
  const [loading, setLoading] = useState(false);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)
  const [threshold, setThreshold] = useState<number>(0);

  const [showThreshold, setShowThreshold] = useState<boolean>(true);

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

        console.log("parametros cpu: ",JSON.stringify(timeframe.to))
        const result = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)");
        const sevenDaysAgo = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)",true);
        const throttled = await kubernetesWorkload("cpu_throttled",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)");

        const ts   = await result.metricDataToTimeseries(workload?.toString()?? "All");
        const tsAgo   = await sevenDaysAgo.metricDataToTimeseries("7 Days Ago");
        const tsThrottled   = await throttled.metricDataToTimeseries("Throttled");

        
        const limits = await kubernetesWorkload(
          "limits_cpu",cluster, namespace, workload, timeframe,
          "max:toUnit(MilliCores,Cores):last"
        );
        setThreshold(limits.getFirstValueOfFirstMetric()?.value ?? 0)

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
  }, [filters,lastRefreshedAt]);

  useEffect(() => {
    const minMax = new TimeSeriesMinMax(series)
    setMin(minMax.rawMin)
    if(showThreshold)
      setMax(Math.max(minMax.rawMax, threshold))
    else
      setMax(minMax.rawMax)
  },[series,threshold,showThreshold])  

  return (
    <div>
    <Button
        color="primary" variant="accent"
        onClick={() => setShowThreshold(s => !s)}
      >
        {showThreshold ? 'Ocultar threshold' : 'Mostrar threshold'}
      </Button>
    <TimeseriesChart
      loading={loading}
      data={series}
    >
      {throttled ? <TimeseriesChart.Bar data={throttled}  /> : <></>}
      <TimeseriesChart.YAxis min={min * 0.95} max={max * 1.05} />
      <TimeseriesChart.Threshold
        data={{ value: threshold }}
        color={Colors.Charts.Threshold.Bad.Default}
        label="Limits"
      />
      <TimeseriesChart.Legend position="bottom" />
      </TimeseriesChart>
      </div>
  );
}


(WorkloadCpuUsage as any).dashboardWidget = true;

export { WorkloadCpuUsage };