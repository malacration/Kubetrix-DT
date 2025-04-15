import { subDays } from 'date-fns';
import React, { useState } from 'react';

import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { FilterBar } from '@dynatrace/strato-components-preview/filters';
import {
  SelectV2,
  TextInput,
} from '@dynatrace/strato-components-preview/forms';

const countries = ['Austria', 'Estonia', 'Poland', 'Spain'];
const cities = [
  'Linz',
  'Graz',
  'Hagenberg',
  'Innsbruck',
  'Klagenfurt',
  'Vienna',
  'Tallinn',
  'Gdansk',
  'Barcelona',
];

export const MultipleFilters = () => {
  const defaultFilterState = {
    text: { value: 'Dynatrace' },
    country: { value: 'Austria' },
    city: { value: ['Linz'] },
    timeframe: {
      value: {
        from: {
          absoluteDate: subDays(new Date(), 1827).toISOString(),
          value: 'now()-1827d',
          type: 'expression',
        },
        to: {
          absoluteDate: new Date().toISOString(),
          value: 'now()',
          type: 'expression',
        },
      } as TimeframeV2,
    },
  };
  const [timeframe, setTimeframe] = useState<TimeframeV2 | null>(
    defaultFilterState.timeframe.value
  );

  return (
    <FilterBar
      onFilterChange={() => {
        /* Insert filtering logic here */
      }}
    >
      <FilterBar.Item name="text" label="Full name">
        <TextInput defaultValue={defaultFilterState.text.value} />
      </FilterBar.Item>
      <FilterBar.Item name="country" label="Country">
        <SelectV2
          defaultValue={defaultFilterState.country.value}
          name="country"
          id="country-select"
          clearable
        >
          <SelectV2.Content>
            {countries.map((country) => (
              <SelectV2.Option key={country} value={country}>
                {country}
              </SelectV2.Option>
            ))}
          </SelectV2.Content>
        </SelectV2>
      </FilterBar.Item>
      <FilterBar.Item name="city" label="City">
        <SelectV2
          defaultValue={defaultFilterState.city.value}
          name="city"
          id="city-select"
          multiple
          clearable
        >
          <SelectV2.Content>
            {cities.map((city) => (
              <SelectV2.Option key={city} value={city}>
                {city}
              </SelectV2.Option>
            ))}
          </SelectV2.Content>
        </SelectV2>
      </FilterBar.Item>
    </FilterBar>
  );
};