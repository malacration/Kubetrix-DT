import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'app/services/k8s/WorkloadService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import { Button } from '@dynatrace/strato-components/buttons';
import { CHART_COLORS, BASELINE_LABEL, currentBaselinePalette } from './style/ChartColors';
import { pickPairedResolutions, pickResolution } from 'app/components/timeframe/resolution';



function WorkloadCpuUsage({ filters}: ChartProps, desejado : boolean = false) {
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [throttled, setThrottled] = useState<Timeseries>();
  const [currentName, setCurrentName] = useState('Atual');
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

        // "now" e baseline calculadas juntas: garante que a baseline suba pra uma
        // resolução que a API de fato atende pra dado de até 21 dias atrás (mesmo
        // com resolução manual fina demais) e que "now" não fique absurdamente mais
        // fina que ela.
        const { now: nowResolution, baseline: baselineResolution } = pickPairedResolutions(timeframe, resolution);

        const result = await kubernetesWorkload("cpu_usage",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)", false, undefined, nowResolution);
        // Baseline com a mesma janela de 21 dias (média de 7/14/21 dias atrás) usada
        // nos KPIs — não os 7 dias fixos de antes. cpu_usage é um gauge (média por
        // bucket, não soma acumulada), então, diferente do Throughput, não precisa de
        // renormalização por resolução ao suavizar.
        const baseline = await classicBaseLineBy(result, timeframe, "", "", 3, baselineResolution);
        const throttled = await kubernetesWorkload("cpu_throttled",cluster, namespace, workload, timeframe, "sum:toUnit(MilliCores,Cores)", false, undefined, nowResolution);

        const name = workload?.toString() ?? "All";
        // Unidade passada explicitamente (igual ao Throughput com "Count"): sem isso,
        // metricDataToTimeseries tenta descobrir a unidade consultando a API pelo
        // metricId da série — que pra baseline é a expressão composta inteira
        // ((...):timeshift(-7d)+...)/3, não um metric ID válido, e a consulta some
        // com 404. A query já converte pra Cores via toUnit(MilliCores,Cores).
        const ts   = await result.metricDataToTimeseries(name, "Cores");
        const tsAgo   = await baseline.metricDataToTimeseries(BASELINE_LABEL, "Cores");
        const tsThrottled   = await throttled.metricDataToTimeseries("Throttled", "Cores");


        // Resolução própria, NÃO a "nowResolution" (pareada/suavizada com a
        // baseline): limits_cpu é um snapshot estático (limite do pod, não varia
        // minuto a minuto), buscado com :last. Com default(0,always), QUALQUER
        // bucket sem dado vira 0 — inclusive o último, se ainda estiver incompleto
        // no momento da consulta. Quanto mais grosso o bucket (ex.: 1h, que a
        // resolução pareada pode escolher pra timeframes maiores), maior a chance
        // do último bucket estar "em andamento" e :last pegar esse 0 em vez do
        // valor real — threshold sumia ou vinha errado por causa disso.
        const limits = await kubernetesWorkload(
          "limits_cpu",cluster, namespace, workload, timeframe,
          "max:fold(max):toUnit(MilliCores,Cores):last", false, undefined, pickResolution(0, timeframe, resolution)
        );

        if (cancelled) return;

        setThreshold(limits.getFirstValueOfFirstMetric()?.value ?? 0)

        if(desejado){
          result.plus(throttled)
        }

        setCurrentName(name);
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
      colorPalette={currentBaselinePalette(currentName)}
    >
        {throttled ? <TimeseriesChart.Bar data={throttled} color={CHART_COLORS.critical} /> : <></>}
        <TimeseriesChart.YAxis min={min} max={max} />
        {showThreshold && (
          <TimeseriesChart.Threshold
            data={{ value: threshold }}
            color={CHART_COLORS.threshold}
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