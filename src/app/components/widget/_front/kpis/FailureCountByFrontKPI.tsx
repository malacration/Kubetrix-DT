import React, { useCallback, useEffect, useState } from 'react';

import { serviceMetricByApplicationName, responseTimePercentilByApplicationName } from 'src/app/services/front/WorkloadService';
import { isQueryResult } from 'src/app/services/core/GrailConverter';

import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { useTimeFrame } from '../../../context/FilterK8sContext';
import { KpiCore, MetricDirection, NowBaseline } from '../kpiCore';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { CriticalIcon, GrailIcon, HttpIcon } from '@dynatrace/strato-icons';


type ByFrontProp = {
  front: string;
};
const FailureCountByFrontKPI = ({ front }: ByFrontProp) => {

  const formatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.amount.one,
    maximumFractionDigits: 1,
    cascade: 1
  };
  
  const funcao = async (front: string, timeframe: TimeframeV2): Promise<NowBaseline> =>{
    return serviceMetricByApplicationName(front,timeframe,"dt.service.request.failure_count", "sum").then(it => {
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
    kpiLabel='Failure Count'
    unitFormatter={formatter}
    getNowBaseline={(timeframe) => funcao(front, timeframe)}
    metricDirection={MetricDirection.LowerIsBetter}
    prefixIcon={<CriticalIcon />}
   ></KpiCore>
  );
};

export { FailureCountByFrontKPI };

