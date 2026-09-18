import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import Colors from '@dynatrace/strato-design-tokens/colors';
import {
  ApplicationsIcon,
  ChevronDownSmallIcon,
  ChevronRightSmallIcon,
  ContainerIcon,
  CrosshairIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  LinkIcon,
  NetworkIcon,
  OptionsIcon,
  ProcessGroupIcon,
  ServicesIcon,
  WarningIcon,
  ZoomOutIcon,
} from '@dynatrace/strato-icons';
import type { SvgIconProps } from '@dynatrace/strato-icons';
import { countAbreviation } from 'app/components/widget/services/formater';
import type { EntityProblem } from 'app/services/problems';
import type { NodeCategory } from 'app/model/TopologyMap';

export interface MapNode {
  id: string;
  /** Chave crua do grupo (sem qualificação de direção) — usada pra marcar "expandido" de forma consistente onde quer que este grupo apareça no gráfico. */
  groupKey: string;
  label: string;
  sub: string;
  db: boolean;
  /** Categoria pra cor/ícone — 'service' (um serviço específico) é visualmente DIFERENTE de 'workload' (barra agregando vários serviços do mesmo workload). */
  category: NodeCategory;
  tech?: string[];
  /** Se este node representa um grupo que pode ser "aberto" nos serviços que o compõem. */
  expandable?: boolean;
  /** Ids reais de dt.entity.service que este node representa — se tiver só 1, é um serviço específico (habilita "página do serviço"). */
  serviceIds: string[];
  /** Soma de requests (total no período) de todas as arestas que tocam este node — dá a espessura da barra. */
  totalReq: number;
}

/** [from, to, rpm, taxaDeFalhaPct|null, totalDeRequests] */
export type MapEdge = [string, string, number, number | null, number];

export interface BacktraceGraphProps {
  /** Uma coluna por salto de distância do centro — não mais um trio fixo inbound/center/outbound. */
  columns: MapNode[][];
  edges: MapEdge[];
  /** Índice da coluna do centro — ela ganha um limite de altura bem maior (ver MAX_BAR_HEIGHT_CENTER), já que costuma concentrar o maior número de arestas convergindo. */
  centerColumnIndex?: number;
  /** Problemas Davis ATIVOS por id de entidade (serviço/aplicação) — nodes com algum problema ganham uma faixa vermelha e uma seção no menu de ações. */
  problemsByEntity?: ReadonlyMap<string, EntityProblem[]>;
  /** Clique num problema listado no menu de ações: abre o detalhe daquele problema no Dynatrace clássico. */
  onOpenProblem?: (problemId: string) => void;
  /** Ids atualmente "abertos" em serviços individuais — desenha o chevron apontando pra baixo. */
  expandedIds?: ReadonlySet<string>;
  /** Clique no chevron de um node expansível: abre/fecha em serviços individuais. */
  onToggleExpand?: (nodeId: string) => void;
  /** "Abrir em nova aba" no menu de ações: abre esse node como novo centro numa aba nova do navegador. */
  onOpenInNewTab?: (nodeId: string) => void;
  /** "Colocar em evidência" no menu de ações: recentraliza o gráfico ATUAL (mesma aba) neste node — selecionando-o como raiz. */
  onRecenter?: (nodeId: string) => void;
  /** "Selecionar o workload" no menu de ações: sobe um nível — recentraliza no WORKLOAD deste serviço em vez do serviço específico. Só faz sentido pra service/database. */
  onRecenterOnWorkload?: (nodeId: string) => void;
  /** "Página do serviço" no menu de ações: abre a página nativa do Dynatrace pra este serviço — só disponível quando o node representa exatamente 1 serviço. */
  onOpenServicePage?: (nodeId: string) => void;
}

