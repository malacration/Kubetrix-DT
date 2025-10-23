import { Timeseries, TimeseriesAnnotations, type TimeseriesAnnotationsMarkerProps, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'app/services/core/MetricsClientClassic';
import { responseTime } from 'app/services/k8s/WorkloadService';
import { ChartProps } from '../filters/BarChartProps';
import { shiftTimeframeBack } from 'app/model/ShiftTimeframeBack';
import { QueryResult } from '@dynatrace-sdk/client-query';
import { DQLResultConverter, convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { convert, units } from "@dynatrace-sdk/units";
import { ThumbsDownIcon, ViewIcon } from '@dynatrace/strato-icons';
import { isQueryResult, queryResultToTimeseries } from 'app/services/core/GrailConverter';




function WorkloadResponseTime({ filters, lastRefreshedAt, title = "windson" }: ChartProps) {
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
        if(isQueryResult(result)){
          const timeSeries = convertQueryResultToTimeseries(result)
          timeSeries.forEach(it => it.unit = units.time.microsecond)
          setSeries(timeSeries)
        }
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters,lastRefreshedAt]);

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

