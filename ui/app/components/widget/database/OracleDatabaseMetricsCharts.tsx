import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { units } from '@dynatrace-sdk/units';
import { OracleMetricChart } from './OracleMetricChart';

type OracleDatabaseMetricsChartsProps = {
  label: string;
  candidateNames: string[];
};

// Gráficos ao longo do tempo para uma PDB Oracle específica — mesmas métricas do bloco de KPIs
// (OracleDatabaseKpis), mas como série temporal em vez de valor único.
export const OracleDatabaseMetricsCharts = ({ label, candidateNames }: OracleDatabaseMetricsChartsProps) => {
  return (
    <Flex flexDirection="column" gap={4} style={{ marginBottom: '1rem' }}>
      <Heading level={4} style={{ margin: 0 }}>{label} <span style={{ fontSize: '0.7em', opacity: 0.7 }}>Oracle (PDB)</span></Heading>

      <Flex flexWrap="wrap" gap={16}>
        <OracleMetricChart
          label="Active Sessions"
          metric="com.dynatrace.extension.sql-oracle.sessions.active"
          scope="database"
          candidateNames={candidateNames}
          aggregation="avg"
        />
        <OracleMetricChart
          label="Blocked Sessions"
          metric="com.dynatrace.extension.sql-oracle.sessions.blocked"
          scope="database"
          candidateNames={candidateNames}
          aggregation="max"
        />
        <OracleMetricChart
          label="Deadlocks"
          metric="com.dynatrace.extension.sql-oracle.sessions.deadlocks.count"
          scope="database"
          candidateNames={candidateNames}
          aggregation="sum"
        />
        <OracleMetricChart
          label="DB Time"
          metric="com.dynatrace.extension.sql-oracle.queries.dbTime.count"
          scope="database"
          candidateNames={candidateNames}
          aggregation="sum"
          unit={units.time.microsecond}
        />
        <OracleMetricChart
          label="DB CPU"
          metric="com.dynatrace.extension.sql-oracle.queries.cpuTime.count"
          scope="database"
          candidateNames={candidateNames}
          aggregation="sum"
          unit={units.time.microsecond}
        />
      </Flex>
    </Flex>
  );
};
