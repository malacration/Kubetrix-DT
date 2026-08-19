import { eventsClient, metricsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { QueryResult } from "@dynatrace-sdk/client-query";
import { Timeframe } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";
import { GrailDqlQuery } from "../core/GrailClient";
import { pickResolution } from "app/components/timeframe/resolution";


/**
 * Monta o `:filter(and(...))` de dimensões k8s. Valor vazio ou "all" é omitido —
 * mesma convenção de kubernetesWorkload()/kubernetesMetrics().
 */
function dimensionFilter(pairs: Array<[string, string | undefined]>): string {
  const all = pairs
    .filter(([, v]) => v && v !== 'all')
    .map(([dim, v]) => `eq("${dim}","${v}")`)
    .join(',');

  return all === '' ? '' : `:filter(and(${all}))`;
}


/** Escapa um valor inserido como string literal em DQL. */
function quoteDql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}


/**
 * Quantos pods em execução do workload estavam em cada node, ao longo do tempo.
 *
 * Neste ambiente, `dt.kubernetes.pods` não retornou séries com workload + node. A
 * fonte usada aqui é a mesma que já retorna memória por pod: cada combinação de
 * `dt.entity.cloud_application_instance` e `k8s.node.name` representa um pod observado
 * naquele node. Primeiro colapsamos todos os containers na entidade do pod; depois
 * transformamos presença em 1 e somamos por node em cada bucket.
 *
 * O resultado fica no formato nativo de `timeseries`: uma linha por node e um array
 * `value` alinhado a `timeframe`/`interval`.
 */
export function workloadPodsByNode(
  $kubernetsCluster?: string,
  $Namespace?: string,
  $workload?: string,
  timeFrame?: Timeframe,
  resolution?: string,
): Promise<QueryResult | { error: string }> {

  if (!$workload || $workload === 'all') {
    return Promise.resolve({ error: 'Selecione um workload específico para consultar pods por node.' });
  }

  const podEntity = 'dt.entity.cloud_application_instance';
  const selectedFilters = [
    $kubernetsCluster && $kubernetsCluster !== 'all'
      ? `matchesValue(entityName(dt.entity.kubernetes_cluster), "${quoteDql($kubernetsCluster)}")` : '',
    $Namespace && $Namespace !== 'all'
      ? `matchesValue(k8s.namespace.name, "${quoteDql($Namespace)}")` : '',
    `matchesValue(entityName(${podEntity}), "${quoteDql($workload)}*")`,
  ].filter(Boolean).join(' and ');

  const interval = pickResolution(0, timeFrame, resolution);
  const dql = `
    timeseries pod_signal = avg(dt.containers.memory.resident_set_bytes),
      by: { ${podEntity}, k8s.node.name },
      filter: { ${selectedFilters} },
      interval: ${interval}
    | filter isNotNull(k8s.node.name)
    | fieldsAdd value = if(isNotNull(pod_signal[]), 1, else: 0)
    | summarize value = sum(value[]), by: { k8s.node.name, timeframe, interval }
    | fieldsAdd node = k8s.node.name
    | fieldsKeep timeframe, interval, node, value
  `;

  return GrailDqlQuery(dql, timeFrame);
}


/**
 * Uso real dos containers de cada node ao longo do tempo.
 *
 * Usa as métricas `dt.containers.*` que já retornam dados neste tenant. Primeiro
 * preserva a instância do container para calcular seu consumo e depois soma os
 * containers por node. CPU e memória são consultadas separadamente para não depender
 * da interseção de dimensões entre famílias de métricas diferentes.
 */
