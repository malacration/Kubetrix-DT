import React, { useCallback, useEffect, useState } from 'react';

import { serviceMetricByApplicationName, responseTimePercentilByApplicationName } from 'app/services/front/WorkloadService';
import { isQueryResult } from 'app/services/core/GrailConverter';

import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { useTimeFrame } from '../../../context/FilterK8sContext';
import { KpiCore, MetricDirection, NowBaseline } from './../../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { ClockIcon } from '@dynatrace/strato-icons';


type ByFrontProp = {
  front: string;
};

const P90ByFront = ({ front }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.microsecond,
    maximumFractionDigits: 1,
    cascade: 1
  };
  
  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    return responseTimePercentilByApplicationName(front,timeframe,95).then(it => {
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
   <KpiCore
    kpiLabel='Response P90'
    unitFormatter={timeFormatter}
    getNowBaseline={(timeframe) => funcao(front, timeframe)}
    metricDirection={MetricDirection.LowerIsBetter}
    prefixIcon={<ClockIcon/>}
   ></KpiCore>
  );
};

export { P90ByFront };