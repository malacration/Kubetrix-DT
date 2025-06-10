import { QueryResult, ResultRecord } from '@dynatrace-sdk/client-query';
import { HoneycombTileNumericData } from '@dynatrace/strato-components-preview/charts';

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
