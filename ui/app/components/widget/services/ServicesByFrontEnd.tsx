import React, { useEffect, useState } from 'react';
import { ChartProps } from '../../filters/BarChartProps';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'
import { Link } from '@dynatrace/strato-components/typography';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { getServicesByIdFrontend } from 'app/services/frontendService';


const normalizeRecord = (r: any) => ({
  name: r['entity.name'],
  ...r,
})

function ServicesByFrontEnd({ filters, lastRefreshedAt}: ChartProps) {
  
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

    const { idFrontend, timeframe } = {
      idFrontend:   filters.idFrontend?.value,
      timeframe: filters.timeframe?.value,
    };

    if(idFrontend && idFrontend != "all"){
      setLoading(true);
      getServicesByIdFrontend(idFrontend,timeframe).then(it => {
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
            Select at least one frontend
          </DataTableV2.EmptyState>
        </DataTableV2>
      </Flex>
    </div>
  );
}


(ServicesByFrontEnd as any).dashboardWidget = true;

export { ServicesByFrontEnd };