const COLUMN_WIDTH_DEFAULT = 220;
const COLUMN_WIDTH_MIN = 150;
// um pouco mais largo em geral (não só o centro) — dá mais espaço horizontal pras
// faixas correrem antes de curvar, o que ajuda a ler o gráfico mesmo fora do centro.
const COLUMN_WIDTH_MAX = 280;
// espaço entre colunas — também é onde o total de requests de cada aresta é exibido,
// por isso maior que antes (tinha ficado apertado com o rótulo só no hover).
const GAP_MIN = 56;
const GAP_MAX = 140;
// altura da barra varia com o volume (ver barHeightFor) entre esses limites — o mínimo
// garante que barras de baixo volume continuem visíveis/clicáveis.
const MIN_BAR_HEIGHT = 24;
const MAX_BAR_HEIGHT = 60;
// a coluna do CENTRO (o item em evidência) pode crescer bem mais — concentra o maior
// número de arestas convergindo, então precisa de mais espaço vertical pra elas não
// ficarem espremidas.
const MAX_BAR_HEIGHT_CENTER = 220;
// espaço vertical entre barras empilhadas na mesma coluna — maior que antes pra dar
// lugar às pílulas de valor das arestas que chegam/saem entre uma barra e a próxima.
const BAR_GAP = 22;
const LABEL_GUTTER = 8;
// espaço reservado no TOPO do gráfico — sem isso, a pílula de valor de uma aresta que
// toca bem no topo da barra mais alta fica com metade acima de y=0, cortada pelo
// viewBox do svg.
const TOP_PADDING = 14;
const MIN_RIBBON_THICKNESS = 2;

/** Formata um total de requests pro rótulo do node/tooltip (ex.: 12345 -> "12,35 K"). */
function formatReqTotal(value: number): string {
  return `${countAbreviation(value)} req`;
}

/**
 * Altura da barra em função do volume relativo ao maior node do gráfico — não é uma
 * proporção linear exata (usa raiz quadrada), só precisa crescer/encolher de forma
 * monotônica com o volume, respeitando um mínimo pra continuar visível/clicável.
 */
function barHeightFor(totalReq: number, maxTotalReq: number, maxHeight: number): number {
  if (maxTotalReq <= 0) return MIN_BAR_HEIGHT;
  const ratio = Math.sqrt(Math.max(0, totalReq) / maxTotalReq);
  return MIN_BAR_HEIGHT + (maxHeight - MIN_BAR_HEIGHT) * ratio;
}

/**
 * Paleta de cores do mapa — uma cor fixa por categoria (não por posição/ordem), pra
 * que "banco de dados", por exemplo, sempre saia na mesma cor em qualquer mapa.
 */
export const TOPOLOGY_COLORS: Record<NodeCategory, string> = {
  frontend: Colors.Charts.Categorical.Color05.Default,
  service: Colors.Charts.Categorical.Color03.Default,
  workload: Colors.Charts.Categorical.Color01.Default,
  namespace: Colors.Charts.Categorical.Color02.Default,
  database: Colors.Charts.Categorical.Color06.Default,
  external: Colors.Charts.Categorical.Color04.Default,
  unknown: Colors.Charts.Categorical.Color09.Default,
};

const LEGEND_ITEMS: { key: NodeCategory; label: string; Icon?: React.ComponentType<SvgIconProps> }[] = [
  { key: 'frontend', label: 'Frontend (app RUM)', Icon: ApplicationsIcon },
  { key: 'service', label: 'Serviço específico', Icon: ServicesIcon },
  { key: 'workload', label: 'Workload (vários serviços)', Icon: ProcessGroupIcon },
  { key: 'namespace', label: 'Namespace (sem workload)', Icon: ContainerIcon },
  { key: 'database', label: 'Banco de dados', Icon: DatabaseIcon },
  { key: 'external', label: 'Externo / desconhecido', Icon: NetworkIcon },
];

function nodeColor(node: MapNode): string {
  return TOPOLOGY_COLORS[node.category];
}

