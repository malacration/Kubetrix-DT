import React, { useEffect, useMemo, useState } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { SingleValue, Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { InformationOverlay } from '@dynatrace/strato-components-preview/overlays';
import { Text } from '@dynatrace/strato-components/typography';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { units } from '@dynatrace-sdk/units';
import { ChartProps } from '../../filters/BarChartProps';
import { clusterMemoryCapacity, ClusterCapacitySeries } from 'app/services/k8s/ClusterCapacity';
import { divideSeriesByBucket, lastValue, subtractSeriesByBucket } from 'app/model/ClusterCapacitySeries';
import { TimeSeriesMinMax } from 'app/model/TimeSeriesMinMax';

const MEMORY_FORMATTER = { input: units.data.byte, output: units.data.gibibyte };

const cardStyle: React.CSSProperties = { height: '7em', minWidth: '10em', flex: '1 1 10em' };

/**
 * Ocupação de memória do cluster (ou da frota inteira, sem cluster selecionado):
 * quanto é usado, reservado (request) e disponível (allocatable) agora, e como a
 * fração de cada um sobre o TOTAL disponível evolui ao longo do tempo.
 *
 * Sem linha de "suprimido" (throttling): memória não tem essa métrica, e este tenant
 * não tem nenhum sinal de OOM kill disponível (nem métrica dt.containers.*, nem
 * evento K8S_EVENT, nem problema Davis) — confirmado ao vivo antes de implementar.
 * Tem, porém, "impedido" (reservado - usado, ver `subtractSeriesByBucket`), que não
 * depende de métrica nenhuma além das já buscadas.
 */
function ClusterMemoryCapacity({ filters, lastRefreshedAt }: ChartProps) {
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
    clusterMemoryCapacity(cluster, timeframe as never, resolution).then(result => {
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
  // "Impedido": reservado - usado, zerado quando o uso ultrapassa o reservado — a
  // parte da capacidade que está travada por request mas ociosa (não pode ser
  // agendada por outro workload, mesmo sem estar sendo consumida de verdade).
  const impeded = useMemo(
    () => subtractSeriesByBucket(data.reserved, data.used, 'Memória impedida'),
    [data.reserved, data.used],
  );
  const impededPct = useMemo(
    () => divideSeriesByBucket(impeded, data.available, 'Impedido'),
    [impeded, data.available],
  );
  const ratioSeries = [usedPct, reservedPct, impededPct].filter((s): s is Timeseries => !!s);

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
        TOTAL de memória do cluster (soma de todos os nodes) que está sendo usada e
        reservada por request.
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
        aquela memória estar sendo consumida de verdade.
      </Text>
    </Flex>
  );

  return (
    <Flex flexDirection="column" gap={8}>
      <Flex alignItems="center" gap={8}>
        <InformationOverlay>
          <InformationOverlay.Trigger aria-label="Como o percentual de memória é calculado" />
          <InformationOverlay.Content>{help}</InformationOverlay.Content>
        </InformationOverlay>
        <Flex gap={12} flexWrap="wrap" style={{ flex: 1 }}>
          <div style={cardStyle}>
            <SingleValue
              data={lastValue(data.used) ?? 0}
              label="Memória usada"
              formatter={MEMORY_FORMATTER}
              loading={loading}
            />
          </div>
          <div style={cardStyle}>
            <SingleValue
              data={lastValue(data.reserved) ?? 0}
              label="Memória reservada"
              formatter={MEMORY_FORMATTER}
              loading={loading}
            />
          </div>
          <div style={cardStyle}>
            <SingleValue
              data={lastValue(data.available) ?? 0}
              label="Memória disponível"
              formatter={MEMORY_FORMATTER}
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

Object.assign(ClusterMemoryCapacity, { dashboardWidget: true });

export { ClusterMemoryCapacity };
