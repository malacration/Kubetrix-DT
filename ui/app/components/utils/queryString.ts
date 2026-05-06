import { createParser } from 'nuqs';
import type { Timeframe, TimeValue } from '@dynatrace/strato-components-preview/core';
import { parseTimeAsTimeValue } from '@dynatrace-sdk/units';

const SEP = '~';

function resolveAbsoluteDate(value: string, type: string): string {
  if (type === 'absolute') return value;
  const resolved = parseTimeAsTimeValue(value, Date.now(), 'minutes');
  return resolved?.absoluteDate ?? new Date().toISOString();
}

export const parseAsTimeframe = createParser<Timeframe>({
  parse(queryValue: string): Timeframe | null {
    const parts = queryValue.split(SEP);
    if (parts.length !== 4) return null;
    const [fromValue, fromType, toValue, toType] = parts;
    if (!fromValue || !toValue) return null;
    return {
      from: {
        value: fromValue,
        type: fromType as TimeValue['type'],
        absoluteDate: resolveAbsoluteDate(fromValue, fromType),
      } as TimeValue,
      to: {
        value: toValue,
        type: toType as TimeValue['type'],
        absoluteDate: resolveAbsoluteDate(toValue, toType),
      } as TimeValue,
    };
  },
  serialize(tf: Timeframe): string {
    return [tf.from.value, tf.from.type, tf.to.value, tf.to.type].join(SEP);
  },
});