/**
 * Ícone por categoria — usando os ícones OFICIAIS do design system (@dynatrace/strato-icons),
 * não emoji arbitrário. Não existe um catálogo público de logos por tecnologia/vendor
 * (Java, Spring, Oracle, etc.) no Dynatrace atual — o antigo catálogo Barista que tinha
 * isso foi descontinuado — então o ícone reflete a CATEGORIA do node (serviço específico,
 * workload/grupo, namespace, banco, externo), que é o que o Strato realmente disponibiliza hoje.
 * 'service' e 'workload' usam ícones DIFERENTES (Services vs. ProcessGroup) — antes os dois
 * caíam no mesmo branch e ficavam visualmente idênticos.
 */
type IconComponent = React.ComponentType<SvgIconProps>;

function iconFor(node: MapNode): IconComponent | undefined {
  switch (node.category) {
    case 'frontend': return ApplicationsIcon;
    case 'database': return DatabaseIcon;
    case 'external': return NetworkIcon;
    case 'namespace': return ContainerIcon;
    case 'unknown': return undefined;
    case 'workload': return ProcessGroupIcon;
    case 'service': return ServicesIcon;
    default: return undefined;
  }
}

/** Posição vertical de cada node numa coluna: barras de altura VARIÁVEL (ver barHeightFor), empilhadas com espaçamento a partir de TOP_PADDING. */
function layoutColumnY(nodes: MapNode[], heightOf: (node: MapNode) => number): Map<string, number> {
  const positions = new Map<string, number>();
  let cursor = TOP_PADDING;
  for (const node of nodes) {
    positions.set(node.id, cursor);
    cursor += heightOf(node) + BAR_GAP;
  }
  return positions;
}

/**
 * Reparte a altura de uma barra proporcionalmente ao peso de cada aresta que a toca
 * (estilo Sankey) — cada aresta fica com um segmento vertical (top/bottom), não um
 * ponto só no meio da barra. Segmentos têm espessura mínima pra ficarem visíveis
 * mesmo quando o volume é bem menor que os outros da mesma barra.
 */
function stackSegments(
  items: { edgeIndex: number; value: number }[],
  top: number,
  barHeight: number,
): Map<number, { top: number; bottom: number }> {
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  const available = barHeight - items.length * MIN_RIBBON_THICKNESS;
  let cursor = top;
  const segments = new Map<number, { top: number; bottom: number }>();
  for (const item of items) {
    const proportional = available > 0 ? (item.value / total) * available : 0;
    const height = MIN_RIBBON_THICKNESS + Math.max(0, proportional);
    segments.set(item.edgeIndex, { top: cursor, bottom: cursor + height });
    cursor += height;
  }
  return segments;
}

