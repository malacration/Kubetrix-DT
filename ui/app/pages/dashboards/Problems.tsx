import React, { useEffect, useMemo, useState } from 'react';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { Flex, Container } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Link } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { DataTableV2, type DataTableV2ColumnDef } from '@dynatrace/strato-components-preview/tables';
import { FilterBar, type FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { TextInput, TextArea } from '@dynatrace/strato-components-preview/forms';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import Spacings from '@dynatrace/strato-design-tokens/spacings';
import { isQueryResult } from 'app/services/core/GrailConverter';
import { ProblemsList } from 'app/services/problems';
import { fetchAlertingProfiles, type AlertingProfile } from 'app/services/alertingProfileService';
import {
  getProblemComments,
  addProblemComment,
  closeProblem,
  type Comment,
} from 'app/services/problemActionsService';
import { SelectComponent, Option } from 'app/components/form/Select';
import { useQueryState, parseAsString } from 'nuqs';

// ── Metadados de apresentação ────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#c81920',
  CLOSED: '#19781c',
};

const CATEGORY_LABEL: Record<string, string> = {
  AVAILABILITY: 'Availability',
  ERROR: 'Error',
  SLOWDOWN: 'Slowdown',
  PERFORMANCE: 'Slowdown',
  RESOURCE: 'Resource',
  RESOURCE_CONTENTION: 'Resource',
  CUSTOM: 'Custom',
  CUSTOM_ALERT: 'Custom',
  CUSTOM_ANNOTATION: 'Custom',
  INFO: 'Info',
  INFORMATION: 'Info',
  MONITORING_UNAVAILABLE: 'Monitoring unavailable',
};

const CATEGORY_COLOR: Record<string, string> = {
  AVAILABILITY: '#c81920',
  ERROR: '#c85c00',
  SLOWDOWN: '#c8a200',
  PERFORMANCE: '#c8a200',
  RESOURCE: '#9b6ead',
  RESOURCE_CONTENTION: '#9b6ead',
  CUSTOM: '#1f6bc9',
  CUSTOM_ALERT: '#1f6bc9',
  CUSTOM_ANNOTATION: '#1f6bc9',
  INFO: '#6e6e6e',
  INFORMATION: '#6e6e6e',
  MONITORING_UNAVAILABLE: '#6e6e6e',
};

/**
 * event.severity é o NÍVEL de gravidade numérico do problema no Grail.
 * Escala assumida (maior = mais severo): 5=Critical … 1=Informational.
 *
 * As cores extrapolam a paleta de limite de recurso do projeto
 * (percentOverloadColorScheme: red → orange → yellow → lightgreen → lightblue),
 * do mais "quente" (crítico) ao mais "frio" (informativo). Se no seu ambiente a
 * escala for invertida, basta trocar os números das chaves abaixo.
 */
interface SeverityMeta { label: string; color: string; text: string; }

const SEVERITY_META: Record<number, SeverityMeta> = {
  5: { label: 'Critical',      color: '#e11900', text: '#ffffff' }, // red
  4: { label: 'Major',         color: '#ff8b00', text: '#3d2200' }, // orange
  3: { label: 'Minor',         color: '#ffd500', text: '#3d3400' }, // yellow
  2: { label: 'Warning',       color: '#8fe388', text: '#1c3b1a' }, // lightgreen
  1: { label: 'Informational', color: '#9fd4e8', text: '#0c3a4a' }, // lightblue
};

function severityMeta(n: number | null): SeverityMeta {
  if (n == null) return { label: '—', color: '#e6e6e6', text: '#6e6e6e' };
  return SEVERITY_META[n] ?? { label: `Nível ${n}`, color: '#e6e6e6', text: '#555555' };
}

const RANGE_OPTIONS: Array<{ label: string; fromExpr: string }> = [
  { label: 'Últimas 2h', fromExpr: 'now()-2h' },
  { label: 'Últimas 24h', fromExpr: 'now()-24h' },
  { label: 'Últimos 7 dias', fromExpr: 'now()-7d' },
  { label: 'Últimos 30 dias', fromExpr: 'now()-30d' },
];

// ── Tipos e helpers ──────────────────────────────────────────────────────────

