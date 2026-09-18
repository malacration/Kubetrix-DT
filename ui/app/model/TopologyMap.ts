/**
 * Modelo do mapa de chamadas: o documento gerado por `api/topology-map.function.ts`
 * traz o grafo CRU (todos os nós/arestas do ambiente inteiro), sem agrupar por
 * namespace. A "centralização" — um ou mais serviços específicos, e/ou um workload
 * inteiro (cluster + namespace + nome do workload) — é um filtro client-side sobre
 * esse grafo já cacheado, então trocar de centro, expandir um grupo em serviços, ou
 * mudar o nível de profundidade é instantâneo, sem reconsultar o Dynatrace.
 */

export interface ServiceNode {
  id: string;
  name: string;
  cluster?: string;
  ns?: string;
  workload?: string;
  db?: string;
  tech?: string[];
  /** 'application' pra apps RUM (frontend) — quem efetivamente chama a cadeia de serviços. */
  kind?: 'application';
}

/** [from, to, rpm, req, err] — cru; agrupado/computado só na hora de centralizar. */
export type RawEdge = [string, string, number, number, number];

export interface TopologyPayload {
  generatedAt: string;
  window: string;
  nodes: Record<string, ServiceNode>;
  edges: RawEdge[];
}

/** Um item de centralização: um serviço específico, ou um workload inteiro. */
export type CenterItem =
  | { type: 'service'; id: string }
  | { type: 'workload'; cluster?: string; ns: string; workload: string };

/** A seleção é sempre uma LISTA — dá pra centralizar em vários serviços/workloads ao mesmo tempo. */
export type CenterSelection = CenterItem[];

/** Categoria visual do node — 'service' é um serviço específico (não um grupo), diferente de 'workload' (barra agregando vários serviços do mesmo workload). */
export type NodeCategory = 'service' | 'workload' | 'namespace' | 'database' | 'external' | 'frontend' | 'unknown';

export interface DisplayNode {
  /** Id único de RENDERIZAÇÃO — qualificado por direção (o mesmo grupo pode aparecer tanto do lado inbound quanto outbound numa relação bidirecional/circular). */
  id: string;
  /** Chave crua do grupo/serviço (sem qualificação de direção) — usada pra marcar "expandido" de forma consistente onde quer que este grupo apareça. */
  groupKey: string;
  label: string;
  sub: string;
  db: boolean;
  /** Categoria pra cor/ícone — ver NodeCategory. */
  category: NodeCategory;
  tech?: string[];
  /** Se este node representa um grupo (workload/namespace/banco) que pode ser "aberto" em serviços individuais. */
  expandable: boolean;
  /** Ids reais de dt.entity.service que este node representa (1 se já é um serviço específico). */
  serviceIds: string[];
  /** Soma de requests (total no período, não taxa) de todas as arestas que tocam este node — usado pra dar espessura proporcional ao volume. */
  totalReq: number;
}

/** [from, to, rpm, taxaDeFalhaPct|null, totalDeRequests] */
export type DisplayEdge = [string, string, number, number | null, number];

/**
 * Grafo em camadas: uma coluna por salto (não uma lista só inflada). `columns[0]` é
 * a coluna mais distante do centro do lado inbound; `columns[centerColumnIndex]` é
 * o centro (pode ter mais de um node, um por item centralizado); as colunas depois
 * dele vão se afastando pro lado outbound. Arestas só ligam colunas ADJACENTES.
 */
export interface LayeredView {
  columns: DisplayNode[][];
  edges: DisplayEdge[];
  centerColumnIndex: number;
}

/**
 * Remove o padrão redundante "namespace - workload-*" (com variações: prefixo
 * "Background - ns - workload-*", ou sufixo "workload-* / - ns") do nome cru de um
 * serviço, pra exibição — o namespace já aparece como `sub` do node e o workload já é
 * o rótulo do grupo de onde ele foi expandido/o filtro escolhido, então repetir os
 * dois dentro do próprio nome do serviço é só ruído. Mesmos padrões que
 * `deriveWorkload` usa (api/topology-map.function.ts) pra ida contrária (extrair o
 * workload do nome). Se depois de remover não sobrar nada útil (o nome era só esse
 * padrão, sem sufixo distintivo), mostra o nome do workload — é a única informação
 * que resta pra diferenciar esse serviço.
 */
