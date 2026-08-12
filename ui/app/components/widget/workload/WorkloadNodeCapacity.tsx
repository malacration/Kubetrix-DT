import React, { useEffect, useMemo, useState } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { Chip } from '@dynatrace/strato-components-preview/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import {
  SimpleTableV2,
  type SimpleTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables';
import { ChartProps } from '../../filters/BarChartProps';
import { workloadPodsByNode, nodesCapacity, NodeCapacity } from 'app/services/k8s/NodeServices';
import { useNodeSelected, useSetNodeSelected } from 'app/components/context/FilterK8sContext';
import { isQueryResult } from 'app/services/core/GrailConverter';
import { Option, SelectComponent } from 'app/components/form/Select';
import { FilterOutIcon } from '@dynatrace/strato-icons';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from 'app/components/dashboard/DashboardWidgetHeaderActions';

const ONE_GiB = 1024 ** 3;

type Row = NodeCapacity & {
  /** Pods do workload analisado neste node (pico do período). */
  pods: number;
  cpuFillPct?: number;
  memFillPct?: number;
};

type SortKey = 'node' | 'pods' | 'cpuFillPct' | 'memFillPct';

const SORT_OPTIONS = [
  new Option('Ordenar: Node', 'node'),
  new Option('Ordenar: Pods', 'pods'),
  new Option('Ordenar: Ocupação de CPU', 'cpuFillPct'),
  new Option('Ordenar: Ocupação de memória', 'memFillPct'),
];

function fmtCores(v?: number) {
  if (v == null) return '—';
  return v >= 1 ? `${v.toFixed(2)} Core` : `${(v * 1000).toFixed(0)} mCore`;
}

function fmtGiB(v?: number) {
  if (v == null) return '—';
  return `${(v / ONE_GiB).toFixed(2)} GiB`;
}

function fmtPct(v?: number) {
  if (v == null) return '—';
  return `${v.toFixed(0)}%`;
}

/**
 * Ocupação dos nodes onde o workload está rodando: quanto de CPU/memória já foi
 * reservado por requests (de TODOS os pods do node) contra o alocável.
 *
 * É o que responde "cabe crescer aqui?". Um node com 95% de request reservado não
 * aceita aumento de request do workload, mesmo que o uso real dele esteja baixo —
 * o scheduler decide por request, não por uso.
 *
 * Clicar no nome do node recorta a página inteira para aquele node.
 */
