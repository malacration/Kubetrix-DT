import { TimeframeSelector } from "@dynatrace/strato-components-preview/filters";
import React, { ForwardedRef, forwardRef, useEffect } from 'react';
import type { Timeframe, TimeValue } from '@dynatrace/strato-components-preview/core';
import { TimeRangePickerRef } from '@dynatrace/strato-components-preview/forms';
import { FormField } from '@dynatrace/strato-components-preview/forms';
import { useLastRefreshedAt, useSetTimeFrame, useTimeFrame } from '../context/FilterK8sContext';

import { parseTimeAsTimeValue } from '@dynatrace-sdk/units';


type TimeFrameProps = {
  onChange?: (value: Timeframe | null) => void;
};

const PRESET_VALUES = [
  { from: '-5m', to: 'now()' },
  { from: '-30m', to: 'now()' },
  { from: '-1h', to: 'now()' },
  { from: '-2h', to: 'now()' },
  { from: '-6h', to: 'now()' },
  { from: '-12h', to: 'now()' },
  { from: '@d', to: 'now()' },
  { from: '-1d@d', to: '@d' },
  { from: '-24h', to: 'now()' },
  { from: '-7d', to: 'now()' },
  { from: '-30d', to: 'now()' },
  { from: '-365d', to: 'now()' },
];

/** Recalcula os absoluteDate de um timeframe a partir de uma âncora (lastRefreshedAt). */
export function resolveTimeframeByAnchor(
  tf: Timeframe,
  anchor: Date | number,
  precision: 'day' | 'minutes' | 'seconds' | 'milliseconds' = 'minutes'
): Timeframe {
  const ref = typeof anchor === 'number' ? anchor : anchor.getTime();

  // Helper que aceita expressão ou ISO e retorna TimeValue resolvido
  const parse = (tv: TimeValue): TimeValue =>
    parseTimeAsTimeValue(tv.type === 'expression' ? tv.value : tv.absoluteDate, ref, precision) ?? tv;

  return {
    from: parse(tf.from),
    to: parse(tf.to),
  };
}

const TimeFrame = forwardRef<TimeRangePickerRef<HTMLDivElement>, TimeFrameProps>(
  ({ onChange }, ref) => {
    const value = useTimeFrame();
    const setValue = useSetTimeFrame();

    const contextLastRefreshedAt = useLastRefreshedAt()

    useEffect(() => {
      if (!contextLastRefreshedAt || !value) return;
      const newTimeframe = resolveTimeframeByAnchor(value, contextLastRefreshedAt, 'minutes');
      handleChange(newTimeframe)
    }, [contextLastRefreshedAt]);

    const handleChange = (newValue: Timeframe) => {
      setValue(newValue);
      onChange?.(newValue);
    };

    return (
      <TimeframeSelector
        ref={ref}
        value={value}
        onChange={handleChange}
        precision="minutes"
        stepper={false}
      >
        <TimeframeSelector.Presets>
          {[...PRESET_VALUES].map((item) => (
            <TimeframeSelector.PresetItem
              key={item.from + item.to}
              value={item}
            />
          ))}
        </TimeframeSelector.Presets>
      </TimeframeSelector>
    );
  }
);

// @ts-expect-error pede displayname e depois nao reconhece
TimeFrame.displayName = 'TimeFrame';

export { TimeFrame };