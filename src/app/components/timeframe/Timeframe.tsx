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
  TimeRangePickerRef,
} from '@dynatrace/strato-components-preview/forms';

import { subHours } from 'date-fns';
import { getDefaultTimeframe } from './DefaultTimeframe';
import {
  FormField,
  TIMEFRAME_SELECTOR_PRESETS,
  TimeframeSelector,
  Label,
} from '@dynatrace/strato-components-preview/forms';
import { useSetTimeFrame, useTimeFrame } from '../context/FilterK8sContext';


type TimeFrameProps = {
  onChange?: (value: TimeframeV2 | null) => void;
};

const TimeFrame  = React.forwardRef<TimeRangePickerRef<HTMLDivElement>, TimeFrameProps>( 
  ({ onChange }, ref: ForwardedRef<TimeRangePickerRef<HTMLDivElement>> )  => {
  
  const value = useTimeFrame()
  const setValue = useSetTimeFrame()

  const handleChange = (newValue: TimeframeV2) => {
    setValue(newValue);
    onChange?.(newValue);
  };

  const presetValues = [
    {from: '-5m', to: 'now()'},
    {from: '-30m', to: 'now()'},
    {from: '-1h', to: 'now()'},
    {from: '-2h', to: 'now()'},
    {from: '-6h', to: 'now()'},
    {from: '-12h', to: 'now()'},
    {from: '@d', to: 'now()'},
    {from: '-1d@d', to: '@d'},
    {from: '-24h', to: 'now()'},
    {from: '-7d', to: 'now()'},
    {from: '-30d', to: 'now()'},
    {from: '-365d', to: 'now()'},
  ]
  

  return(
    <TimeframeSelector  ref={ref} value={value} onChange={handleChange} precision="minutes" stepper={false} >
      <TimeframeSelector.Presets>
        {[...presetValues].map((item) => (
          <TimeframeSelector.PresetItem
              key={item.from + item.to}
              value={item}
            />
          ))}
      </TimeframeSelector.Presets>
    </TimeframeSelector>);
})

// @ts-expect-error pede displayname e depois nao reconhece
TimeFrame.displayName = "TimeFrame"


export { TimeFrame };
