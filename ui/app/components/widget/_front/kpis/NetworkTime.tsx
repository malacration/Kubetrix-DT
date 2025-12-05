import React from 'react';


import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { KpiCore, MetricDirection, NowBaseline } from './../../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { ClockIcon } from '@dynatrace/strato-icons';
import { builtinDurationUserActionByFront, builtinNetworkContributionByFront} from 'app/services/front/builtinUserActionService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';


type ByFrontProp = {
  front: string;
  agreggation : "median" | "avg" | "percentile(90)" | "percentile(99)"
};

const NetworkTime = ({ front, agreggation }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.millisecond,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    const handdle = new MetricSeriesCollectionHandl()
    return builtinNetworkContributionByFront(front,timeframe,agreggation).then(metricResult => {
      return classicBaseLineBy(metricResult,timeframe,"","",3).then(base => {
        return { 
          now : handdle.getAvg(metricResult.getByMetric("xhr")), 
          baseline : handdle.getAvg(base.getByMetric("xhr")) 
        }
      })
    })
  }

  const titulo = () =>{
    switch (agreggation) {
      case "median":
        return "(p50)";
      case "avg":
        return "(avg)";
      case "percentile(90)":
        return "(p90)";
      case "percentile(99)":
        return "(p99)";
      default:
        return "Network";
  }
  }

  return (
   <KpiCore
      kpiLabel={'Network '+titulo()}
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
      metricDirection={MetricDirection.LowerIsBetter}
      prefixIcon={<ClockIcon/>}
      trendLabel={'Base last 21 days'}
      trendAbsolute={true}
   ></KpiCore>
  );
};

export { NetworkTime };