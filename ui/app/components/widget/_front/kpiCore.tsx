import React, { useEffect, useState } from 'react';
import { type ReactNode } from 'react';

import { type PropsWithChildren } from 'react';

import { Formatter, SingleValue, SingleValueGrid, Timeseries, TrendDirection, TrendIndicatorColors } from '@dynatrace/strato-components-preview/charts';
import { serviceMetricByApplicationName } from 'app/services/front/WorkloadService';
import { getDefaultTimeframe } from '../../timeframe/DefaultTimeframe';
import { isQueryResult } from 'app/services/core/GrailConverter';
import { Container, Flex } from '@dynatrace/strato-components/layouts';

import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { useLastRefreshedAt, useTimeFrame } from '../../context/FilterK8sContext';
import { Threshold, Timeframe } from '@dynatrace/strato-components-preview/core';


type Trend = {
  direction: TrendDirection;
  value: number;  // magnitude da variação em %
  label: string;
};

type PanelState = 'normal' | 'warning' | 'critical';


const PALETTE = {
    up: Colors.Charts.Threshold.Good.Default,
    down: Colors.Charts.Threshold.Bad.Default,
    downOnCritical: Colors.Text.Critical.OnAccent.Default,//'var(--kubetrix-negative-on-critical, #f59e0b)', // âmbar
    neutral: 'var(--kubetrix-neutral, #94a3b8)',      // cinza
};


function getPanelState(nowValue: number, thresholds: Threshold[]): PanelState {
    if (!thresholds || thresholds.length === 0) return 'normal';

    // Procura critical (Bad) primeiro para ser mais estrito
    const critical = thresholds.findLast?.(() => true) ?? thresholds[thresholds.length - 1];
    const warning  = thresholds[0];

    if (critical && matchComparator(nowValue, critical)) return 'critical';
    if (warning  && matchComparator(nowValue, warning))  return 'warning';
    return 'normal';
}

export enum MetricDirection {
  HigherIsBetter,
  LowerIsBetter,
  none
}


export type NowBaseline = { 
  now: number; 
  baseline: number,
  sparkline? : Timeseries
};

function matchComparator(now: number, t: Threshold): boolean {
  switch (t.comparator) {
    case 'less-than-or-equal-to':   return now <= t.value;
    case 'less-than':               return now <  t.value;
    case 'greater-than-or-equal-to':return now >= t.value;
    case 'greater-than':            return now >  t.value;
    default: return false;
  }
}

export function getTrendColorsAuto(
  nowValue: number,
  thresholdsFactory: () => Threshold[],
  opts?: { downwardOnCritical?: 'amber' | 'white' }
): TrendIndicatorColors {
  const thresholds = thresholdsFactory?.() ?? [];
  const state = getPanelState(nowValue, thresholds);

  let downward: string;
  if (state === 'critical') {
    downward = opts?.downwardOnCritical === 'white'
      ? 'var(--kubetrix-negative-on-critical, #ffffff)'
      : PALETTE.downOnCritical; // âmbar (default)
  } else {
    downward = PALETTE.down;
  }

  return {
    upward: PALETTE.up,
    downward,
    neutral: PALETTE.neutral,
  };
}



type KpiByFrontProps = {
  kpiLabel: string;
  unitFormatter : FormatOptions<Unit, ConvertibleUnit>
  neutralPercent? : number
  warningPercent? : number;
  badPercent? : number
  metricDirection : MetricDirection
  trendLabel? : string,
  prefixIcon?: ReactNode
  getNowBaseline: (timeframe: Timeframe) => Promise<NowBaseline>;
  trendAbsolute? : boolean
  thresholds? : Threshold[]
};


const KpiCore = ({ 
    kpiLabel, 
    unitFormatter, 
    getNowBaseline,
    metricDirection,
    neutralPercent = 5, 
    warningPercent = 30, 
    badPercent = 50,
    trendLabel = "Base last 21 days",
    trendAbsolute = false,
    
}: KpiByFrontProps) => {

    const timeframe = useTimeFrame()
    const lastRefreshedAt = useLastRefreshedAt() 

    const [nowValue, setNowValue] = useState<number>();
    const [baselineValue, setBaseLineValue] = useState<number | null>();
    const [sparkline, setSparkline] = useState<Timeseries | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const getTrend = (): Trend => {

        if(metricDirection == MetricDirection.none){
          
          return {
            direction: (baselineValue ?? 0) > nowValue! ? 'upward' : 'downward',
            value: baselineValue ?? 0,
            label: trendLabel,
          };
        }
          
        if (
        baselineValue === null ||
        !isFinite(baselineValue!) ||
        !isFinite(nowValue!)
        ) {
        return { direction: 'neutral', value: 0, label: 'Sem baseline' };
        }

        const deltaAbs = nowValue! - baselineValue!;

        // % vs baseline; se baseline=0, tratamos como 0% (neutro) quando now=0,
        // e 100% quando now!=0, apenas para dar uma noção de magnitude.
        const deltaPct =
        baselineValue !== 0
            ? (deltaAbs / Math.abs(baselineValue!)) * 100
            : (nowValue === 0 ? 0 : 100 * Math.sign(deltaAbs));

        const magnitude = Math.abs(deltaPct);
        const outsideTolerance = magnitude > neutralPercent;

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
        label: trendLabel,
      };
    };

    const thresholds = () : Threshold[] => {
        const isHigherBetter = metricDirection == MetricDirection.HigherIsBetter;
        if(!baselineValue || metricDirection == MetricDirection.none)
        return []
        return isHigherBetter
        ? [
            { 
                comparator: 'less-than-or-equal-to', 
                value: baselineValue-(baselineValue*warningPercent/100), 
                color: Colors.Background.Container.Warning.Accent
            },
            { 
                comparator: 'less-than-or-equal-to', 
                value: baselineValue-(baselineValue*badPercent/100),    
                color: Colors.Background.Container.Critical.Accent
            },
            ]
        : [
            { 
                comparator: 'greater-than-or-equal-to', 
                value: baselineValue+(baselineValue*warningPercent/100), 
                color: Colors.Background.Container.Warning.Accent 
            },
            { 
                comparator: 'greater-than-or-equal-to', 
                value: baselineValue+(baselineValue*badPercent/100),    
                color: Colors.Background.Container.Critical.Accent 
            },
            ];
    };

    useEffect(() => {
        setLoading(true)
        getNowBaseline(timeframe).then(it => {
            setNowValue(it.now)
            setBaseLineValue(it.baseline)
            setSparkline(it.sparkline ?? null)
            setLoading(false)
        })
    },[timeframe]);

    return (
        <SingleValue
            data={nowValue!}
            formatter={unitFormatter}
            alignment={'center'}
            label={kpiLabel}
            applyThresholdBackground={true}
            // prefixIcon={<ResearchIcon />}
            color={Colors.Background.Container.Success.Default}
            thresholds={thresholds()}
            loading={loading}
            // prefixIcon={prefixIcon}
        >
          {sparkline != null ? <SingleValue.Sparkline data={sparkline} showContextValues={true}> </SingleValue.Sparkline>: <></> }

          <SingleValue.Trend
              direction={getTrend().direction}
              formatter={ trendAbsolute || metricDirection == MetricDirection.none ? unitFormatter :
                {
                  input: units.percentage.percent,
                  output: units.percentage.percent,
                }
              }
              value={trendAbsolute ? baselineValue! : getTrend().value}
              label={getTrend().label}
              colorsOverride={getTrendColorsAuto(nowValue!,thresholds,{ downwardOnCritical: 'amber' })}
          />
        </SingleValue>
    );
};

export { KpiCore };