/** Faixa (ribbon) estilo Sankey entre um segmento da barra de origem e um da barra de destino. */
function ribbonPath(x1: number, y1Top: number, y1Bottom: number, x2: number, y2Top: number, y2Bottom: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1Top} `
    + `C ${midX} ${y1Top}, ${midX} ${y2Top}, ${x2} ${y2Top} `
    + `L ${x2} ${y2Bottom} `
    + `C ${midX} ${y2Bottom}, ${midX} ${y1Bottom}, ${x1} ${y1Bottom} Z`;
}

/**
 * Visualização estilo "Service-level backtrace of requests" do Dynatrace, com faixas
 * de largura proporcional ao volume (estilo Sankey): uma coluna por salto de
 * distância do centro (inbound à esquerda, centro no meio, outbound à direita) —
 * aumentar o nível em qualquer direção adiciona uma coluna nova, revelando o que
 * cada serviço alcançado também chama, em vez de só inflar a mesma lista. Passar o
 * mouse sobre uma faixa mostra o volume exato; barras de grupo têm um chevron pra
 * abrir em serviços individuais; e clicar no corpo de qualquer barra (ou no ícone de
 * opções ⋮, que sinaliza que ela é clicável) abre um menu de ações: colocar em
 * evidência (torna o item o novo centro NESTA aba), abrir em nova aba, ou ir pra
 * página nativa do serviço no Dynatrace.
 */
export function BacktraceGraph({
  columns,
  edges,
  centerColumnIndex,
  expandedIds,
  problemsByEntity,
  onToggleExpand,
  onOpenInNewTab,
  onRecenter,
  onRecenterOnWorkload,
  onOpenServicePage,
  onOpenProblem,
}: BacktraceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [menuNode, setMenuNode] = useState<{ id: string; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuNode) return undefined;
    // captura em vez de bubble pra fechar mesmo ao clicar noutra barra (que também abre
    // um menu) — mas SEM fechar quando o clique é DENTRO do próprio menu: um
    // stopPropagation() no botão (fase bubble) roda tarde demais pra impedir um
    // listener de captura já preso ao document, então o menu fechava (e o item era
    // removido do DOM) antes do 'click' do botão chegar a disparar — nenhuma ação
    // nunca executava. Checar containment aqui resolve isso na raiz.
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setMenuNode(null);
    };
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuNode(null); };
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [menuNode]);

  const byId = useMemo(() => {
    const map = new Map<string, MapNode>();
    for (const col of columns) for (const n of col) map.set(n.id, n);
    return map;
  }, [columns]);

  const maxTotalReq = useMemo(() => {
    let max = 0;
    for (const node of byId.values()) if (node.totalReq > max) max = node.totalReq;
    return max;
  }, [byId]);

  const heightById = useMemo(() => {
    const map = new Map<string, number>();
    columns.forEach((col, colIdx) => {
      const maxHeight = colIdx === centerColumnIndex ? MAX_BAR_HEIGHT_CENTER : MAX_BAR_HEIGHT;
      for (const node of col) map.set(node.id, barHeightFor(node.totalReq, maxTotalReq, maxHeight));
    });
    return map;
  }, [columns, maxTotalReq, centerColumnIndex]);
  const heightOf = (node: MapNode) => heightById.get(node.id) ?? MIN_BAR_HEIGHT;
  const problemsFor = (node: MapNode): EntityProblem[] => (
    problemsByEntity ? node.serviceIds.flatMap(id => problemsByEntity.get(id) ?? []) : []
  );

  const positions = useMemo(() => {
    const map = new Map<string, { col: number; y: number }>();
    columns.forEach((col, colIdx) => {
      const ys = layoutColumnY(col, heightOf);
      col.forEach(node => map.set(node.id, { col: colIdx, y: ys.get(node.id) ?? 0 }));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, heightById]);

  const svgHeight = useMemo(() => {
    let max = 0;
    for (const col of columns) {
      const total = col.reduce((sum, node) => sum + heightOf(node) + BAR_GAP, 0);
      if (total > max) max = total;
    }
    return max + TOP_PADDING;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, heightById]);

  // largura de coluna/gap se adaptam ao espaço disponível pra caber sem scroll — só
  // recorre ao mínimo (e, aí sim, scroll) quando há colunas demais pro espaço existir.
  const nCols = Math.max(1, columns.length);
  const gap = nCols > 1 ? Math.max(GAP_MIN, Math.min(GAP_MAX, containerWidth * 0.09)) : GAP_MAX;
  const fitColumnWidth = containerWidth > 0 ? (containerWidth - (nCols - 1) * gap) / nCols : COLUMN_WIDTH_DEFAULT;
  const columnWidth = Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, fitColumnWidth));

  const svgWidth = nCols * columnWidth + Math.max(0, nCols - 1) * gap;
  const colX = (i: number) => i * (columnWidth + gap);

  const outgoingByNode = useMemo(() => {
    const map = new Map<string, { edgeIndex: number; value: number }[]>();
    edges.forEach(([from, , rpm], idx) => {
      const list = map.get(from) ?? [];
      list.push({ edgeIndex: idx, value: rpm });
      map.set(from, list);
    });
    return map;
  }, [edges]);

  const incomingByNode = useMemo(() => {
    const map = new Map<string, { edgeIndex: number; value: number }[]>();
    edges.forEach(([, to, rpm], idx) => {
      const list = map.get(to) ?? [];
      list.push({ edgeIndex: idx, value: rpm });
      map.set(to, list);
    });
    return map;
  }, [edges]);

  const outSegmentsByNode = useMemo(() => {
    const map = new Map<string, Map<number, { top: number; bottom: number }>>();
    for (const [nodeId, items] of outgoingByNode) {
      const pos = positions.get(nodeId);
      const node = byId.get(nodeId);
      if (!pos || !node) continue;
      map.set(nodeId, stackSegments(items, pos.y, heightOf(node)));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoingByNode, positions, byId, heightById]);

  const inSegmentsByNode = useMemo(() => {
    const map = new Map<string, Map<number, { top: number; bottom: number }>>();
    for (const [nodeId, items] of incomingByNode) {
      const pos = positions.get(nodeId);
      const node = byId.get(nodeId);
      if (!pos || !node) continue;
      map.set(nodeId, stackSegments(items, pos.y, heightOf(node)));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingByNode, positions, byId, heightById]);

  // hover: destaca a ÁRVORE INTEIRA relacionada ao node apontado — mas as DUAS pernas
  // (quem chama / quem é chamado) são percorridas SEM se misturar: uma vez andando pra
  // trás (quem chama, direta ou transitivamente), só continua andando pra trás; uma
  // vez andando pra frente (quem é chamado), só continua pra frente. Sem essa
  // separação, um único chamador que TAMBÉM liga pra outro serviço não-relacionado
  // acendia esse outro serviço junto — "tudo que vai e volta", que não é o que se quer:
  // o que chega fica com o que chega, o que sai fica com o que sai.
  const connectedToHover = useMemo(() => {
    if (!hoveredId) return null;
    const addTo = (map: Map<string, string[]>, key: string, value: string) => {
      const list = map.get(key);
      if (list) list.push(value); else map.set(key, [value]);
    };
    const forward = new Map<string, string[]>();
    const backward = new Map<string, string[]>();
    for (const [from, to] of edges) {
      addTo(forward, from, to);
      addTo(backward, to, from);
    }
    const visited = new Set<string>([hoveredId]);

    const inboundQueue = [hoveredId];
    while (inboundQueue.length > 0) {
      const current = inboundQueue.shift() as string;
      for (const caller of backward.get(current) ?? []) {
        if (!visited.has(caller)) { visited.add(caller); inboundQueue.push(caller); }
      }
    }

    const outboundQueue = [hoveredId];
    while (outboundQueue.length > 0) {
      const current = outboundQueue.shift() as string;
      for (const callee of forward.get(current) ?? []) {
        if (!visited.has(callee)) { visited.add(callee); outboundQueue.push(callee); }
      }
    }

    return visited;
  }, [edges, hoveredId]);

  const ribbonData = edges.flatMap(([from, to, rpm, fail, totalReq], idx) => {
    const fromPos = positions.get(from);
    const toPos = positions.get(to);
    const outSeg = outSegmentsByNode.get(from)?.get(idx);
    const inSeg = inSegmentsByNode.get(to)?.get(idx);
    if (!fromPos || !toPos || !outSeg || !inSeg) return [];

    const x1 = colX(fromPos.col) + columnWidth;
    const x2 = colX(toPos.col);
    const sourceNode = byId.get(from);
    const color = sourceNode ? nodeColor(sourceNode) : TOPOLOGY_COLORS.workload;
    const title = `${byId.get(from)?.label ?? from} → ${byId.get(to)?.label ?? to}: ${formatReqTotal(totalReq)}`
      + ` (${rpm.toFixed(1)} req/min)`
      + (fail != null ? ` · ${fail}% falhas` : '');
    // aresta faz parte da árvore em destaque quando AMBAS as pontas estão nela — não só
    // as que tocam hoveredId diretamente, senão os saltos mais distantes ficariam sem
    // nenhuma aresta acesa entre eles.
    const touchesHover = hoveredId != null && !!connectedToHover?.has(from) && !!connectedToHover?.has(to);
    const dimmedByHover = hoveredId != null && !touchesHover;

    return [{
      key: `${from}~>${to}~>${idx}`,
      d: ribbonPath(x1, outSeg.top, outSeg.bottom, x2, inSeg.top, inSeg.bottom),
      color,
      title,
      // rótulo no MEIO da aresta (não mais no node) — posição = ponto médio entre os
      // centros dos dois segmentos que ela liga, mesmo eixo X da curva bezier.
      midX: (x1 + x2) / 2,
      midY: ((outSeg.top + outSeg.bottom) / 2 + (inSeg.top + inSeg.bottom) / 2) / 2,
      valueLabel: formatReqTotal(totalReq),
      touchesHover,
      dimmedByHover,
    }];
  });

  const ribbons = ribbonData.map(r => (
    <path
      key={r.key}
      d={r.d}
      fill={r.color}
      fillOpacity={r.dimmedByHover ? 0.08 : r.touchesHover ? 0.65 : 0.4}
      stroke="none"
      style={{ transition: 'fill-opacity 120ms ease' }}
    >
      <title>{r.title}</title>
    </path>
  ));

  const ribbonLabels = ribbonData.map(r => {
    const pillWidth = r.valueLabel.length * 5.6 + 10;
    return (
      <g key={`label-${r.key}`} style={{ pointerEvents: 'none', opacity: r.dimmedByHover ? 0.15 : 1 }}>
        <rect
          x={r.midX - pillWidth / 2}
          y={r.midY - 8}
          width={pillWidth}
          height={16}
          rx={4}
          fill={Colors.Background.Surface.Default}
          fillOpacity={0.85}
        />
        <text
          x={r.midX}
          y={r.midY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill={Colors.Text.Neutral.Default}
        >
          {r.valueLabel}
        </text>
      </g>
    );
  });

  function renderColumn(nodes: MapNode[], colIdx: number) {
    const barX = colX(colIdx);
    const iconSize = 16;
    const iconGutter = 6;
    const actionSize = 14;
    // reserva espaço à direita pro ícone de opções (sinaliza visualmente que a barra é clicável).
    const optionsGutter = actionSize + iconGutter;
    return nodes.map(node => {
      const y = positions.get(node.id)?.y ?? 0;
      const height = heightOf(node);
      const Icon = iconFor(node);
      const textColor = Colors.Text.Neutral.OnAccent.Default;
      const isExpanded = expandedIds?.has(node.groupKey) ?? false;
      const showChevron = !!node.expandable;
      const leftGutter = showChevron ? actionSize + iconGutter : 0;
      const iconX = barX + leftGutter + iconGutter;
      const textX = Icon ? iconX + iconSize + iconGutter : barX + leftGutter + columnWidth / 2;
      const maxChars = Icon ? (showChevron ? 18 : 20) : 23;
      const displayLabel = node.label.length > maxChars ? `${node.label.slice(0, maxChars - 1)}…` : node.label;
      // o total de requests é exibido na ARESTA (ver ribbonLabels), não mais na barra —
      // aqui só continua disponível no tooltip.
      const valueLabel = formatReqTotal(node.totalReq);
      const ChevronIcon = isExpanded ? ChevronDownSmallIcon : ChevronRightSmallIcon;
      const openMenu = (e: React.MouseEvent) => { e.stopPropagation(); setMenuNode({ id: node.id, x: e.clientX, y: e.clientY }); };
      const isHovered = hoveredId === node.id;
      const dimmedByHover = connectedToHover != null && !connectedToHover.has(node.id);
      const nodeProblems = problemsFor(node);
      const hasProblem = nodeProblems.length > 0;

      return (
        <g
          key={node.id}
          opacity={dimmedByHover ? 0.3 : 1}
          style={{ transition: 'opacity 120ms ease' }}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(prev => (prev === node.id ? null : prev))}
        >
          <rect
            x={barX}
            y={y}
            width={columnWidth}
            height={height}
            rx={5}
            fill={nodeColor(node)}
            fillOpacity={isHovered ? 1 : 0.9}
            stroke={isHovered ? Colors.Border.Primary.Accent : 'none'}
            strokeWidth={isHovered ? 2 : 0}
            style={{ cursor: 'pointer', filter: isHovered ? 'brightness(1.15)' : undefined, transition: 'filter 120ms ease' }}
            onClick={openMenu}
          >
            <title>
              {node.label}{node.sub ? ` — ${node.sub}` : ''} · {valueLabel}
              {hasProblem ? ` · ${nodeProblems.length} problema${nodeProblems.length > 1 ? 's' : ''} ativo${nodeProblems.length > 1 ? 's' : ''}` : ''}
            </title>
          </rect>

          {/* faixa vermelha: sinaliza que este node tem ao menos 1 problema Davis ativo. */}
          {hasProblem && (
            <rect
              x={barX}
              y={y}
              width={4}
              height={height}
              rx={2}
              fill={Colors.Border.Critical.Accent}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {showChevron && (
            <g
              transform={`translate(${barX + iconGutter}, ${y + (height - actionSize) / 2})`}
              style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onToggleExpand?.(node.groupKey); }}
            >
              <rect x={-2} y={-2} width={actionSize + 4} height={actionSize + 4} fill="transparent" />
              <ChevronIcon size={actionSize} style={{ color: textColor }} />
            </g>
          )}

          {Icon && (
            <g transform={`translate(${iconX}, ${y + (height - iconSize) / 2})`}>
              <Icon size={iconSize} style={{ color: textColor }} />
            </g>
          )}

          {/* ícone de "opções" — sinaliza visualmente que a barra tem ações (evidência, centralizar, links) */}
          <g
            transform={`translate(${barX + columnWidth - optionsGutter}, ${y + (height - actionSize) / 2})`}
            style={{ cursor: 'pointer' }}
            onClick={openMenu}
          >
            <rect x={-2} y={-2} width={actionSize + 4} height={actionSize + 4} fill="transparent" />
            <OptionsIcon size={actionSize} style={{ color: textColor, opacity: 0.85 }} />
            <title>Ações deste item</title>
          </g>

          <text
            x={textX}
            y={y + height / 2}
            textAnchor={Icon ? 'start' : 'middle'}
            dominantBaseline="middle"
            fontSize={13}
            fontWeight={600}
            fill={textColor}
            style={{ pointerEvents: 'none' }}
          >
            {displayLabel}
          </text>
        </g>
      );
    });
  }

  if (columns.every(col => col.length === 0)) {
    return <Text>Nenhum dado de topologia disponível para esta seleção.</Text>;
  }

  const menuTarget = menuNode ? byId.get(menuNode.id) : undefined;
  const menuTargetProblems = menuTarget ? problemsFor(menuTarget) : [];
  const closeMenu = () => setMenuNode(null);

  return (
    // minWidth:0 é o que impede o gráfico (que pode ficar bem mais largo que a tela)
    // de "vazar" sua largura intrínseca pros ancestrais Flex — sem isso, o Flex pai
    // não encolhe abaixo do conteúdo e a PÁGINA TAMBÉM ganha barra de rolagem
    // horizontal própria, além da do container abaixo (2 barras em vez de 1).
    <Flex flexDirection="column" gap={8} style={{ minWidth: 0 }}>
      <Flex gap={16} flexWrap="wrap">
        {LEGEND_ITEMS.map(item => (
          <Flex key={item.key} alignItems="center" gap={4}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: TOPOLOGY_COLORS[item.key],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: Colors.Text.Neutral.OnAccent.Default,
            }}
            >
              {item.Icon && <item.Icon size={14} />}
            </div>
            <Text style={{ fontSize: '0.8rem', opacity: 0.8 }}>{item.label}</Text>
          </Flex>
        ))}
        {problemsByEntity && problemsByEntity.size > 0 && (
          <Flex alignItems="center" gap={4}>
            <div style={{ width: 6, height: 20, borderRadius: 2, background: Colors.Border.Critical.Accent }} />
            <Text style={{ fontSize: '0.8rem', opacity: 0.8 }}>Problema ativo</Text>
          </Flex>
        )}
      </Flex>
      <div ref={containerRef} style={{ overflowX: 'auto', width: '100%', minWidth: 0 }}>
        <svg width={svgWidth} height={svgHeight + LABEL_GUTTER} viewBox={`0 0 ${svgWidth} ${svgHeight + LABEL_GUTTER}`}>
          {ribbons}
          {columns.map((col, i) => renderColumn(col, i))}
          {ribbonLabels}
        </svg>
      </div>

      {menuNode && menuTarget && (
        <Surface
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuNode.x,
            top: menuNode.y,
            zIndex: 1000,
            padding: '0.4rem',
            minWidth: 220,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: '0.75rem', opacity: 0.7, padding: '0.2rem 0.4rem' }}>
              {menuTarget.label}{menuTarget.sub ? ` — ${menuTarget.sub}` : ''}
            </Text>
            {onRecenter && (
              <Button
                variant="default"
                width="full"
                textAlign="start"
                onClick={() => { onRecenter(menuNode.id); closeMenu(); }}
              >
                <Button.Prefix><CrosshairIcon /></Button.Prefix>
                Colocar em evidência (selecionar como raiz)
              </Button>
            )}
            {onRecenterOnWorkload && (menuTarget.category === 'service' || menuTarget.category === 'database') && (
              <Button
                variant="default"
                width="full"
                textAlign="start"
                onClick={() => { onRecenterOnWorkload(menuNode.id); closeMenu(); }}
              >
                <Button.Prefix><ZoomOutIcon /></Button.Prefix>
                Subir pro workload
              </Button>
            )}
            {onOpenInNewTab && (
              <Button
                variant="default"
                width="full"
                textAlign="start"
                onClick={() => { onOpenInNewTab(menuNode.id); closeMenu(); }}
              >
                <Button.Prefix><ExternalLinkIcon /></Button.Prefix>
                Abrir em nova aba
              </Button>
            )}
            {onOpenServicePage && menuTarget.serviceIds.length === 1 && (
              <Button
                variant="default"
                width="full"
                textAlign="start"
                onClick={() => { onOpenServicePage(menuNode.id); closeMenu(); }}
              >
                <Button.Prefix><LinkIcon /></Button.Prefix>
                Página do serviço (Dynatrace)
              </Button>
            )}
            {onOpenProblem && menuTargetProblems.length > 0 && (
              <>
                <Text style={{ fontSize: '0.7rem', opacity: 0.6, padding: '0.4rem 0.4rem 0' }}>
                  {menuTargetProblems.length} problema{menuTargetProblems.length > 1 ? 's' : ''} ativo{menuTargetProblems.length > 1 ? 's' : ''}
                </Text>
                {menuTargetProblems.map(problem => (
                  <Button
                    key={problem.id}
                    variant="default"
                    width="full"
                    textAlign="start"
                    color="critical"
                    onClick={() => { onOpenProblem(problem.id); closeMenu(); }}
                  >
                    <Button.Prefix><WarningIcon /></Button.Prefix>
                    {problem.name}
                  </Button>
                ))}
              </>
            )}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
}
