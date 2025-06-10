import { Timeseries, TimeseriesAnnotations, type TimeseriesAnnotationsMarkerProps, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { responseTime } from 'src/app/services/k8s/WorkloadService';
import { ChartProps } from '../filters/BarChartProps';
import { shiftTimeframeBack } from 'src/app/model/ShiftTimeframeBack';
import { QueryResult } from '@dynatrace-sdk/client-query';

import { ThumbsDownIcon, ViewIcon } from '@dynatrace/strato-icons';




function WorkloadResponseTime({ filters, refreshToken, title = "windson" }: ChartProps) {
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
        const result = await responseTime(cluster, namespace, workload, timeframe);
        const baseLine = await responseTime(cluster, namespace, workload,timeframe,true);

        const timeSeries  = await result.metricDataToTimeseries(workload??"All");
        const timeSeriesBaseLine   = await baseLine.metricDataToTimeseries("Base Line");

        // TODO tentar usar a propria api do dynatrace https://developer.dynatrace.com/develop/visualize-data-in-apps/visualize-events/
        // const buildTimeseries = (...queryResults: (QueryResult | undefined)[]) =>
        //   queryResults.flatMap((res) => (res ? convertQueryResultToTimeseries(res) : []));
        
        setSeries([...timeSeries, ...timeSeriesBaseLine]);
        
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
      truncationMode={"start"}
      curve="smooth"
      
    >
      <TimeseriesChart.Legend position="bottom" />
    </TimeseriesChart>
  );
}

(WorkloadResponseTime as any).dashboardWidget = true;

export { WorkloadResponseTime };

