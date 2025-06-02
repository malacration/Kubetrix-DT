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
import { getServices } from 'src/app/services/services';

const normalizeRecord = (r: any) => ({
  id: r['entity.name'],
  name: r['entity.name'],
  description: r['entity.name'],
  k8sPath : r['entity.name'],
  affectedCount : r["entity.name"],
  category : r["entity.name"],
  frequent : r["entity.name"],
  ...r,                 // mantém o resto, se precisar
})

function Services({ filters, refreshToken}: ChartProps) {
  
  const [problems, setProblems] = useState<[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      {
        header: 'ID',
        accessor: row => row.id,
        id: 'id',
        width: { type: 'auto' },
        cell: ({ value, rowData }) => {
          return (
            <DataTableV2.DefaultCell >
              <Link
                href={`/ui/apps/dynatrace.classic.problems/#problems/problemdetails;gtf=-2h;gf=all;pid=${value}`}
                target="_blank"
              >
                {rowData?.display_id}
              </Link>
            </DataTableV2.DefaultCell>
          );
        },
      },
      { accessor: 'name', id: 'name', header: 'Name', width: { type: 'auto' }, },
      { accessor: 'k8sPath', id: 'k8sPath', header: 'k8sPath', width: { type: 'auto', maxWidth: 250 } },
      { accessor: 'description', id: 'description', header: 'Description', width: { type: 'auto', maxWidth: 150 } },
      { accessor: 'affectedCount', id: 'affectedCount', header: 'Affected', width: { type: 'auto', maxWidth: 100 } },
      { accessor: 'category', id: 'category', header: 'Category', width: { type: 'auto' } },
      { accessor: 'frequent', id: 'frequent', header: 'Frequent', width: { type: 'auto' } },
      { accessor: 'root_cause_entity_name', id: 'rooteCause', header: 'Roote Cause', width: { type: 'auto', maxWidth: 100  } },
    ],
    []
  );

  
  
  useEffect(() => {
    if (!filters) return;

    const load = async () => {
      setLoading(true);
      const { cluster, namespace, workload, timeframe } = {
        cluster:   filters.cluster?.value,
        namespace: filters.namespace?.value,
        workload:  filters.workload?.value,
        timeframe: filters.timeframe?.value,
      };
      
      getServices(cluster,namespace,workload,timeframe).then(it => {
        console.log(it)
        if(it?.data?.records)
          setProblems(it?.data.records.map(it => normalizeRecord(it)))
        setLoading(false);
      })
    };

    load();
  }, [filters,refreshToken]);

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
        </DataTableV2>
      </Flex>
      <li>Adicionar botao para ativar ou desativar frequent events</li>
    </div>
  );
}


(Services as any).dashboardWidget = true;

export { Services };