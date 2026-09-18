import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { documentsClient } from '@dynatrace-sdk/client-document';
import { PlatformBinary as Binary } from '@dynatrace-sdk/http-client';

const DEFAULT_JANELA_HORAS = 2;
/** externalId estável do documento — permite localizar sem listar/filtrar. */
const DOC_EXTERNAL_ID = 'kubetrix-topology-map';

/**
 * Arestas removidas manualmente do grafo — conhecidamente enganosas (ex.: o volume
 * estimado de request diverge muito do real por conta de tráfego não-atribuído a um
 * caller específico, ver conversa: rhbk->eolis mostrava ~4-20k estimado vs. 16 real no
 * Service Flow nativo). `[from, to]` por id de entidade; remove nos dois sentidos que
 * `globalEdges`/`applicationEdges` poderiam gerar.
 */
const EXCLUDED_EDGES: [string, string][] = [
  ['SERVICE-60D444E76F5AD86F', 'SERVICE-26C61D315B41332A'], // rhbk -> eolis
];

function isExcludedEdge(fromId: string, toId: string): boolean {
  return EXCLUDED_EDGES.some(([from, to]) => from === fromId && to === toId);
}

/** Escapa um valor inserido como string literal em DQL. */
function quoteDql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Executa uma query DQL e devolve os records, com poll até concluir. */
async function runDql(query: string): Promise<Record<string, unknown>[]> {
  // maxResultRecords explícito: o padrão da API fica bem abaixo do total de arestas
  // do ambiente inteiro (visto ao vivo: ~2000 arestas, resultado vinha truncado em
  // ~1000 sem isso).
  const execution = await queryExecutionClient.queryExecute({ body: { query, maxResultRecords: 10_000 } });
  if (execution.state === 'SUCCEEDED' && execution.result) {
    return (execution.result.records ?? []) as Record<string, unknown>[];
  }
  if (execution.state === 'FAILED' || execution.state === 'CANCELLED') {
    throw new Error(`Query ${execution.state.toLowerCase()} ao iniciar: ${query}`);
  }
  if (!execution.requestToken) {
    throw new Error('A consulta não retornou resultado nem token para acompanhamento.');
  }

  const token = execution.requestToken;
  for (let tries = 0; tries < 60; tries++) {
    const poll = await queryExecutionClient.queryPoll({
      requestToken: token,
      requestTimeoutMilliseconds: 1_000,
    });
    if (poll.state === 'SUCCEEDED') {
      return (poll.result?.records ?? []) as Record<string, unknown>[];
    }
    if (poll.state === 'FAILED' || poll.state === 'CANCELLED') {
      throw new Error(`Query ${poll.state.toLowerCase()}: ${query}`);
    }
  }
  throw new Error(`Query não concluiu a tempo: ${query}`);
}

/**
 * Deriva o workload/deployment a partir do nome do serviço — porta de Get-Workload
 * em gerar-dados.txt. Não há tag k8s.workload.name neste ambiente.
 */
function deriveWorkload(name: string, ns: string): string {
  const esc = ns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = name.match(new RegExp(`^Background - ${esc} - (.+?)-\\*`));
  if (m) return m[1];
  m = name.match(new RegExp(`^${esc} - (.+?)-\\*`));
  if (m) return m[1];
  m = name.match(new RegExp(`^(.+?)(?:-v\\*)?-\\* ?/ - ${esc}$`));
  if (m) return m[1];
  if (/KafkaListener|MessageListener/.test(name)) return 'kafka-listeners';
  const matches = [...name.matchAll(/([A-Za-z0-9][A-Za-z0-9-]*)-\*/g)];
  if (matches.length > 0) return matches[matches.length - 1][1];
  return name;
}

const NS_SUBQUERY = '[ fetch dt.entity.service | fieldsAdd tag = tags | expand tag '
  + '| filter startsWith(tag, "k8s.namespace.name:") '
  + '| summarize ns = takeFirst(substring(tag, from: 19)), by: {id} ]';
const CLUSTER_SUBQUERY = '[ fetch dt.entity.service | fieldsAdd tag = tags | expand tag '
  + '| filter startsWith(tag, "k8s.cluster.name:") '
  + '| summarize cluster = takeFirst(substring(tag, from: 17)), by: {id} ]';
const NAME_SUBQUERY = '[ fetch dt.entity.service '
  + '| fields id, name = entity.name, dbVendor = databaseVendor, techs = serviceTechnologyTypes ]';

interface RawEdgeRecord {
  my_id: string;
  my_name: string;
  my_ns?: string;
  my_cluster?: string;
  my_db?: string;
  my_tech?: string[];
  other_id: string;
  other_name?: string;
  other_ns?: string;
  other_cluster?: string;
  other_db?: string;
  other_tech?: string[];
}

/**
 * Todas as arestas "calls" do ambiente inteiro — não mais por namespace. Como toda
 * aresta A->B aparece no `calls` de A, isso já dá o grafo completo (o antigo
 * called_by seria redundante: é a mesma relação vista do outro lado).
 */
