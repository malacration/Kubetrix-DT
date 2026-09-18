import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsInteger, parseAsArrayOf } from 'nuqs';
import { Container, Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { NumberInput } from '@dynatrace/strato-components-preview/forms';
import { documentsClient } from '@dynatrace-sdk/client-document';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { useSetSidebarDismissed } from 'app/components/context/FilterK8sContext';
import { BacktraceGraph } from 'app/components/widget/topology/BacktraceGraph';
import { SelectComponent, Option } from 'app/components/form/Select';
import { EntityProblem, getActiveProblemsByEntity } from 'app/services/problems';
import {
  buildLayeredView,
  CenterItem,
  CenterSelection,
  clusterOptions,
  DisplayNode,
  namespaceOptions,
  serviceOptionsForWorkload,
  TopologyPayload,
  workloadOptions,
} from 'app/model/TopologyMap';

/** externalId fixo do documento gerado pela function `topology-map` (ver api/topology-map.function.ts). */
const DOC_EXTERNAL_ID = 'kubetrix-topology-map';
const ALL = 'all';

type ExpandScope = 'all' | 'in' | 'out' | 'center';
const EXPAND_SCOPE_OPTIONS = [
  new Option('Tudo', 'all'),
  new Option('Inbound', 'in'),
  new Option('Outbound', 'out'),
  new Option('Centro', 'center'),
];

/** Resolve o triplo cluster/namespace/workload a que um node pertence, a partir de qualquer um dos serviços que ele representa. */
function parentWorkloadTripleFor(
  node: DisplayNode,
  payload: TopologyPayload | null,
): { cluster?: string; ns: string; workload: string } | null {
  if (!payload || node.serviceIds.length === 0) return null;
  const first = payload.nodes[node.serviceIds[0]];
  if (!first?.ns || !first?.workload) return null;
  return { cluster: first.cluster, ns: first.ns, workload: first.workload };
}

/**
 * Se o node clicado no gráfico é uma barra de WORKLOAD (categoria 'workload', não um
 * serviço específico), resolve o triplo cluster/namespace/workload — usado pra manter
 * a centralização como o WORKLOAD inteiro (1 bar agregada) em vez de explodir em N
 * serviços individuais quando o usuário coloca em evidência/abre em nova aba um grupo.
 */
function workloadTripleFor(
  node: DisplayNode,
  payload: TopologyPayload | null,
): { cluster?: string; ns: string; workload: string } | null {
  return node.category === 'workload' ? parentWorkloadTripleFor(node, payload) : null;
}

/**
 * Mapa de chamadas entre serviços, no estilo "Service-level backtrace of requests"
 * do Dynatrace, com faixas estilo Sankey. Diferente de toda outra página deste app,
 * NÃO consulta DQL ao vivo — lê um documento pré-computado (Document Storage) com o
 * grafo do ambiente INTEIRO, que uma function/workflow atualiza a cada 30min,
 * compartilhado entre todos os usuários. A centralização (cluster → namespace →
 * workload → um ou mais serviços) e o "abrir em serviços" de qualquer grupo são
 * filtros client-side sobre esse grafo já cacheado — por isso não usa
 * <Dashboard>/<Dashboard.Filter>/FiltersK8s.
 */
const MapaChamadas = () => {
  const [payload, setPayload] = useState<TopologyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSidebarDismissed = useSetSidebarDismissed();

  // filtros salvos na URL — mesmas chaves ("cluster"/"ns"/"wl") e mecanismo (nuqs) já
  // usados pelos filtros de kubernetes dos outros componentes (ver FilterK8sContext),
  // pra ficar consistente e sobreviver a reload/compartilhamento de link.
  const queryOpts = { history: 'replace' as const, shallow: true };
  const [selCluster, setSelCluster] = useQueryState('cluster', parseAsString.withDefault(ALL).withOptions(queryOpts));
  const [selNamespace, setSelNamespace] = useQueryState('ns', parseAsString.withDefault(ALL).withOptions(queryOpts));
  const [selWorkload, setSelWorkload] = useQueryState('wl', parseAsString.withDefault(ALL).withOptions(queryOpts));
  const [selServices, setSelServices] = useQueryState<string[]>('svc', parseAsArrayOf(parseAsString).withDefault([]).withOptions(queryOpts));
  const [inboundDepth, setInboundDepth] = useQueryState('din', parseAsInteger.withDefault(1).withOptions(queryOpts));
  const [outboundDepth, setOutboundDepth] = useQueryState('dout', parseAsInteger.withDefault(1).withOptions(queryOpts));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandScope, setExpandScope] = useState<ExpandScope>('all');
  const [problemsByEntity, setProblemsByEntity] = useState<Map<string, EntityProblem[]>>(new Map());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    documentsClient.getDocument({ id: DOC_EXTERNAL_ID })
      .then(async response => {
        const content = await response.content?.get('json');
        setPayload(content as TopologyPayload);
      })
      .catch(err => {
        console.error('Erro ao ler o mapa de chamadas', err);
        setError('Não foi possível carregar o mapa. Ele ainda pode não ter sido gerado (aguarde a primeira execução do workflow).');
      })
      .finally(() => setLoading(false));
    // problemas ATIVOS são consultados ao vivo (não fazem parte do documento cacheado
    // de 30min) — uma falha aqui não deve impedir o mapa de aparecer, só fica sem a
    // faixa vermelha.
    getActiveProblemsByEntity()
      .then(setProblemsByEntity)
      .catch(err => console.error('Erro ao carregar problemas ativos', err));
  }, []);

  useEffect(() => { load(); }, [load]);

  // aplica uma seleção de serviços (por id) como novo centro — usada tanto pelo
  // pré-seed via URL quanto por "Centralizar aqui" no menu de ações do gráfico.
  const applyServiceSelection = useCallback((ids: string[]) => {
    if (ids.length === 0 || !payload) return;
    setSelServices(ids);
    const first = payload.nodes[ids[0]];
    if (first) {
      setSelCluster(first.cluster ?? ALL);
      setSelNamespace(first.ns ?? ALL);
      setSelWorkload(first.workload ?? ALL);
    }
  }, [payload, setSelCluster, setSelNamespace, setSelServices, setSelWorkload]);

  // cluster/ns/wl/svc já vêm prontos da URL via nuqs (mesmo mecanismo dos outros
  // filtros k8s do app) — só falta preencher cluster/ns/wl pra EXIBIÇÃO quando a URL
  // trouxe só "svc" (ex.: um link de "abrir em nova aba" pra um serviço específico,
  // que não carrega ns/workload — bancos e endpoints externos nem têm um).
  useEffect(() => {
    if (!payload || selServices.length === 0 || selNamespace !== ALL) return;
    const first = payload.nodes[selServices[0]];
    if (!first) return;
    setSelCluster(first.cluster ?? ALL);
    setSelNamespace(first.ns ?? ALL);
    setSelWorkload(first.workload ?? ALL);
    // só quando o payload chega/muda a seleção de serviços — não a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, selServices]);

  // minimiza a sidebar ao interagir com qualquer filtro, pra ganhar área de tela
  // pro gráfico (que já é bem mais largo que as outras telas do app).
  const dismissSidebarOnInteraction = useCallback(() => setSidebarDismissed(true), [setSidebarDismissed]);

  const clusterOpts = useMemo(
    () => [new Option('Todos', ALL), ...(payload ? clusterOptions(payload.nodes) : []).map(c => new Option(c, c))],
    [payload],
  );
  const namespaceOpts = useMemo(
    () => [new Option('Todos', ALL), ...(payload ? namespaceOptions(payload.nodes, selCluster) : []).map(n => new Option(n, n))],
    [payload, selCluster],
  );
  const workloadOpts = useMemo(
    () => [
      new Option('Todos', ALL),
      ...(payload ? workloadOptions(payload.nodes, selCluster, selNamespace) : []).map(w => new Option(w, w)),
    ],
    [payload, selCluster, selNamespace],
  );
  const serviceOpts = useMemo(() => {
    if (!payload || selNamespace === ALL || selWorkload === ALL) return [];
    const services = serviceOptionsForWorkload(payload.nodes, selCluster, selNamespace, selWorkload);
    return services.map(s => new Option(s.name, s.id));
  }, [payload, selCluster, selNamespace, selWorkload]);

  // "descer o nível": só existe uma vez que um workload real está selecionado.
  const showServiceFilter = selNamespace !== ALL && selWorkload !== ALL;

  const handleClusterChange = (value: string | string[] | null | undefined) => {
    dismissSidebarOnInteraction();
    setSelCluster((Array.isArray(value) ? value[0] : value) ?? ALL);
    setSelNamespace(ALL); setSelWorkload(ALL); setSelServices([]);
  };
  const handleNamespaceChange = (value: string | string[] | null | undefined) => {
    dismissSidebarOnInteraction();
    setSelNamespace((Array.isArray(value) ? value[0] : value) ?? ALL);
    setSelWorkload(ALL); setSelServices([]);
  };
  const handleWorkloadChange = (value: string | string[] | null | undefined) => {
    dismissSidebarOnInteraction();
    setSelWorkload((Array.isArray(value) ? value[0] : value) ?? ALL);
    setSelServices([]);
  };
  const handleServicesChange = (value: string | string[] | null | undefined) => {
    dismissSidebarOnInteraction();
    setSelServices(Array.isArray(value) ? value : value ? [value] : []);
  };

  const selection: CenterSelection | null = useMemo(() => {
    // serviços explícitos (via filtro OU "colocar em evidência"/"abrir em nova aba" de um
    // node do gráfico) sempre valem, MESMO sem namespace/workload — nem todo node tem um
    // (bancos de dados e endpoints externos não têm k8s.namespace.name). Checar
    // selNamespace/selWorkload ANTES disso fazia a seleção virar null pra esses casos,
    // e o botão "parecia" não fazer nada.
    if (selServices.length > 0) {
      return selServices.map((id): CenterItem => ({ type: 'service', id }));
    }
    if (selNamespace === ALL || selWorkload === ALL) return null;
    return [{
      type: 'workload',
      cluster: selCluster !== ALL ? selCluster : undefined,
      ns: selNamespace,
      workload: selWorkload,
    }];
  }, [selCluster, selNamespace, selWorkload, selServices]);

  // troca de centro invalida qualquer expansão da visão anterior
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [selection]);

  const view = useMemo(
    () => (payload && selection ? buildLayeredView(payload, selection, { inboundDepth, outboundDepth }, expandedGroups) : null),
    [payload, selection, inboundDepth, outboundDepth, expandedGroups],
  );

  const nodeById = useMemo(() => {
    const map = new Map<string, DisplayNode>();
    if (view) for (const col of view.columns) for (const n of col) map.set(n.id, n);
    return map;
  }, [view]);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const handleExpandScope = () => {
    if (!view) return;
    const toAdd: string[] = [];
    view.columns.forEach((col, idx) => {
      const side: ExpandScope = idx < view.centerColumnIndex ? 'in' : idx > view.centerColumnIndex ? 'out' : 'center';
      if (expandScope !== 'all' && expandScope !== side) return;
      for (const node of col) if (node.expandable) toAdd.push(node.id);
    });
    setExpandedGroups(prev => new Set([...prev, ...toAdd]));
  };

  const handleOpenInNewTab = useCallback((nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node || node.serviceIds.length === 0) return;
    const sp = new URLSearchParams();
    // node de WORKLOAD (não expandido em serviços individuais): mantém cluster/ns/wl
    // SEPARADOS (mesmas chaves do filtro) — senão a nova aba abriria com N serviços
    // soltos em vez do workload agregado.
    const wl = workloadTripleFor(node, payload);
    if (wl) {
      if (wl.cluster) sp.set('cluster', wl.cluster);
      sp.set('ns', wl.ns);
      sp.set('wl', wl.workload);
    } else {
      sp.set('svc', node.serviceIds.join(','));
    }
    window.open(`${window.location.pathname}?${sp.toString()}`, '_blank', 'noopener,noreferrer');
  }, [nodeById, payload]);

  // "Colocar em evidência": recentraliza o gráfico NESTA MESMA aba nesse node (o
  // par "nesta aba" / "abrir em nova aba" pedido originalmente para qualquer item).
  // Um node de WORKLOAD vira o workload inteiro como centro (1 bar agregada), não
  // uma seleção de todos os seus serviços individuais.
  const handleRecenter = useCallback((nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node || node.serviceIds.length === 0) return;
    const wl = workloadTripleFor(node, payload);
    if (wl) {
      setSelServices([]);
      setSelCluster(wl.cluster ?? ALL);
      setSelNamespace(wl.ns);
      setSelWorkload(wl.workload);
      return;
    }
    applyServiceSelection(node.serviceIds);
  }, [nodeById, payload, applyServiceSelection, setSelCluster, setSelNamespace, setSelServices, setSelWorkload]);

  // "Subir pro workload": reduz o nível — em vez de centralizar no serviço específico,
  // centraliza no workload a que ele pertence (o inverso de "descer o nível" via filtro).
  const handleRecenterOnWorkload = useCallback((nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    const wl = parentWorkloadTripleFor(node, payload);
    if (!wl) return;
    setSelServices([]);
    setSelCluster(wl.cluster ?? ALL);
    setSelNamespace(wl.ns);
    setSelWorkload(wl.workload);
  }, [nodeById, payload, setSelCluster, setSelNamespace, setSelServices, setSelWorkload]);

  // "Página do serviço": abre a página nativa do Dynatrace pro serviço (mesmo padrão já usado em Services.tsx/Throughput.tsx).
  const handleOpenServicePage = useCallback((nodeId: string) => {
    const node = nodeById.get(nodeId);
    const id = node?.serviceIds[0];
    if (!id) return;
    window.open(`${getEnvironmentUrl()}/ui/apps/dynatrace.classic.services/ui/entity/${id}`, '_blank', 'noopener,noreferrer');
  }, [nodeById]);

  // "Ver problemas" no menu de ações: mesmo padrão de link já usado em Problems.tsx/widget/Problems.tsx.
  const handleOpenProblem = useCallback((problemId: string) => {
    window.open(
      `${getEnvironmentUrl()}/ui/apps/dynatrace.classic.problems/#problems/problemdetails;gtf=-2h;gf=all;pid=${problemId}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, []);

  return (
    <Container style={{ padding: '1.5rem', maxWidth: 'none', width: '100%', minWidth: 0 }}>
      <Flex flexDirection="row" alignItems="center" justifyContent="space-between">
        <Flex flexDirection="column" gap={4}>
          <Heading level={1}>Mapa de Chamadas</Heading>
          <Text style={{ opacity: 0.8 }}>
            {payload
              ? `Gerado em ${new Date(payload.generatedAt).toLocaleString('pt-BR')} · janela: ${payload.window} · `
                + `${Object.keys(payload.nodes).length} serviços, ${payload.edges.length} arestas no ambiente`
              : 'Carregando...'}
          </Text>
        </Flex>
        <Button size="condensed" color="primary" onClick={load} loading={loading}>
          Atualizar
        </Button>
      </Flex>

      {error && <Text style={{ color: '#c81920', marginTop: '1rem' }}>{error}</Text>}

      {payload && (
        <Flex
          flexDirection="column"
          gap={12}
          style={{ marginTop: '1rem', marginBottom: '1rem' }}
          onClickCapture={dismissSidebarOnInteraction}
        >
          <Flex gap={16} flexWrap="wrap" alignItems="flex-end">
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cluster</Text>
              <SelectComponent key="cluster" options={clusterOpts} defaultValue={selCluster} onChange={handleClusterChange} />
            </Flex>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Namespace</Text>
              <SelectComponent key={`ns-${selCluster}`} options={namespaceOpts} defaultValue={selNamespace} onChange={handleNamespaceChange} />
            </Flex>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Workload</Text>
              <SelectComponent
                key={`wl-${selCluster}-${selNamespace}`}
                options={workloadOpts}
                defaultValue={selWorkload}
                onChange={handleWorkloadChange}
              />
            </Flex>
            {showServiceFilter && (
              <Flex flexDirection="column" gap={4}>
                <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Serviços (múltiplo — vazio = workload inteiro)</Text>
                <SelectComponent
                  key={`svc-${selCluster}-${selNamespace}-${selWorkload}`}
                  multiple
                  options={serviceOpts}
                  defaultValue={selServices}
                  onChange={handleServicesChange}
                />
              </Flex>
            )}
          </Flex>

          <Flex gap={16} alignItems="flex-end" flexWrap="wrap">
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nível inbound (quem chama)</Text>
              <NumberInput
                value={inboundDepth}
                min={1}
                max={20}
                step={1}
                style={{ width: 90 }}
                onChange={value => { dismissSidebarOnInteraction(); setInboundDepth(value ?? 1); }}
              />
            </Flex>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nível outbound (quem é chamado)</Text>
              <NumberInput
                value={outboundDepth}
                min={1}
                max={20}
                step={1}
                style={{ width: 90 }}
                onChange={value => { dismissSidebarOnInteraction(); setOutboundDepth(value ?? 1); }}
              />
            </Flex>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: '0.8rem', fontWeight: 600 }}>Expandir em serviços</Text>
              <Flex gap={8}>
                <SelectComponent
                  options={EXPAND_SCOPE_OPTIONS}
                  defaultValue={expandScope}
                  clearable={false}
                  onChange={value => setExpandScope(((Array.isArray(value) ? value[0] : value) as ExpandScope) ?? 'all')}
                />
                <Button size="condensed" onClick={handleExpandScope}>Expandir</Button>
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      )}

      {view && (
        <BacktraceGraph
          columns={view.columns}
          edges={view.edges}
          centerColumnIndex={view.centerColumnIndex}
          expandedIds={expandedGroups}
          problemsByEntity={problemsByEntity}
          onToggleExpand={handleToggleExpand}
          onOpenInNewTab={handleOpenInNewTab}
          onRecenter={handleRecenter}
          onRecenterOnWorkload={handleRecenterOnWorkload}
          onOpenServicePage={handleOpenServicePage}
          onOpenProblem={handleOpenProblem}
        />
      )}

      {payload && !selection && (
        <Text style={{ opacity: 0.7, marginTop: '1rem' }}>
          Escolha um namespace e um workload acima (e opcionalmente um ou mais serviços específicos) para ver o mapa de chamadas.
        </Text>
      )}
    </Container>
  );
};

export default MapaChamadas;
