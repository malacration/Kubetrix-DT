import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'app/services/k8s/WorkloadService';
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
import { ProblemsGetActive } from 'app/services/problems';
import { getNamesSpaces } from 'app/services/k8s/NameSpaceService';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';

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

function Problems({ filters, lastRefreshedAt}: ChartProps) {
  
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
                href={`${getEnvironmentUrl()}/ui/apps/dynatrace.classic.problems/#problems/problemdetails;gtf=-2h;gf=all;pid=${value}`}
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
      
      ProblemsGetActive(cluster,namespace,workload,timeframe).then(it => {
        if(it?.records)
          setProblems(it?.records.map(it => normalizeRecord(it)))
        setLoading(false);
      })
    };

    load();
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
        </DataTableV2>
      </Flex>
      <li>Adicionar botao para ativar ou desativar frequent events</li>
    </div>
  );
}


(Problems as any).dashboardWidget = true;

export { Problems };