export function nodesResourceUsageOverTime(
  resource: 'cpu' | 'memory',
  $kubernetsCluster?: string,
  timeFrame?: Timeframe,
  resolution?: string,
  $nodes?: string | string[],
): Promise<QueryResult | { error: string }> {

  if (!timeFrame) {
    return Promise.resolve({ error: 'Selecione um período para consultar o uso dos nodes.' });
  }

  // Esta métrica representa o consumo TOTAL do node, não apenas o workload. Exigir
  // explicitamente os nodes evita que a ausência de recorte transforme a consulta
  // em "todos os nodes do cluster". Quem chama deve primeiro correlacionar o
  // workload com seus pods (workloadPodsByNode).
  const selectedNodes = (Array.isArray($nodes) ? $nodes : [$nodes])
    .filter((node): node is string => Boolean(node && node !== 'all'));
  if (selectedNodes.length === 0) {
    return Promise.resolve({
      error: 'Nenhum node correlacionado ao workload foi informado para a consulta.',
    });
  }

  const nodeFilter = selectedNodes.length === 1
    ? `k8s.node.name == "${quoteDql(selectedNodes[0])}"`
    : `in(k8s.node.name, array(${selectedNodes
        .map(node => `"${quoteDql(node)}"`)
        .join(', ')}))`;

  const selectedFilters = [
    $kubernetsCluster && $kubernetsCluster !== 'all'
      ? `matchesValue(entityName(dt.entity.kubernetes_cluster), "${quoteDql($kubernetsCluster)}")` : '',
    nodeFilter,
  ].filter(Boolean);

  const filter = selectedFilters.join(' and ');
  const interval = pickResolution(0, timeFrame, resolution);
  const containerEntity = 'dt.entity.container_group_instance';
  const dql = resource === 'memory'
    ? `
      timeseries container_usage = avg(dt.containers.memory.resident_set_bytes),
        by: { ${containerEntity}, k8s.node.name },
        filter: { ${filter} },
        interval: ${interval}
      | filter isNotNull(k8s.node.name)
      | summarize value = sum(container_usage[]),
          by: { k8s.node.name, timeframe, interval }
      | fieldsAdd node = k8s.node.name
      | fieldsKeep timeframe, interval, node, value
    `
    : `
      timeseries {
          usage_user_time = avg(dt.containers.cpu.usage_user_time),
          usage_system_time = avg(dt.containers.cpu.usage_system_time)
        },
        by: { ${containerEntity}, k8s.node.name },
        filter: { ${filter} },
        interval: ${interval}
      | filter isNotNull(k8s.node.name)
      | fieldsAdd container_usage = (usage_user_time[] + usage_system_time[])
          * 1000 / (60 * 1000 * 1000 * 1000)
      | summarize value = sum(container_usage[]),
          by: { k8s.node.name, timeframe, interval }
      | fieldsAdd node = k8s.node.name
      | fieldsKeep timeframe, interval, node, value
    `;

  return GrailDqlQuery(dql, timeFrame);
}


/**
 * Uso de CPU dos processos executados no host correspondente a um node K8s.
 *
 * Neste tenant o worker Kubernetes já é representado por um `HOST` contendo
 * `k8s.node.name`; não existe um `K8S_NODE` separado. A própria métrica de processo
 * traz `dt.smartscape.host`, portanto o recorte pode ser feito diretamente pelo ID
 * desse HOST, sem depender de travessias `runs_on`.
 */
export function nodeProcessesCpuUsageOverTime(
  $node?: string | string[],
  $kubernetsCluster?: string,
  timeFrame?: Timeframe,
  resolution?: string,
): Promise<QueryResult | { error: string }> {

  const selectedNodes = Array.isArray($node)
    ? $node.filter(node => node && node !== 'all')
    : $node && $node !== 'all' ? [$node] : [];
  if (selectedNodes.length !== 1) {
    return Promise.resolve({ error: 'Selecione exatamente um node para consultar seus processos.' });
  }
  if (!timeFrame) {
    return Promise.resolve({ error: 'Selecione um período para consultar a CPU dos processos.' });
  }

  const hostFilters = [
    `k8s.node.name == "${quoteDql(selectedNodes[0])}"`,
    $kubernetsCluster && $kubernetsCluster !== 'all'
      ? `dt.host_group.id == "${quoteDql($kubernetsCluster)}"` : '',
  ].filter(Boolean).join(' and ');
  const interval = pickResolution(0, timeFrame, resolution);

  const dql = `
    timeseries cpu = avg(dt.process.cpu.usage),
      by: { dt.smartscape.process, dt.smartscape.host },
      filter: {
        dt.smartscape.host in [
          smartscapeNodes HOST
          | filter ${hostFilters}
          | fields id
        ]
      },
      interval: ${interval}
    | fieldsAdd
        process = getNodeName(dt.smartscape.process),
        host = getNodeName(dt.smartscape.host)
    | fieldsKeep timeframe, interval, process, host, cpu
  `;

  return GrailDqlQuery(dql, timeFrame);
}