interface ProblemRow {
  eventId: string;
  displayId: string;
  name: string;
  status: string;
  category: string;
  severity: number | null;
  start: number | null;
  end: number | null;
  affectedCount: number;
  rootCause: string;
  cluster: string;
  namespace: string;
  workload: string;
  muted: boolean;
}

/** Lê um campo que pode vir como string única ou array (dimensões K8s). */
function pickStr(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return [...new Set(v.map(x => String(x)).filter(Boolean))].join(', ');
  }
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

function fmtDate(ms: number | null): string {
  if (ms == null) return '—';
  return new Date(ms).toLocaleString();
}

function fmtDuration(start: number | null, end: number | null): string {
  if (start == null) return '—';
  const to = end ?? Date.now();
  let sec = Math.max(0, Math.floor((to - start) / 1000));
  const d = Math.floor(sec / 86400); sec -= d * 86400;
  const h = Math.floor(sec / 3600); sec -= h * 3600;
  const m = Math.floor(sec / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      background: color + '22',
      color,
      fontWeight: 600,
      fontSize: '0.78rem',
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

/** Badge sólido para gravidade, usando as cores extrapoladas da paleta de recurso. */
function SeverityBadge({ level }: { level: number | null }) {
  const m = severityMeta(level);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 4,
      background: m.color,
      color: m.text,
      fontWeight: 700,
      fontSize: '0.78rem',
      whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  );
}

function SummaryCard({ label, value, color, active, onClick }: {
  label: string; value: string | number; color?: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <Container
      onClick={onClick}
      style={{
        minWidth: 150,
        textAlign: 'center',
        padding: Spacings.Size12,
        cursor: onClick ? 'pointer' : 'default',
        border: active ? `2px solid ${color ?? '#1f6bc9'}` : '2px solid transparent',
        borderRadius: 8,
        transition: 'border 0.15s',
      }}
    >
      <Text style={{ fontSize: '0.8rem', color: '#666' }}>{label}</Text>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color ?? '#1f6bc9' }}>{value}</div>
    </Container>
  );
}

// ── Mapeamento do resultado Grail ────────────────────────────────────────────

function toRows(qr: unknown): ProblemRow[] {
  if (!isQueryResult(qr)) return [];
  const records = Array.isArray(qr.records) ? qr.records : [];
  const out: ProblemRow[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    {
      const affected = rec['affected_entity_ids'];
      out.push({
        eventId: String(rec['event.id'] ?? ''),
        displayId: String(rec['display_id'] ?? rec['event.id'] ?? '—'),
        name: String(rec['event.name'] ?? '(sem título)'),
        status: String(rec['event.status'] ?? 'UNKNOWN'),
        category: String(rec['event.category'] ?? 'UNKNOWN'),
        severity: num(rec['event.severity']),
        start: num(rec['event.start']),
        end: num(rec['event.end']),
        affectedCount: Array.isArray(affected) ? affected.length : 0,
        rootCause: String(rec['root_cause_entity_name'] ?? ''),
        cluster: pickStr(rec['k8s.cluster.name']),
        namespace: pickStr(rec['k8s.namespace.name']),
        workload: pickStr(rec['k8s.workload.name']),
        muted: String(rec['dt.davis.mute.status'] ?? '').toUpperCase() === 'MUTED',
      });
    }
  }
  return out;
}

// ── Componente ───────────────────────────────────────────────────────────────