function cleanServiceLabel(name: string, ns?: string, workload?: string): string {
  if (!ns) return name;
  const escNs = ns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let cleaned = name
    .replace(new RegExp(`^Background - ${escNs} - .+?-\\*\\s*`), '')
    .replace(new RegExp(`^${escNs} - .+?-\\*\\s*`), '')
    .replace(new RegExp(`^.+?(?:-v\\*)?-\\* ?/ - ${escNs}$`), '');
  cleaned = cleaned.replace(/^[\s/-]+|[\s/-]+$/g, '');
  return cleaned.length > 0 ? cleaned : (workload ?? name);
}

/** Nível de profundidade (nº de saltos) a percorrer em cada direção — padrão 1 (vizinho direto). */
export interface DepthOptions {
  inboundDepth: number;
  outboundDepth: number;
}

export const DEFAULT_DEPTH: DepthOptions = { inboundDepth: 1, outboundDepth: 1 };

interface GroupInfo {
  key: string;
  label: string;
  sub: string;
  db: boolean;
  category: NodeCategory;
  tech?: string[];
}

/** Categoria de um node QUANDO ele é exibido como serviço individual (`svc|`) — 'frontend' pra apps RUM, 'database' pra bancos, senão 'service'. */
function categoryForIndividualNode(node: ServiceNode | undefined): NodeCategory {
  if (!node) return 'unknown';
  if (node.kind === 'application') return 'frontend';
  if (node.db) return 'database';
  return 'service';
}

/** Categoriza um node "do outro lado" da centralização — mesma ideia de Get-Group no script de referência. */
function groupOf(node: ServiceNode | undefined, fallbackId: string): GroupInfo {
  if (!node) return { key: `unk|${fallbackId}`, label: fallbackId, sub: '', db: false, category: 'unknown' };
  // apps RUM (frontend) são sempre um grupo de 1 membro (o próprio app) — chave única
  // por id, então o auto-colapso de "grupo com só 1 conectado" já vira `svc|` direto.
  if (node.kind === 'application') return { key: `app|${node.id}`, label: node.name, sub: 'frontend', db: false, category: 'frontend' };
  if (node.db) return { key: `db|${node.name}`, label: node.name, sub: node.db, db: true, category: 'database', tech: node.tech };
  if (node.ns && node.workload) {
    return {
      key: `wl|${node.cluster ?? ''}|${node.ns}|${node.workload}`,
      label: node.workload,
      sub: node.ns,
      db: false,
      category: 'workload',
      tech: node.tech,
    };
  }
  if (node.ns) return { key: `ns|${node.ns}`, label: node.ns, sub: 'namespace', db: false, category: 'namespace', tech: node.tech };
  if (node.name === 'Requests to public networks') {
    return { key: 'ext|internet', label: 'Redes públicas', sub: 'externo', db: false, category: 'external' };
  }
  if (node.name === 'Requests to unmonitored hosts') {
    return { key: 'ext|unmon', label: 'Hosts não monitorados', sub: 'externo', db: false, category: 'external' };
  }
  return { key: `ext|${node.name}`, label: node.name, sub: 'externo', db: false, category: 'external', tech: node.tech };
}

function centerItemKey(item: CenterItem): string {
  return item.type === 'service' ? `svc|${item.id}` : `wl|${item.cluster ?? ''}|${item.ns}|${item.workload}`;
}

function centerItemIds(nodes: Record<string, ServiceNode>, item: CenterItem): string[] {
  if (item.type === 'service') return [item.id];
  return Object.values(nodes)
    .filter(n => n.ns === item.ns && n.workload === item.workload && (!item.cluster || n.cluster === item.cluster))
    .map(n => n.id);
}

