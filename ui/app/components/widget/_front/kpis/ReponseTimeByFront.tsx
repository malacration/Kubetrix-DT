import React, { useEffect, useState } from 'react';

import { type PropsWithChildren } from 'react';

import { Formatter, SingleValue, SingleValueGrid, TrendDirection } from '@dynatrace/strato-components-preview/charts';
import { serviceMetricByApplicationName } from 'app/services/front/WorkloadService';
import { getDefaultTimeframe } from '../../../timeframe/DefaultTimeframe';
import { isQueryResult } from 'app/services/core/GrailConverter';
import { Container, Flex } from '@dynatrace/strato-components/layouts';

import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { Value } from '@dynatrace/strato-components-preview/charts/single-value-grid/slots/Value';
import { ClockIcon, ResearchIcon } from '@dynatrace/strato-icons';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { ActionButton } from '@dynatrace/strato-components-preview/layouts/app-header/ActionButton';
import { ChartProps } from '../../../filters/BarChartProps';
import { useLastRefreshedAt, useTimeFrame } from '../../../context/FilterK8sContext';
import { KpiCore, MetricDirection, NowBaseline } from './../../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';


type Trend = {
  direction: TrendDirection;
  value: number;  // magnitude da variação em %
  label: string;
};


type KpiByFrontProps = {
  front: string;
};

const ReponseTimeByFront = ({ front }: KpiByFrontProps) => {

  const timeFormatter: Formatter | FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.microsecond,
    maximumFractionDigits: 1,
    cascade: 1
  };

  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    return serviceMetricByApplicationName(front,timeframe,"dt.service.request.response_time","avg").then(it => {
      let now = 0;
      let baseline = 0;
      if(isQueryResult(it)){
        it.records.forEach(element => {
          if(element?.nowScalar){
            now = Number(element?.nowScalar ?? 0)
          }
            
          if(element?.baselineScalar){
            baseline = Number(element?.baselineScalar ?? 0)
          }
        });
      }
      return { now, baseline }
    })
  }

  return (
    // <SingleValue
    //     data={nowValue}
    //     formatter={formatter}
    //     alignment={'center'}
    //     label={'Response Time'}
    //     applyThresholdBackground={true}
    //     // prefixIcon={<ResearchIcon />}
    //     color={Colors.Charts.Threshold.Good.Default}
    //     thresholds={thresholds()}
    //     loading={loading}
    //     prefixIcon={ <ClockIcon/>}
    // >
    //       <SingleValue.Trend
    //         direction={getTrend().direction}
    //         formatter={{
    //           input: units.percentage.percent,
    //           output: units.percentage.percent,
    //         }}
    //         value={getTrend().value}
    //         label={getTrend().label}
    //       />
    // </SingleValue>
    (<KpiCore 
      kpiLabel='Response Time' 
      unitFormatter={timeFormatter}
      metricDirection={MetricDirection.LowerIsBetter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
    >
    </KpiCore>)
  );
};

export { ReponseTimeByFront };