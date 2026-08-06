import { QueryResult, ResultRecord } from '@dynatrace-sdk/client-query';
import { HoneycombTileNumericData, Timeseries } from '@dynatrace/strato-components-preview/charts';
import { replaceHostNames } from 'app/components/utils/abreviaNomes';

export function converterToHoneycomb(
  queryResult: QueryResult | { error: string } | null | undefined,
  nameKey = "name",
  valueKey = "value"
): HoneycombTileNumericData[] {
  if (!isQueryResult(queryResult)) {
    return [];
  }

  const records = Array.isArray(queryResult.records) ? queryResult.records : [];

  return records
    // 1) Remover registros nulos e que não contenham as chaves nameKey/valueKey
    .filter(
      (rec): rec is ResultRecord =>
        rec !== null &&
        Object.prototype.hasOwnProperty.call(rec, nameKey) &&
        Object.prototype.hasOwnProperty.call(rec, valueKey)
    )
    // 2) Mapear cada registro
    .map((rec, idx) => {
      // Extrai e normaliza o valor numérico
      const raw = rec[valueKey];
      const num = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(num)) {
        throw new Error(
          `Registro ${idx}: campo "${valueKey}" não é numérico (“${raw}”).`
        );
      }

      // Monta o objeto resultante
      const item: Record<string, unknown> = {};
      for (const key in rec) {
        if (!Object.prototype.hasOwnProperty.call(rec, key)) continue;
        // pulamos as chaves que serão sobrescritas abaixo
        if (key === nameKey || key === valueKey) continue;
        item[key] = rec[key];
      }
      // campos obrigatórios do HoneycombTileNumericData
      item.name = replaceHostNames(String(rec[nameKey]));
      item.value = num;

      return item as HoneycombTileNumericData;
    });
}

/**
 * Converte um QueryResult em Timeseries (Strato).
 *
 * @param qr          Resultado do queryPoll/queryExecute.
 * @param timeField   Campo de tempo (default: "timestamp").
 * @param valueFields Campo(s) numérico(s) a plotar. Pode ser string ou string[].
 *                    Se omitido, será escolhido o 1º campo numérico existente.
 */
export function queryResultToTimeseries(
  qr: QueryResult,
  timeField = 'timestamp',
  valueFields: string | string[] = 'value',
): Timeseries[] {
  if (!qr.records?.length) return [];

  // Normaliza para array
  const explicitValueFields = Array.isArray(valueFields)
    ? valueFields
    : valueFields
    ? [valueFields]
    : [];

  // Detecta campos numéricos caso não tenham sido informados.
  const numericCandidates =
    explicitValueFields.length > 0
      ? explicitValueFields
      : Object.entries(qr.types[0].mappings)
          .filter(([, t]) => t?.type === 'double' || t?.type === 'long')
          .map(([n]) => n)
          .filter((n) => n !== timeField);

  if (numericCandidates.length === 0) return [];

  const dimensionFields = Object.keys(qr.records[0] as object).filter(
    (f) => f !== timeField && !numericCandidates.includes(f),
  );

  const seriesMap = new Map<string, Timeseries>();

  qr.records.forEach((rec) => {
    if (!rec) return;
    const ts = new Date(rec[timeField] as string | number | Date);

    numericCandidates.forEach((field) => {
      const v = rec[field] as number;
      if (v == null) return;

      // Nome base da série = dimensões; se houver + de um valueField, adiciona o nome dele.
      const nameParts: string[] = [];

      if (dimensionFields.length) {
        nameParts.push(...dimensionFields.map((d) => String(rec[d])));
      }

      if (numericCandidates.length > 1) {
        nameParts.push(field);
      }

      const key = nameParts.join('•') || field; // fallback quando não há dimensões
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { name: nameParts.length ? nameParts : [field], datapoints: [] });
      }
      seriesMap.get(key)!.datapoints.push({ start: ts, value: v });
    });
  });

  return Array.from(seriesMap.values()).map((s) => ({
    ...s,
    datapoints: s.datapoints.sort((a, b) => +a.start - +b.start),
  }));
}


/**
 * Converte o resultado BRUTO do comando `timeseries` do DQL (uma linha por combinação de
 * dimensões, com um campo array por métrica + `timeframe`/`interval`) diretamente em
 * `Timeseries[]`, sem passar por `convertQueryResultToTimeseries` (SDK Strato).
 *
 * Motivo: para queries simples de uma métrica só (sem `by:`/`append`), a detecção automática do
 * conversor da Strato não estava desdobrando o campo array em múltiplos pontos — o gráfico
 * renderizava só 1 ponto em vez da série inteira. Como o formato bruto do DQL é conhecido e
 * estável (confirmado manualmente contra o tenant: `interval` em nanossegundos, `timeframe.start`
 * em ISO, `value` como array alinhado aos buckets), montamos os datapoints nós mesmos — sem
 * depender de heurística de detecção de tipo da biblioteca.
 */
export function timeseriesCommandResultToChartSeries(
  queryResult: QueryResult | { error: string } | null | undefined,
  seriesName: string,
  unit?: Timeseries['unit'],
  valueField = 'value',
): Timeseries[] {
  if (!isQueryResult(queryResult)) return [];

  const series: Timeseries[] = [];

  (queryResult.records ?? []).forEach((record) => {
    if (!record) return;

    const values = record[valueField];
    if (!Array.isArray(values)) return;

    const timeframe = record['timeframe'] as { start?: string; end?: string } | undefined;
    const intervalNs = Number(record['interval'] ?? 0);
    const intervalMs = intervalNs / 1_000_000;

    if (!timeframe?.start || !intervalMs) return;

    const startMs = new Date(timeframe.start).getTime();

    const datapoints = values
      .map((value, index) => {
        if (value == null) return null;
        const start = new Date(startMs + index * intervalMs);
        const end = new Date(start.getTime() + intervalMs);
        return { start, end, value: Number(value) };
      })
      .filter((dp): dp is { start: Date; end: Date; value: number } => dp !== null);

    if (datapoints.length > 0) {
      series.push({ name: [seriesName], unit, datapoints });
    }
  });

  return series;
}

export function isQueryResult(obj: unknown): obj is QueryResult {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'records' in obj &&
    'types'   in obj
  );
}
