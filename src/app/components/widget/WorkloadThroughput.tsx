import { ChartInteractions, Timeseries, TimeseriesAnnotations, type TimeseriesAnnotationsMarkerProps, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime, serviceWorkload } from 'src/app/services/k8s/WorkloadService';
import { ChartProps } from '../filters/BarChartProps';
import { shiftTimeframeBack } from 'src/app/model/ShiftTimeframeBack';
import { QueryResult } from '@dynatrace-sdk/client-query';

import { ThumbsDownIcon, ViewIcon } from '@dynatrace/strato-icons';




function WorkloadThroughput({ filters, refreshToken }: ChartProps) {
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
        const throughputMetric = await serviceWorkload("requestCount.server",cluster, namespace, workload, timeframe);
        const throughputMetricSevenDaysAgo = await serviceWorkload("requestCount.server",cluster, namespace, workload,timeframe,undefined,true);

        const timeSeries  = await throughputMetric.metricDataToTimeseries("Throughput");
        const timeSeriesSevenDaysAgo   = await throughputMetricSevenDaysAgo.metricDataToTimeseries("7 Days Ago");

        setSeries([...timeSeries, ...timeSeriesSevenDaysAgo]);
        
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters,refreshToken]);

  return (
    <TimeseriesChart curve="smooth"
      loading={loading}
      data={series}
      
    >
      <TimeseriesChart.Legend position="bottom" />
      <ChartInteractions>
          <ChartInteractions.Zoom />
      </ChartInteractions>
    </TimeseriesChart>
  );
}

(WorkloadThroughput as any).dashboardWidget = true;

export { WorkloadThroughput };

