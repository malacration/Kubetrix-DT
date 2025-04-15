import React from 'react';

import { Flex } from '@dynatrace/strato-components/layouts';
import {
  HoneycombChart,
  HoneycombTileNumericData,
} from '@dynatrace/strato-components-preview/charts';

const honeycombTileNumericData: HoneycombTileNumericData[] = [
  { value: 10757, name: 'Severe' },
  { value: 4106, name: 'Emergency' },
  { value: 1652, name: 'Notice' },
  { value: 10958, name: 'Alert' },
  { value: 7095, name: 'Error' },
  { value: 6935, name: 'Emergency' },
  { value: 1273, name: 'None' },
  { value: 2368, name: 'Warning' },
  { value: 10321, name: 'Alert' },
  { value: 3638, name: 'Notice' },
];

const NodeLabels = () => {
  return (
    <Flex gap={8} flexDirection="column">
      <HoneycombChart data={honeycombTileNumericData} showLabels />
      <HoneycombChart
        data={honeycombTileNumericData}
        width={200}
        height={100}
        showLabels
      />
    </Flex>
  );
};

export default NodeLabels