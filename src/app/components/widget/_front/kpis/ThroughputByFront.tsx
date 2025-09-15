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
import { AnalyticsIcon, ConnectorIcon } from '@dynatrace/strato-icons';
import { builtinThroughputUserActionByFront } from 'src/app/services/front/builtinUserActionService';
import { classicBaseLine2, classicBaseLine3 } from 'src/app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'src/app/services/core/MetricsClientClassic';


type ByFrontProp = {
  front: string;
};

const ThroughputByFront = ({ front }: ByFrontProp) => {

  const formatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.amount.one,
    maximumFractionDigits: 1,
    cascade: 1
  };
  
  const funcao = async (front: string, timeframe: TimeframeV2): Promise<NowBaseline> =>{
    const handdle = new MetricSeriesCollectionHandl()
    return builtinThroughputUserActionByFront(front,timeframe).then(it => {
      const now = handdle.getSum(it.getByMetric("count.xhr"))+handdle.getSum(it.getByMetric("count.load"));
      return classicBaseLine3(it,timeframe,"","").then(it => {
        const metric = it.getByMetric("xhr")
        return { now, baseline: handdle.getSum(metric) }
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

