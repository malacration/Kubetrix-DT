import React, { useEffect, useMemo, useState } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { DocumentIcon } from '@dynatrace/strato-icons';
import { ChartProps } from '../../filters/BarChartProps';
import { useDetectedDatabases } from 'app/services/database/useDetectedDatabases';
import { openDashboardInNewTab } from 'app/services/core/appUrl';
import { OracleDatabaseMetricsCharts } from './OracleDatabaseMetricsCharts';
import { PostgresDatabaseMetricsCharts } from './PostgresDatabaseMetricsCharts';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from '../../dashboard/DashboardWidgetHeaderActions';

// Slug precisa bater com uma entrada de app/services/core/docsRegistry.tsx (fonte da lista
// exibida na página raiz de documentação, /dashboards/Docs).
const DOCS_PAGE_SLUG = 'database-metrics-docs';

// Widget "Database Metrics Charts": mesma detecção do "Database KPIs" (ver DatabaseKpisPanel.tsx
// e useDetectedDatabases.tsx), mas mostra as métricas como série ao longo do tempo (gráficos de
// linha) em vez de valor único.
//
// É um widget dashboardWidget separado de propósito — para poder ocultar/maximizar cada um
// independentemente. A ativação exige clique explícito pelo mesmo motivo do KPIs: cada instância
// detectada dispara várias chamadas ao Dynatrace (uma por gráfico).
function DatabaseChartsPanel({ filters, onHeaderActionsChange }: ChartProps) {
  const { loadingList, dbCandidates, oracleCandidates, postgresCandidates } = useDetectedDatabases(filters);
  const [chartsActivated, setChartsActivated] = useState(false);

  useEffect(() => {
    setChartsActivated(false);
  }, [filters?.cluster?.value, filters?.namespace?.value, filters?.workload?.value, filters?.timeframe?.value]);

  const headerActions = useMemo(() => (
    <DashboardWidgetHeaderActions>
      <DashboardWidgetHeaderActionGroup>
        <Button
          size="condensed"
          style={dashboardWidgetHeaderButtonStyle(false)}
          onClick={() => openDashboardInNewTab(DOCS_PAGE_SLUG)}
        >
          <Button.Prefix><DocumentIcon /></Button.Prefix>
          Documentação
        </Button>
      </DashboardWidgetHeaderActionGroup>
    </DashboardWidgetHeaderActions>
  ), []);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

  return (
    <div>
      {!onHeaderActionsChange && headerActions}

      {dbCandidates.length === 0 && !loadingList && (
        <div style={{ opacity: 0.7 }}>
          Nenhum banco de dados (Oracle/PostgreSQL) encontrado entre os Services e Called
          Services do namespace/workload selecionado.
        </div>
      )}

      {loadingList && <div style={{ opacity: 0.7 }}>Buscando bancos de dados relacionados...</div>}

      {dbCandidates.length > 0 && !chartsActivated && (
        <Flex flexDirection="column" gap={8}>
          <div>
            {dbCandidates.length} instância(s) de banco de dados detectada(s):{' '}
            {dbCandidates.map((c) => `${c.name} (${c.technology})`).join(', ')}
          </div>
          <Flex>
            <Button
              color="primary"
              variant="accent"
              style={dashboardWidgetHeaderButtonStyle(true)}
              onClick={() => setChartsActivated(true)}
            >
              Carregar gráficos de métricas
            </Button>
          </Flex>
        </Flex>
      )}

      {chartsActivated && (
        <Flex flexDirection="column" gap={8}>
          {oracleCandidates.map((c) => (
            <OracleDatabaseMetricsCharts key={c.id} label={c.name} candidateNames={c.candidateNames} />
          ))}
          {postgresCandidates.map((c) => (
            <PostgresDatabaseMetricsCharts key={c.id} label={c.name} candidateNames={c.candidateNames} />
          ))}
        </Flex>
      )}
    </div>
  );
}

(DatabaseChartsPanel as any).dashboardWidget = true;

export { DatabaseChartsPanel };