async function globalEdges(): Promise<RawEdgeRecord[]> {
  const dql = `
    fetch dt.entity.service
    | filter isNotNull(calls)
    | fieldsAdd other_id = calls[dt.entity.service]
    | expand other_id
    | filter isNotNull(other_id)
    | lookup ${NS_SUBQUERY}, sourceField: id, lookupField: id, prefix: "mynsl."
    | lookup ${NS_SUBQUERY}, sourceField: other_id, lookupField: id, prefix: "onsl."
    | lookup ${CLUSTER_SUBQUERY}, sourceField: id, lookupField: id, prefix: "myclu."
    | lookup ${CLUSTER_SUBQUERY}, sourceField: other_id, lookupField: id, prefix: "oclu."
    | lookup ${NAME_SUBQUERY}, sourceField: other_id, lookupField: id, prefix: "t."
    | fields
        my_id = id, my_name = entity.name, my_ns = mynsl.ns, my_cluster = myclu.cluster,
        my_db = databaseVendor, my_tech = serviceTechnologyTypes,
        other_id, other_name = t.name, other_ns = onsl.ns, other_cluster = oclu.cluster,
        other_db = t.dbVendor, other_tech = t.techs
    | limit 5000
  `;
  return runDql(dql) as unknown as Promise<RawEdgeRecord[]>;
}

/**
 * Arestas de FRONTEND: `dt.entity.application` (apps RUM) também tem campo `calls`
 * apontando pra `dt.entity.service`, no mesmo formato do calls de serviço->serviço —
 * é como a aplicação (o navegador do usuário) aparece como quem efetivamente inicia a
 * cadeia de chamadas. Sem isso, o "topo" do mapa sempre para no primeiro serviço, sem
 * nunca mostrar QUEM (qual app) de fato chama.
 */
async function applicationEdges(): Promise<RawEdgeRecord[]> {
  const dql = `
    fetch dt.entity.application
    | filter isNotNull(calls)
    | fieldsAdd other_id = calls[dt.entity.service]
    | expand other_id
    | filter isNotNull(other_id)
    | lookup ${NS_SUBQUERY}, sourceField: other_id, lookupField: id, prefix: "onsl."
    | lookup ${CLUSTER_SUBQUERY}, sourceField: other_id, lookupField: id, prefix: "oclu."
    | lookup ${NAME_SUBQUERY}, sourceField: other_id, lookupField: id, prefix: "t."
    | fields
        my_id = id, my_name = entity.name,
        other_id, other_name = t.name, other_ns = onsl.ns, other_cluster = oclu.cluster,
        other_db = t.dbVendor, other_tech = t.techs
    | limit 2000
  `;
  return runDql(dql) as unknown as Promise<RawEdgeRecord[]>;
}

interface ThroughputInfo {
  rpm: number;
  req: number;
  err: number;
}

/** Throughput atual (sem baseline) por serviço destino — porta de Get-Throughput, em paralelo por chunk. */
async function throughputByService(ids: string[], hours: number): Promise<Map<string, ThroughputInfo>> {
  const out = new Map<string, ThroughputInfo>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 80) chunks.push(ids.slice(i, i + 80));

  // interval fino de propósito: evita que um interval largo alinhe os buckets fora da
  // janela e infle o throughput — mesmo motivo do script original (1min pra 2h,
  // idêntico a antes). Escalado pra cima em janelas maiores só pra manter um nº
  // razoável de buckets por consulta, não porque a precisão fina deixe de importar.
  const intervalMinutes = hours <= 6 ? 1 : hours <= 24 ? 5 : hours <= 72 ? 15 : 60;

  const results = await Promise.all(chunks.map(chunk => {
    const inList = chunk.map(id => `"${quoteDql(id)}"`).join(',');
    const dql = `
      timeseries {
          total = sum(dt.service.request.count),
          failed = sum(dt.service.request.failure_count)
        },
        by: { dt.entity.service },
        filter: { in(dt.entity.service, {${inList}}) },
        from: now()-${hours}h,
        interval: ${intervalMinutes}m
      | fieldsAdd req = arraySum(total), err = arraySum(failed)
      | fields id = dt.entity.service, req, err
    `;
    return runDql(dql);
  }));

  for (const records of results) {
    for (const rec of records) {
      const id = rec.id as string | undefined;
      const req = rec.req as number | undefined;
      if (id && req != null) {
        out.set(id, { rpm: req / (hours * 60), req, err: (rec.err as number | undefined) ?? 0 });
      }
    }
  }
  return out;
}

export interface ServiceNode {
  id: string;
  name: string;
  cluster?: string;
  ns?: string;
  workload?: string;
  db?: string;
  tech?: string[];
  /** 'application' pra apps RUM (frontend) — distingue de um dt.entity.service comum sem precisar inspecionar o id. */
  kind?: 'application';
}

/** [from, to, rpm, req, err] — cru; o front agrupa/computa taxa de falha ao centralizar. */
export type RawEdge = [string, string, number, number, number];