/** Ids de todos os serviços que compõem a seleção inteira (união de todos os itens). */
export function resolveCenterIds(nodes: Record<string, ServiceNode>, selection: CenterSelection): Set<string> {
  const ids = new Set<string>();
  for (const item of selection) for (const id of centerItemIds(nodes, item)) ids.add(id);
  return ids;
}

function failPct(req: number, err: number): number | null {
  return req > 0 ? Math.round((err / req) * 1000) / 10 : null;
}

interface GroupIndex {
  /** node id -> chave do grupo a que ele pertence (workload/namespace/banco/externo). */
  nodeToGroup: Map<string, string>;
  /** chave do grupo -> todos os node ids que pertencem a ele. */
  groupToNodes: Map<string, string[]>;
  groupMeta: Map<string, GroupInfo>;
}

/** Categoriza TODOS os nodes do payload de uma vez — usado pra marcar um grupo inteiro como
 *  "já colocado numa coluna" assim que qualquer um de seus serviços é alcançado. */
function buildGroupIndex(payload: TopologyPayload): GroupIndex {
  const nodeToGroup = new Map<string, string>();
  const groupToNodes = new Map<string, string[]>();
  const groupMeta = new Map<string, GroupInfo>();
  for (const node of Object.values(payload.nodes)) {
    const g = groupOf(node, node.id);
    nodeToGroup.set(node.id, g.key);
    if (!groupMeta.has(g.key)) groupMeta.set(g.key, g);
    const list = groupToNodes.get(g.key) ?? [];
    list.push(node.id);
    groupToNodes.set(g.key, list);
  }
  return { nodeToGroup, groupToNodes, groupMeta };
}

interface LevelEdgeAcc {
  from: string;
  to: string;
  rpm: number;
  req: number;
  err: number;
}

/**
 * Resolve a chave de exibição de um node alcançado: se o GRUPO dele está na lista de
 * "expandidos" (o usuário clicou pra abrir aquele workload/namespace em serviços),
 * cada serviço vira seu próprio node (`svc|<id>`); senão, todos os serviços do grupo
 * continuam colapsados numa barra só — A NÃO SER que o grupo, olhando só pros membros
 * realmente conectados no grafo, tenha no máximo 1 serviço: nesse caso não faz sentido
 * mostrar uma barra de "grupo" pra representar um único serviço, então mostra o
 * serviço direto mesmo sem expansão explícita.
 */
function displayKeyFor(
  nodeId: string,
  index: GroupIndex,
  expandedGroups: ReadonlySet<string>,
  connected: ReadonlySet<string>,
): string {
  const groupKey = index.nodeToGroup.get(nodeId) ?? `unk|${nodeId}`;
  if (expandedGroups.has(groupKey)) return `svc|${nodeId}`;
  const members = index.groupToNodes.get(groupKey) ?? [nodeId];
  const connectedMemberCount = members.filter(id => connected.has(id)).length;
  if (connectedMemberCount <= 1) return `svc|${nodeId}`;
  return groupKey;
}

/**
 * Caminha `depth` saltos a partir do centro, na direção pedida, uma CAMADA (coluna)
 * por salto. `direction: 'in'` anda pelas arestas de trás pra frente (quem chama);
 * `'out'` anda pra frente (quem é chamado). `seedFrontier` mapeia cada id inicial
 * (um serviço do centro) pra a chave de exibição do respectivo bar do centro — é
 * assim que uma aresta de nível 1 sabe a qual bar específico do centro se ligar,
 * mesmo com centro múltiplo/expandido.
 */
/** Uma chave de grupo/serviço + o id de exibição QUALIFICADO (único por direção). */
interface LevelKey { raw: string; id: string; }

