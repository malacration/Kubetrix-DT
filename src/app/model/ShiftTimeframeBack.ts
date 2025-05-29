import { subDays } from 'date-fns';
import type { TimeframeV2, TimeValue } from '@dynatrace/strato-components-preview/core';

/**
 * Desloca o `from` e o `to` de um TimeframeV2 para trás em N dias.
 * Funciona para valores absolutos (tipo 'iso8601').
 *
 * ⚠️  Para valores relativos (tipo 'expression') não há como “mover” a data,
 *      então eles ficam inalterados. Ajuste essa lógica se precisar
 *      tratar expressões de outro jeito.
 *
 * @param timeframe Timeframe original.
 * @param days      Quantos dias recuar (default = 7).
 * @returns         Novo timeframe com datas ajustadas.
 */
export function shiftTimeframeBack(
  timeframe: TimeframeV2,
  days = 7,
): TimeframeV2 {
  const shift = (tv: TimeValue): TimeValue => {
    if (tv.type === 'iso8601' || !tv.type) {
      const newDate = subDays(new Date(tv.absoluteDate), days).toISOString();
      return {
        ...tv,
        absoluteDate: newDate,
        value: newDate,
        type: 'iso8601',
      };
    }
    return tv;
  };

  return {
    from: shift(timeframe.from),
    to: shift(timeframe.to),
  };
}
