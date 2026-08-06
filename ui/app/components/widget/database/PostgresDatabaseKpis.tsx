import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { useResolvedPostgresDatabase } from 'app/services/postgres/useResolvedPostgresDatabase';
import { SessionsCountKPI } from '../_postgres/kpis/SessionsCountKPI';
import { SessionsTimeKPI } from '../_postgres/kpis/SessionsTimeKPI';
import { ActiveConKPI } from '../_postgres/kpis/ActivityConKPI';
import { ConflictsKPI } from '../_postgres/kpis/ConflictsKPI';
import { KpiGeneric } from '../KpiGeneric';
import '../style/KubetrixKpi.css';

type PostgresDatabaseKpisProps = {
  label: string;
  candidateNames: string[];
};

// Bloco de KPIs para um database PostgreSQL específico.
//
// IMPORTANTE: a Classic Metrics API identifica a entidade do database por
// `entityName.equals("<nome exato>")`, mas esse nome NÃO é igual ao nome do SERVICE nem à
// dimensão `database` crua — confirmado no tenant: dimensão database="pjesg", porém o
// entity.name real é "pjesg (PJE-BD-SG.pjro.local:5432)". Por isso resolvemos o nome real via
// dt.entity.sql:postgres_database (Grail) ANTES de disparar os KPIs — ver
// postgresEntityResolver.tsx. Sem essa resolução, entityName.equals() nunca casa com nada e os
// KPIs voltam todos zerados (não NaN/erro, porque os helpers clássicos tratam "sem dado" como 0).
export const PostgresDatabaseKpis = ({ label, candidateNames }: PostgresDatabaseKpisProps) => {
  const resolvedDatabase = useResolvedPostgresDatabase(candidateNames);

  return (
    <Flex padding={0} margin={0} className="kdt-container">
      <Flex padding={0} margin={0} className="kdt-row kdt-row--tall">
        <Flex className="kdt-badge">
          <h4 className="kdt-badge__title" title={label}>{label}</h4>
          <span className="kdt-badge__subtitle">PostgreSQL</span>
        </Flex>

        {resolvedDatabase === undefined && (
          <Flex padding={0} margin={0} className="kdt-content" alignItems="center" justifyContent="center">
            <span style={{ opacity: 0.7 }}>Resolvendo instância...</span>
          </Flex>
        )}

        {resolvedDatabase === null && (
          <Flex padding={0} margin={0} className="kdt-content" alignItems="center" justifyContent="center">
            <span style={{ opacity: 0.7 }}>
              Nenhuma instância monitorada pela extensão Postgres bate com "{label}".
            </span>
          </Flex>
        )}

        {resolvedDatabase && (
          <>
            <Flex padding={0} margin={0} className="kdt-content">
              <SessionsCountKPI front={resolvedDatabase.entityName} />
            </Flex>

            <Flex padding={0} margin={0} className="kdt-content">
              <SessionsTimeKPI front={resolvedDatabase.entityName} />
            </Flex>

            <Flex padding={0} margin={0} className="kdt-content">
              <ActiveConKPI front={resolvedDatabase.entityName} />
            </Flex>

            <Flex padding={0} margin={0} className="kdt-content">
              <KpiGeneric
                label="Idle in Transaction"
                metric="postgres.activity.idle_in_transaction"
                type="sql:postgres_database"
                application={resolvedDatabase.entityName}
              />
            </Flex>

            <Flex padding={0} margin={0} className="kdt-content">
              <ConflictsKPI front={resolvedDatabase.entityName} />
            </Flex>

            <Flex padding={0} margin={0} className="kdt-content">
              <KpiGeneric
                label="Deadlocks"
                metric="postgres.deadlocks.count"
                type="sql:postgres_database"
                application={resolvedDatabase.entityName}
              />
            </Flex>
          </>
        )}
      </Flex>
    </Flex>
  );
};
