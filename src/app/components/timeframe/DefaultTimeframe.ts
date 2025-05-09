import { subHours } from 'date-fns';
import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';

export function getDefaultTimeframe(): TimeframeV2 {
  return {
    from: {
      absoluteDate: subHours(new Date(), 2).toISOString(),
      value: 'now()-2h',
      type: 'expression',
    },
    to: {
      absoluteDate: new Date().toISOString(),
      value: 'now()',
      type: 'expression',
    },
  };
}
