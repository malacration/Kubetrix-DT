import React from 'react';

import { MeterBarChart } from '@dynatrace/strato-components-preview/charts';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { ClockIcon } from '@dynatrace/strato-icons';

const Thresholds = () => {
  return (
    <div style={{ width: '400px', height: '120px' }}>
      <MeterBarChart value={50}>
        <MeterBarChart.Label>Host unit hours</MeterBarChart.Label>
        <MeterBarChart.Icon>
          <ClockIcon />
        </MeterBarChart.Icon>
        <MeterBarChart.Value>50/100</MeterBarChart.Value>
        <MeterBarChart.Min>0</MeterBarChart.Min>
        <MeterBarChart.Max>100</MeterBarChart.Max>

        <MeterBarChart.Threshold
          name="Good"
          color={Colors.Charts.Threshold.Good.Default}
          value={20}
        />
        <MeterBarChart.Threshold
          name="Warning"
          color={Colors.Charts.Threshold.Warning.Default}
          value={50}
          showIndicator
        />
        <MeterBarChart.Threshold
          name="Bad"
          color={Colors.Charts.Threshold.Bad.Default}
          value={75}
          showIndicator
        />
        <MeterBarChart.ThresholdLegend />
      </MeterBarChart>
    </div>
  );
};

export default Thresholds