function walkLayered(
  payload: TopologyPayload,
  seedFrontier: Map<string, string>,
  centerIds: ReadonlySet<string>,
  direction: 'in' | 'out',
  depth: number,
  index: GroupIndex,
  expandedGroups: ReadonlySet<string>,
  connected: ReadonlySet<string>,
): { levelKeys: LevelKey[][]; levelEdges: LevelEdgeAcc[][] } {
  const adjacency = new Map<string, { other: string; rpm: number; req: number; err: number }[]>();
  for (const [from, to, rpm, req, err] of payload.edges) {
    const anchor = direction === 'in' ? to : from;
    const other = direction === 'in' ? from : to;
    const bucket = adjacency.get(anchor) ?? [];
    bucket.push({ other, rpm, req, err });
    adjacency.set(anchor, bucket);
  }

  // nodes que já pertencem a um nível MAIS RASO (ou são o próprio centro) — bloqueia
  // reaparecer numa coluna mais funda. Só é atualizado no FIM de cada nível (ver
  // abaixo), nunca no meio: se atualizasse por aresta, o primeiro membro do frontier a
  // alcançar um grupo "fecharia a porta" pros outros membros DO MESMO nível que também
  // ligam pra ele, perdendo a aresta deles — exatamente o bug relatado ("o serviço A
  // liga com o namespace mas o B não, mesmo os dois chamando alguém lá dentro").
  const nodeVisited = new Set(centerIds);
  let frontier = seedFrontier;

  const levelKeys: LevelKey[][] = [];
  const levelEdges: LevelEdgeAcc[][] = [];

  // estritamente limitado ao depth configurado — abrir um grupo em serviços não deve,
  // por si só, revelar mais uma coluna. Pra ver o que os serviços recém-abertos
  // chamam/são chamados, o usuário precisa aumentar o nível manualmente.
  for (let level = 0; level < Math.max(1, depth) && frontier.size > 0; level++) {
    const thisLevelKeys = new Map<string, string>(); // id qualificado -> chave crua
    const thisLevelEdges = new Map<string, LevelEdgeAcc>();
    const nextFrontier = new Map<string, string>();
    // grupos/serviços tocados NESTE nível — só vira nodeVisited (bloqueando níveis
    // futuros) depois que TODO o nível terminar de processar. Separado em dois
    // porque cada um bloqueia de um jeito diferente (ver abaixo).
    const touchedGroups = new Set<string>(); // grupos NÃO expandidos: bloqueiam todos os membros
    const touchedIndividuals = new Set<string>(); // serviços de grupos expandidos: bloqueiam só a si mesmos

    // 1ª passada: coleta candidatos e conta, por grupo NÃO explicitamente expandido,
    // quantos membros DISTINTOS são de fato alcançados NESTA travessia — um grupo pode
    // ter vários serviços no total, mas se só UM deles tem aresta vinda do frontier
    // atual, o chevron prometeria "vários serviços" e entregaria só 1 ao expandir.
    const candidates: { fromKey: string; other: string; rpm: number; req: number; err: number; rawGroupKey: string }[] = [];
    const reachedMembersByGroup = new Map<string, Set<string>>();
    for (const [nodeId, fromKey] of frontier) {
      for (const edge of adjacency.get(nodeId) ?? []) {
        // já pertence a um nível anterior (ou é o centro) — não redesenha aqui.
        if (nodeVisited.has(edge.other)) continue;
        const rawGroupKey = index.nodeToGroup.get(edge.other) ?? `unk|${edge.other}`;
        candidates.push({ fromKey, other: edge.other, rpm: edge.rpm, req: edge.req, err: edge.err, rawGroupKey });
        if (!expandedGroups.has(rawGroupKey)) {
          const set = reachedMembersByGroup.get(rawGroupKey) ?? new Set<string>();
          set.add(edge.other);
          reachedMembersByGroup.set(rawGroupKey, set);
        }
      }
    }

    // 2ª passada: resolve a chave final de cada candidato — auto-expande em serviço
    // individual quando essa travessia só alcançou 1 membro do grupo (mesmo que
    // `displayKeyFor` mantivesse o grupo colapsado por conectividade GLOBAL).
    for (const c of candidates) {
      const baseRawKey = displayKeyFor(c.other, index, expandedGroups, connected);
      const reachedOnlyOne = !expandedGroups.has(c.rawGroupKey)
        && (reachedMembersByGroup.get(c.rawGroupKey)?.size ?? 0) === 1;
      const rawKey = baseRawKey.startsWith('svc|') || !reachedOnlyOne ? baseRawKey : `svc|${c.other}`;
      // qualificado por direção: os walks de inbound e outbound rodam de forma
      // independente, então o MESMO grupo/serviço pode ser descoberto nos dois
      // lados (relação bidirecional com o centro). Sem esse prefixo, as duas
      // ocorrências colidiriam no mesmo id — e no gráfico, a posição de uma delas
      // sobrescreveria a da outra, deixando uma das barras sem nenhuma aresta
      // visível (o "nó desconexo" em grafos com ciclos).
      const otherKey = `${direction}:${rawKey}`;

      thisLevelKeys.set(otherKey, rawKey);
      const ek = `${c.fromKey}~>${otherKey}`;
      const acc = thisLevelEdges.get(ek) ?? { from: c.fromKey, to: otherKey, rpm: 0, req: 0, err: 0 };
      acc.rpm += c.rpm; acc.req += c.req; acc.err += c.err;
      thisLevelEdges.set(ek, acc);

      if (!nextFrontier.has(c.other)) nextFrontier.set(c.other, otherKey);
      if (rawKey.startsWith('svc|')) touchedIndividuals.add(c.other);
      else touchedGroups.add(c.rawGroupKey);
    }

    // agora sim: fecha a porta pro nível seguinte, só depois que TODO o nível terminou
    // — assim, dois membros diferentes do frontier deste mesmo nível (ex.: A e B, cada
    // um chamando um serviço distinto do mesmo namespace XPTO) conseguem AMBOS desenhar
    // sua aresta pra XPTO antes dele ser bloqueado pra níveis futuros.
    for (const groupKey of touchedGroups) {
      for (const nid of index.groupToNodes.get(groupKey) ?? [groupKey]) nodeVisited.add(nid);
    }
    for (const id of touchedIndividuals) nodeVisited.add(id);

    levelKeys.push([...thisLevelKeys].map(([id, raw]) => ({ id, raw })));
    levelEdges.push([...thisLevelEdges.values()]);
    frontier = nextFrontier;
  }

  return { levelKeys, levelEdges };
}