const Problems = () => {
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [profiles, setProfiles] = useState<AlertingProfile[]>([]);
  // Filtros sincronizados na URL (nuqs), como os demais filtros do app.
  const [profileId, setProfileId] = useQueryState('profile', parseAsString.withDefault('all'));
  const [fromExpr, setFromExpr] = useQueryState('range', parseAsString.withDefault('now()-24h'));
  const [statusFilter, setStatusFilter] = useQueryState('status', parseAsString.withDefault('ACTIVE'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [barFilters, setBarFilters] = useState<FilterItemValues>({});
  const envUrl = getEnvironmentUrl();

  // Modal de ações do problema (ler/adicionar comentários e encerrar).
  const [modalProblem, setModalProblem] = useState<ProblemRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  // Carrega os alerting profiles uma vez.
  useEffect(() => {
    fetchAlertingProfiles()
      .then(setProfiles)
      .catch(e => setError(e?.message ?? 'Erro ao carregar alerting profiles'));
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find(p => p.objectId === profileId) ?? null,
    [profiles, profileId],
  );

  // Mapa categoria (event.category) -> nomes dos profiles que a cobrem.
  // É o "responsável": o(s) alerting profile(s) que alertam sobre aquele problema.
  const categoryProfiles = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of profiles) {
      for (const c of p.categories) {
        (map[c] ??= []).push(p.name);
      }
    }
    return map;
  }, [profiles]);

  const responsibleFor = (category: string): string =>
    (categoryProfiles[category] ?? []).join(', ');

  const profileOptions = useMemo(
    () => [
      new Option('Todos os profiles', 'all'),
      ...profiles.map(
        p =>
          new Option(
            `${p.name}${p.severityLevels.length ? ` (${p.severityLevels.length} sev.)` : ''}`,
            p.objectId,
          ),
      ),
    ],
    [profiles],
  );

  const rangeOptions = useMemo(
    () => RANGE_OPTIONS.map(o => new Option(o.label, o.fromExpr)),
    [],
  );

  const load = () => {
    setLoading(true);
    setError(null);
    const categories = selectedProfile ? selectedProfile.categories : null;
    ProblemsList(categories, fromExpr)
      .then(qr => {
        if (isQueryResult(qr)) {
          setRows(toRows(qr));
        } else {
          setError((qr as { error?: string })?.error ?? 'Erro ao consultar problemas');
          setRows([]);
        }
      })
      .catch(e => setError(e?.message ?? 'Erro ao consultar problemas'))
      .finally(() => setLoading(false));
  };

  // Recarrega quando muda o perfil ou o range.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, fromExpr, profiles.length]);

  // ── Ações do problema (modal) ───────────────────────────────────────────────

  const loadComments = (problemId: string) => {
    setCommentsLoading(true);
    setActionError(null);
    getProblemComments(problemId)
      .then(setComments)
      .catch(e => setActionError(e?.message ?? 'Erro ao carregar comentários'))
      .finally(() => setCommentsLoading(false));
  };

  // Abre o modal e carrega os comentários sob demanda (ao clicar).
  const openActions = (row: ProblemRow) => {
    setModalProblem(row);
    setComments([]);
    setCommentText('');
    setActionError(null);
    setActionInfo(null);
    if (row.eventId) loadComments(row.eventId);
  };

  const closeModal = () => {
    setModalProblem(null);
    setActionLoading(false);
  };

  const handleAddComment = async () => {
    if (!modalProblem?.eventId || !commentText.trim()) return;
    setActionLoading(true);
    setActionError(null);
    setActionInfo(null);
    try {
      await addProblemComment(modalProblem.eventId, commentText.trim());
      setCommentText('');
      setActionInfo('Comentário adicionado.');
      loadComments(modalProblem.eventId);
    } catch (e: unknown) {
      setActionError((e as Error)?.message ?? 'Erro ao adicionar comentário');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseProblem = async () => {
    // O Dynatrace exige um comentário de encerramento.
    if (!modalProblem?.eventId || !commentText.trim()) {
      setActionError('Informe um comentário para encerrar o problema.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionInfo(null);
    try {
      await closeProblem(modalProblem.eventId, commentText.trim());
      setActionInfo('Problema encerrado.');
      setCommentText('');
      loadComments(modalProblem.eventId);
      // Atualiza a lista para refletir o novo status após o Davis processar.
      setTimeout(load, 1500);
    } catch (e: unknown) {
      setActionError((e as Error)?.message ?? 'Erro ao encerrar problema');
    } finally {
      setActionLoading(false);
    }
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(r => r.status === 'ACTIVE').length;
    const closed = total - active;
    return { total, active, closed };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = statusFilter !== 'all' ? rows.filter(r => r.status === statusFilter) : rows;
    const nameQ = barFilters.name?.value;
    if (nameQ) {
      const q = String(nameQ).toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) || r.displayId.toLowerCase().includes(q),
      );
    }
    // Ordenação padrão: 1) status (ativos primeiro, fechados no fim),
    // 2) severidade (maior primeiro), 3) nº de entidades afetadas,
    // 4) duração (maior primeiro). Problemas abertos usam "agora" como fim.
    const statusRank = (r: ProblemRow) => (r.status === 'ACTIVE' ? 0 : 1);
    const durMs = (r: ProblemRow) =>
      r.start == null ? -1 : (r.end ?? Date.now()) - r.start;
    return [...list].sort((a, b) => {
      if (statusRank(a) !== statusRank(b)) return statusRank(a) - statusRank(b);
      const sa = a.severity ?? -Infinity;
      const sb = b.severity ?? -Infinity;
      if (sb !== sa) return sb - sa;
      if (b.affectedCount !== a.affectedCount) return b.affectedCount - a.affectedCount;
      return durMs(b) - durMs(a);
    });
  }, [rows, statusFilter, barFilters]);

  const exportCsv = () => {
    const headers = ['ID', 'Titulo', 'Status', 'Severidade', 'Categoria', 'Cluster', 'Namespace', 'Workload', 'Inicio', 'Fim', 'Duracao', 'Entidades afetadas', 'Causa raiz', 'Responsavel'];
    const data = filtered.map(r => [
      r.displayId, r.name, r.status,
      r.severity != null ? severityMeta(r.severity).label : '',
      CATEGORY_LABEL[r.category] ?? r.category,
      r.cluster || '', r.namespace || '', r.workload || '',
      fmtDate(r.start), fmtDate(r.end), fmtDuration(r.start, r.end),
      r.affectedCount, r.rootCause, responsibleFor(r.category),
    ]);
    const csv = [headers, ...data]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `problemas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<DataTableV2ColumnDef<ProblemRow>[]>(() => [
    {
      id: 'displayId',
      header: 'ID',
      accessor: 'displayId',
      width: { type: 'auto', minWidth: 110, maxWidth: 150 },
      cell: ({ value, rowData }) => (
        <DataTableV2.DefaultCell>
          {rowData.eventId ? (
            <Link
              href={`${envUrl}/ui/apps/dynatrace.davis.problems/problem/${rowData.eventId}`}
              target="_blank"
            >
              {value}
            </Link>
          ) : (
            String(value)
          )}
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'name',
      header: 'Título',
      accessor: 'name',
      width: { type: 'auto', minWidth: 240, maxWidth: 460 },
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: { type: 'auto', maxWidth: 110 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <Badge label={String(value)} color={STATUS_COLOR[String(value)] ?? '#6e6e6e'} />
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'severity',
      header: 'Severidade',
      accessor: 'severity',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 150 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <SeverityBadge level={value as number | null} />
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'category',
      header: 'Categoria',
      accessor: 'category',
      width: { type: 'auto', maxWidth: 180 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <Badge
            label={CATEGORY_LABEL[String(value)] ?? String(value)}
            color={CATEGORY_COLOR[String(value)] ?? '#6e6e6e'}
          />
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'cluster',
      header: 'Cluster',
      accessor: 'cluster',
      width: { type: 'auto', minWidth: 120, maxWidth: 220 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>{value ? String(value) : '—'}</DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'namespace',
      header: 'Namespace',
      accessor: 'namespace',
      width: { type: 'auto', minWidth: 120, maxWidth: 220 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>{value ? String(value) : '—'}</DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'workload',
      header: 'Workload',
      accessor: 'workload',
      width: { type: 'auto', minWidth: 120, maxWidth: 240 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>{value ? String(value) : '—'}</DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'start',
      header: 'Início',
      accessor: 'start',
      sortType: 'number',
      width: { type: 'auto', minWidth: 160, maxWidth: 200 },
      cell: ({ value }) => <DataTableV2.DefaultCell>{fmtDate(value as number | null)}</DataTableV2.DefaultCell>,
    },
    {
      id: 'duration',
      header: 'Duração',
      accessor: 'start',
      width: { type: 'auto', maxWidth: 110 },
      cell: ({ rowData }) => (
        <DataTableV2.DefaultCell>{fmtDuration(rowData.start, rowData.end)}</DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'affectedCount',
      header: 'Entidades',
      accessor: 'affectedCount',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 100 },
    },
    {
      id: 'rootCause',
      header: 'Causa raiz',
      accessor: 'rootCause',
      width: { type: 'auto', minWidth: 160, maxWidth: 300 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>{value ? String(value) : '—'}</DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'responsible',
      header: 'Responsável',
      accessor: 'category',
      width: { type: 'auto', minWidth: 160, maxWidth: 320 },
      cell: ({ rowData }) => {
        const resp = (categoryProfiles[rowData.category] ?? []).join(', ');
        return <DataTableV2.DefaultCell>{resp || '—'}</DataTableV2.DefaultCell>;
      },
    },
    {
      id: 'actions',
      header: 'Ações',
      accessor: 'eventId',
      width: 140,
      cell: ({ rowData }) => (
        <DataTableV2.DefaultCell>
          <Button
            variant="default"
            disabled={!rowData.eventId}
            onClick={() => openActions(rowData)}
          >
            Comentários
          </Button>
        </DataTableV2.DefaultCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [envUrl, categoryProfiles]);

  return (
    <div style={{ padding: Spacings.Size16 }}>
      <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: Spacings.Size16 }}>
        <Heading level={2}>Problemas (Davis)</Heading>
        <Flex flexDirection="row" alignItems="center" style={{ gap: 8 }}>
          <Text style={{ fontSize: '0.85rem', color: '#666' }}>Alerting profile:</Text>
          <SelectComponent
            options={profileOptions}
            defaultValue={profileId}
            clearable={false}
            placeholder="Selecione o profile..."
            loading={profiles.length === 0}
            onChange={v => setProfileId((v as string) ?? 'all')}
          />
          <SelectComponent
            options={rangeOptions}
            defaultValue={fromExpr}
            clearable={false}
            filter={false}
            onChange={v => v && setFromExpr(v as string)}
          />
          <Button onClick={load} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </Button>
        </Flex>
      </Flex>

      {selectedProfile && (
        <Text style={{ fontSize: '0.8rem', color: '#888', marginBottom: Spacings.Size8 }}>
          Filtrando por severidades do profile <b>{selectedProfile.name}</b>:{' '}
          {selectedProfile.severityLevels.length
            ? selectedProfile.severityLevels.join(', ')
            : 'nenhuma regra de severidade — exibindo todos'}
        </Text>
      )}

      {!loading && (
        <Flex flexDirection="row" flexWrap="wrap" style={{ gap: 8, marginBottom: Spacings.Size16 }}>
          <SummaryCard
            label="Total"
            value={summary.total}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <SummaryCard
            label="Ativos"
            value={summary.active}
            color="#c81920"
            active={statusFilter === 'ACTIVE'}
            onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'all' : 'ACTIVE')}
          />
          <SummaryCard
            label="Fechados"
            value={summary.closed}
            color="#19781c"
            active={statusFilter === 'CLOSED'}
            onClick={() => setStatusFilter(statusFilter === 'CLOSED' ? 'all' : 'CLOSED')}
          />
        </Flex>
      )}

      {error && (
        <Text style={{ color: '#c81920', marginBottom: Spacings.Size16 }}>{error}</Text>
      )}

      {loading && (
        <Flex justifyContent="center" style={{ padding: Spacings.Size32 }}>
          <div style={{ fontSize: '1rem', color: '#666' }}>Carregando problemas...</div>
        </Flex>
      )}

      {!loading && (
        <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: Spacings.Size8 }}>
          <FilterBar onFilterChange={setBarFilters} style={{ flex: 1 }}>
            <FilterBar.Item name="name" label="Busca">
              <TextInput placeholder="Buscar por título ou ID..." />
            </FilterBar.Item>
          </FilterBar>
          <Button variant="emphasized" onClick={exportCsv} style={{ marginLeft: Spacings.Size8, whiteSpace: 'nowrap' }}>
            Exportar CSV
          </Button>
        </Flex>
      )}

      {!loading && (
        <div style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
          <DataTableV2
            data={filtered}
            columns={columns}
            sortable
            resizable
            fullWidth
            fullHeight
            rowId={(row: ProblemRow) => row.eventId || row.displayId}
            defaultSortBy={[]}
            variant={{
              rowDensity: 'default',
              rowSeparation: 'zebraStripes',
              verticalDividers: true,
              contained: true,
            }}
          >
            <DataTableV2.Pagination
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, 250, 500]}
            />
            <DataTableV2.EmptyState>
              {error ? 'Erro ao carregar dados.' : 'Nenhum problema encontrado no período.'}
            </DataTableV2.EmptyState>
          </DataTableV2>
        </div>
      )}

      <Modal
        show={modalProblem !== null}
        size="medium"
        title={
          modalProblem
            ? `${modalProblem.displayId} — ${modalProblem.name}`
            : 'Problema'
        }
        onDismiss={closeModal}
      >
        {modalProblem && (
          <Flex flexDirection="column" style={{ gap: Spacings.Size12 }}>
            <Flex flexDirection="row" alignItems="center" style={{ gap: 8 }}>
              <Badge label={modalProblem.status} color={STATUS_COLOR[modalProblem.status] ?? '#6e6e6e'} />
              <SeverityBadge level={modalProblem.severity} />
              {modalProblem.eventId && (
                <Link
                  href={`${envUrl}/ui/apps/dynatrace.davis.problems/problem/${modalProblem.eventId}`}
                  target="_blank"
                >
                  Abrir no Dynatrace
                </Link>
              )}
            </Flex>

            {/* Comentários (carregados sob demanda ao abrir) */}
            <div>
              <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: Spacings.Size4 }}>
                <Text style={{ fontWeight: 600 }}>Comentários</Text>
                <Button
                  variant="default"
                  disabled={commentsLoading || !modalProblem.eventId}
                  onClick={() => modalProblem.eventId && loadComments(modalProblem.eventId)}
                >
                  {commentsLoading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </Flex>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: Spacings.Size8 }}>
                {commentsLoading && <Text style={{ color: '#666' }}>Carregando comentários...</Text>}
                {!commentsLoading && comments.length === 0 && (
                  <Text style={{ color: '#999' }}>Nenhum comentário.</Text>
                )}
                {!commentsLoading && comments.map((c, i) => (
                  <div key={c.id ?? i} style={{ padding: '6px 0', borderBottom: i < comments.length - 1 ? '1px solid #eee' : 'none' }}>
                    <Flex flexDirection="row" justifyContent="space-between" style={{ gap: 8 }}>
                      <Text style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.authorName ?? 'Desconhecido'}</Text>
                      <Text style={{ color: '#999', fontSize: '0.75rem' }}>
                        {c.createdAtTimestamp ? new Date(c.createdAtTimestamp).toLocaleString() : ''}
                      </Text>
                    </Flex>
                    <Text style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{c.content ?? ''}</Text>
                  </div>
                ))}
              </div>
            </div>

            {/* Novo comentário / encerramento */}
            <div>
              <Text style={{ fontWeight: 600 }}>Novo comentário</Text>
              <TextArea
                value={commentText}
                onChange={setCommentText}
                placeholder="Escreva um comentário... (obrigatório para encerrar)"
                rows={3}
                width="full"
              />
            </div>

            {actionError && <Text style={{ color: '#c81920' }}>{actionError}</Text>}
            {actionInfo && <Text style={{ color: '#19781c' }}>{actionInfo}</Text>}

            <Flex flexDirection="row" justifyContent="flex-end" style={{ gap: 8 }}>
              <Button variant="default" onClick={closeModal} disabled={actionLoading}>
                Fechar
              </Button>
              <Button
                variant="emphasized"
                onClick={handleAddComment}
                loading={actionLoading}
                disabled={actionLoading || !commentText.trim()}
              >
                Adicionar comentário
              </Button>
              <Button
                variant="emphasized"
                color="critical"
                onClick={handleCloseProblem}
                loading={actionLoading}
                disabled={actionLoading || modalProblem.status !== 'ACTIVE' || !commentText.trim()}
              >
                {modalProblem.status !== 'ACTIVE' ? 'Já encerrado' : 'Encerrar problema'}
              </Button>
            </Flex>
          </Flex>
        )}
      </Modal>
    </div>
  );
};

export default Problems;
