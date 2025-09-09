import React, { useEffect, useState } from 'react';
import { type ReactNode } from 'react';

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
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';


type Trend = {
  direction: TrendDirection;
  value: number;  // magnitude da variação em %
  label: string;
};

export enum MetricDirection {
  HigherIsBetter,
  LowerIsBetter,
}

export type NowBaseline = { now: number; baseline: number };

type KpiByFrontProps = {
  kpiLabel: string;
  unitFormatter : FormatOptions<Unit, ConvertibleUnit>
  neutralPercent? : number
  warningPercent? : number;
  badPercent? : number
  metricDirection : MetricDirection
  prefixIcon?: ReactNode
  getNowBaseline: (timeframe: TimeframeV2) => Promise<NowBaseline>;
};

const KpiCore = ({ 
    kpiLabel, 
    unitFormatter, 
    getNowBaseline,
    metricDirection,
    neutralPercent = 5, 
    warningPercent = 30, 
    badPercent = 50,
    prefixIcon
}: KpiByFrontProps) => {

    const timeframe = useTimeFrame()
    const lastRefreshedAt = useLastRefreshedAt() 

    const [nowValue, setNowValue] = useState<number>();
    const [baselineValue, setBaseLineValue] = useState<number | null>();
    const [loading, setLoading] = useState<boolean>(true);

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
        label: 'Base last 21 days ',
        };
    };

    const thresholds = () => {
        const isHigherBetter = metricDirection == MetricDirection.HigherIsBetter;
        if(!baselineValue)
        return []
        return isHigherBetter
        ? [
            { 
                comparator: 'less-than-or-equal-to', 
                value: baselineValue-(baselineValue*warningPercent/100), 
                color: Colors.Charts.Threshold.Warning.Default 
            },
            { 
                comparator: 'less-than-or-equal-to', 
                value: baselineValue-(baselineValue*badPercent/100),    
                color: Colors.Charts.Threshold.Bad.Default 
            },
            ]
        : [
            { 
                comparator: 'greater-than-or-equal-to', 
                value: baselineValue+(baselineValue*warningPercent/100), 
                color: Colors.Charts.Threshold.Warning.Default 
            },
            { 
                comparator: 'greater-than-or-equal-to', 
                value: baselineValue+(baselineValue*badPercent/100),    
                color: Colors.Charts.Threshold.Bad.Default 
            },
            ];
    };


    useEffect(() => {
        setLoading(true)
        getNowBaseline(timeframe).then(it => {
            setNowValue(it.now)
            setBaseLineValue(it.baseline)
            setLoading(false)
        })
    },[timeframe,lastRefreshedAt]);

    return (
        <SingleValue
            data={nowValue}
            formatter={unitFormatter}
            alignment={'center'}
            label={kpiLabel}
            applyThresholdBackground={true}
            // prefixIcon={<ResearchIcon />}
            color={Colors.Charts.Threshold.Good.Default}
            thresholds={thresholds()}
            loading={loading}
            prefixIcon={prefixIcon}
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

export { KpiCore };