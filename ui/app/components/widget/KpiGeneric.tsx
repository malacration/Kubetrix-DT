import React, { useCallback, useEffect, useState } from 'react';
import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { KpiCore, MetricDirection, NowBaseline } from './kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import {  classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';
import { activeConnectionByDatabase, builtinSessionTimeByDatabase } from 'app/services/postgres/builtinDataBasesService';
import { KpiBuiltinGeneric } from 'app/services/KpiBuiltinGeneric';


type kpiGenericProp = {
    label : string,
    type : string;
    metric : string;
    application: string;
    unit? : Unit
    aggregation? : string;
};

export const KpiGeneric = ({ label, type, metric, application, unit = units.amount.one, aggregation = 'avg' }: kpiGenericProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: unit,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (
    type : string, 
    metric : string, 
    application: string, 
    timeframe: Timeframe, 
    aggregation : string): Promise<NowBaseline> =>{

    return KpiBuiltinGeneric(type,metric,application,aggregation,timeframe).then(async metricResult => {
      const handdle = new MetricSeriesCollectionHandl()
      const apdex = handdle.getAvg(metricResult.getByMetric(metric));
      return classicBaseLineBy(metricResult,timeframe,"","").then(base => {
            const baseline = handdle.getAvg(base.getByMetric(metric))
            return { now : apdex, baseline : baseline}
          })
    })
  }

  return (
   <KpiCore
      kpiLabel={label}
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(type,metric,application, timeframe, aggregation)}
      metricDirection={MetricDirection.HigherIsBetter}
      trendAbsolute={true}
      trendLabel={'Base last 21 days'}
   ></KpiCore>
  );
};