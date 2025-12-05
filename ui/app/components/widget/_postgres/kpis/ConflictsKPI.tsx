import React, { useCallback, useEffect, useState } from 'react';
import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { KpiCore, MetricDirection, NowBaseline } from '../../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import {  classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';
import { builtinSessionTimeByDatabase, conflictsByDatabase } from 'app/services/postgres/builtinDataBasesService';


type ByFrontProp = {
  front: string;
};

const ConflictsKPI = ({ front }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.millisecond,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (database: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    return conflictsByDatabase(database,timeframe).then(async metricResult => {
      const handdle = new MetricSeriesCollectionHandl()
      const apdex = handdle.getAvg(metricResult.getByMetric("conflicts"));
      return classicBaseLineBy(metricResult,timeframe,"","").then(base => {
            const baseline = handdle.getAvg(base.getByMetric("conflicts"))
            return { now : apdex, baseline : baseline}
          })
    })
  }

  return (
   <KpiCore
      kpiLabel='Conflicts'
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
      metricDirection={MetricDirection.HigherIsBetter}
      trendAbsolute={true}
      trendLabel={'Base last 21 days'}
   ></KpiCore>
  );
};

export { ConflictsKPI };