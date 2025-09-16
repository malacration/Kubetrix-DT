import React, { useCallback, useEffect, useState } from 'react';

import { serviceMetricByApplicationName, responseTimePercentilByApplicationName } from 'src/app/services/front/WorkloadService';
import { isQueryResult } from 'src/app/services/core/GrailConverter';

import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { KpiCore, MetricDirection, NowBaseline } from '../kpiCore';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { ClockIcon } from '@dynatrace/strato-icons';
import { builtinDurationUserActionByFront} from 'src/app/services/front/builtinUserActionService';
import { classicBaseLineBy } from 'src/app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'src/app/services/core/MetricsClientClassic';
import { pickResolution } from 'src/app/components/timeframe/resolution';


type ByFrontProp = {
  front: string;
};

const UserActionTime = ({ front }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.millisecond,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (front: string, timeframe: TimeframeV2): Promise<NowBaseline> =>{
    const handdle = new MetricSeriesCollectionHandl()
    return builtinDurationUserActionByFront(front,timeframe).then(metricResult => {
      return classicBaseLineBy(metricResult,timeframe,"","",3).then(base => {
        return { 
          now : handdle.getAvg(metricResult.getByMetric("xhr")), 
          baseline : handdle.getAvg(base.getByMetric("xhr")) 
        }
      })
    })
  }

  return (
   <KpiCore
      kpiLabel='Action Duration'
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
      metricDirection={MetricDirection.LowerIsBetter}
      prefixIcon={<ClockIcon/>}
      trendLabel={'Base last 21 days'}
   ></KpiCore>
  );
};

export { UserActionTime };

