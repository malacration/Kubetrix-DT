import React, { useCallback, useEffect, useState } from 'react';
import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { KpiCore, MetricDirection, NowBaseline } from '../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { ClockIcon } from '@dynatrace/strato-icons';
import { builtinApdexByFront, builtinDurationUserActionByFront } from 'app/services/front/builtinUserActionService';
import {  classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';


type ByFrontProp = {
  front: string;
};

const ApdexKpi = ({ front }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.amount.one,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    return builtinApdexByFront(front,timeframe).then(async metricResult => {
      const handdle = new MetricSeriesCollectionHandl()
      const apdex = handdle.getAvg(metricResult.getByMetric("apdex"));
      return classicBaseLineBy(metricResult,timeframe,"","").then(base => {
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
      metricDirection={MetricDirection.HigherIsBetter}
      trendAbsolute={true}
      trendLabel={'Base last 21 days'}
   ></KpiCore>
  );
};

export { ApdexKpi };