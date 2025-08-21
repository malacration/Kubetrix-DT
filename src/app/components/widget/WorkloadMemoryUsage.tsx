import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { kubernetesWorkload } from 'src/app/services/k8s/WorkloadService';
import { TimeSeriesMinMax } from 'src/app/model/TimeSeriesMinMax';
import { Colors } from '@dynatrace/strato-design-tokens';
import { Button } from '@dynatrace/strato-components';


function WorkloadMemoryUsage({ filters, refreshToken}: ChartProps) {
  const [metric, setMetric] = useState<MetricResult | null>(null);
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);

  const [threshold, setThreshold] = useState<number>(0);
  const [showThreshold, setShowThreshold] = useState<boolean>(true);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)

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

        const result = await kubernetesWorkload("memory_working_set",cluster, namespace, workload, timeframe, "sum:toUnit(Byte,GibiByte)");
        const sevenDaysAgo = await kubernetesWorkload("memory_working_set",cluster, namespace, workload, timeframe, "sum:toUnit(Byte,GibiByte)",true);

        const ts   = await result.metricDataToTimeseries(workload);
        const tsAgo  = await sevenDaysAgo.metricDataToTimeseries("7 Days Ago");
        

        const limits = await kubernetesWorkload(
          "limits_memory",cluster, namespace, 
          workload, timeframe,
          "max:default(0,always):fold(max):toUnit(Byte,GibiByte):last"
        );
        setThreshold(limits.getFirstValueOfFirstMetric()?.value ?? 0)
        
        setSeries([...ts,...tsAgo]);
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters,refreshToken]);

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
        { showThreshold ?
            <TimeseriesChart.Threshold
            data={{ value: threshold }}
            color={Colors.Charts.Threshold.Bad.Default}
            label="Limits"></TimeseriesChart.Threshold>
            : <></>
        }
        <TimeseriesChart.YAxis min={min * 0.95} max={max * 1.05} />
        <TimeseriesChart.Legend position="bottom" />
        </TimeseriesChart>
      </div>
  );
}


(WorkloadMemoryUsage as any).dashboardWidget = true;

export { WorkloadMemoryUsage };