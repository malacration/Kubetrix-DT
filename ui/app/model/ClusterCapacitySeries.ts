import type { Timeseries } from '@dynatrace/strato-components-preview/charts';
import { units } from '@dynatrace-sdk/units';

/**
 * Soma várias séries (ex.: uma por node) num total único, casando por timestamp —
 * não por índice posicional, já que séries de nodes diferentes podem ter buckets
 * ausentes em pontas distintas (node que entrou/saiu do cluster no meio da janela).
 */
export function sumSeriesByBucket(series: Timeseries[], name: string): Timeseries | undefined {
  if (series.length === 0) return undefined;

  const byTime = new Map<number, { sum: number; end?: Date }>();
  for (const s of series) {
    for (const dp of s.datapoints) {
      const t = +dp.start;
      const entry = byTime.get(t) ?? { sum: 0, end: dp.end };
      entry.sum += dp.value;
      byTime.set(t, entry);
    }
  }

  const datapoints = [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, entry]) => ({ start: new Date(t), end: entry.end, value: entry.sum }));

  return { name: [name], unit: series[0].unit, datapoints };
}

/**
 * Divide `numerator` por `denominator`, bucket a bucket, casando por timestamp (não
 * por índice posicional) — as duas séries vêm de buscas independentes que
 * compartilham timeframe+interval, mas casar por timestamp protege contra qualquer
 * desalinhamento nas pontas. Pontos sem denominador correspondente (ou zero) são
 * descartados, não zerados — evita picos enganosos no gráfico.
 */
export function divideSeriesByBucket(
  numerator: Timeseries | undefined,
  denominator: Timeseries | undefined,
  name: string,
  scale = 100,
): Timeseries | undefined {
  if (!numerator || !denominator) return undefined;

  const denomByTime = new Map<number, number>(
    denominator.datapoints
      .filter(dp => Number.isFinite(dp.value))
      .map(dp => [+dp.start, dp.value]),
  );

  const datapoints = numerator.datapoints.flatMap(dp => {
    const denomValue = denomByTime.get(+dp.start);
    if (!denomValue || !Number.isFinite(dp.value)) return [];
    return [{ ...dp, value: (dp.value / denomValue) * scale }];
  });

  if (datapoints.length === 0) return undefined;
  return { ...numerator, name: [name], unit: units.percentage.percent, datapoints };
}

/**
 * Diferença `a - b`, bucket a bucket, casada por timestamp (não por índice
 * posicional). Com `clampZero` (padrão), valores negativos viram 0 em vez de
 * negativos — uso: "impedido" = reservado - usado só existe quando o reservado
 * supera o usado (capacidade travada por request mas ociosa); se o uso ultrapassa o
 * reservado, não há nada impedido, então o valor é 0, não negativo.
 */
export function subtractSeriesByBucket(
  a: Timeseries | undefined,
  b: Timeseries | undefined,
  name: string,
  clampZero = true,
): Timeseries | undefined {
  if (!a || !b) return undefined;

  const bByTime = new Map<number, number>(
    b.datapoints.filter(dp => Number.isFinite(dp.value)).map(dp => [+dp.start, dp.value]),
  );

  const datapoints = a.datapoints.flatMap(dp => {
    const bValue = bByTime.get(+dp.start);
    if (bValue === undefined || !Number.isFinite(dp.value)) return [];
    const diff = dp.value - bValue;
    return [{ ...dp, value: clampZero ? Math.max(0, diff) : diff }];
  });

  if (datapoints.length === 0) return undefined;
  return { ...a, name: [name], datapoints };
}

/**
 * Descarta buckets cujo fim ainda não chegou — o bucket em andamento (o minuto/hora
 * mais recente) reporta 0 ou um valor parcial porque a ingestão daquele intervalo
 * ainda não terminou, não porque o uso caiu de verdade. Sem isso, tanto o card do
 * último valor quanto a ponta direita do gráfico de razão mostram um "zerado"
 * enganoso — mais visível quando a série tem poucas fontes somadas (ex.: um cluster
 * só), porque não sobra nenhum outro dado preenchendo aquele bucket.
 */
export function trimIncompleteBuckets(series: Timeseries | undefined): Timeseries | undefined {
  if (!series) return series;
  const now = Date.now();
  const datapoints = series.datapoints.filter(dp => !dp.end || +dp.end <= now);
  if (datapoints.length === 0) return undefined;
  return { ...series, datapoints };
}

/** Último valor finito de uma série — usado nos cards de resumo (snapshot atual). */
export function lastValue(series?: Timeseries): number | undefined {
  const dps = series?.datapoints ?? [];
  for (let i = dps.length - 1; i >= 0; i--) {
    if (Number.isFinite(dps[i].value)) return dps[i].value;
  }
  return undefined;
}
