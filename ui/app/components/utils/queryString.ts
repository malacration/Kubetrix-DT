import { createParser } from 'nuqs';
import type { Timeframe, TimeValue } from '@dynatrace/strato-components-preview/core';

const SEP = '~';

export const parseAsTimeframe = createParser<Timeframe>({
  parse(queryValue: string): Timeframe | null {
    const parts = queryValue.split(SEP);
    if (parts.length !== 4) return null;
    const [fromValue, fromType, toValue, toType] = parts;
    if (!fromValue || !toValue) return null;
    return {
      from: { value: fromValue, type: fromType as TimeValue['type'], absoluteDate: fromValue } as TimeValue,
      to: { value: toValue, type: toType as TimeValue['type'], absoluteDate: toValue } as TimeValue,
    };
  },
  serialize(tf: Timeframe): string {
    return [tf.from.value, tf.from.type, tf.to.value, tf.to.type].join(SEP);
  },
});
