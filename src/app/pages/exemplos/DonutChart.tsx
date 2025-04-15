import React from 'react';

import { DonutChart } from '@dynatrace/strato-components-preview/charts';

const conversions = {
  slices: [
    {
      category: 'EMEA',
      value: 66,
    },
    {
      category: 'APAC',
      value: 25,
    },
    {
      category: 'LATAM',
      value: 33,
    },
    {
      category: 'NA',
      value: 5,
    },
  ],
  unit: '$',
};

const Grouping = () => {
  return (
    <>
      <p>Grouping with `relative` threshold</p>

      <DonutChart data={conversions}>
        <DonutChart.Grouping
          threshold={{ type: 'relative', value: 20 }}
          name={'Rest of the world'}
        />
      </DonutChart>

      <p>Grouping with `absolute` threshold</p>

      <DonutChart data={conversions}>
        <DonutChart.Grouping
          threshold={{ type: 'absolute', value: 26 }}
          name={'Rest of the world'}
        />
      </DonutChart>

      <p>Grouping with `number-of-slices` threshold</p>

      <DonutChart data={conversions}>
        <DonutChart.Grouping
          threshold={{ type: 'number-of-slices', value: 2 }}
          name={'Rest of the world'}
        />
      </DonutChart>
    </>
  );
};

export default Grouping