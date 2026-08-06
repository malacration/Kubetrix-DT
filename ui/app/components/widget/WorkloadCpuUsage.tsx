import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'app/services/k8s/WorkloadService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { Button } from '@dynatrace/strato-components/buttons';



function WorkloadCpuUsage({ filters}: ChartProps, desejado : boolean = false) {
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [throttled, setThrottled] = useState<Timeseries>();
  const [loading, setLoading] = useState(false);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)
  const [threshold, setThreshold] = useState<number>(0);

  const [showThreshold, setShowThreshold] = useState<boolean>(true);

  useEffect(() => {
    if (!filters) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const { cluster, namespace, workload, timeframe, resolution } = {
          cluster:   filters.cluster?.value,
          namespace: filters.namespace?.value,
          workload:  filters.workload?.value,
          timeframe: filters.timeframe?.value,
          resolution: filters.resolution?.value,
        };

        if (!timeframe) return;

        const result = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)", false, undefined, resolution);
        const sevenDaysAgo = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)",true, undefined, resolution);
        const throttled = await kubernetesWorkload("cpu_throttled",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)", false, undefined, resolution);

        const ts   = await result.metricDataToTimeseries(workload?.toString()?? "All");
        const tsAgo   = await sevenDaysAgo.metricDataToTimeseries("7 Days Ago");
        const tsThrottled   = await throttled.metricDataToTimeseries("Throttled");


        const limits = await kubernetesWorkload(
          "limits_cpu",cluster, namespace, workload, timeframe,
          "max:fold(max):toUnit(MilliCores,Cores):last", false, undefined, resolution
        );

        if (cancelled) return;

        setThreshold(limits.getFirstValueOfFirstMetric()?.value ?? 0)

        if(desejado){
          result.plus(throttled)
        }

        setSeries([...ts,...tsAgo,]);
        setThrottled(tsThrottled[0]);
      } catch (err) {
        if (!cancelled) console.error('Erro ao buscar métricas', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    const arr = throttled != null ? [...series, throttled] : series;
    let minMax : { min, max }
    if(showThreshold){
      minMax = new TimeSeriesMinMax(arr,threshold).padded
      setMax(Math.max(minMax.max, threshold))
    }
    else{
      minMax = new TimeSeriesMinMax(arr).padded
      setMax(minMax.max)
    }
      setMin(Math.min(minMax.min))
  },[series,threshold,showThreshold,throttled])  

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
        <TimeseriesChart.YAxis min={min} max={max} />
        {showThreshold && (
          <TimeseriesChart.Threshold
            data={{ value: threshold }}
            color={Colors.Charts.Threshold.Bad.Default}
            label="Limits"
          />
        )}
        <TimeseriesChart.Legend position="bottom" />
      </TimeseriesChart>
      </div>
  );
}


(WorkloadCpuUsage as any).dashboardWidget = true;

export { WorkloadCpuUsage };