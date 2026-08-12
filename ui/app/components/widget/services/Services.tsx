import React, { useEffect, useState } from 'react';
import { ChartProps } from '../../filters/BarChartProps';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { DocumentIcon } from '@dynatrace/strato-icons';
import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'
import { Link } from '@dynatrace/strato-components/typography';
import { getServices } from 'app/services/services';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { openDashboardInNewTab } from 'app/services/core/appUrl';
import { timeFormatter, countFormatter, microToMileSeconds, countAbreviation, shareFormatter, latencyImpactFormatter } from './formater';
import { Trend } from './Trend';
import { withServiceContributions } from 'app/model/ServiceContribution';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from 'app/components/dashboard/DashboardWidgetHeaderActions';

// Slug precisa bater com uma entrada de app/services/core/docsRegistry.tsx.
const DOCS_PAGE_SLUG = 'service-contribution-docs';

const normalizeRecord = (r: any) => ({
  name: r['entity.name'],
  ...r,
})

function Services({ filters, lastRefreshedAt, onHeaderActionsChange }: ChartProps) {
  
  const url = getEnvironmentUrl();

  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      {
        header: 'Name',
        accessor: row => row.name,
        id: 'name',
        width: { type: 'auto', maxWidth: 350 },
        cell: ({ value, rowData }) => {
          return (
            <DataTableV2.DefaultCell >
              <Link
                href={`${getEnvironmentUrl()}/ui/apps/dynatrace.classic.services/ui/entity/${rowData?.id}`}
                target="_blank"
              >
                {value}
              </Link>
            </DataTableV2.DefaultCell>
          );
        },
      },
      { accessor: 'serviceTechnologyTypes', id: 'technologyTypes', header: 'Technology', width: { type: 'auto', maxWidth:150 }, sortType:"number" },

      {
        header: 'Response Time',
        accessor: row => row,
        id: 'currResponse',
        width: { type: 'auto', maxWidth: 180, },
        sortAccessor: 'baseResponse',
        sortType:"number",
        cell: ({ value }) => {
          return (
            <DataTableV2.DefaultCell >
                <Trend
                  curr={value.currResponse}
                  base={value.baseResponse}
                  lowerIsBetter={true}
                  tolPct={5}
                  label={microToMileSeconds(value.currResponse)}
                />
            </DataTableV2.DefaultCell>
          );
        },
      },
      { 
        accessor: 'baseResponse', id: 'baseResponse', header: 'Base Response Time', 
        formatter:timeFormatter, width: { type: 'auto',maxWidth: 180 }, sortType:"number" 
      },
      {
        header: 'Throughput',
        accessor: row => row,
        id: 'currCount',
        width: { type: 'auto', maxWidth: 180, },
        sortAccessor: 'currCount',
        sortType:"number",
        cell: ({ value }) => {
          return (
            <DataTableV2.DefaultCell >
                <Trend
                  curr={value.currCount}
                  base={value.baseCount}
                  lowerIsBetter={true}
                  tolPct={5}
                  label={countAbreviation(value.currCount)}
                />
            </DataTableV2.DefaultCell>
          );
        },
      },
      {
        accessor: 'baseCount', id: 'baseCount', header: 'Base Throughput',
        formatter:countFormatter, width: { type: 'auto',maxWidth: 180 }, sortType:"number"
      },
      {
        accessor: 'throughputShare', id: 'throughputShare', header: 'Fatia Throughput',
        width: { type: 'auto', maxWidth: 140 }, alignment: 'center', sortType: 'number',
        cell: ({ value }) => <DataTableV2.DefaultCell>{shareFormatter(value)}</DataTableV2.DefaultCell>,
      },
      {
        accessor: 'loadShare', id: 'loadShare', header: "Carga (Little's Law)",
        width: { type: 'auto', maxWidth: 160 }, alignment: 'center', sortType: 'number',
        cell: ({ value }) => <DataTableV2.DefaultCell>{shareFormatter(value)}</DataTableV2.DefaultCell>,
      },
      {
        accessor: 'latencyImpact', id: 'latencyImpact', header: 'Impacto na Latência Média',
        width: { type: 'auto', maxWidth: 180 }, alignment: 'center', sortType: 'number',
        cell: ({ value }) => <DataTableV2.DefaultCell>{latencyImpactFormatter(value)}</DataTableV2.DefaultCell>,
      },
    ],
    []
  );

  
  
  useEffect(() => {
    if (!filters) return;

    const { cluster, namespace, workload, timeframe } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
    };
    
    

    if((workload && workload != "all") || (namespace && namespace != "all")){
      setLoading(true);
      getServices(cluster,namespace,workload,timeframe).then(it => {
        if(it?.records) {
          const normalized = it?.records.map(it => normalizeRecord(it));
          // Totais calculados só dentro desta categoria (Services) — nunca
          // combinar com os registros de CallServices (outside do namespace).
          setProblems(withServiceContributions(normalized))
        }
        setLoading(false);
      })
    }
  }, [filters,lastRefreshedAt]);

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
      <Flex height={300}>
        <DataTableV2
          data={problems}
          resizable
          fullWidth sortable
          defaultSortBy={[{id:"currCount", desc:true}]}
          loading={loading} 
          columns={columns}
          variant={{
            rowDensity: 'default',
            rowSeparation: "zebraStripes",
            verticalDividers: true,
            contained: true,
        }}>
          <DataTableV2.EmptyState>
            Select at least one namespace or workload
          </DataTableV2.EmptyState>
        </DataTableV2>
      </Flex>
    </div>
  );
}


(Services as any).dashboardWidget = true;

export { Services };
