import React, { useEffect, useState } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { DocumentIcon } from '@dynatrace/strato-icons';
import { ChartProps } from '../../filters/BarChartProps';
import { useDetectedDatabases } from 'app/services/database/useDetectedDatabases';
import { openDashboardInNewTab } from 'app/services/core/appUrl';
import { OracleDatabaseKpis } from './OracleDatabaseKpis';
import { PostgresDatabaseKpis } from './PostgresDatabaseKpis';

// Slug precisa bater com uma entrada de app/services/core/docsRegistry.tsx (fonte da lista
// exibida na página raiz de documentação, /dashboards/Docs).
const DOCS_PAGE_SLUG = 'database-metrics-docs';

// Widget "Database KPIs": detecta, a partir das listas de Services e Called Services outside of
// the namespace, quais entidades são bancos de dados suportados (Oracle/PostgreSQL) e permite
// carregar os KPIs (valor atual vs. baseline) daquela instância sob demanda.
//
// É um widget dashboardWidget separado do "Database Metrics Charts" (ver DatabaseChartsPanel.tsx)
// de propósito — para poder ocultar/maximizar cada um independentemente.
//
// Os KPIs NÃO são carregados automaticamente: cada instância detectada pode disparar várias
// chamadas ao Dynatrace (uma por KPI), e a tela já dispara bastante tráfego para os painéis
// Services/CallServices/Problems. Por isso a ativação exige um clique explícito (evita "too many
// requests").
function DatabaseKpisPanel({ filters }: ChartProps) {
  const { loadingList, dbCandidates, oracleCandidates, postgresCandidates } = useDetectedDatabases(filters);
  const [kpisActivated, setKpisActivated] = useState(false);

  useEffect(() => {
    setKpisActivated(false);
  }, [filters?.cluster?.value, filters?.namespace?.value, filters?.workload?.value, filters?.timeframe?.value]);

  return (
    <div>
      <Flex justifyContent="flex-end" style={{ marginBottom: 8 }}>
        <Button onClick={() => openDashboardInNewTab(DOCS_PAGE_SLUG)}>
          <Button.Prefix>
            <DocumentIcon />
          </Button.Prefix>
          Documentação
        </Button>
      </Flex>

      {dbCandidates.length === 0 && !loadingList && (
        <div style={{ opacity: 0.7 }}>
          Nenhum banco de dados (Oracle/PostgreSQL) encontrado entre os Services e Called
          Services do namespace/workload selecionado.
        </div>
      )}

      {loadingList && <div style={{ opacity: 0.7 }}>Buscando bancos de dados relacionados...</div>}

      {dbCandidates.length > 0 && !kpisActivated && (
        <Flex flexDirection="column" gap={8}>
          <div>
            {dbCandidates.length} instância(s) de banco de dados detectada(s):{' '}
            {dbCandidates.map((c) => `${c.name} (${c.technology})`).join(', ')}
          </div>
          <Flex>
            <Button color="primary" variant="accent" onClick={() => setKpisActivated(true)}>
              Carregar KPIs de banco de dados
            </Button>
          </Flex>
        </Flex>
      )}

      {kpisActivated && (
        <Flex flexDirection="column" gap={8}>
          {oracleCandidates.map((c) => (
            <OracleDatabaseKpis key={c.id} label={c.name} candidateNames={c.candidateNames} />
          ))}
          {postgresCandidates.map((c) => (
            <PostgresDatabaseKpis key={c.id} label={c.name} candidateNames={c.candidateNames} />
          ))}
        </Flex>
      )}
    </div>
  );
}

(DatabaseKpisPanel as any).dashboardWidget = true;

export { DatabaseKpisPanel };
