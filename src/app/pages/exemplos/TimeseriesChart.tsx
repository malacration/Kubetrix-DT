import React from 'react';

import { Flex } from '@dynatrace/strato-components/layouts';
import { TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import type { Timeseries } from '@dynatrace/strato-components-preview/charts';

const cpuUsage: Timeseries[] = [
  {
    name: ['pl1l-vh48.example.com', 'HYPERVISOR-CC7CFC844F787622'],
    unit: 'percent',
    datapoints: [
      {
        start: new Date('Tue, 05 Apr 2022 12:18:00 UTC'),
        end: new Date('Tue, 12 Apr 2022 12:19:00 UTC'),
        value: 51,
      },
      {
        start: new Date('Tue, 12 Apr 2022 12:19:00 UTC'),
        end: new Date('Tue, 19 Apr 2022 12:20:00 UTC'),
        value: 49.29,
      },
      {
        start: new Date('Tue, 19 Apr 2022 12:20:00 UTC'),
        end: new Date('Tue, 26 Apr 2022 12:21:00 UTC'),
        value: 51.98,
      },
      {
        start: new Date('Tue, 26 Apr 2022 12:21:00 UTC'),
        end: new Date('Tue, 03 May 2022 12:22:00 UTC'),
        value: 40.14,
      },
      {
        start: new Date('Tue, 03 May 2022 12:22:00 UTC'),
        end: new Date('Tue, 10 May 2022 12:23:00 UTC'),
        value: 46.71,
      },
      {
        start: new Date('Tue, 10 May 2022 12:23:00 UTC'),
        end: new Date('Tue, 17 May 2022 12:24:00 UTC'),
        value: 33.81,
      },
      {
        start: new Date('Tue, 17 May 2022 12:24:00 UTC'),
        end: new Date('Tue, 24 May 2022 12:25:00 UTC'),
        value: 41.57,
      },
      {
        start: new Date('Tue, 24 May 2022 12:25:00 UTC'),
        end: new Date('Tue, 24 May 2022 12:26:00 UTC'),
        value: 40.33,
      },
      {
        start: new Date('Tue, 24 May 2022 12:26:00 UTC'),
        end: new Date('Tue, 31 May 2022 12:27:00 UTC'),
        value: 43.63,
      },
      {
        start: new Date('Tue, 31 May 2022 12:27:00 UTC'),
        end: new Date('Tue, 07 Jun 2022 12:28:00 UTC'),
        value: 44.81,
      },
    ],
  },
  {
    name: ['pl1l-vh93.example.com', 'HYPERVISOR-610F030E04740015'],
    unit: 'percent',
    datapoints: [
      {
        start: new Date('Tue, 05 Apr 2022 12:18:00 UTC'),
        end: new Date('Tue, 12 Apr 2022 12:19:00 UTC'),
        value: 23.2,
      },
      {
        start: new Date('Tue, 12 Apr 2022 12:19:00 UTC'),
        end: new Date('Tue, 19 Apr 2022 12:20:00 UTC'),
        value: 25.54,
      },
      {
        start: new Date('Tue, 19 Apr 2022 12:20:00 UTC'),
        end: new Date('Tue, 26 Apr 2022 12:21:00 UTC'),
        value: 21.88,
      },
      {
        start: new Date('Tue, 26 Apr 2022 12:21:00 UTC'),
        end: new Date('Tue, 03 May 2022 12:22:00 UTC'),
        value: 24.62,
      },
      {
        start: new Date('Tue, 03 May 2022 12:22:00 UTC'),
        end: new Date('Tue, 10 May 2022 12:23:00 UTC'),
        value: 40,
      },
      {
        start: new Date('Tue, 10 May 2022 12:23:00 UTC'),
        end: new Date('Tue, 17 May 2022 12:24:00 UTC'),
        value: 42.99,
      },
      {
        start: new Date('Tue, 17 May 2022 12:24:00 UTC'),
        end: new Date('Tue, 24 May 2022 12:25:00 UTC'),
        value: 33.4,
      },
      {
        start: new Date('Tue, 24 May 2022 12:25:00 UTC'),
        end: new Date('Tue, 24 May 2022 12:26:00 UTC'),
        value: 12.15,
      },
      {
        start: new Date('Tue, 24 May 2022 12:26:00 UTC'),
        end: new Date('Tue, 31 May 2022 12:27:00 UTC'),
        value: 23,
      },
      {
        start: new Date('Tue, 31 May 2022 12:27:00 UTC'),
        end: new Date('Tue, 07 Jun 2022 12:28:00 UTC'),
        value: 35.65,
      },
    ],
  },
  {
    name: ['pl1i-vh41.example.com', 'HYPERVISOR-CC7EFC844F606622'],
    unit: 'percent',
    datapoints: [
      {
        start: new Date('Tue, 05 Apr 2022 12:18:00 UTC'),
        end: new Date('Tue, 12 Apr 2022 12:19:00 UTC'),
        value: 36.84,
      },
      {
        start: new Date('Tue, 12 Apr 2022 12:19:00 UTC'),
        end: new Date('Tue, 19 Apr 2022 12:20:00 UTC'),
        value: 31.77,
      },
      {
        start: new Date('Tue, 19 Apr 2022 12:20:00 UTC'),
        end: new Date('Tue, 26 Apr 2022 12:21:00 UTC'),
        value: 79.15,
      },
      {
        start: new Date('Tue, 26 Apr 2022 12:21:00 UTC'),
        end: new Date('Tue, 03 May 2022 12:22:00 UTC'),
        value: 2.1,
      },
      {
        start: new Date('Tue, 03 May 2022 12:22:00 UTC'),
        end: new Date('Tue, 10 May 2022 12:23:00 UTC'),
        value: 2.68,
      },
      {
        start: new Date('Tue, 10 May 2022 12:23:00 UTC'),
        end: new Date('Tue, 17 May 2022 12:24:00 UTC'),
        value: 1.18,
      },
      {
        start: new Date('Tue, 17 May 2022 12:24:00 UTC'),
        end: new Date('Tue, 24 May 2022 12:25:00 UTC'),
        value: 77.79,
      },
      {
        start: new Date('Tue, 24 May 2022 12:25:00 UTC'),
        end: new Date('Tue, 24 May 2022 12:26:00 UTC'),
        value: 1.56,
      },
      {
        start: new Date('Tue, 24 May 2022 12:26:00 UTC'),
        end: new Date('Tue, 31 May 2022 12:27:00 UTC'),
        value: 69.07,
      },
      {
        start: new Date('Tue, 31 May 2022 12:27:00 UTC'),
        end: new Date('Tue, 07 Jun 2022 12:28:00 UTC'),
        value: 66.87,
      },
    ],
  },
];

const Variants = () => {
  return (
    <Flex flexDirection="column" gap={16}>
      <TimeseriesChart data={cpuUsage} />
      <TimeseriesChart data={cpuUsage} variant="area" />
      <TimeseriesChart data={cpuUsage} variant="bar" />
    </Flex>
  );
};

export default Variants