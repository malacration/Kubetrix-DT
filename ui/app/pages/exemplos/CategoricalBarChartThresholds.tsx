import React from 'react';

import { CategoricalBarChart } from '@dynatrace/strato-components-preview/charts';
import Colors from '@dynatrace/strato-design-tokens/colors';

const thresholdData = [
  { category: 'Unacceptable', value: 5 },
  { category: 'Poor', value: 56 },
  { category: 'Fair', value: 280 },
  { category: 'Good', value: 129 },
  { category: 'Excellent', value: 17 },
];

const ThresholdsPointsAndRangesOnVerticalLayout = () => {
  return (
    <CategoricalBarChart layout="vertical" data={thresholdData}>
      <CategoricalBarChart.Threshold
        data={{ value: 180 }}
        color={Colors.Charts.Threshold.Warning.Default}
      />
      <CategoricalBarChart.Threshold
        data={{ min: 200, max: 245 }}
        color={Colors.Charts.Threshold.Good.Default}
      />
      <CategoricalBarChart.Threshold
        data={{ value: 50 }}
        color={Colors.Charts.Threshold.Good.Default}
      />
      <CategoricalBarChart.Threshold
        data={{ min: 100, max: 150 }}
        color={Colors.Charts.Threshold.Warning.Default}
      />
      <CategoricalBarChart.Legend hidden={true} />
    </CategoricalBarChart>
  );
};

export default ThresholdsPointsAndRangesOnVerticalLayout;