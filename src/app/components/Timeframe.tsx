import { subDays, subHours } from 'date-fns';
import React, { useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { TimeframeSelector } from '@dynatrace/strato-components-preview/forms';

export const TimeFrame = () => {
  const [value, setValue] = useState<TimeframeV2 | null>({
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
  });

  return <TimeframeSelector value={value} onChange={setValue} />;
};