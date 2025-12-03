import React, { useEffect, useState } from 'react';
import { ChartProps } from '../../filters/BarChartProps';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'
import { Link } from '@dynatrace/strato-components/typography';
import { getCallServices } from 'app/services/services';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { timeFormatter, countFormatter, microToMileSeconds, countAbreviation } from './formater';
import { Trend } from './Trend';


const normalizeRecord = (r: any) => ({
  name: r['entity.name'],
  ...r,
})

function Throughput({ filters}: ChartProps) {
  
  const url = getEnvironmentUrl();

  const [problems, setProblems] = useState<[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = useMemo<DataTableV2ColumnDef<(typeof any)[number]>[]>(
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
                href={`${getEnvironmentUrl()}/ui/apps/dynatrace.classic.services/ui/entity/${rowData?.id ?? rowData?.lookupId}`}
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
        sortAccessor: 'currResponse',
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
      getCallServices(cluster,namespace,workload,timeframe).then(it => {
        if(it?.records){
          setProblems(it?.records.map(it => normalizeRecord(it)))
          console.log(problems)
        }
          
        
        setLoading(false);
      })
    }
    

    

  }, [filters]);

  return (
    <div>
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


(Throughput as any).dashboardWidget = true;

export { Throughput };