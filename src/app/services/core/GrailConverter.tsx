import { QueryResult, ResultRecord } from '@dynatrace-sdk/client-query';
import { HoneycombTileNumericData } from '@dynatrace/strato-components-preview/charts';
import { Timeseries } from '@dynatrace/strato-components-preview/charts';

export function converterToHoneycomb(
  queryResult: QueryResult,
  nameKey = "name",
  valueKey = "value"
): HoneycombTileNumericData[] {
  return queryResult.records
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
      item.name = String(rec[nameKey]);
      item.value = num;

      return item as HoneycombTileNumericData;
    });
}

import { QueryResult } from '@dynatrace-sdk/client-query';
import { Timeseries } from '@dynatrace/strato-components-preview/charts';



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
  timeField: string = 'timestamp',
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


export function isQueryResult(obj: unknown): obj is QueryResult {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'records' in obj &&
    'types'   in obj
  );
}