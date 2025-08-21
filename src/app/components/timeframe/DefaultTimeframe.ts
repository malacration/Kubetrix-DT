import { subHours } from 'date-fns';
import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';

function toIsoMinuteUTC(date: Date): string {
  // zera segundos e ms e formata em UTC como YYYY-MM-DDTHH:mmZ
  const d = new Date(date.getTime());
  d.setUTCSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-` +
    `${pad(d.getUTCMonth() + 1)}-` +
    `${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}:` +
    `${pad(d.getUTCMinutes())}Z`
  );
}

export function getDefaultTimeframe(): TimeframeV2 {
  const now = new Date();
  const from = subHours(now, 2);

  return {
    from: {
      absoluteDate: toIsoMinuteUTC(from), // ex.: "2025-08-18T05:57Z"
      value: 'now()-2h',
      type: 'expression',
    },
    to: {
      absoluteDate: toIsoMinuteUTC(now),  // ex.: "2025-08-18T07:57Z"
      value: 'now()',
      type: 'expression',
    },
  };
}