/** Resolve o HOST que carrega o nome do node Kubernetes selecionado. */
export function nodeHostNames(
  $node?: string | string[],
  $kubernetsCluster?: string,
  timeFrame?: Timeframe,
): Promise<QueryResult | { error: string }> {

  const selectedNodes = Array.isArray($node)
    ? $node.filter(node => node && node !== 'all')
    : $node && $node !== 'all' ? [$node] : [];
  if (selectedNodes.length !== 1) {
    return Promise.resolve({ error: 'Selecione exatamente um node para resolver seu host.' });
  }

  const hostFilters = [
    `k8s.node.name == "${quoteDql(selectedNodes[0])}"`,
    $kubernetsCluster && $kubernetsCluster !== 'all'
      ? `dt.host_group.id == "${quoteDql($kubernetsCluster)}"` : '',
  ].filter(Boolean).join(' and ');
  const dql = `
    smartscapeNodes HOST
    | filter ${hostFilters}
    | fields host = name
    | filter isNotNull(host)
    | dedup host
  `;

  return GrailDqlQuery(dql, timeFrame);
}


/** Ocupação de um node: o que já está reservado contra o que ele tem pra oferecer. */
export type NodeCapacity = {
  node: string;
  /** Cores de CPU já reservados por requests de TODOS os pods do node. */
  requestsCpu?: number;
  /** Cores alocáveis do node (capacidade menos reserva do sistema). */
  allocatableCpu?: number;
  /** Bytes de memória já reservados por requests de todos os pods do node. */
  requestsMemory?: number;
  /** Bytes de memória alocáveis do node. */
  allocatableMemory?: number;
};

/** Capacidade alocável, nas unidades nativas usadas pelos gráficos. */
export type NodeAllocatable = {
  node: string;
  /** Millicores. */
  cpu?: number;
  /** Bytes. */
  memory?: number;
};


/**
 * Busca uma métrica de node dividida por `k8s.node.name`, tolerando ausência.
 *
 * Esta parte da tabela ainda consulta as métricas Classic de capacidade do node. Uma
 * métrica ausente devolve 404 e derrubaria o Promise.all inteiro — aqui ela vira um mapa
 * vazio e o widget mostra somente aquela coluna em branco, em vez da tabela toda sumir.
 */
async function nodeMetricByName(
  metricName: string,
  extra: string,
  $kubernetsCluster?: string,
  timeFrame?: Timeframe,
): Promise<Map<string, number>> {

  const filter = dimensionFilter([["k8s.cluster.name", $kubernetsCluster]]);
  const metricSelector = `builtin:kubernetes.node.${metricName}${filter}:splitBy("k8s.node.name"):${extra}`;

  const out = new Map<string, number>();
  try {
    const result = await clientClassic(metricSelector, timeFrame);
    result.raw().result.forEach(collection => {
      collection.data.forEach(series => {
        const node = series.dimensionMap["k8s.node.name"];
        if (!node) return;
        // :last já reduz a série a um ponto, mas a API ainda devolve o array —
        // pega o último valor finito, ignorando buckets vazios do fim.
        const value = [...series.values].reverse().find(v => v != null && isFinite(v));
        if (value != null) out.set(node, value);
      });
    });
  } catch (err) {
    console.warn(`Métrica de node indisponível neste ambiente: ${metricName}`, err);
  }
  return out;
}


/**
 * Capacidade alocável atual de todos os nodes do cluster.
 *
 * CPU permanece em millicores para casar com `dt.containers.cpu.*`; memória
 * permanece em bytes para casar com `resident_set_bytes`.
 */
export async function nodesAllocatableCapacity(
  $kubernetsCluster?: string,
  timeFrame?: Timeframe,
): Promise<NodeAllocatable[]> {
  const [cpu, memory] = await Promise.all([
    nodeMetricByName('cpu_allocatable', 'max:fold(max):last', $kubernetsCluster, timeFrame),
    nodeMetricByName('memory_allocatable', 'max:fold(max):last', $kubernetsCluster, timeFrame),
  ]);
  const nodes = Array.from(new Set([...cpu.keys(), ...memory.keys()])).sort(
    (left, right) => left.localeCompare(right),
  );

  return nodes.map(node => ({
    node,
    cpu: cpu.get(node),
    memory: memory.get(node),
  }));
}


/**
 * Ocupação dos nodes informados: quanto de CPU/memória já está reservado por requests
 * contra o alocável de cada um. Responde "cabe crescer neste node?".
 *
 * Os requests aqui são os de TODOS os pods do node, não só os do workload analisado —
 * é isso que determina se o scheduler ainda consegue encaixar mais alguma coisa ali.
 */
