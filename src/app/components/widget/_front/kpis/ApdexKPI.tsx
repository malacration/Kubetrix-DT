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
import { builtinApdexByFront, builtinDurationUserActionByFront } from 'src/app/services/front/builtinUserActionService';
import { classicBaseLine, classicBaseLine2, classicBaseLine3 } from 'src/app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'src/app/services/core/MetricsClientClassic';


type ByFrontProp = {
  front: string;
};

const ApdexKpi = ({ front }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.amount.one,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (front: string, timeframe: TimeframeV2): Promise<NowBaseline> =>{
    return builtinApdexByFront(front,timeframe).then(metricResult => {
      const handdle = new MetricSeriesCollectionHandl()
      const apdex = handdle.getAvg(metricResult.getByMetric("apdex"));
      return classicBaseLine3(metricResult,timeframe,"","",2).then(base => {
            const baseline = handdle.getAvg(base.getByMetric("apdex"))
            return { now : apdex, baseline : baseline}
          })
    })
  }

  return (
   <KpiCore
      kpiLabel='Apdex'
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
      metricDirection={MetricDirection.LowerIsBetter}
      trendLabel={'Base last 21 days'}
   ></KpiCore>
  );
};

export { ApdexKpi };

