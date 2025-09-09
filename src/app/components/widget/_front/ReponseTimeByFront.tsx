import React, { useEffect, useState } from 'react';

import { type PropsWithChildren } from 'react';

import { Formatter, SingleValue, SingleValueGrid, TrendDirection } from '@dynatrace/strato-components-preview/charts';
import { serviceMetricByApplicationName } from 'src/app/services/front/WorkloadService';
import { getDefaultTimeframe } from '../../timeframe/DefaultTimeframe';
import { isQueryResult } from 'src/app/services/core/GrailConverter';
import { Container, Flex } from '@dynatrace/strato-components/layouts';

import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { Value } from '@dynatrace/strato-components-preview/charts/single-value-grid/slots/Value';
import { ClockIcon, ResearchIcon } from '@dynatrace/strato-icons';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { ActionButton } from '@dynatrace/strato-components-preview/layouts/app-header/ActionButton';
import { ChartProps } from '../../filters/BarChartProps';
import { useLastRefreshedAt, useTimeFrame } from '../../context/FilterK8sContext';


type Trend = {
  direction: TrendDirection;
  value: number;  // magnitude da variação em %
  label: string;
};

export enum MetricDirection {
  HigherIsBetter,
  LowerIsBetter,
}

type KpiByFrontProps = {
  front: string;
};

const ReponseTimeByFront = ({ front }: KpiByFrontProps) => {

  const timeFormatter: Formatter | FormatOptions<Unit, ConvertibleUnit> = {
    input: units.time.microsecond,
    maximumFractionDigits: 1,
    cascade: 1
  };

  const timeframe = useTimeFrame()
  const lastRefreshedAt = useLastRefreshedAt()

  //parametros
  const YELLOW_PCT = 25;   // ≥25% (piora moderada)
  const RED_PCT    = 40;   // ≥40% (piora severa)
  const formatter = timeFormatter
  const TOLERANCE_PCT = 5;
  
  const [metricDirection, setMetricDirection] = useState<MetricDirection>(MetricDirection.LowerIsBetter);
  const [nowValue, setNowValue] = useState<number>();
  const [baselineValue, setBaseLineValue] = useState<number | null>();

  const [loading, setLoading] = useState<boolean>(true);

  const COLORS = {
    yellow: Colors.Charts.Threshold.Warning,
    red:    Colors.Charts.Threshold.Warning,
    green:  Colors.Charts.CategoricalThemed.Swamps.Color01.Default,
  } as const;


  const getTrend = (): Trend => {
    if (
      baselineValue === null ||
      !isFinite(baselineValue) ||
      !isFinite(nowValue)
    ) {
      return { direction: 'neutral', value: 0, label: 'Sem baseline' };
    }

    const deltaAbs = nowValue - baselineValue;

    // % vs baseline; se baseline=0, tratamos como 0% (neutro) quando now=0,
    // e 100% quando now!=0, apenas para dar uma noção de magnitude.
    const deltaPct =
      baselineValue !== 0
        ? (deltaAbs / Math.abs(baselineValue)) * 100
        : (nowValue === 0 ? 0 : 100 * Math.sign(deltaAbs));

    const magnitude = Math.abs(deltaPct);

    // fora/ dentro da zona neutra (±5%)
    const outsideTolerance = magnitude > TOLERANCE_PCT;

    // mudança é "melhor" conforme a direção da métrica
    const changeIsBetter =
      metricDirection == MetricDirection.HigherIsBetter
        ? deltaAbs > 0
        : deltaAbs < 0;

    let direction: TrendDirection = 'neutral';
    if (outsideTolerance) {
      direction = changeIsBetter ? 'upward' : 'downward';
    }

    return {
      direction,
      value: Number.isFinite(magnitude) ? Number(magnitude.toFixed(1)) : 0,
      label: 'Base last 21 days ', // ajuste se quiser dinamizar
    };
  };

  const thresholds = () => {
    const isHigherBetter = metricDirection == MetricDirection.HigherIsBetter;

    // Regra:
    // - Se MAIOR É MELHOR → piora = valores NEGATIVOS (ex.: -25%, -40%)
    // - Se MENOR É MELHOR → piora = valores POSITIVOS (ex.: +25%, +40%)

    if(!baselineValue)
      return []

    return isHigherBetter
      ? [
          { 
            comparator: 'less-than-or-equal-to', 
            value: baselineValue-(baselineValue*YELLOW_PCT/100), 
            color: Colors.Charts.Threshold.Warning.Default 
          },
          { 
            comparator: 'less-than-or-equal-to', 
            value: baselineValue-(baselineValue*RED_PCT/100),    
            color: Colors.Charts.Threshold.Bad.Default 
          },
        ]
      : [
          { 
            comparator: 'greater-than-or-equal-to', 
            value: baselineValue+(baselineValue*YELLOW_PCT/100), 
            color: Colors.Charts.Threshold.Warning.Default 
          },
          { 
            comparator: 'greater-than-or-equal-to', 
            value: baselineValue+(baselineValue*RED_PCT/100),    
            color: Colors.Charts.Threshold.Bad.Default 
          },
        ];
  };


  useEffect(() => {
    setLoading(true)
    serviceMetricByApplicationName(front,timeframe).then(it => {
      if(isQueryResult(it)){
        it.records.forEach(element => {
          if(element.nowScalar){
            setNowValue(element.nowScalar)
            dataValue = element.nowScalar
          }
            
          if(element.baselineScalar){
            console.log(element.baselineScalar)
            setBaseLineValue(element.baselineScalar)
          }
          setLoading(false)
        });
      }
    })
  },[timeframe,lastRefreshedAt]);


  const trendColor = Colors.Charts.CategoricalThemed.Fireplace.Color03.Default;


  return (
    <SingleValue
        data={nowValue}
        formatter={formatter}
        alignment={'center'}
        label={'Response Time'}
        applyThresholdBackground={true}
        // prefixIcon={<ResearchIcon />}
        color={Colors.Charts.Threshold.Good.Default}
        thresholds={thresholds()}
        loading={loading}
        prefixIcon={ <ClockIcon/>}
    >
          <SingleValue.Trend
            direction={getTrend().direction}
            formatter={{
              input: units.percentage.percent,
              output: units.percentage.percent,
            }}
            value={getTrend().value}
            label={getTrend().label}
          />
    </SingleValue>
  );
};

export { ReponseTimeByFront };