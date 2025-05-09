import React, {
  ForwardedRef,
  forwardRef,
  useState,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
} from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import {
  TimeframeSelector,
  TimeRangePickerRef,
} from '@dynatrace/strato-components-preview/forms';
import { subHours } from 'date-fns';
import { getDefaultTimeframe } from './DefaultTimeframe';

type TimeFrameProps = {
  onChange?: (value: TimeframeV2 | null) => void;
};

const TimeFrame  = React.forwardRef<TimeRangePickerRef<HTMLDivElement>, TimeFrameProps>( 
  ({ onChange }, ref: ForwardedRef<TimeRangePickerRef<HTMLDivElement>> )  => {
  const [value, setValue] = useState<TimeframeV2 | null>(getDefaultTimeframe);

  const handleChange = (newValue: TimeframeV2 | null) => {
    setValue(newValue);
    onChange?.(newValue);
  };

  return <TimeframeSelector ref={ref} value={value} onChange={handleChange} />;
})

// @ts-expect-error pede displayname e depois nao reconhece
TimeFrame.displayName = "TimeFrame"


export { TimeFrame };