export async function nodesCapacity(
  nodes: string[],
  $kubernetsCluster?: string,
  timeFrame?: Timeframe,
): Promise<NodeCapacity[]> {

  if (nodes.length === 0) return [];

  const [requestsCpu, allocatableCpu, requestsMemory, allocatableMemory] = await Promise.all([
    nodeMetricByName("requests_cpu", "max:fold(max):toUnit(MilliCores,Cores):last", $kubernetsCluster, timeFrame),
    nodeMetricByName("cpu_allocatable", "max:fold(max):toUnit(MilliCores,Cores):last", $kubernetsCluster, timeFrame),
    nodeMetricByName("requests_memory", "max:fold(max):last", $kubernetsCluster, timeFrame),
    nodeMetricByName("memory_allocatable", "max:fold(max):last", $kubernetsCluster, timeFrame),
  ]);

  return nodes.map(node => ({
    node,
    requestsCpu: requestsCpu.get(node),
    allocatableCpu: allocatableCpu.get(node),
    requestsMemory: requestsMemory.get(node),
    allocatableMemory: allocatableMemory.get(node),
  }));
}





export async function NodesMetrics(metric : string, $kubernetsCluster, $Namespace, $workload, timeFrame? : Timeframe) {
    
  let toRelationship = ',in("dt.entity.kubernetes_node",entitySelector("type(~"KUBERNETES_NODE~")';
  toRelationship += ',toRelationship.runsOn(type(~"CLOUD_APPLICATION_INSTANCE~")';
  toRelationship += ',fromRelationship.isInstanceOf(type(~"CLOUD_APPLICATION~")';
  toRelationship += ',toRelationship.isNamespaceOfCa(type(~"CLOUD_APPLICATION_NAMESPACE~"),entityName.equals(~'+$Namespace+'~))))"))';
  
  if(!$Namespace || $Namespace == "all")
    toRelationship = '';

  let clusterFilter = ',eq("k8s.cluster.name","'+$kubernetsCluster+'")'
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''

  let workloadFilter = ',in("dt.entity.kubernetes_node", entitySelector("type(~"KUBERNETES_NODE~"),toRelationship.runsOn(type(~"CLOUD_APPLICATION_INSTANCE~"),fromRelationships.isInstanceOf(type(~"CLOUD_APPLICATION~"),entityName.equals(~'+$workload+'~)))"))'
  if(!$workload || $workload == "all")
    workloadFilter = ''

  
  //:filter(eq("k8s.cluster.name","openshift"))
  // const metricSelector = "builtin:kubernetes.node.pods"
  const filter = ':filter(and(eq("pod_condition","Ready"),eq("pod_phase","Running"),eq("pod_status","Running")'+toRelationship+clusterFilter+workloadFilter+'))';
  const split  = ':splitBy("k8s.node.name")'
  
  const metricSelector = metric+filter+':last';

  return clientClassic(metricSelector,timeFrame)
}


export async function LastHostMetric(metric : string, $kubernetsCluster, $Namespace, $workload, timeFrame? : Timeframe) {
      
  let clusterFilter = `| filter in(dt.entity.host,classicEntitySelector("type(HOST),toRelationship.isClusterOfHost(type(KUBERNETES_CLUSTER),entityName.equals(${$kubernetsCluster}))"))`
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''

  let nameSpaceFilter = `| filter in(dt.entity.host,classicEntitySelector("type(HOST),toRelationship.isCgiOfHost(type(CONTAINER_GROUP_INSTANCE),fromRelationship.isCgiOfNamespace(type(CLOUD_APPLICATION_NAMESPACE),entityName.equals(${$Namespace})))"))`
  if(!$Namespace || $Namespace == "all")
    nameSpaceFilter = '';

  

  let workloadFilter = `| filter in(dt.entity.host, entitySelector("type(HOST),toRelationship.isCgiOfHost(type(CONTAINER_GROUP_INSTANCE),fromRelationship.isCgiOfCa(type(CLOUD_APPLICATION),entityName.equals(${$workload})))"))`
  if(!$workload || $workload == "all")
    workloadFilter = ''

  
  const dql = `
    timeseries { values=avg({${metric}}), by:{dt.entity.host} }
    | fieldsAdd name=entityName(dt.entity.host), kubernetesLabels=entityAttr(dt.entity.host,"kubernetesLabels")
    | filter isNotNull(kubernetesLabels)
    ${clusterFilter}
    ${nameSpaceFilter}
    ${workloadFilter}
    | fieldsAdd value = arrayLast(values), id=dt.entity.host
    | fields name, value, id
  `

  return GrailDqlQuery(dql,timeFrame)
}
