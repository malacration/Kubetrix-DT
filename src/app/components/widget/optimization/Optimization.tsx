import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Chip, ChipOwnProps, ChipProps } from "@dynatrace/strato-components-preview/content"
import { InformationOverlay } from '@dynatrace/strato-components-preview/overlays';



import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'
import { ChartProps } from '../../dashboard/DashBoard';
import { getOptimizationData } from './query';
import { ChipValues, Metrics, MetricsGrouped } from './model';

const normalizeRecord = (r: any) => ({
  id: r['event.id'],
  name: r['event.name'],
  description: r['event.description'],
  k8sPath : r['k8s.cluster.name']? r['k8s.cluster.name']+"."+r['k8s.namespace.name']+"."+r['k8s.workload.name'] : "",
  affectedCount : r["affected_entity_ids"].length,
  category : r["event.category"],
  frequent : r["dt.davis.is_frequent_event"],
  ...r,
})

function getResourceChip(metricas){
  const rowData : MetricsGrouped = metricas.rowData
  const chips: Array<ChipValues> = typeof rowData?.getChips === 'function'
    ? rowData.getChips() ?? [] : [];
  return chips?.length > 0 ? 
        (<InformationOverlay>
          <InformationOverlay.Trigger>
          {rowData?.workload} 
          </InformationOverlay.Trigger>
          <InformationOverlay.Content>
            <Flex flexDirection="column">
                {chips.map((c, i) => (
                  <Chip color={c.color} key={i}>{c.label}</Chip>
                ))}
              </Flex>
          </InformationOverlay.Content>
        </InformationOverlay>)
        :
        rowData?.workload
}

const Optimization = forwardRef<HTMLDivElement, ChartProps>(
  ( { filters, refreshToken, title},ref: ForwardedRef<HTMLDivElement>) => {  
  
  const [result, setResult] = useState<MetricsGrouped[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);


  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      { accessor: 'name', id: 'name',
        cell: (info) => getResourceChip(info),
        header: 'WorkLoad', width: 165, 
      },
      { accessor: 'namespace', id: 'namespace',
        header: 'namespace', width: 120, 
      },
      { 
        accessor: 'resource', id: 'resource', 
        header: 'Resource', alignment: 'center', width: 175, 
      },
      { 
        accessor: 'podDesired', id: 'podDesired', 
        header: 'Pod\'s', alignment: 'center', width: 80,
      },
      
      { 
        header: 'CPU', accessor: 'cpu', id: 'cpu',
        width: { type: 'auto' }, alignment: 'center', 
        columns: [
          { header: 'Request', accessor: 'cpuRequest', id: 'cpuRequest', width: { type: 'auto' }, alignment: 'center'},
          { header: 'Limit', accessor: 'cpuLimit', id: 'cpuLimit', width: { type: 'auto' }, alignment: 'center'},
          { header: '(-) Over | (+) Under', accessor: 'overUnderCpu', id: 'cpuOptimization', width: { type: 'auto' }, 
            alignment: 'center', sortAccessor: 'overUnderCpuRaw', sortType: 'number',
          }
        ]
      },
      { 
        header: 'Memory', accessor: 'memory', id: 'memory', 
        width: { type: 'auto' }, alignment: 'center',
        columns: [
          { header: 'Request', 
            accessor: 'memoryRequest', 
            id: 'memoryRequest', width: 
            { type: 'auto' }, alignment: 'center'
          },
          { header: 'Limit', accessor: 'memoryLimit', id: 'memoryLimit', width: { type: 'auto' }, alignment: 'center'},
          { header: '(-) Over | (+) Under', accessor: 'overUnderMemory', id: 'memoryOptimization', width: { type: 'auto' }, 
            alignment: 'center', sortAccessor: 'overUnderMemoryRaw', sortType: 'number',
          }
        ]
      },
    ],
    []
  );

  useEffect(() => {
    if (!filters) return;

    setLoading(true);
    let { cluster, namespace, workload, timeframe } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
    };

    if(namespace && namespace != "all" || (namespace == "all" && result.length > 0)){
      const valores : Map<string,MetricsGrouped> = new Map()
      getOptimizationData(cluster,namespace,workload,timeframe).then(it =>{
        it.forEach(t => {
          t.raw().result.forEach(row => {
            const metricId = row.metricId
            row.data.filter(f => f.dimensionMap["k8s.cluster.name"] != null).forEach(data => {
              const dm  = data.dimensionMap;
              const key = `${dm["k8s.cluster.name"]}-${dm["k8s.workload.name"]}-${dm["k8s.namespace.name"]}`
              let valor : MetricsGrouped | undefined = valores.get(key)
        
              if(valor == null || valor == undefined){
                valores.set(key,new MetricsGrouped(dm)) //[key] = 
                valor = valores.get(key)
              }

              valor?.set(metricId,data.values)
            })
          });
        })
      }).finally(() => {
        setResult(Array.from(valores.values()))
        setLoading(false)
      })
    }else{
      setLoading(false);
    }
  }, [filters,refreshToken]);


  const teste = function(){
    return true
  }

  return (
    <div ref={ref}>
      <Flex>
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
          <DataTableV2.Pagination
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageIndex={pageIndex}
            onPageIndexChange={setPageIndex}
          />
          <DataTableV2.EmptyState>
            Select at least one namespace
          </DataTableV2.EmptyState>
        </DataTableV2>
      </Flex>
    </div>
  );
})
/*
-- TODO
Adicionar texto explicando os calculos e orientações de como analisatar!

Idealmente 
*/


// @ts-expect-error pede displayname e depois nao reconhece
Optimization.dashboardWidget = true;
// @ts-expect-error pede displayname e depois nao reconhece
Optimization.displayName = ""

export { Optimization as Optimization };