import React, { useEffect, useState } from 'react';
import { ChartProps } from '../../filters/BarChartProps';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'
import { Link } from '@dynatrace/strato-components/typography';
import { getServices } from 'src/app/services/services';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';


const normalizeRecord = (r: any) => ({
  name: r['entity.name'],
  ...r,
})

function Services({ filters, lastRefreshedAt}: ChartProps) {
  
  const url = getEnvironmentUrl();

  const [problems, setProblems] = useState<[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      {
        header: 'Name',
        accessor: row => row.name,
        id: 'name',
        width: { type: 'auto' },
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
      { accessor: 'serviceTechnologyTypes', id: 'technologyTypes', header: 'Technology', width: { type: 'auto' } },
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
        if(it?.records)
          setProblems(it?.records.map(it => normalizeRecord(it)))
        setLoading(false);
      })
    }
  }, [filters,lastRefreshedAt]);

  return (
    <div>
      <Flex height={300}>
        <DataTableV2
          data={problems}
          resizable
          fullWidth sortable
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