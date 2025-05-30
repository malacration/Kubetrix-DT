import { Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useEffect, useState } from 'react';
import { MetricResult } from 'src/app/services/core/MetricsClientClassic';
import { kubernetesWorkload, responseTime } from 'src/app/services/k8s/WorkloadService';
import { convertQueryResultToTimeseries, convertToTimeseries } from '@dynatrace/strato-components-preview/conversion-utilities';
import { ChartProps } from '../filters/BarChartProps';
import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';

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

const normalizeRecord = (r: any) => ({
  id: r['event.id'],
  name: r['event.name'],
  description: r['event.description'],
  ...r,                 // mantém o resto, se precisar
})

function Problems({ filters, refreshToken}: ChartProps) {
  
  const [problems, setProblems] = useState<[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      {
        header: 'ID',
        accessor: row => row.id,
        id: 'id',
        cell: ({ value, rowData }) => {
          return (
            <DataTableV2.DefaultCell>
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
      { accessor: 'name', id: 'name', header: 'Name' },
      { accessor: 'description', id: 'description', header: 'Description' },
      { accessor: 'root_cause_entity_name', id: 'rooteCause', header: 'Roote Cause' },
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
      <DataTableV2
        data={problems}
        resizable
        loading={loading} 
        columns={columns}
        containerProps={{
          style: {
            maxWidth: '800px',
          },
        }}
        variant={{
          rowDensity: 'default',
          rowSeparation: "zebraStripes",
          verticalDividers: true,
          contained: true,
        }}
    >
    </DataTableV2>
    <li>Adicionar botao para ativar ou desativar frequent events</li>
    </div>
  );
}


(Problems as any).dashboardWidget = true;

export { Problems };