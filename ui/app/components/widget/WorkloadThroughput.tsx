import { ChartInteractions, Timeseries, TimeseriesAnnotations, type TimeseriesAnnotationsMarkerProps, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime, serviceWorkload } from 'app/services/k8s/WorkloadService';
import { ChartProps } from '../filters/BarChartProps';
import { shiftTimeframeBack } from 'app/model/ShiftTimeframeBack';
import { QueryResult } from '@dynatrace-sdk/client-query';

import { ThumbsDownIcon, ViewIcon } from '@dynatrace/strato-icons';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import { BASELINE_LABEL, currentBaselinePalette } from './style/ChartColors';
import { pickPairedResolutions, resolutionRatio } from 'app/components/timeframe/resolution';

const CURRENT_LABEL = 'Throughput';




function WorkloadThroughput({ filters}: ChartProps) {
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
        // Throughput é uma métrica de SOMA (contagem de requests por bucket). A
        // baseline alcança até 21 dias atrás do início do timeframe (timeshift), e a
        // Metrics API só mantém granularidade fina pros primeiros ~14 dias — por isso
        // "now" e baseline são calculadas juntas (pickPairedResolutions), garantindo
        // que a baseline suba pra uma resolução que a API de fato atende pra essa
        // idade (mesmo com resolução manual fina demais) e que "now" não fique
        // absurdamente mais fina que ela. Quando a baseline sai mais grossa que "now",
        // cada bucket dela precisa ser dividido pela razão de tamanho antes de
        // comparar: um bucket de 5min de uma soma tem ~5x o valor de um bucket de
        // 1min pela própria natureza da soma, então sem essa correção a baseline
        // apareceria artificialmente maior/menor mesmo com a taxa real idêntica.
        const { now: nowResolution, baseline: baselineResolution } = pickPairedResolutions(timeframe, resolution);
        const ratio = resolutionRatio(baselineResolution, nowResolution);

        const throughputMetric = await serviceWorkload("requestCount.server",cluster, namespace, workload, timeframe,"sum",false,0,nowResolution);
        // examples=3: mesma janela de 21 dias (média de 7/14/21 dias atrás) usada nos KPIs.
        const throughputMetricBaseline = await classicBaseLineBy(throughputMetric,timeframe,"","",3,baselineResolution);

        const timeSeries  = await throughputMetric.metricDataToTimeseries(CURRENT_LABEL,"Count");
        const timeSeriesBaseline   = await throughputMetricBaseline.metricDataToTimeseries(BASELINE_LABEL,"Count");

        if (ratio > 1) {
          timeSeriesBaseline.forEach(ts => ts.datapoints.forEach(dp => {
            if (dp.value != null) dp.value = dp.value / ratio;
          }));
        }

        setSeries([...timeSeries, ...timeSeriesBaseline]);

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
  },[series])  

  return (
    <TimeseriesChart curve="smooth"
      loading={loading}
      data={series}
      colorPalette={currentBaselinePalette(CURRENT_LABEL)}
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

