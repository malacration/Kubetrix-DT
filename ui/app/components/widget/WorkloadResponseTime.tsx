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
import { BASELINE_LABEL, currentBaselinePalette } from './style/ChartColors';

const CURRENT_LABEL = 'Tempo de Resposta';


function WorkloadResponseTime({ filters, title = "windson" }: ChartProps) {
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filters) return;

    const { cluster, namespace, workload, timeframe, resolution } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
      resolution: filters.resolution?.value,
    };

    if (!timeframe) return;

    const load = async () => {
      setLoading(true);
      try {
        const result = await responseTime(cluster, namespace, workload, timeframe, false, resolution);
        if(isQueryResult(result)){
          const timeSeries = convertQueryResultToTimeseries(result)
          timeSeries.forEach(it => {
            it.unit = units.time.microsecond;
            // Os campos da query DQL se chamam "now"/"baseline" — renomeados aqui pros
            // rótulos padrão do app (mesmos usados nos demais gráficos de workload).
            const key = Array.isArray(it.name) ? it.name.join(' | ') : it.name;
            if (key === 'now') it.name = CURRENT_LABEL;
            else if (key === 'baseline') it.name = BASELINE_LABEL;
          })
          setSeries(timeSeries)
        }
      } catch (err) {
        console.error('Erro ao buscar métricas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters]);

  return (
    <TimeseriesChart
      loading={loading}
      data={series}
      truncationMode={"start"}
      curve="smooth"
      colorPalette={currentBaselinePalette(CURRENT_LABEL)}
    >
      <TimeseriesChart.Legend position="bottom" />
    </TimeseriesChart>
  );
}

(WorkloadResponseTime as any).dashboardWidget = true;

export { WorkloadResponseTime };

