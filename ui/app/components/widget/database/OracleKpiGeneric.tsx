import React from 'react';
import {
  ConvertibleUnit,
  FormatOptions,
  Unit,
  units,
} from '@dynatrace-sdk/units';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { KpiCore, MetricDirection, NowBaseline } from '../kpiCore';
import { oracleMetricNowBaseline, OracleMetricScope } from 'app/services/oracle/oracleDatabaseService';

type OracleKpiGenericProps = {
  label: string;
  metric: string;
  scope: OracleMetricScope;
  candidateNames: string[];
  aggregation?: 'avg' | 'sum' | 'max' | 'min';
  unit?: Unit;
  metricDirection?: MetricDirection;
};

export const OracleKpiGeneric = ({
  label,
  metric,
  scope,
  candidateNames,
  aggregation = 'avg',
  unit = units.amount.one,
  metricDirection = MetricDirection.none,
}: OracleKpiGenericProps) => {
  const timeFormatter: FormatOptions<Unit, ConvertibleUnit> = {
    input: unit,
    maximumFractionDigits: 2,
  };

  const getNowBaseline = (timeframe: Timeframe): Promise<NowBaseline> =>
    oracleMetricNowBaseline(metric, aggregation, scope, candidateNames, timeframe);

  return (
    <KpiCore
      kpiLabel={label}
      unitFormatter={timeFormatter}
      getNowBaseline={getNowBaseline}
      metricDirection={metricDirection}
      trendAbsolute={true}
      trendLabel="Base last 21 days"
    />
  );
};
