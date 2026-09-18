import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { Timeseries } from '@dynatrace/strato-components-preview/charts';
import { units } from '@dynatrace-sdk/units';
import { clientClassic } from '../core/MetricsClientClassic';
import { GrailDqlQuery } from '../core/GrailClient';
import { isQueryResult, timeseriesCommandResultToChartSeries } from '../core/GrailConverter';
import { pickResolution } from 'app/components/timeframe/resolution';
import { sumSeriesByBucket, trimIncompleteBuckets } from 'app/model/ClusterCapacitySeries';

/** Escapa um valor inserido como string literal em DQL. */
function quoteDql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Bloco `filter: { ... }` das queries Grail (`dt.containers.*`). Filtra por
 * `entityName(dt.entity.kubernetes_cluster)`, não por `k8s.cluster.name` — confirmado
 * ao vivo que boa parte dos nodes deste tenant não populica `k8s.cluster.name` nas
 * métricas `dt.containers.*` (ficam com essa dimensão nula), mas a entidade
 * `dt.entity.kubernetes_cluster` está sempre presente. Mesmo padrão já usado em
 * `nodesResourceUsageOverTime`/`kubernetesPodCpuThrottling` (NodeServices.tsx /
 * WorkloadService.tsx). Vazio (frota inteira) quando "all".
 */
function clusterFilterBlock($kubernetsCluster?: string): string {
  if (!$kubernetsCluster || $kubernetsCluster === 'all') return '';
  return `, filter: { matchesValue(entityName(dt.entity.kubernetes_cluster), "${quoteDql($kubernetsCluster)}") }`;
}

/**
 * Ocupação agregada de um recurso (CPU ou memória) no nível do CLUSTER — ou de toda a
 * frota monitorada, quando nenhum cluster é selecionado — como série temporal.
 *
 * Cada campo é resiliente individualmente: se uma consulta falhar (métrica ausente
 * neste ambiente, erro de rede), o campo fica `undefined` em vez de derrubar o
 * resultado inteiro — mesmo critério de `nodeMetricByName` em NodeServices.tsx.
 */
export interface ClusterCapacitySeries {
  used?: Timeseries;
  reserved?: Timeseries;
  available?: Timeseries;
  /** Só CPU — memória não tem métrica de throttling neste tenant. */
  throttled?: Timeseries;
}

/**
 * Busca uma métrica `builtin:kubernetes.node.*` dividida por node, SEM colapsar num
 * snapshot (`:last`) como `nodeMetricByName` em NodeServices.tsx faz — aqui a série
 * completa no `resolution` pedido é o que interessa, porque a capacidade
 * agregada do cluster precisa refletir nodes entrando/saindo ao longo do tempo, não
 * um valor único "de agora". As séries por node são somadas por bucket de tempo em
 * um total só do cluster.
 */
async function nodeMetricSeries(
  metricName: 'cpu_allocatable' | 'memory_allocatable' | 'requests_cpu' | 'requests_memory',
  $kubernetsCluster: string | undefined,
  timeFrame: Timeframe | undefined,
  interval: string,
  seriesName: string,
): Promise<Timeseries | undefined> {
  const filter = $kubernetsCluster && $kubernetsCluster !== 'all'
    ? `:filter(and(eq("k8s.cluster.name","${quoteDql($kubernetsCluster)}")))`
    : '';
  // ":max" agrega os pontos brutos dentro de cada bucket do `resolution` pedido — sem
  // ":fold(...):last" na ponta, que é o que colapsava tudo num snapshot único.
  const metricSelector = `builtin:kubernetes.node.${metricName}${filter}:splitBy("k8s.node.name"):max`;

  try {
    // A Classic Metrics API não entende "auto" (o valor cru do filtro de resolução) —
    // precisa do intervalo já resolvido, o mesmo usado no `interval:` do DQL ao lado.
    const result = await clientClassic(metricSelector, timeFrame, interval);
    const perNode = await result.metricDataToTimeseries(seriesName);
    return sumSeriesByBucket(perNode, seriesName);
  } catch (err) {
    console.warn(`Métrica de node indisponível neste ambiente: ${metricName}`, err);
    return undefined;
  }
}

/** Executa uma query DQL de total-do-cluster (uma linha só) e extrai a série. */
async function grailClusterSeries(
  dql: string,
  timeFrame: Timeframe | undefined,
  seriesName: string,
  unit: Timeseries['unit'],
  valueField: string,
): Promise<Timeseries | undefined> {
  try {
    const result = await GrailDqlQuery(dql, timeFrame);
    if (!isQueryResult(result)) {
      console.warn(`Consulta de capacidade de cluster falhou: ${seriesName}`, result.error);
      return undefined;
    }
    return timeseriesCommandResultToChartSeries(result, seriesName, unit, valueField)[0];
  } catch (err) {
    console.warn(`Consulta de capacidade de cluster falhou: ${seriesName}`, err);
    return undefined;
  }
}