export interface TopologyPayload {
  generatedAt: string;
  window: string;
  nodes: Record<string, ServiceNode>;
  edges: RawEdge[];
}

function upsertNode(
  nodes: Record<string, ServiceNode>,
  id: string,
  name: string,
  cluster?: string,
  ns?: string,
  db?: string,
  tech?: string[],
  kind?: 'application',
) {
  if (nodes[id]) return;
  nodes[id] = { id, name, cluster, ns, workload: ns ? deriveWorkload(name, ns) : undefined, db, tech, kind };
}

async function buildPayload(hours: number): Promise<TopologyPayload> {
  const [serviceEdgesRaw, appEdgesRaw] = await Promise.all([globalEdges(), applicationEdges()]);
  const serviceEdges = serviceEdgesRaw.filter(r => !isExcludedEdge(r.my_id, r.other_id));
  const appEdges = appEdgesRaw.filter(r => !isExcludedEdge(r.my_id, r.other_id));
  const rawEdges = [...serviceEdges, ...appEdges];

  const nodes: Record<string, ServiceNode> = {};
  for (const r of serviceEdges) {
    upsertNode(nodes, r.my_id, r.my_name, r.my_cluster, r.my_ns, r.my_db, r.my_tech);
    upsertNode(nodes, r.other_id, r.other_name ?? r.other_id, r.other_cluster, r.other_ns, r.other_db, r.other_tech);
  }
  for (const r of appEdges) {
    upsertNode(nodes, r.my_id, r.my_name, undefined, undefined, undefined, undefined, 'application');
    upsertNode(nodes, r.other_id, r.other_name ?? r.other_id, r.other_cluster, r.other_ns, r.other_db, r.other_tech);
  }

  // nº de chamadores distintos por serviço destino (para ratear o throughput, na
  // ausência de entitlement de spans que daria o par chamador->destino exato)
  const callers = new Map<string, number>();
  for (const r of rawEdges) callers.set(r.other_id, (callers.get(r.other_id) ?? 0) + 1);

  const ids = new Set<string>();
  for (const r of rawEdges) {
    ids.add(r.my_id);
    ids.add(r.other_id);
  }
  const rpm = await throughputByService([...ids], hours);

  const edges: RawEdge[] = rawEdges.map(r => {
    const div = Math.max(1, callers.get(r.other_id) ?? 1);
    const dest = rpm.get(r.other_id);
    const w = (dest?.rpm ?? 0) / div;
    const req = (dest?.req ?? 0) / div;
    const err = (dest?.err ?? 0) / div;
    return [r.my_id, r.other_id, Math.round(w * 100) / 100, req, err];
  });

  return {
    generatedAt: new Date().toISOString(),
    window: `últimas ${hours}h`,
    nodes,
    edges,
  };
}

/**
 * Cria ou atualiza o documento único e compartilhado do mapa. `externalId` fixo
 * permite localizar o documento sem precisar listar/filtrar; `isPrivate: false`
 * (só setável via updateDocument, não na criação) torna o conteúdo legível por
 * todos os usuários do ambiente.
 */
async function upsertDocument(payload: unknown): Promise<void> {
  const content = Binary.fromJson(payload);
  try {
    const meta = await documentsClient.getDocumentMetadata({ id: DOC_EXTERNAL_ID });
    await documentsClient.updateDocument({
      id: meta.id,
      optimisticLockingVersion: meta.version,
      body: { content, isPrivate: false },
    });
  } catch {
    await documentsClient.createDocument({
      body: {
        name: 'Kubetrix - Mapa de Chamadas',
        type: 'kubetrix-topology-map',
        content,
        externalId: DOC_EXTERNAL_ID,
      },
    });
    const meta = await documentsClient.getDocumentMetadata({ id: DOC_EXTERNAL_ID });
    await documentsClient.updateDocument({
      id: meta.id,
      optimisticLockingVersion: meta.version,
      body: { isPrivate: false },
    });
  }
}

/**
 * `event.payload.hours`: janela de tempo pra recalcular (default 2h, mesma do
 * schedule). `event.payload.persist`: se `false`, NÃO escreve no documento
 * compartilhado — usado pela geração em runtime a partir do front quando o usuário
 * escolhe uma janela diferente da padrão, pra não sobrescrever o cache de todo mundo
 * com uma visão pontual de um usuário só. O schedule chama sem payload (persist=true
 * default) e continua atualizando o documento compartilhado normalmente.
 */
export default async function (event?: { payload?: { hours?: number; persist?: boolean } }) {
  const hours = event?.payload?.hours ?? DEFAULT_JANELA_HORAS;
  const persist = event?.payload?.persist ?? true;
  const payload = await buildPayload(hours);
  if (persist) {
    await upsertDocument(payload);
  }
  return {
    ok: true,
    generatedAt: payload.generatedAt,
    nodes: Object.keys(payload.nodes).length,
    edges: payload.edges.length,
    // o payload completo só volta na resposta quando NÃO persistido — no caminho
    // normal (schedule), manter a resposta pequena evita o limite de saída da function.
    ...(persist ? {} : { payload }),
  };
}