function WorkloadNodeCapacity({ filters, lastRefreshedAt, onHeaderActionsChange }: ChartProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [nodeFilter, setNodeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('node');
  const [sortDescending, setSortDescending] = useState(false);

  const nodeSelected = useNodeSelected();
  const setNodeSelected = useSetNodeSelected();

  // A seleção disparada pelos gráficos de pod também alimenta o filtro textual da
  // tabela. Assim a tabela não só destaca o node: ela isola imediatamente sua linha.
  useEffect(() => {
    setNodeFilter(nodeSelected && nodeSelected !== 'all' ? nodeSelected : '');
  }, [nodeSelected]);

  useEffect(() => {
    if (!filters) return;

    let cancelled = false;

    const { cluster, namespace, workload, timeframe, resolution } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
      resolution: filters.resolution?.value,
    };

    if (!timeframe || !workload || workload === 'all') {
      setRows([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // Passo 1: descobrir em quais nodes o workload esteve. As métricas de node não
        // têm dimensão de workload, então não dá pra ir direto — a lista de nodes tem
        // que sair da métrica de pods.
        const podsResult = await workloadPodsByNode(
          cluster as string, namespace as string, workload as string,
          timeframe as never, resolution as string,
        );
        if (!isQueryResult(podsResult)) throw new Error(podsResult.error);

        const podsByNode = new Map<string, number>();
        (podsResult.records ?? []).forEach(record => {
          if (!record) return;
          const node = typeof record.node === 'string' ? record.node : '';
          const values = Array.isArray(record.value) ? record.value : [];
          if (!node) return;

          const peak = values.reduce<number>((acc, rawValue) => {
            const value = Number(rawValue);
            return Number.isFinite(value) ? Math.max(acc, value) : acc;
          }, 0);
          podsByNode.set(node, Math.max(podsByNode.get(node) ?? 0, peak));
        });

        // Passo 2: ocupação só dos nodes que interessam.
        const capacity = await nodesCapacity(
          Array.from(podsByNode.keys()), cluster as string, timeframe as never,
        );

        const assembled: Row[] = capacity.map(c => ({
          ...c,
          pods: podsByNode.get(c.node) ?? 0,
          cpuFillPct: c.requestsCpu != null && c.allocatableCpu
            ? (c.requestsCpu / c.allocatableCpu) * 100 : undefined,
          memFillPct: c.requestsMemory != null && c.allocatableMemory
            ? (c.requestsMemory / c.allocatableMemory) * 100 : undefined,
        }));

        if (!cancelled) setRows(assembled);
      } catch (err) {
        if (!cancelled) console.error('Erro ao buscar ocupação dos nodes', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filters, lastRefreshedAt]);

  const columns = useMemo<SimpleTableV2ColumnDef<Row>[]>(() => [
    {
      accessor: 'node', id: 'node', header: 'Node', minWidth: 220,
      cell: ({ rowData }) => (
        <Button
          size="condensed"
          color="primary"
          variant={nodeSelected === rowData.node ? 'emphasized' : 'default'}
          style={dashboardWidgetHeaderButtonStyle(nodeSelected === rowData.node)}
          onClick={() => setNodeSelected(nodeSelected === rowData.node ? 'all' : rowData.node)}
          aria-label={`Recortar análise pelo node ${rowData.node}`}
        >
          {rowData.node}
        </Button>
      ),
    },
    { accessor: 'pods', id: 'pods', header: 'Pods do workload', alignment: 'center', width: 130 },
    {
      header: 'CPU do node', id: 'cpu', alignment: 'center', width: 330,
      columns: [
        { id: 'cpuReq', header: 'Reservado', alignment: 'center',
          accessor: (r: Row) => fmtCores(r.requestsCpu) },
        { id: 'cpuAlloc', header: 'Alocável', alignment: 'center',
          accessor: (r: Row) => fmtCores(r.allocatableCpu) },
        { id: 'cpuFill', header: 'Ocupação', alignment: 'center',
          accessor: (r: Row) => fmtPct(r.cpuFillPct) },
      ],
    },
    {
      header: 'Memória do node', id: 'mem', alignment: 'center', width: 330,
      columns: [
        { id: 'memReq', header: 'Reservado', alignment: 'center',
          accessor: (r: Row) => fmtGiB(r.requestsMemory) },
        { id: 'memAlloc', header: 'Alocável', alignment: 'center',
          accessor: (r: Row) => fmtGiB(r.allocatableMemory) },
        { id: 'memFill', header: 'Ocupação', alignment: 'center',
          accessor: (r: Row) => fmtPct(r.memFillPct) },
      ],
    },
  ], [nodeSelected, setNodeSelected]);

  const visibleRows = useMemo(() => {
    const term = nodeFilter.trim().toLocaleLowerCase();
    const filtered = term
      ? rows.filter(row => row.node.toLocaleLowerCase().includes(term))
      : rows;

    return [...filtered].sort((left, right) => {
      if (sortKey === 'node') {
        const comparison = left.node.localeCompare(right.node);
        return sortDescending ? -comparison : comparison;
      }

      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      // Métrica indisponível fica sempre no fim, independentemente da direção.
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;

      const comparison = leftValue - rightValue;
      return sortDescending ? -comparison : comparison;
    });
  }, [nodeFilter, rows, sortDescending, sortKey]);

  const hasNodeSelected = Boolean(nodeSelected && nodeSelected !== 'all');
  const headerActions = useMemo(() => (
    <DashboardWidgetHeaderActions>
      <DashboardWidgetHeaderActionGroup label="Node">
        <Button
          size="condensed"
          color="primary"
          variant={hasNodeSelected ? 'emphasized' : 'default'}
          style={dashboardWidgetHeaderButtonStyle(hasNodeSelected)}
          disabled={!hasNodeSelected}
          onClick={() => setNodeSelected('all')}
        >
          <Button.Prefix><FilterOutIcon /></Button.Prefix>
          Limpar recorte
        </Button>
      </DashboardWidgetHeaderActionGroup>
    </DashboardWidgetHeaderActions>
  ), [hasNodeSelected, setNodeSelected]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

  return (
    <Flex flexDirection="column" gap={8}>
      {!onHeaderActionsChange && headerActions}
      {nodeSelected && nodeSelected !== 'all' && (
        <Chip color="primary">node: {nodeSelected}</Chip>
      )}
      {loading && <span>Carregando ocupação dos nodes…</span>}
      {!loading && rows.length === 0 ? (
        <span>Selecione um workload específico para ver os nodes</span>
      ) : (
        <Flex flexDirection="column" gap={8}>
          <Flex alignItems="center" gap={8} flexWrap="wrap">
            <TextInput
              type="search"
              value={nodeFilter}
              onChange={setNodeFilter}
              placeholder="Filtrar por nome do node"
              aria-label="Filtrar nodes por nome"
              style={{ minWidth: 240 }}
            />
            <SelectComponent
              defaultValue={sortKey}
              options={SORT_OPTIONS}
              clearable={false}
              filter={false}
              onChange={value => value && setSortKey(value as SortKey)}
            />
            <Button
              style={dashboardWidgetHeaderButtonStyle(sortDescending)}
              onClick={() => setSortDescending(value => !value)}
              aria-label={`Alterar para ordem ${sortDescending ? 'crescente' : 'decrescente'}`}
            >
              {sortDescending ? 'Decrescente' : 'Crescente'}
            </Button>
            <span>{visibleRows.length} de {rows.length} nodes</span>
          </Flex>

          {visibleRows.length === 0 ? (
            <span>Nenhum node corresponde ao filtro.</span>
          ) : (
            <div
              role="region"
              aria-label="Ocupação dos nodes"
              tabIndex={0}
              style={{
                maxHeight: 360,
                overflow: 'auto',
                overscrollBehavior: 'contain',
              }}
            >
              <SimpleTableV2
                data={visibleRows}
                columns={columns}
                style={{ width: '100%' }}
                variant={{
                  rowDensity: 'default',
                  rowSeparation: 'zebraStripes',
                  verticalDividers: true,
                  contained: true,
                }}
              />
            </div>
          )}
        </Flex>
      )}
    </Flex>
  );
}

(WorkloadNodeCapacity as any).dashboardWidget = true;

export { WorkloadNodeCapacity };
