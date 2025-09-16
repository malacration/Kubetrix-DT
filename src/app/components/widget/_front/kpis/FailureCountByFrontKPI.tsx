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
import { builtinErrosCountByFront } from 'src/app/services/front/builtinUserActionService';
import { MetricSeriesCollectionHandl } from 'src/app/services/core/MetricsClientClassic';
import { classicBaseLineBy } from 'src/app/services/builtin/baseLineService';


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
    return builtinErrosCountByFront(front,timeframe).then(metricResult => {
      console.log(metricResult.baseQuery)
      const handdle = new MetricSeriesCollectionHandl()
      const now = handdle.getSum(metricResult.getByMetric("countOfErrors"));
      return classicBaseLineBy(metricResult,timeframe,"","").then(base => {
            const baseline = handdle.getSum(base.getByMetric("countOfErrors"))
            return { now : now, baseline : baseline}
      })
    })
  }

  return (
   <KpiCore
    kpiLabel='Failure Count'
    unitFormatter={formatter}
    getNowBaseline={(timeframe) => funcao(front, timeframe)}
    metricDirection={MetricDirection.LowerIsBetter}
    trendAbsolute={true}
    prefixIcon={<CriticalIcon />}
   ></KpiCore>
  );
};

export { FailureCountByFrontKPI };

