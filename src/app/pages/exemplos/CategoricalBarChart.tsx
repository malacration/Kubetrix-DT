import React from 'react';

import { Flex } from '@dynatrace/strato-components/layouts';
import {
  CategoricalBarChart,
  CategoricalBarChartData,
} from '@dynatrace/strato-components-preview/charts';

const serviceResponse: CategoricalBarChartData[] = [
  { category: 'WebServer', value: 200, unit: 'ms' },
  { category: 'CreditCardVerification', value: 700, unit: 'ms' },
  { category: 'Payment', value: 439, unit: 'ms' },
  { category: 'API', value: 147, unit: 'ms' },
  { category: 'AddToCart', value: 84, unit: 'ms' },
];
const investment: CategoricalBarChartData[] = [
  {
    category: 'Q1',
    value: { 'R&D': 140000, HR: 40000, Sales: 500000, Support: 400000 },
    unit: '$',
  },
  {
    category: 'Q2',
    value: { 'R&D': 200000, HR: 20000, Sales: 520000, Support: 380000 },
    unit: '$',
  },
  {
    category: 'Q3',
    value: { 'R&D': 225000, HR: 37000, Sales: 510000, Support: 427000 },
    unit: '$',
  },
  {
    category: 'Q4',
    value: { 'R&D': 278000, HR: 45000, Sales: 540000, Support: 489300 },
    unit: '$',
  },
];

const AddData = () => {
  return (
    <Flex gap={8} flexDirection="column">
      <CategoricalBarChart data={serviceResponse}>
        <CategoricalBarChart.ValueAxis label="Response time" />
      </CategoricalBarChart>
      <CategoricalBarChart data={investment}>
        <CategoricalBarChart.ValueAxis label="Investment" />
      </CategoricalBarChart>
    </Flex>
  );
};

export default AddData;