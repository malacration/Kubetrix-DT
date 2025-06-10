import { subDays } from 'date-fns';
import React, { useEffect, useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { ClusterSelection } from './properties/ClusterSelect';
import { NameSpaceSelection } from './properties/NameSpacesSelect';
import { WorkloadsSelection } from './properties/WorkloadsSelect';
import { TimeFrame } from '../timeframe/Timeframe';
import { getDefaultTimeframe } from '../timeframe/DefaultTimeframe';
import { FilterBarProps } from '../dashboard/DashBoard';
import { SelectComponent } from '../form/Select';
import { FrontendSelection } from './properties/FrontendSelect';

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


export const FilterFrontend = ({ onFiltersChange, refreshIntervalMs, setRefreshIntervalMs }: FilterBarProps) => {

    const [frontendSelected, setFrontendSelected] = useState<string>();
    const [timeframe, setTimeframe] = useState<TimeframeV2>(getDefaultTimeframe);

    const [allProps, setAllProps] = useState<FilterItemValues>({
      timeframe: { value: timeframe},
    });
 

    useEffect(() => {
      onFiltersChange?.(allProps);
    }, [frontendSelected,timeframe]);

  return (
    <FilterBar
      onFilterChange={(props) => {
        setAllProps((prev) => mergeFilterValues(prev, props));

        if(typeof props.idFrontend.value === 'string')
          setFrontendSelected(props.idFrontend.value)

        if(new Number(props.time.value) && setRefreshIntervalMs)
          setRefreshIntervalMs(props.time.value)

        // @ts-expect-error o framework garante a tipagem
        setTimeframe(props.timeframe.value)
      }}

      
    >
      <FilterBar.Item name="idFrontend" label="Frontend">
        <FrontendSelection timeFrame={timeframe}/>
      </FilterBar.Item>
      <FilterBar.Item name="timeframe" label="">
        <TimeFrame />
      </FilterBar.Item>
      <FilterBar.Item name="time" label="Auto Refresh">
        <SelectComponent
          defaultValue="300000"
          options={[
            new Option("5m","300000"),
            new Option("1m","60000"),
            new Option("30s","30000")
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
