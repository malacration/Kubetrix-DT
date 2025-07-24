import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'src/app/services/k8s/WorkloadService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';


import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'
import { Button } from '@dynatrace/strato-components/buttons';
import { Menu } from '@dynatrace/strato-components-preview/navigation';
import { EditIcon } from '@dynatrace/strato-icons';
import { Link } from '@dynatrace/strato-components/typography';
import { ProblemsGetActive } from 'src/app/services/problems';
import { getNamesSpaces } from 'src/app/services/k8s/NameSpaceService';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { randomInt } from 'crypto';


function createRow() {
  const firstName = "randFirstName()";
  const lastName = "randLastName()";

  return {
    firstname: firstName,
    lastname: lastName
  };
}


function mock() {
  const max = 10
  return {
    cpuRequest: 1+Math.floor(Math.random() * (max + 1))+'Cores',
    cpuLimit: 1+Math.floor(Math.random() * (max + 1))+'Cores',
    memoryRequest: 1+Math.floor(Math.random() * (max + 1))+'GB',
    memoryLimit: 1+Math.floor(Math.random() * (max + 1))+'GB',
  }
}

const normalizeRecord = (r: any) => ({
  id: r['event.id'],
  name: r['event.name'],
  description: r['event.description'],
  k8sPath : r['k8s.cluster.name']? r['k8s.cluster.name']+"."+r['k8s.namespace.name']+"."+r['k8s.workload.name'] : "",
  affectedCount : r["affected_entity_ids"].length,
  category : r["event.category"],
  frequent : r["dt.davis.is_frequent_event"],
  ...r,                 // mantém o resto, se precisar
})

function CpuOptimization({ filters, refreshToken}: ChartProps) {
  
  const [result, setResult] = useState<[]>([]);
  const [loading, setLoading] = useState(false);


    
  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      { accessor: 'name', id: 'name', header: 'WorkLoad', width: { type: 'auto' }, },
      
      { 
        accessor: 'resource', id: 'resource', 
        header: 'Resource', alignment: 'center', width: { type: 'auto' }, 
      },
      
      { 
        header: 'CPU', accessor: 'cpu', id: 'cpu',
        width: { type: 'auto' }, alignment: 'center', 
        columns: [
          { header: 'Request', accessor: 'cpuRequest', id: 'request', width: { type: 'auto' }, alignment: 'center'},
          { header: 'Limit', accessor: 'cpuLimit', id: 'limit', width: { type: 'auto' }, alignment: 'center'}    
        ]
      },
      { 
        header: 'Memory', accessor: 'memory', id: 'memory', 
        width: { type: 'auto' }, alignment: 'center', 
        columns: [
          { header: 'Request', accessor: 'memoryRequest', id: 'request', width: { type: 'auto' }, alignment: 'center'},
          { header: 'Limit', accessor: 'memoryLimit', id: 'limit', width: { type: 'auto' }, alignment: 'center'}    
        ]
      },
    ],
    []
  );


  
  useEffect(() => {
    if (!filters) return;

    setLoading(false);
      const { cluster, namespace, workload, timeframe } = {
        cluster:   filters.cluster?.value,
        namespace: filters.namespace?.value,
        workload:  filters.workload?.value,
        timeframe: filters.timeframe?.value,
      };
    
    const resultado = [
      {
        name: "pje" ,
        resource: 'Definition',
        
        ...mock(),

        myCustomSubRows: [
          {resource: 'Recommended (MIN)', ...mock(), },
          {resource: 'Recommended (MAX)', ...mock(),},
        ],
      },
      {
        name: "gabinete",
        resource: 'Definition',
        
        ...mock(),

        myCustomSubRows: [
          {resource: 'Recommended (MIN)', ...mock(), },
          {resource: 'Recommended (MAX)', ...mock(),},
        ],

      }
    ]
    setResult(resultado)

  }, [filters,refreshToken]);

  return (
    <div>
      <Flex height={300}>
        <DataTableV2
          data={result}
          resizable
          fullWidth sortable
          loading={loading} 
          columns={columns}
          variant={{
            rowDensity: 'default',
            rowSeparation: "zebraStripes",
            verticalDividers: true,
            contained: true,
          }}
          subRows={{
            accessor: 'myCustomSubRows',
            subRowColumnId: 'resource',
            selectionBehavior: 'cascading',
          }}
    
        >
        </DataTableV2>
      </Flex>
    </div>
  );
}


(CpuOptimization as any).dashboardWidget = true;

export { CpuOptimization };