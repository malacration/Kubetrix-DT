import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { Chip } from "@dynatrace/strato-components-preview/content"
import { InformationOverlay, Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { SingleValue } from '@dynatrace/strato-components-preview/charts';
import { units } from '@dynatrace-sdk/units';


import {
  DataTableV2,
  type DataTableV2ColumnDef,
} from '@dynatrace/strato-components-preview/tables'

import { getOptimizationData } from './query';
import { ChipValues, MetricsGrouped } from './model';
import { ChartProps } from '../../filters/BarChartProps';
import { useSetLastRefreshedAt, useSetSidebarDismissed } from '../../context/FilterK8sContext';
import { CapacityBalance } from './CapacityBalance';
import { Link } from '@dynatrace/strato-components/typography';
import { Link as RouterLink } from 'react-router-dom';
import { FilterIcon, RefreshIcon } from '@dynatrace/strato-icons';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
  DashboardWidgetHeaderActions,
} from '../../dashboard/DashboardWidgetHeaderActions';

interface OptimizationProps extends ChartProps {
  /** Versão enxuta para a análise de um único workload. */
  compact?: boolean;
}

const GiB = 1024 ** 3

/**
 * Destino do drill-down para a análise dedicada do workload.
 *
 * Cluster/namespace/workload viajam como query params porque é assim que o
 * FilterK8sContext já sincroniza esses três valores na URL (chaves `cluster`, `ns`,
 * `wl`) — usar segmentos de path criaria uma segunda fonte de verdade pro mesmo estado.
 * `node=all` limpa um recorte de node que tenha ficado de uma visita anterior.
 *
 * Devolve um `to` do react-router (caminho relativo à app), NÃO uma URL absoluta de
 * getDashboardUrl(): a URL absoluta força recarga de página inteira, que sai do router
 * e acabava caindo de volta na rota atual. O react-router já resolve o basename="ui"
 * e o prefixo da plataforma sozinho — mesma abordagem da SideBar.
 */
function workloadAnalysisTo(row: MetricsGrouped) {
  const params = new URLSearchParams({
    cluster: row.cluster ?? 'all',
    ns: row.namespace ?? 'all',
    wl: row.workload ?? 'all',
    node: 'all',
  });
  return { pathname: '/dashboards/WorkloadAnalysis', search: `?${params.toString()}` };
}

/**
 * Célula do nome do workload: link de drill-down + ícone de alertas.
 *
 * É um componente (e não uma função pura de render) porque precisa do hook de sidebar.
 * DataTableV2CustomCell exige JSX.Element como retorno, daí os fragmentos nos caminhos
 * que só mostram texto.
 */
function WorkloadCell({ info }: { info: { rowData: MetricsGrouped } }) : React.JSX.Element {
  const rowData = info.rowData
  const setSidebarDismissed = useSetSidebarDismissed()

  // getChips só existe na linha-pai; as sub-linhas (MIN/Median/MAX/My) são Metrics
  // puros — não são workloads e não têm pra onde navegar.
  const isWorkloadRow = typeof rowData?.getChips === 'function'
  const chips: Array<ChipValues> = isWorkloadRow ? rowData.getChips() ?? [] : [];

  if (!isWorkloadRow)
    return <>{rowData?.workload}</>

  // O link fica FORA do InformationOverlay, lado a lado com ele. O Trigger renderiza
  // um <button>, e âncora dentro de botão é HTML inválido: o clique era capturado pelo
  // botão (abrindo o overlay) e a navegação nunca acontecia. Separados, o nome navega
  // e o ícone de info abre os chips.
  return (
    <Flex alignItems="center" gap={4}>
      <Link
        as={RouterLink}
        to={workloadAnalysisTo(rowData)}
        // Recolhe a sidebar ao entrar na análise: é uma tela de leitura densa
        // (quatro gráficos + duas tabelas) e ganha a largura toda. Mesmo gesto que
        // os próprios links da SideBar já fazem ao navegar.
        onClick={() => setSidebarDismissed(true)}
      >
        {rowData?.workload}
      </Link>
      {chips.length > 0 && (
        <InformationOverlay>
          <InformationOverlay.Trigger aria-label={`Alertas de ${rowData?.workload}`} />
          <InformationOverlay.Content>
            <Flex flexDirection="column">
              {chips.map((c, i) => (
                <Chip color={c.color} key={i}>{c.label}</Chip>
              ))}
            </Flex>
          </InformationOverlay.Content>
        </InformationOverlay>
      )}
    </Flex>
  )
}

// header aceita () => ReactElement, então o tooltip vai no cabeçalho da coluna.
// O tracejado embaixo é a única dica visual de que existe algo pra ler ali.
function headerWithHelp(label: string, help: string) {
  const Header = () => (
    <Tooltip text={help}>
      <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{label}</span>
    </Tooltip>
  )
  // Nomeado por causa da regra react/display-name: o header é um componente de
  // verdade, e uma arrow anônima devolvida por factory dispara o lint.
  Header.displayName = `Header(${label})`
  return Header
}

