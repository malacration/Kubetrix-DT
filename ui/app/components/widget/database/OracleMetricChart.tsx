import React, { useEffect, useMemo, useState } from 'react';
import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Unit, units } from '@dynatrace-sdk/units';
import { useTimeFrame } from 'app/components/context/FilterK8sContext';
import { timeseriesCommandResultToChartSeries } from 'app/services/core/GrailConverter';
import { oracleMetricTimeseries, OracleMetricScope } from 'app/services/oracle/oracleDatabaseService';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';

type OracleMetricChartProps = {
  label: string;
  metric: string;
  scope: OracleMetricScope;
  candidateNames: string[];
  aggregation?: 'avg' | 'sum' | 'max' | 'min';
  // Unidade REAL da métrica no Dynatrace — confirmada por consulta em vez de suposta (ex: as
  // métricas de tempo da extensão sql-oracle, como dbTime/cpuTime, vêm em microssegundos, não em
  // segundos ou ms). Sem isso, o gráfico plota o número cru (ex: 164518456) sem contexto de
  // unidade, o que parece "quebrado" mesmo estando correto.
  unit?: Unit;
};

// Gráfico de linha (série ao longo do tempo) para uma métrica Oracle — complementa os KPIs
// (OracleDatabaseKpis, valor único "agora vs. baseline") permitindo acompanhar a tendência.
export const OracleMetricChart = ({
  label,
  metric,
  scope,
  candidateNames,
  aggregation = 'avg',
  unit = units.amount.one,
}: OracleMetricChartProps) => {
  const timeframe = useTimeFrame();
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!candidateNames?.length) return;

    setLoading(true);
    oracleMetricTimeseries(metric, aggregation, scope, candidateNames, timeframe)
      .then((result) => {
        setSeries(timeseriesCommandResultToChartSeries(result, label, unit));
      })
      .finally(() => setLoading(false));
  }, [metric, aggregation, scope, candidateNames, timeframe, unit, label]);

  // Mesmo padrão dos gráficos de Workload já existentes (WorkloadCpuUsage/WorkloadThroughput):
  // passar só `min` isolado para o YAxis não é suficiente para fixar o piso em zero — é preciso
  // calcular min/max reais a partir dos dados (TimeSeriesMinMax, clampZero: true por padrão) e
  // passar os dois juntos, senão o eixo volta a "auto" e estende abaixo de zero.
  //
  // threshold=1: quando a série fica em zero o tempo inteiro (comum para Deadlocks — evento
  // raro), min===max===0 e o TimeSeriesMinMax cai no caso "série plana", somando/subtraindo
  // Number.EPSILON para não ter limites idênticos. Isso gera um domínio infinitesimal
  // (ex: [0, 4.4e-16]) que o gráfico não renderiza direito — o zero acaba parecendo "no meio".
  // Com threshold=1, o teto mínimo vira 1 nesse caso (Math.max(0, 1)), dando um domínio [0, ~1]
  // sensato, com o zero de fato na base.
  const yAxis = useMemo(() => new TimeSeriesMinMax(series, 1).forYAxis(), [series]);

  return (
    <div style={{ minWidth: 260, flex: 1 }}>
      <Heading level={5} style={{ margin: '0 0 4px 0' }}>{label}</Heading>
      <TimeseriesChart loading={loading} data={series} truncationMode="start" curve="smooth">
        <TimeseriesChart.Legend position="bottom" />
        <TimeseriesChart.YAxis min={yAxis.min} max={yAxis.max} />
      </TimeseriesChart>
    </div>
  );
};