/**
 * Ids que aparecem em pelo menos uma aresta do payload (from ou to). Um workload pode
 * agrupar serviços que, por coincidência de nome, caem na mesma chave de grupo mas não
 * têm NENHUMA chamada registrada — sem esse filtro, "abrir em serviços" criaria bars
 * fantasma sem nenhuma aresta, o que o usuário reportou como "perder o sentido de
 * expandir".
 */
function connectedIds(payload: TopologyPayload): Set<string> {
  const ids = new Set<string>();
  for (const [from, to] of payload.edges) { ids.add(from); ids.add(to); }
  return ids;
}

/** Restringe a uma lista de ids apenas aos que têm ao menos uma aresta — com fallback pra lista original se nenhum tiver (nesse caso não há nada de útil a filtrar mesmo). */
function onlyConnected(ids: string[], connected: ReadonlySet<string>): string[] {
  const filtered = ids.filter(id => connected.has(id));
  return filtered.length > 0 ? filtered : ids;
}

/**
 * Constrói o DisplayNode de uma chave — cobre grupo colapsado (`wl|`/`ns|`/`db|`/`ext|`)
 * e serviço individual (`svc|`). `displayId` é o id QUALIFICADO (único por direção,
 * ver walkLayered) usado como `DisplayNode.id`/ponta de aresta; `rawKey` é a chave crua
 * usada só pra localizar metadados (groupMeta/svc).
 */
