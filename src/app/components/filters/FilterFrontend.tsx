import React, { useEffect, useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { TimeFrame } from '../timeframe/Timeframe';
import { getDefaultTimeframe } from '../timeframe/DefaultTimeframe';
import { FilterBarProps } from '../dashboard/DashBoard';
import { SelectComponent } from '../form/Select';
import { FrontendSelection } from './properties/FrontendSelect';
import { useAutoRefreshMs, useFrontendsSelected, useSetAutoRefreshMs, useSetFrontendsSelected, useSetTimeFrame, useTimeFrame } from '../context/FilterK8sContext';

function mergeFilterValues(
  prev: FilterItemValues,
  next: FilterItemValues,
): FilterItemValues {
  const merged = { ...prev };

  for (const [key, val] of Object.entries(next)) {
    if (val && 'value' in val && val.value !== undefined && val.value !== null) {
      merged[key as keyof FilterItemValues] = val;
    }
  }
  return merged;
}


export const FilterFrontend = ({ onFiltersChange }: FilterBarProps) => {

  const setFrontend = useSetFrontendsSelected()
  const setTimeframe = useSetTimeFrame()
  const autoRefresh = useAutoRefreshMs()
  const setAutoRefreshMs = useSetAutoRefreshMs()



  const [allProps, setAllProps] = useState<FilterItemValues>({
    frontends:   { value: useFrontendsSelected() },
    timeframe: { value: useTimeFrame() },
  });

  useEffect(() => {
    onFiltersChange?.(allProps);
  }, [allProps, onFiltersChange]);

  return (
    <FilterBar
      onFilterChange={(props) => {
        setAllProps((prev) => mergeFilterValues(prev, props));

        if(typeof props.frontends.value === 'string')
          setFrontend([props.frontends.value])
        else{
          setFrontend(props.frontends.value)
        }


        const maybeTime = Number(props.time?.value);
        if (maybeTime && !Number.isNaN(maybeTime))
          setAutoRefreshMs(maybeTime);

        setTimeframe(props.timeframe.value)
      }}

      
    >
      <FilterBar.Item name="frontends" label="Frontend">
        <FrontendSelection />
      </FilterBar.Item>
      <FilterBar.Item name="timeframe" label="">
        <TimeFrame />
      </FilterBar.Item>
      <FilterBar.Item name="time" label="Auto Refresh">
        <SelectComponent
          defaultValue={autoRefresh.toString()}
          options={[
            new Option("10m", "600000"),
            new Option("5m", "300000"),
            new Option("1m", "60000"),
          ]}
          clearable={false}
        />
      </FilterBar.Item>
    </FilterBar>
  );
};


export class Filter{
  label
}
