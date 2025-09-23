import { ChartInteractions, Timeseries, TimeseriesAnnotations, type TimeseriesAnnotationsMarkerProps, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime, serviceWorkload } from 'src/app/services/k8s/WorkloadService';
import { ChartProps } from '../filters/BarChartProps';
import { shiftTimeframeBack } from 'src/app/model/ShiftTimeframeBack';
import { QueryResult } from '@dynatrace-sdk/client-query';

import { ThumbsDownIcon, ViewIcon } from '@dynatrace/strato-icons';
import { classicBaseLineBy } from 'src/app/services/builtin/baseLineService';
import { TimeSeriesMinMax } from 'src/app/model/TimeSeriesMinMax';




function WorkloadThroughput({ filters}: ChartProps) {
  const [series, setSeries] = useState<Timeseries[]>([]);
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
        const throughputMetric = await serviceWorkload("requestCount.server",cluster, namespace, workload, timeframe,"sum",false,14);
        const throughputMetricSevenDaysAgo = await classicBaseLineBy(throughputMetric,timeframe,"","",1,7);

        const timeSeries  = await throughputMetric.metricDataToTimeseries("Throughput","Count");
        const timeSeriesSevenDaysAgo   = await throughputMetricSevenDaysAgo.metricDataToTimeseries("Baseline","Count");

        setSeries([...timeSeries, ...timeSeriesSevenDaysAgo]);
        
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters]);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)

  useEffect(() => {
    const minMax : { min, max } = new TimeSeriesMinMax(series).padded
    setMax(minMax.max)
    setMin(minMax.min)
    console.log(minMax,"Minamx")
  },[series])  

  return (
    <TimeseriesChart curve="smooth"
      loading={loading}
      data={series}
    >
      <TimeseriesChart.Legend position="bottom" />
      <TimeseriesChart.YAxis min={min} max={max} />
      <ChartInteractions>
          <ChartInteractions.Zoom />
      </ChartInteractions>
    </TimeseriesChart>
  );
}

(WorkloadThroughput as any).dashboardWidget = true;

export { WorkloadThroughput };

