import React, { useEffect, useState } from 'react';

import { FilterBar, FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { TimeFrame } from '../timeframe/Timeframe';
import { FilterBarProps } from '../dashboard/DashBoard';
import { SelectComponent } from '../form/Select';
import { useAutoRefreshMs, useFrontendsSelected as useKPIentitysSelected, useFrontKpisSelected, useSetAutoRefreshMs, useSetFrontendsSelected as useSetKPIentitysSelected, useSetFrontKpisSelected as useSetKpisSelected, useSetTimeFrame, useTimeFrame } from '../context/FilterK8sContext';
import { KpisFrontSelection } from './properties/KpisFrontSelect';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { PostgresDBsSelection } from './properties/PostgresDBsSelect';
import { KpisPostgresDbSelection } from './properties/KpisPostgresDbSelect';

function mergeFilterValues(prev: FilterItemValues, next: FilterItemValues): FilterItemValues {
  const merged = { ...prev };
  for (const [key, val] of Object.entries(next)) {
    if (val && 'value' in val && val.value !== undefined && val.value !== null) {
      merged[key as keyof FilterItemValues] = val;
    }
  }
  return merged;
}


export const FilterPostgres = ({ onFiltersChange }: FilterBarProps) => {

  const setEntitys = useSetKPIentitysSelected()
  const setKpis = useSetKpisSelected()
  const setTimeframe = useSetTimeFrame()
  const autoRefresh = useAutoRefreshMs()
  const setAutoRefreshMs = useSetAutoRefreshMs()



  const [allProps, setAllProps] = useState<FilterItemValues>({
    KPIentity:   { value: useKPIentitysSelected() },
    timeframe: { value: useTimeFrame() },
    kpis: { value: useFrontKpisSelected() },
  });

  useEffect(() => {
    onFiltersChange?.(allProps);
  }, [allProps, onFiltersChange]);

  return (
    <FilterBar
      onFilterChange={(props) => {
        setAllProps((prev) => mergeFilterValues(prev, props));

        if(typeof props.KPIentity.value === 'string')
          setEntitys([props.KPIentity.value])
        else if(Array.isArray(props.KPIentity.value)){
          setEntitys(props.KPIentity.value)
        }

        if(typeof props.kpis.value === 'string')
          setKpis([props.kpis.value])
        else if(Array.isArray(props.kpis.value)){
          setKpis(props.kpis.value)
        }

        const maybeTime = Number(props.time?.value);
        if (maybeTime && !Number.isNaN(maybeTime)){
          setAutoRefreshMs(maybeTime);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        setTimeframe(props.timeframe.value as Timeframe);
      }}

      
    >
      <FilterBar.Item name="KPIentity" label="Postgres DBs">
        <PostgresDBsSelection />
      </FilterBar.Item>
      <FilterBar.Item name="kpis" label="KPI's">
        <KpisPostgresDbSelection />
      </FilterBar.Item>
      <FilterBar.Item name="timeframe" label="timeframe">
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
        />
      </FilterBar.Item>
    </FilterBar>
  );
};


export class Filter{
  label
}
