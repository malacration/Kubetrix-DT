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
import { KpiCore, MetricDirection, NowBaseline } from '../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { CriticalIcon, GrailIcon, HttpIcon } from '@dynatrace/strato-icons';
import { builtinErrosRateByFront } from 'app/services/front/builtinUserActionService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';


type ByFrontProp = {
  front: string;
};
const FailureCountByFrontKPI = ({ front }: ByFrontProp) => {

  const formatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.percentage.percent,
    maximumFractionDigits: 1,
    cascade: 1
  };
  
  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    return builtinErrosRateByFront(front,timeframe).then(metricResult => {
      console.log(metricResult.baseQuery)
      const handdle = new MetricSeriesCollectionHandl()
      const now = handdle.getLast(metricResult.getByMetric("countOfErrors")!);
      return classicBaseLineBy(metricResult,timeframe,"","").then(base => {
            const baseline = handdle.getLast(base.getByMetric("countOfErrors")!)
            return { now : now!, baseline : baseline!}
      })
    })
  }

  return (
   <KpiCore
    kpiLabel='Failure Rate'
    unitFormatter={formatter}
    getNowBaseline={(timeframe) => funcao(front, timeframe)}
    metricDirection={MetricDirection.LowerIsBetter}
    trendAbsolute={true}
    prefixIcon={<CriticalIcon />}
    warningPercent={40}
    badPercent={70}

   ></KpiCore>
  );
};

export { FailureCountByFrontKPI };