function toDisplayNode(displayId: string, rawKey: string, payload: TopologyPayload, index: GroupIndex, connected: ReadonlySet<string>): DisplayNode {
  if (rawKey.startsWith('svc|')) {
    const id = rawKey.slice('svc|'.length);
    const node = payload.nodes[id];
    return {
      id: displayId,
      groupKey: rawKey,
      label: node ? cleanServiceLabel(node.name, node.ns, node.workload) : id,
      sub: node?.ns ?? '',
      db: !!node?.db,
      category: categoryForIndividualNode(node),
      tech: node?.tech,
      expandable: false,
      serviceIds: [id],
      totalReq: 0,
    };
  }
  const meta = index.groupMeta.get(rawKey);
  const serviceIds = index.groupToNodes.get(rawKey) ?? [];
  if (!meta) return { id: displayId, groupKey: rawKey, label: rawKey, sub: '', db: false, category: 'unknown', expandable: false, serviceIds, totalReq: 0 };
  const connectedCount = serviceIds.filter(id => connected.has(id)).length;
  return {
    id: displayId,
    groupKey: rawKey,
    label: meta.label,
    sub: meta.sub,
    db: meta.db,
    category: meta.category,
    tech: meta.tech,
    // só faz sentido "abrir em serviços" quando há mais de 1 serviço CONECTADO ali —
    // do contrário a expansão não revelaria nada de útil.
    expandable: !meta.db && connectedCount > 1,
    serviceIds,
    totalReq: 0,
  };
}

/**
 * Recorta o grafo global em torno de uma seleção (um ou mais serviços/workloads),
 * em CAMADAS: uma coluna por salto de distância do centro. `depth` controla quantos
 * saltos gerar em cada direção. `expandedGroups` (chaves de grupo, o mesmo formato
 * de `DisplayNode.id` quando `expandable`) força os grupos escolhidos a aparecerem
 * como serviços individuais em vez de uma barra agregada — é o "abrir em serviços"
 * disparado por clique no gráfico.
 */
export function buildLayeredView(
  payload: TopologyPayload,
  selection: CenterSelection,
  depth: DepthOptions = DEFAULT_DEPTH,
  expandedGroups: ReadonlySet<string> = new Set(),
): LayeredView {
  const index = buildGroupIndex(payload);
  const centerIds = resolveCenterIds(payload.nodes, selection);
  const connected = connectedIds(payload);

  // um bar por item centralizado — ou um bar por serviço, se aquele item foi expandido
  const centerBars: DisplayNode[] = [];
  const seedFrontier = new Map<string, string>();
  for (const item of selection) {
    const key = centerItemKey(item);
    const allIds = centerItemIds(payload.nodes, item);
    // ao expandir/expor múltiplos bars, só vale a pena mostrar serviços que realmente
    // têm alguma aresta — do contrário viram bars soltos, sem nenhuma ligação.
    const ids = item.type === 'workload' ? onlyConnected(allIds, connected) : allIds;
    if (item.type === 'workload' && expandedGroups.has(key) && ids.length > 1) {
      for (const id of ids) {
        const barKey = `svc|${id}`;
        const node = payload.nodes[id];
        centerBars.push({
          id: barKey, groupKey: barKey, label: node ? cleanServiceLabel(node.name, node.ns, node.workload) : id,
          sub: node?.ns ?? '', db: !!node?.db,
          category: categoryForIndividualNode(node),
          expandable: false, serviceIds: [id], totalReq: 0,
        });
        seedFrontier.set(id, barKey);
      }
    } else if (item.type === 'workload' && ids.length === 1) {
      // só sobrou 1 serviço nesse workload (real ou depois de filtrar por conectividade)
      // — mostra ele direto, sem o "acoplamento" artificial com o rótulo do workload,
      // que ficaria redundante representando um grupo de um membro só.
      const id = ids[0];
      const node = payload.nodes[id];
      centerBars.push({
        id: key, groupKey: key, label: node ? cleanServiceLabel(node.name, node.ns, node.workload) : id,
        sub: node?.ns ?? '', db: !!node?.db,
        category: categoryForIndividualNode(node),
        expandable: false, serviceIds: ids, totalReq: 0,
      });
      seedFrontier.set(id, key);
    } else {
      const centerServiceNode = item.type === 'service' ? payload.nodes[item.id] : undefined;
      const label = item.type === 'service'
        ? (centerServiceNode ? cleanServiceLabel(centerServiceNode.name, centerServiceNode.ns, centerServiceNode.workload) : item.id)
        : item.workload;
      const sub = item.type === 'service' ? (centerServiceNode?.ns ?? '') : item.ns;
      centerBars.push({
        id: key, groupKey: key, label, sub: sub ?? '', db: !!centerServiceNode?.db,
        category: item.type === 'service' ? categoryForIndividualNode(centerServiceNode) : 'workload',
        expandable: item.type === 'workload' && ids.length > 1, serviceIds: ids, totalReq: 0,
      });
      for (const id of ids) seedFrontier.set(id, key);
    }
  }

  const inboundSeed = new Map(seedFrontier);
  const outboundSeed = new Map(seedFrontier);
  const inbound = walkLayered(payload, inboundSeed, centerIds, 'in', depth.inboundDepth, index, expandedGroups, connected);
  const outbound = walkLayered(payload, outboundSeed, centerIds, 'out', depth.outboundDepth, index, expandedGroups, connected);

  const columns: DisplayNode[][] = [];

  [...inbound.levelKeys].reverse().forEach(keys => {
    columns.push(keys.map(k => toDisplayNode(k.id, k.raw, payload, index, connected)));
  });

  const centerColumnIndex = columns.length;
  columns.push(centerBars);

  outbound.levelKeys.forEach(keys => {
    columns.push(keys.map(k => toDisplayNode(k.id, k.raw, payload, index, connected)));
  });

  const edges: DisplayEdge[] = [];
  for (const level of inbound.levelEdges) {
    for (const e of level) {
      edges.push([e.to, e.from, Math.round(e.rpm * 10) / 10, failPct(e.req, e.err), Math.round(e.req)]);
    }
  }
  for (const level of outbound.levelEdges) {
    for (const e of level) {
      edges.push([e.from, e.to, Math.round(e.rpm * 10) / 10, failPct(e.req, e.err), Math.round(e.req)]);
    }
  }

  // soma de requests de todas as arestas que tocam cada node — dá a espessura da
  // barra proporcional ao volume (ver BacktraceGraph) e o total exibido no gráfico.
  const totalByNode = new Map<string, number>();
  for (const [from, to, , , req] of edges) {
    totalByNode.set(from, (totalByNode.get(from) ?? 0) + req);
    totalByNode.set(to, (totalByNode.get(to) ?? 0) + req);
  }
  for (const col of columns) for (const node of col) node.totalReq = totalByNode.get(node.id) ?? 0;

  return { columns, edges, centerColumnIndex };
}

