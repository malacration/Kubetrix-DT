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
import { builtinDurationUserActionByFront } from 'src/app/services/front/builtinUserActionService';
import { classicBaseLine, classicBaseLine2 } from 'src/app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'src/app/services/core/MetricsClientClassic';


type ByFrontProp = {
  front: string;
};

const UserActionTime = ({ front }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.millisecond,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (front: string, timeframe: TimeframeV2): Promise<NowBaseline> =>{
    return builtinDurationUserActionByFront(front,timeframe).then(metricResult => {
      try {
      const handdle = new MetricSeriesCollectionHandl()
      
      const xhr = handdle.getAvg(metricResult.getByMetric("duration.xhr.browser"));
      const xhrQtd = handdle.getSum(metricResult.getByMetric("count.xhr.browser"));
      const load = handdle.getAvg(metricResult.getByMetric("duration.load.browser"));
      const loadQtd = handdle.getSum(metricResult.getByMetric("count.load.browser"));
      const result = loadQtd+xhrQtd == 0 ? null : ((xhr*xhrQtd) + (load*loadQtd))/ (loadQtd+xhrQtd);
      if(result == null)
              return { now : result, baseline: null}
      return classicBaseLine2(metricResult,timeframe,":avg","",2).then(base => {
            const xhrBase = handdle.getAvg(base.getByMetric("duration.xhr.browser:splitBy():timeshift(-7d):avg:default(0,always)+builtin:apps.web.action.duration.xhr.browser"))
            const loadBase = handdle.getAvg(base.getByMetric("duration.load.browser:splitBy():timeshift(-7d):avg:default(0,always)+builtin:apps.web.action.duration.load.browser"))
            const loadCountBase = handdle.getAvg(base.getByMetric("count.load.browser:splitBy():timeshift(-7d):avg:default(0,always)+builtin:apps.web.action.count.load"))
            const xhrCountBase = handdle.getAvg(base.getByMetric("count.xhr.browser:splitBy():timeshift(-7d):avg:default(0,always)+builtin:apps.web.action.count.xhr"))
            
            const baseLine = ((xhrBase*xhrCountBase) + (loadBase*loadCountBase))/(xhrCountBase+loadCountBase);

            return { now : result, baseline : baseLine }
          })
      } catch (error) {
        return { now : result, baseline: -1 } 
      }
    })
  }

  return (
   <KpiCore
      kpiLabel='Action Duration'
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
      metricDirection={MetricDirection.LowerIsBetter}
      prefixIcon={<ClockIcon/>}
      trendLabel={'Base last 14 days'}
   ></KpiCore>
  );
};

export { UserActionTime };

