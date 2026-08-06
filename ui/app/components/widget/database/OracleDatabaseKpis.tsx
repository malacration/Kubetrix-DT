import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { units } from '@dynatrace-sdk/units';
import { OracleKpiGeneric } from './OracleKpiGeneric';
import { MetricDirection } from '../kpiCore';
import '../style/KubetrixKpi.css';

type OracleDatabaseKpisProps = {
  label: string;
  candidateNames: string[];
};

// Bloco de KPIs para uma PDB Oracle específica.
// Metade das métricas é reportada por PDB (container.name) e a outra metade só existe
// por instância RAC (instance.name) — ver comentário em oracleDatabaseService.tsx.
// Como candidateNames guarda o(s) possível(is) nome(s) de PDB, usamos os mesmos candidatos
// tanto para o escopo "database" quanto, na falta de melhor informação, para tentar o escopo
// "instance" (algumas instâncias RAC usam o mesmo nome base da PDB em ambientes single-tenant).
export const OracleDatabaseKpis = ({ label, candidateNames }: OracleDatabaseKpisProps) => {
  return (
    <Flex padding={0} margin={0} className="kdt-container">
      <Flex padding={0} margin={0} className="kdt-row kdt-row--tall">
        <Flex className="kdt-badge">
          <h4 className="kdt-badge__title" title={label}>{label}</h4>
          <span className="kdt-badge__subtitle">Oracle (PDB)</span>
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="Active Sessions"
            metric="com.dynatrace.extension.sql-oracle.sessions.active"
            scope="database"
            candidateNames={candidateNames}
            aggregation="avg"
          />
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="Blocked Sessions"
            metric="com.dynatrace.extension.sql-oracle.sessions.blocked"
            scope="database"
            candidateNames={candidateNames}
            aggregation="max"
            metricDirection={MetricDirection.LowerIsBetter}
          />
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="Total Sessions"
            metric="com.dynatrace.extension.sql-oracle.sessions.all"
            scope="database"
            candidateNames={candidateNames}
            aggregation="avg"
          />
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="Deadlocks"
            metric="com.dynatrace.extension.sql-oracle.sessions.deadlocks.count"
            scope="database"
            candidateNames={candidateNames}
            aggregation="sum"
            metricDirection={MetricDirection.LowerIsBetter}
          />
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="Tablespace Usage"
            metric="com.dynatrace.extension.sql-oracle.tablespaces.usage"
            scope="database"
            candidateNames={candidateNames}
            aggregation="max"
            unit={units.percentage.percent}
            metricDirection={MetricDirection.LowerIsBetter}
          />
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="DB Time"
            metric="com.dynatrace.extension.sql-oracle.queries.dbTime.count"
            scope="database"
            candidateNames={candidateNames}
            aggregation="sum"
            metricDirection={MetricDirection.LowerIsBetter}
          />
        </Flex>

        <Flex padding={0} margin={0} className="kdt-content">
          <OracleKpiGeneric
            label="DB CPU"
            metric="com.dynatrace.extension.sql-oracle.queries.cpuTime.count"
            scope="database"
            candidateNames={candidateNames}
            aggregation="sum"
            metricDirection={MetricDirection.LowerIsBetter}
          />
        </Flex>
      </Flex>
    </Flex>
  );
};
