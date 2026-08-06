import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { useResolvedPostgresDatabase } from 'app/services/postgres/useResolvedPostgresDatabase';
import { PostgresMetricChart } from './PostgresMetricChart';

type PostgresDatabaseMetricsChartsProps = {
  label: string;
  candidateNames: string[];
};

// Gráficos ao longo do tempo para um database PostgreSQL específico — mesmas métricas do bloco
// de KPIs (PostgresDatabaseKpis), mas como série temporal em vez de valor único. Usa o mesmo
// hook de resolução de nome real da entidade (ver useResolvedPostgresDatabase.tsx).
export const PostgresDatabaseMetricsCharts = ({ label, candidateNames }: PostgresDatabaseMetricsChartsProps) => {
  const resolvedDatabase = useResolvedPostgresDatabase(candidateNames);

  return (
    <Flex flexDirection="column" gap={4} style={{ marginBottom: '1rem' }}>
      <Heading level={4} style={{ margin: 0 }}>{label} <span style={{ fontSize: '0.7em', opacity: 0.7 }}>PostgreSQL</span></Heading>

      {resolvedDatabase === undefined && <span style={{ opacity: 0.7 }}>Resolvendo instância...</span>}

      {resolvedDatabase === null && (
        <span style={{ opacity: 0.7 }}>
          Nenhuma instância monitorada pela extensão Postgres bate com "{label}".
        </span>
      )}

      {resolvedDatabase && (
        <Flex flexWrap="wrap" gap={16}>
          <PostgresMetricChart label="Sessions Count" metric="postgres.sessions.count" database={resolvedDatabase.database} aggregation="avg" />
          <PostgresMetricChart label="Active Connections" metric="postgres.activity.active" database={resolvedDatabase.database} aggregation="avg" />
          <PostgresMetricChart label="Idle in Transaction" metric="postgres.activity.idle_in_transaction" database={resolvedDatabase.database} aggregation="avg" />
          <PostgresMetricChart label="Conflicts" metric="postgres.conflicts.count" database={resolvedDatabase.database} aggregation="avg" />
          <PostgresMetricChart label="Deadlocks" metric="postgres.deadlocks.count" database={resolvedDatabase.database} aggregation="avg" />
        </Flex>
      )}
    </Flex>
  );
};
