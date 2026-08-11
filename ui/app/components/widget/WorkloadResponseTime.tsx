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
import { BASELINE_LABEL, CHART_COLORS } from './style/ChartColors';
import { Button } from '@dynatrace/strato-components/buttons';

// "now" e baseline sempre usam a mesma agregação (avg ou median), escolhida pelo
// toggle abaixo — ver k8s/WorkloadService.tsx#responseTime(). Rótulo muda junto pra
// deixar claro qual estatística está no gráfico.
function currentLabel(aggregation: 'avg' | 'median') {
  return aggregation === 'median' ? 'Tempo de Resposta · p(50)' : 'Tempo de Resposta · média';
}
function baselineLabel(aggregation: 'avg' | 'median') {
  return aggregation === 'median' ? `${BASELINE_LABEL} · p(50)` : `${BASELINE_LABEL} · média`;
}

// Preferência do usuário — lembra a escolha entre sessões/recarregamentos.
const AGGREGATION_STORAGE_KEY = 'kubetrix.responseTime.aggregation';

function loadStoredAggregation(): 'avg' | 'median' {
  const stored = localStorage.getItem(AGGREGATION_STORAGE_KEY);
  return stored === 'avg' ? 'avg' : 'median';
}


function WorkloadResponseTime({ filters, title = "windson" }: ChartProps) {
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);
  const [aggregation, setAggregation] = useState<'avg' | 'median'>(loadStoredAggregation);

  useEffect(() => {
    localStorage.setItem(AGGREGATION_STORAGE_KEY, aggregation);
  }, [aggregation]);

  useEffect(() => {
    if (!filters) return;

    let cancelled = false;

    const { cluster, namespace, workload, timeframe, resolution } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
      resolution: filters.resolution?.value,
    };

    if (!timeframe) return;

    const current = currentLabel(aggregation);
    const baseline = baselineLabel(aggregation);

    const load = async () => {
      setLoading(true);
      try {
        const result = await responseTime(cluster, namespace, workload, timeframe, false, resolution, aggregation);
        if(isQueryResult(result)){
          const timeSeries = convertQueryResultToTimeseries(result)
          timeSeries.forEach(it => {
            it.unit = units.time.microsecond;
            // Os campos da query DQL se chamam "now"/"baseline" — renomeados aqui pros
            // rótulos padrão do app (mesmos usados nos demais gráficos de workload).
            const key = Array.isArray(it.name) ? it.name.join(' | ') : it.name;
            if (key === 'now') it.name = current;
            else if (key === 'baseline') it.name = baseline;
          })
          if (!cancelled) setSeries(timeSeries)
        }
      } catch (err) {
        if (!cancelled) console.error('Erro ao buscar métricas', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filters, aggregation]);

  return (
    <div>
      <Button
        color="primary" variant="accent"
        onClick={() => setAggregation(a => (a === 'median' ? 'avg' : 'median'))}
      >
        {aggregation === 'median' ? 'Usar média' : 'Usar mediana (p50)'}
      </Button>
      <TimeseriesChart
        loading={loading}
        data={series}
        truncationMode={"start"}
        curve="smooth"
        colorPalette={{
          [currentLabel(aggregation)]: CHART_COLORS.current,
          [baselineLabel(aggregation)]: CHART_COLORS.baseline,
        }}
      >
        <TimeseriesChart.Legend position="bottom" />
      </TimeseriesChart>
    </div>
  );
}

(WorkloadResponseTime as any).dashboardWidget = true;

export { WorkloadResponseTime };

