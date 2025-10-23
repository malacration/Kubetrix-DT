import React from 'react';

import { GaugeChart } from '@dynatrace/strato-components-preview/charts';
import { units } from '@dynatrace-sdk/units';

const Formatter = () => {
  return (
    <div style={{ width: '400px' }}>
      <p>Value with appended unit</p>
      <GaugeChart value={50} formatter={(value) => `${value} $`}>
        <GaugeChart.Label />
        <GaugeChart.ValueLabel />
        <GaugeChart.MinLabel />
        <GaugeChart.MaxLabel />
      </GaugeChart>

      <p>Value with prepended unit</p>
      <GaugeChart value={50} formatter={(value) => `$ ${value}`}>
        <GaugeChart.Label />
        <GaugeChart.ValueLabel />
        <GaugeChart.MinLabel />
        <GaugeChart.MaxLabel />
      </GaugeChart>

      <p>Value converted to a different unit</p>
      <GaugeChart
        value={50}
        formatter={{
          input: units.data.bit,
          output: units.data.byte,
        }}
      >
        <GaugeChart.Label />
        <GaugeChart.ValueLabel />
        <GaugeChart.MinLabel />
        <GaugeChart.MaxLabel />
      </GaugeChart>
    </div>
  );
};

export default Formatter