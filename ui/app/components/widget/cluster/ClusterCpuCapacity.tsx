import React, { useEffect, useMemo, useState } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { SingleValue, Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { InformationOverlay } from '@dynatrace/strato-components-preview/overlays';
import { Text } from '@dynatrace/strato-components/typography';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { units } from '@dynatrace-sdk/units';
import { ChartProps } from '../../filters/BarChartProps';
import { clusterCpuCapacity, ClusterCapacitySeries } from 'app/services/k8s/ClusterCapacity';
import { divideSeriesByBucket, lastValue, subtractSeriesByBucket } from 'app/model/ClusterCapacitySeries';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';

const CORE_FORMATTER = { input: units.unspecified.millicore, output: units.unspecified.core };

const cardStyle: React.CSSProperties = { height: '7em', minWidth: '10em', flex: '1 1 10em' };

/**
 * Ocupação de CPU do cluster (ou da frota inteira, sem cluster selecionado): quanto é
 * usado, reservado (request) e disponível (allocatable) agora, e como a fração de
 * cada um sobre o TOTAL disponível evolui ao longo do tempo — a capacidade total é
 * recalculada a cada bucket, então nodes entrando/saindo do cluster deslocam a % sem
 * precisar de re-snapshot manual.
 */
function ClusterCpuCapacity({ filters, lastRefreshedAt }: ChartProps) {
  const [data, setData] = useState<ClusterCapacitySeries>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filters) return;
    const cluster = filters.cluster?.value as string | undefined;
    const timeframe = filters.timeframe?.value;
    const resolution = filters.resolution?.value as string | undefined;

    if (!timeframe) {
      setData({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    clusterCpuCapacity(cluster, timeframe as never, resolution).then(result => {
      if (!cancelled) setData(result);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [filters, lastRefreshedAt]);

  const usedPct = useMemo(
    () => divideSeriesByBucket(data.used, data.available, 'Usado'),
    [data.used, data.available],
  );
  const reservedPct = useMemo(
    () => divideSeriesByBucket(data.reserved, data.available, 'Reservado'),
    [data.reserved, data.available],
  );
  const throttledPct = useMemo(
    () => divideSeriesByBucket(data.throttled, data.available, 'Suprimido'),
    [data.throttled, data.available],
  );
  // "Impedido": reservado - usado, zerado quando o uso ultrapassa o reservado — a
  // parte da capacidade que está travada por request mas ociosa (não pode ser
  // agendada por outro workload, mesmo sem estar sendo consumida de verdade).
  const impeded = useMemo(
    () => subtractSeriesByBucket(data.reserved, data.used, 'CPU impedida'),
    [data.reserved, data.used],
  );
  const impededPct = useMemo(
    () => divideSeriesByBucket(impeded, data.available, 'Impedido'),
    [impeded, data.available],
  );
  const ratioSeries = [usedPct, reservedPct, throttledPct, impededPct]
    .filter((s): s is Timeseries => !!s);

  // Sem travar em 100%: o topo acompanha o maior valor de verdade + 5% de folga
  // (padding padrão do TimeSeriesMinMax), pra dar zoom quando os valores estão longe
  // de 100% — a linha de threshold em 100% só aparece quando o dado chega perto dela.
  const yAxis = useMemo(
    () => new TimeSeriesMinMax(ratioSeries).forYAxis(),
    [ratioSeries],
  );

  const help = (
    <Flex flexDirection="column" gap={8}>
      <Text>
        As linhas mostram, a cada intervalo de tempo, a fração da capacidade alocável
        TOTAL de CPU do cluster (soma de todos os nodes) que está sendo usada,
        reservada por request, e suprimida por throttling.
      </Text>
      <Text>
        Diferente de um percentual contra um valor fixo, o total disponível (o
        denominador) é recalculado a cada ponto da série — se um node entra ou sai do
        cluster, a % se ajusta sozinha a partir do bucket seguinte, em vez de ficar
        comparando contra uma capacidade que já não existe mais.
      </Text>
      <Text>
        <b>Impedido:</b> reservado menos usado (nunca negativo — quando o uso
        ultrapassa o reservado, não há nada impedido). É a capacidade que está travada
        por request mas ociosa: o scheduler não pode agendar outro pod ali, mesmo sem
        aquele CPU estar sendo consumido de verdade.
      </Text>
    </Flex>
  );

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex alignItems="center" gap={8}>
        <InformationOverlay>
          <InformationOverlay.Trigger aria-label="Como o percentual de CPU é calculado" />
          <InformationOverlay.Content>{help}</InformationOverlay.Content>
        </InformationOverlay>
        <Flex gap={12} flexWrap="wrap" style={{ flex: 1 }}>
          <div style={cardStyle}>
            <SingleValue
              data={lastValue(data.used) ?? 0}
              label="CPU usada"
              formatter={CORE_FORMATTER}
              loading={loading}
            />
          </div>
          <div style={cardStyle}>
            <SingleValue
              data={lastValue(data.reserved) ?? 0}
              label="CPU reservada"
              formatter={CORE_FORMATTER}
              loading={loading}
            />
          </div>
          <div style={cardStyle}>
            <SingleValue
              data={lastValue(data.available) ?? 0}
              label="CPU disponível"
              formatter={CORE_FORMATTER}
              loading={loading}
            />
          </div>
        </Flex>
      </Flex>

      <TimeseriesChart loading={loading} data={ratioSeries} height={300}>
        <TimeseriesChart.YAxis min={yAxis.min} max={yAxis.max} />
        <TimeseriesChart.Threshold
          data={{ value: 100 }}
          color={Colors.Charts.Threshold.Bad.Default}
          label="100% da capacidade disponível"
        />
        <TimeseriesChart.Legend position="bottom" />
      </TimeseriesChart>
    </Flex>
  );
}

Object.assign(ClusterCpuCapacity, { dashboardWidget: true });

export { ClusterCpuCapacity };