const ALL = 'all';

function sortedUnique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}

/** Clusters distintos entre todos os nós — 1ª etapa da cascata Cluster → Namespace → Workload → Serviço. */
export function clusterOptions(nodes: Record<string, ServiceNode>): string[] {
  return sortedUnique(Object.values(nodes).map(n => n.cluster));
}

/** Namespaces distintos, restritos ao cluster escolhido ("all" = sem restrição). */
export function namespaceOptions(nodes: Record<string, ServiceNode>, cluster: string): string[] {
  return sortedUnique(Object.values(nodes)
    .filter(n => cluster === ALL || n.cluster === cluster)
    .map(n => n.ns));
}

/** Workloads distintos, restritos a cluster+namespace escolhidos. */
export function workloadOptions(nodes: Record<string, ServiceNode>, cluster: string, ns: string): string[] {
  return sortedUnique(Object.values(nodes)
    .filter(n => (cluster === ALL || n.cluster === cluster) && (ns === ALL || n.ns === ns))
    .map(n => n.workload));
}

/**
 * Serviços individuais dentro do workload escolhido — o "descer o nível": depois de
 * centralizar num workload inteiro, esta lista deixa escolher um ou mais serviços
 * específicos dele como centro mais fino (seleção múltipla).
 */
export function serviceOptionsForWorkload(
  nodes: Record<string, ServiceNode>,
  cluster: string,
  ns: string,
  workload: string,
): { id: string; name: string }[] {
  return Object.values(nodes)
    .filter(n => (cluster === ALL || n.cluster === cluster) && n.ns === ns && n.workload === workload)
    .map(n => ({ id: n.id, name: n.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
