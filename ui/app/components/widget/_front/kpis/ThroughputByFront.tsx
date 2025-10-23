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
import { AnalyticsIcon, ConnectorIcon } from '@dynatrace/strato-icons';
import { builtinThroughputUserActionByFront } from 'app/services/front/builtinUserActionService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';


type ByFrontProp = {
  front: string;
};

const ThroughputByFront = ({ front }: ByFrontProp) => {

  const formatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.amount.one,
    maximumFractionDigits: 1,
    cascade: 1
  };
  
  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    const handdle = new MetricSeriesCollectionHandl()
    return builtinThroughputUserActionByFront(front,timeframe).then(it => {
      const now = handdle.getSum(it.getByMetric("xhr")!)+handdle.getSum(it.getByMetric("load")!);
      return classicBaseLineBy(it,timeframe,"","").then(it => {
        const metric = it.getByMetric("xhr")
        return { now, baseline: handdle.getSum(metric!) }
      })
      return { now, baseline: 0 }
      
    })
  }

  return (
   <KpiCore
    kpiLabel='Throughput'
    unitFormatter={formatter}
    getNowBaseline={(timeframe) => funcao(front, timeframe)}
    metricDirection={MetricDirection.none}
    prefixIcon={<ConnectorIcon />}
   ></KpiCore>
  );
};

export { ThroughputByFront };