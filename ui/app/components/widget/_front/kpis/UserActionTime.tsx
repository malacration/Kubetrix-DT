import React from 'react';


import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { KpiCore, MetricDirection, NowBaseline } from '../../kpiCore';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { ClockIcon } from '@dynatrace/strato-icons';
import { builtinDurationUserActionByFront} from 'app/services/front/builtinUserActionService';
import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { MetricSeriesCollectionHandl } from 'app/services/core/MetricsClientClassic';
import { pickResolution } from 'app/components/timeframe/resolution';


type ByFrontProp = {
  front: string;
  agreggation : "median" | "avg" | "percentile(90)" | "percentile(99)"
};

const UserActionTime = ({ front, agreggation }: ByFrontProp) => {

  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.millisecond,
    maximumFractionDigits: 2,
  };
  
  const funcao = async (front: string, timeframe: Timeframe): Promise<NowBaseline> =>{
    const handdle = new MetricSeriesCollectionHandl()
    return builtinDurationUserActionByFront(front,timeframe,agreggation).then(metricResult => {
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
        return "Típico (p50)";
      case "avg":
        return "Média (avg)";
      case "percentile(90)":
        return "10% piores (p90)";
      case "percentile(99)":
        return "Extremos (p99)";
      default:
        return "Action Duration";
  }
  }

  return (
   <KpiCore
      kpiLabel={titulo()}
      unitFormatter={timeFormatter}
      getNowBaseline={(timeframe) => funcao(front, timeframe)}
      metricDirection={MetricDirection.LowerIsBetter}
      prefixIcon={<ClockIcon/>}
      trendLabel={'Base last 21 days'}
      trendAbsolute={true}
   ></KpiCore>
  );
};

export { UserActionTime };