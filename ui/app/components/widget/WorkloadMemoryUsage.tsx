import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { MetricResult } from 'app/services/core/MetricsClientClassic';
import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { kubernetesWorkload } from 'app/services/k8s/WorkloadService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';
import { Button } from '@dynatrace/strato-components/buttons';
import { CHART_COLORS, BASELINE_LABEL, currentBaselinePalette } from './style/ChartColors';
import { pickPairedResolutions, pickResolution } from 'app/components/timeframe/resolution';


function WorkloadMemoryUsage({ filters, lastRefreshedAt}: ChartProps) {
  const [metric, setMetric] = useState<MetricResult | null>(null);
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [currentName, setCurrentName] = useState('Atual');
  const [loading, setLoading] = useState(false);

  const [threshold, setThreshold] = useState<number>(0);
  const [showThreshold, setShowThreshold] = useState<boolean>(true);

  const [min,setMin] = useState(0)
  const [max,setMax] = useState(1)

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

        const result = await kubernetesWorkload("memory_working_set",cluster, namespace, workload, timeframe, "sum:toUnit(Byte,GibiByte)", false, undefined, nowResolution);
        // Baseline com a mesma janela de 21 dias (média de 7/14/21 dias atrás) usada
        // nos KPIs — não os 7 dias fixos de antes. memory_working_set é um gauge
        // (média por bucket, não soma acumulada), então não precisa de
        // renormalização por resolução ao suavizar (diferente do Throughput).
        const baseline = await classicBaseLineBy(result, timeframe, "", "", 3, baselineResolution);

        const name = workload?.toString() ?? "All";
        // Unidade explícita (mesmo motivo do WorkloadCpuUsage.tsx): sem isso,
        // metricDataToTimeseries tenta buscar a unidade na API usando o metricId da
        // baseline, que é a expressão composta ((...):timeshift(-7d)+...)/3 — não um
        // metric ID válido — e a consulta falha com 404. Já convertida pra GibiByte
        // via toUnit(Byte,GibiByte).
        const ts   = await result.metricDataToTimeseries(name, "GibiByte");
        const tsAgo  = await baseline.metricDataToTimeseries(BASELINE_LABEL, "GibiByte");


        // Resolução própria, NÃO a "nowResolution" (pareada/suavizada com a
        // baseline): limits_memory é um snapshot estático (limite do pod, não varia
        // minuto a minuto), buscado com :last. Com default(0,always), QUALQUER
        // bucket sem dado vira 0 — inclusive o último, se ainda estiver incompleto
        // no momento da consulta. Quanto mais grosso o bucket (ex.: 1h, que a
        // resolução pareada pode escolher pra timeframes maiores), maior a chance
        // do último bucket estar "em andamento" e :last pegar esse 0 em vez do
        // valor real — threshold sumia ou vinha errado por causa disso.
        const limits = await kubernetesWorkload(
          "limits_memory",cluster, namespace,
          workload, timeframe,
          "max:default(0,always):fold(max):toUnit(Byte,GibiByte):last", false, undefined, pickResolution(0, timeframe, resolution)
        );

        if (cancelled) return;

        setThreshold(limits.getFirstValueOfFirstMetric()?.value ?? 0)

        setCurrentName(name);
        setSeries([...ts,...tsAgo]);
      } catch (err) {
        if (!cancelled) console.error('Erro ao buscar métricas', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filters,lastRefreshedAt]);

  useEffect(() => {
    const minMax = new TimeSeriesMinMax(series, showThreshold ? threshold : 0)
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
        colorPalette={currentBaselinePalette(currentName)}
      >
        { showThreshold ?
            <TimeseriesChart.Threshold
            data={{ value: threshold }}
            color={CHART_COLORS.threshold}
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