import React from 'react';

import { TimeseriesChart } from '@dynatrace/strato-components-preview/charts';

const LoadingWithOutData = () => {
  return <TimeseriesChart loading data={[]} />;
};

export default LoadingWithOutData