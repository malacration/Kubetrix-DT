import React, { useEffect, useMemo, useState } from 'react';
import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Unit, units } from '@dynatrace-sdk/units';
import { useTimeFrame } from 'app/components/context/FilterK8sContext';
import { timeseriesCommandResultToChartSeries } from 'app/services/core/GrailConverter';
import { postgresMetricTimeseries } from 'app/services/postgres/postgresMetricTimeseries';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';

type PostgresMetricChartProps = {
  label: string;
  metric: string;
  // Valor CRU da dimensão `database` (ex: "pjesg") — não é o entity.name formatado usado pelos
  // KPIs via Classic API. Ver postgresEntityResolver.tsx / postgresMetricTimeseries.tsx.
  database: string;
  aggregation?: 'avg' | 'sum' | 'max' | 'min';
  unit?: Unit;
};

// Gráfico de linha (série ao longo do tempo) para uma métrica Postgres — complementa os KPIs
// (PostgresDatabaseKpis, valor único "agora vs. baseline"). Usa Grail/DQL diretamente (mesmo
// caminho comprovado do OracleMetricChart.tsx) em vez da Classic Metrics API.
//
// `database` aqui já deve ser o valor resolvido pelo hook useResolvedPostgresDatabase — este
// componente não faz a resolução, quem chama (PostgresDatabaseMetricsCharts) que resolve.
export const PostgresMetricChart = ({
  label,
  metric,
  database,
  aggregation = 'avg',
  unit = units.amount.one,
}: PostgresMetricChartProps) => {
  const timeframe = useTimeFrame();
  const [series, setSeries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!database) return;

    setLoading(true);
    postgresMetricTimeseries(metric, database, aggregation, timeframe)
      .then((result) => {
        setSeries(timeseriesCommandResultToChartSeries(result, label, unit));
      })
      .finally(() => setLoading(false));
  }, [metric, database, aggregation, timeframe, unit, label]);

  // Ver comentário equivalente em OracleMetricChart.tsx: min/max precisam ser calculados a
  // partir dos dados reais (TimeSeriesMinMax, clampZero: true) e passados juntos ao YAxis —
  // só `min` isolado não fixa o piso em zero.
  //
  // threshold=1: quando a série fica em zero o tempo inteiro (Conflicts/Deadlocks — eventos
  // raros), min===max===0 vira um domínio infinitesimal (Number.EPSILON) que renderiza mal e faz
  // o zero parecer "no meio" do gráfico. threshold=1 garante um teto mínimo sensato ([0, ~1])
  // nesse caso, sem afetar séries com dado real (onde o max real já é maior que 1).
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