// Só as linhas-pai (MetricsGrouped) têm recomendação; as sub-linhas (MIN/Median/MAX/My)
// são Metrics puros e não respondem a getRecommendationChip.
function getRecommendationCell(info) : React.JSX.Element {
  const rowData : MetricsGrouped = info.rowData
  if(typeof rowData?.getRecommendationChip !== 'function')
    return <></>
  const chip = rowData.getRecommendationChip()
  return <Chip color={chip.color}>{chip.label}</Chip>
}

const Optimization = forwardRef<HTMLDivElement, OptimizationProps>(
  ( {
    filters,
    lastRefreshedAt,
    compact = false,
    onHeaderActionsChange,
  },ref: ForwardedRef<HTMLDivElement>) => {

  const [result, setResult] = useState<MetricsGrouped[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyWaste, setOnlyWaste] = useState(false);
  const setLastRefreshedAt = useSetLastRefreshedAt();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);


  const columns = useMemo<DataTableV2ColumnDef<(typeof data)[number]>[]>(
    () => [
      { accessor: 'name', id: 'name',
        cell: (info) => <WorkloadCell info={info} />,
        header: 'WorkLoad', width: 165,
      },
      { accessor: 'namespace', id: 'namespace',
        header: 'namespace', width: 120,
      },
      { accessor: 'capacityScoreLabel', id: 'capacityScore',
        header: headerWithHelp('Economia total',
          'CPU e memória somadas num número só, para ordenar a lista por maior ganho. ' +
          'Memória é convertida em "core equivalente" na razão 1 Core : 4 GiB, a proporção ' +
          'vCPU/RAM das instâncias cloud mais comuns. É saldo líquido: o recurso que falta ' +
          'abate o que sobra no outro, então valor negativo = o workload precisa de mais ' +
          'do que devolve. Calculado sobre o REQUEST, que é o que reserva capacidade no nó.'),
        alignment: 'center', width: 130,
        sortAccessor: 'capacityScore', sortType: 'number',
      },
      { id: 'recommendation',
        cell: (info) => getRecommendationCell(info),
        header: headerWithHelp('Situação',
          '"Pode reduzir": o pico de uso está abaixo de 50% do request, sem throttle nem ' +
          'pressão de limite. "Precisa mais": o pico encosta em 90% do limit, ou houve ' +
          'throttle de CPU. "Ajustado": nem um nem outro.'),
        alignment: 'center', width: 120,
      },
      {
        accessor: 'resource', id: 'resource',
        header: 'Resource', alignment: 'center', width: 175,
      },
      {
        accessor: 'podDesired', id: 'podDesired',
        header: headerWithHelp('Pods desejados',
          'Quantidade média de réplicas desejadas do workload durante o período selecionado. ' +
          'Ela é usada para converter os totais de CPU e memória em valores por pod.'),
        alignment: 'center', width: 110,
      },

      {
        header: 'CPU', accessor: 'cpu', id: 'cpu',
        width: { type: 'auto' }, alignment: 'center',
        columns: [
          { header: 'Request', accessor: 'cpuRequest', id: 'cpuRequest', width: { type: 'auto' }, alignment: 'center'},
          { header: 'Limit', accessor: 'cpuLimit', id: 'cpuLimit', width: { type: 'auto' }, alignment: 'center'},
          // Sinal: positivo = request acima do uso = sobra recuperável (ver
          // overUnderCpuRaw). O cabeçalho antigo dizia "(-) Over | (+) Under", o
          // inverso do que o código calcula, e fazia a coluna ser lida ao contrário.
          { header: headerWithHelp('(+) Sobra | (-) Falta',
              'Na linha do workload: request de CPU configurado menos o uso MÉDIO, ' +
              'multiplicado pelo número de pods. Positivo = dá para devolver ao cluster; ' +
              'negativo = está reservando menos do que consome. Nas linhas MIN/Median/MAX/My: ' +
              'quanto aquela recomendação libera em relação ao que está configurado hoje.'),
            accessor: 'overUnderCpu', id: 'cpuOptimization', width: { type: 'auto' },
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
          { header: headerWithHelp('(+) Sobra | (-) Falta',
              'Na linha do workload: request de memória configurado menos o PICO de uso ' +
              'com 20% de folga, multiplicado pelo número de pods. Usa pico (e não média) ' +
              'porque memória não é compressível: cortar perto do uso real gera OOM kill. ' +
              'Nas linhas MIN/Median/MAX/My: quanto aquela recomendação libera em relação ' +
              'ao que está configurado hoje.'),
            accessor: 'overUnderMemory', id: 'memoryOptimization', width: { type: 'auto' },
            alignment: 'center', sortAccessor: 'overUnderMemoryRaw', sortType: 'number',
          }
        ]
      },
    ],
    []
  );

  useEffect(() => {
    if (!filters) return;

    let cancelled = false;

    const { cluster, namespace, workload, timeframe } = {
      cluster:   filters.cluster?.value,
      namespace: filters.namespace?.value,
      workload:  filters.workload?.value,
      timeframe: filters.timeframe?.value,
    };

    // Trava de volume: são 11 métricas por consulta, cada uma dividida por
    // workload+namespace+cluster. Com TUDO em "all" isso varre a frota inteira e
    // traz dado demais. Basta um dos dois eixos estar fixado pra o recorte ficar
    // aceitável: um cluster (varrendo todos os namespaces dele) ou um namespace
    // (varrendo o mesmo namespace em todos os clusters).
    const hasCluster   = cluster   && cluster   !== 'all';
    const hasNamespace = namespace && namespace !== 'all';
    const hasWorkload  = workload  && workload  !== 'all';

    if (!hasCluster && !hasNamespace && !hasWorkload) {
      setResult([]);
      setLoading(false);
      return;
    }

    setLoading(true);
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
    }).catch(err => {
      if (!cancelled) console.error('Erro ao buscar métricas de otimização', err);
    }).finally(() => {
      if (cancelled) return;
      setResult(Array.from(valores.values()))
      setLoading(false)
    })

    return () => { cancelled = true; };
  }, [filters, lastRefreshedAt]);

  // Ordena por economia total decrescente: quem libera mais recurso aparece primeiro
  // sem o usuário precisar clicar em nada. A tabela continua sortable, então dá pra
  // reordenar por CPU ou memória isoladamente depois.
  const rows = useMemo(() => {
    const base = onlyWaste ? result.filter(r => r.capacityScore > 0) : result
    return [...base].sort((a, b) => b.capacityScore - a.capacityScore)
  }, [result, onlyWaste])

  // Sobra e falta somadas SEPARADAMENTE, não como saldo: o donut precisa saber
  // quanto do liberado é reabsorvido internamente, e isso se perde se os dois
  // lados forem compensados antes. O saldo com sinal sai da subtração no
  // CapacityBalance.
  const totals = useMemo(() => {
    return result.reduce((acc, r) => ({
      cpuFreed:     acc.cpuFreed     + Math.max(0,  r.cpuSavingCores),
      cpuNeeded:    acc.cpuNeeded    + Math.max(0, -r.cpuSavingCores),
      // SingleValue/DonutChart formatam a partir de bytes; GiB → bytes.
      memoryFreed:  acc.memoryFreed  + Math.max(0,  r.memorySavingGiB) * GiB,
      memoryNeeded: acc.memoryNeeded + Math.max(0, -r.memorySavingGiB) * GiB,
      count:        acc.count + (r.capacityScore > 0 ? 1 : 0),
    }), { cpuFreed: 0, cpuNeeded: 0, memoryFreed: 0, memoryNeeded: 0, count: 0 })
  }, [result])

  const headerActions = useMemo(() => (
    <DashboardWidgetHeaderActions>
      {!compact && (
        <DashboardWidgetHeaderActionGroup label="Lista">
          <Button
            size="condensed"
            color="primary"
            variant={onlyWaste ? 'emphasized' : 'default'}
            style={dashboardWidgetHeaderButtonStyle(onlyWaste)}
            aria-pressed={onlyWaste}
            onClick={() => setOnlyWaste(value => !value)}
          >
            <Button.Prefix><FilterIcon /></Button.Prefix>
            Somente com sobra
          </Button>
        </DashboardWidgetHeaderActionGroup>
      )}
      <DashboardWidgetHeaderActionGroup>
        <Button
          size="condensed"
          color="primary"
          style={dashboardWidgetHeaderButtonStyle(false)}
          onClick={() => setLastRefreshedAt(new Date())}
          loading={loading}
        >
          <Button.Prefix><RefreshIcon /></Button.Prefix>
          Atualizar
        </Button>
      </DashboardWidgetHeaderActionGroup>
    </DashboardWidgetHeaderActions>
  ), [compact, loading, onlyWaste, setLastRefreshedAt]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
  }, [headerActions, onHeaderActionsChange]);

  return (
    <div ref={ref}>
      {!onHeaderActionsChange && headerActions}
      <Flex flexDirection="column" gap={12}>
        {/* SingleValue não tem altura própria: dentro de um flex sem dimensão ele
            colapsa e o spinner de loading fica sem área pra desenhar (some da tela).
            Cada card precisa de caixa com altura fixa e largura mínima. */}
        <Flex gap={12} flexWrap="wrap">
          <CapacityBalance
            resourceLabel="CPU"
            freed={totals.cpuFreed}
            needed={totals.cpuNeeded}
            formatter={{ input: units.unspecified.core, output: units.unspecified.core }}
            loading={loading}
          />
          <CapacityBalance
            resourceLabel="Memória"
            freed={totals.memoryFreed}
            needed={totals.memoryNeeded}
            formatter={{ input: units.data.byte, output: units.data.gibibyte }}
            loading={loading}
          />
          <div style={{ height: '7em', minWidth: '10em', flex: '1 1 10em' }}>
            <SingleValue
              data={totals.count}
              label="Workloads com sobra"
              loading={loading}
            />
          </div>
        </Flex>

        <DataTableV2
          data={rows}
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
          {!compact && (
            <DataTableV2.Pagination
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              pageIndex={pageIndex}
              onPageIndexChange={setPageIndex}
            />
          )}
          <DataTableV2.EmptyState>
            Selecione ao menos um cluster ou um namespace
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