/**
 * CPU usada + suprimida (throttled) por TODOS os containers do cluster (ou da frota),
 * somadas num total só por bucket de tempo. Variante de
 * `nodesResourceUsageOverTime`/`kubernetesPodCpuThrottling` sem restrição de
 * node/pod e sem `k8s.node.name` no `summarize` final.
 */
export async function clusterCpuCapacity(
  $kubernetsCluster: string | undefined,
  timeFrame: Timeframe | undefined,
  resolution: string | undefined,
): Promise<ClusterCapacitySeries> {
  const interval = pickResolution(0, timeFrame, resolution);
  const filterBlock = clusterFilterBlock($kubernetsCluster);

  const usedDql = `
    timeseries {
        usage_user_time = avg(dt.containers.cpu.usage_user_time),
        usage_system_time = avg(dt.containers.cpu.usage_system_time)
      },
      by: { dt.entity.container_group_instance, k8s.node.name }${filterBlock},
      interval: ${interval}
    | filter isNotNull(k8s.node.name)
    | fieldsAdd used = (usage_user_time[] + usage_system_time[]) * 1000 / (60 * 1000 * 1000 * 1000)
    | summarize used = sum(used[]), by: { timeframe, interval }
    | fieldsKeep timeframe, interval, used
  `;

  const throttledDql = `
    timeseries throttled_time = avg(dt.containers.cpu.throttled_time, rollup: sum, rate: 1m),
      by: { dt.entity.cloud_application_instance, k8s.node.name }${filterBlock},
      interval: ${interval}
    | filter isNotNull(k8s.node.name)
    | fieldsAdd throttled = throttled_time[] * 1000 / (60 * 1000 * 1000 * 1000)
    | summarize throttled = sum(throttled[]), by: { timeframe, interval }
    | fieldsKeep timeframe, interval, throttled
  `;

  const [used, throttled, available, reserved] = await Promise.all([
    grailClusterSeries(usedDql, timeFrame, 'CPU usada', units.unspecified.millicore, 'used'),
    grailClusterSeries(throttledDql, timeFrame, 'CPU suprimida', units.unspecified.millicore, 'throttled'),
    nodeMetricSeries('cpu_allocatable', $kubernetsCluster, timeFrame, interval, 'CPU disponível'),
    nodeMetricSeries('requests_cpu', $kubernetsCluster, timeFrame, interval, 'CPU reservada'),
  ]);

  return {
    used: trimIncompleteBuckets(used),
    throttled: trimIncompleteBuckets(throttled),
    available: trimIncompleteBuckets(available),
    reserved: trimIncompleteBuckets(reserved),
  };
}

/**
 * Memória usada por TODOS os containers do cluster (ou da frota), somada num total só
 * por bucket de tempo. Sem métrica de "suprimido" equivalente — memória não tem
 * throttling, e este tenant não tem sinal de OOM kill (nem métrica, nem evento).
 */
export async function clusterMemoryCapacity(
  $kubernetsCluster: string | undefined,
  timeFrame: Timeframe | undefined,
  resolution: string | undefined,
): Promise<ClusterCapacitySeries> {
  const interval = pickResolution(0, timeFrame, resolution);
  const filterBlock = clusterFilterBlock($kubernetsCluster);

  const usedDql = `
    timeseries used = avg(dt.containers.memory.resident_set_bytes),
      by: { dt.entity.container_group_instance, k8s.node.name }${filterBlock},
      interval: ${interval}
    | filter isNotNull(k8s.node.name)
    | summarize used = sum(used[]), by: { timeframe, interval }
    | fieldsKeep timeframe, interval, used
  `;

  const [used, available, reserved] = await Promise.all([
    grailClusterSeries(usedDql, timeFrame, 'Memória usada', units.data.byte, 'used'),
    nodeMetricSeries('memory_allocatable', $kubernetsCluster, timeFrame, interval, 'Memória disponível'),
    nodeMetricSeries('requests_memory', $kubernetsCluster, timeFrame, interval, 'Memória reservada'),
  ]);

  return {
    used: trimIncompleteBuckets(used),
    available: trimIncompleteBuckets(available),
    reserved: trimIncompleteBuckets(reserved),
  };
}
