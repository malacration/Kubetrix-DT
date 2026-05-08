import React, { useEffect, useMemo, useState } from 'react';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { Flex, Container, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Link } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { DataTableV2, type DataTableV2ColumnDef } from '@dynatrace/strato-components-preview/tables';
import { FilterBar, type FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { Select, TextInput } from '@dynatrace/strato-components-preview/forms';
import Spacings from '@dynatrace/strato-design-tokens/spacings';
import { fetchAllOneAgentDeployments, setHostMonitoring, type OneAgentRow } from 'app/services/oneAgentService';

const MODE_LABEL: Record<string, string> = {
  FULL_STACK: 'Full Stack',
  CLOUD_INFRASTRUCTURE: 'Infrastructure',
  DISCOVERY: 'Discovery',
  STANDALONE: 'Standalone',
};

const MODE_COLOR: Record<string, string> = {
  FULL_STACK: '#1f6bc9',
  CLOUD_INFRASTRUCTURE: '#6e6e6e',
  DISCOVERY: '#9b6ead',
  STANDALONE: '#8a6000',
};

const STATE_LABEL: Record<string, string> = {
  MONITORING_DISABLED: 'DISABLED',
};

const STATE_COLOR: Record<string, string> = {
  RUNNING: '#19781c',
  STOPPED: '#c81920',
  SHUTDOWN: '#6e6e6e',
  MONITORING_DISABLED: '#9b6ead',
  UNKNOWN: '#9e9e9e',
};

const STATE_ORDER: Record<string, number> = {
  RUNNING: 0,
  MONITORING_DISABLED: 1,
  SHUTDOWN: 2,
  OFFLINE: 3,
  STOPPED: 4,
  UNKNOWN: 5,
};

const INACTIVE_STATES = new Set(['MONITORING_DISABLED', 'UNKNOWN', 'OFFLINE', 'SHUTDOWN']);

function fmtGB(gb: number) {
  return `${gb.toFixed(1)} GB`;
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

const OneAgent = () => {
  const [agents, setAgents] = useState<OneAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const envUrl = getEnvironmentUrl();

  const load = () => {
    setLoading(true);
    setError(null);
    setSelectedRows({});
    fetchAllOneAgentDeployments()
      .then(data => {
        data.sort((a, b) => {
          if (a.stateOrder !== b.stateOrder) return a.stateOrder - b.stateOrder;
          return b.hostUnits - a.hostUnits;
        });
        const activeCount = data.filter(a => !INACTIVE_STATES.has(a.state) && a.state !== 'UNKNOWN').length;
        setPageSize(activeCount || 25);
        setAgents(data);
      })
      .catch(e => setError(e?.message ?? 'Erro ao carregar dados'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectedIds = Object.entries(selectedRows)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const handleMonitoring = async (enabled: boolean) => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      await setHostMonitoring(selectedIds, enabled);
      await new Promise(r => setTimeout(r, 1500));
      load();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Erro ao atualizar monitoramento');
      setActionLoading(false);
    }
  };

  const [licensedHU, setLicensedHU] = useState(265);
  const [filterState, setFilterState] = useState<string | null>(null);
  const [showUnknown, setShowUnknown] = useState(false);
  const [pageSize, setPageSize] = useState(25);

  const summary = useMemo(() => {
    const total = agents.length;
    const activeAgents = agents.filter(a => !INACTIVE_STATES.has(a.state));
    const totalHU = activeAgents.reduce((s, a) => s + a.hostUnits, 0);
    const running = agents.filter(a => a.state === 'RUNNING').length;
    const byMode = activeAgents.reduce<Record<string, number>>((acc, a) => {
      acc[a.monitoringMode] = (acc[a.monitoringMode] ?? 0) + a.hostUnits;
      return acc;
    }, {});
    const usedPct = licensedHU > 0 ? (totalHU / licensedHU) * 100 : 0;
    const remainingHU = licensedHU - totalHU;
    return { total, totalHU, running, byMode, usedPct, remainingHU };
  }, [agents, licensedHU]);

  const filteredAgents = useMemo(() => {
    let list = showUnknown ? agents : agents.filter(a => a.state !== 'UNKNOWN');
    if (filterState) list = list.filter(a => a.state === filterState);
    return list;
  }, [agents, filterState, showUnknown]);

  const toggleFilter = (state: string) =>
    setFilterState(prev => prev === state ? null : state);

  const [barFilters, setBarFilters] = useState<FilterItemValues>({});

  const onFilterChange = (values: FilterItemValues) => setBarFilters(values);

  const exportCsv = () => {
    const headers = [
      'Host', 'Versao OneAgent', 'Host Group', 'Modo', 'Estado',
      'CPUs', 'RAM Real (GB)', 'RAM Paga (GB)', 'Nao Alocada (GB)',
      'Host Units', 'Reduzir para (GB)', 'Aumentar para (GB)', 'OS',
    ];
    const rows = filteredData.map(r => [
      r.name, r.agentVersion, r.hostGroup,
      MODE_LABEL[r.monitoringMode] ?? r.monitoringMode,
      STATE_LABEL[r.state] ?? r.state,
      r.cpuCores,
      r.physicalMemoryGB.toFixed(2),
      r.paidMemoryGB.toFixed(2),
      r.headroomGB.toFixed(2),
      r.hostUnits.toFixed(2),
      r.reduceToGB != null ? r.reduceToGB.toFixed(1) : '',
      r.increaseToGB.toFixed(1),
      r.osType,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oneagent-deployments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredData = useMemo(() => filteredAgents.filter(row => {
    const name = barFilters.name?.value;
    const hostGroup = barFilters.hostGroup?.value;
    const mode = barFilters.monitoringMode?.value;
    const os = barFilters.osType?.value;
    if (name && !row.name.toLowerCase().includes(String(name).toLowerCase())) return false;
    if (hostGroup && hostGroup !== row.hostGroup) return false;
    if (mode && mode !== row.monitoringMode) return false;
    if (os && os !== row.osType) return false;
    return true;
  }), [filteredAgents, barFilters]);

  const filterOptions = useMemo(() => ({
    hostGroups: [...new Set(filteredAgents.map(a => a.hostGroup).filter(v => v && v !== '—'))].sort(),
    modes: [...new Set(filteredAgents.map(a => a.monitoringMode).filter(Boolean))].sort(),
    osTypes: [...new Set(filteredAgents.map(a => a.osType).filter(Boolean))].sort(),
  }), [filteredAgents]);

  const columns = useMemo<DataTableV2ColumnDef<OneAgentRow>[]>(() => [
    {
      id: 'name',
      header: 'Host',
      accessor: 'name',
      width: { type: 'auto', minWidth: 200, maxWidth: 300 },
      cell: ({ value, rowData }) => (
        <DataTableV2.DefaultCell>
          <Link href={`${envUrl}/ui/apps/dynatrace.classic.hosts/ui/entity/${rowData.entityId}`} target="_blank">
            {value}
          </Link>
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'hostGroup',
      header: 'Host Group',
      accessor: 'hostGroup',
      width: { type: 'auto', maxWidth: 180 },
    },
    {
      id: 'monitoringMode',
      header: 'Modo',
      accessor: 'monitoringMode',
      width: { type: 'auto', maxWidth: 140 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <Badge label={MODE_LABEL[value] ?? value} color={MODE_COLOR[value] ?? '#6e6e6e'} />
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'state',
      header: 'Estado',
      accessor: 'state',
      width: { type: 'auto', maxWidth: 110 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <Badge label={STATE_LABEL[value] ?? value} color={STATE_COLOR[value] ?? '#9e9e9e'} />
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'cpuCores',
      header: 'CPUs',
      accessor: 'cpuCores',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 80 },
    },
    {
      id: 'physicalMemoryGB',
      header: 'RAM Real',
      accessor: 'physicalMemoryGB',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 110 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          {fmtGB(value as number)}
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'paidMemoryGB',
      header: 'RAM Paga',
      accessor: 'paidMemoryGB',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 110 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <span style={{ color: '#1f6bc9', fontWeight: 600 }}>{fmtGB(value as number)}</span>
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'headroomGB',
      header: 'Nao Alocada',
      accessor: 'headroomGB',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 120 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>{fmtGB(value as number)}</DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'hostUnits',
      header: 'Host Units',
      accessor: 'hostUnits',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 110 },
      cell: ({ value }) => (
        <DataTableV2.DefaultCell>
          <span style={{ fontWeight: 700, color: '#1f6bc9' }}>{(value as number).toFixed(2)}</span>
        </DataTableV2.DefaultCell>
      ),
    },
    {
      id: 'reduceToGB',
      header: 'Reduzir para economizar 1 HU',
      accessor: 'reduceToGB',
      sortType: 'number',
      width: { type: 'auto', minWidth: 160, maxWidth: 220 },
      cell: ({ value, rowData }) => {
        if (value == null) {
          return <DataTableV2.DefaultCell><span style={{ color: '#9e9e9e' }}>—</span></DataTableV2.DefaultCell>;
        }
        const toFree = rowData.physicalMemoryGB - (value as number);
        return (
          <DataTableV2.DefaultCell>
            <span style={{ color: '#c85c00' }}>
              {'< '}{fmtGB(value as number)}
              <span style={{ color: '#9e9e9e', fontWeight: 400, fontSize: '0.75rem', marginLeft: 6 }}>(-{fmtGB(toFree)})</span>
            </span>
          </DataTableV2.DefaultCell>
        );
      },
    },
    {
      id: 'increaseToGB',
      header: 'Pode aumentar ate',
      accessor: 'increaseToGB',
      sortType: 'number',
      width: { type: 'auto', maxWidth: 160 },
      cell: ({ value, rowData }) => {
        const maxGB = value as number;
        const availableGB = maxGB - rowData.physicalMemoryGB;
        return (
          <DataTableV2.DefaultCell>
            <span style={{ color: '#19781c' }}>{fmtGB(maxGB)}</span>
            <span style={{ color: '#9e9e9e', fontSize: '0.75rem', marginLeft: 6 }}>
              (+{fmtGB(availableGB)})
            </span>
          </DataTableV2.DefaultCell>
        );
      },
    },
    {
      id: 'osType',
      header: 'OS',
      accessor: 'osType',
      width: { type: 'auto', maxWidth: 90 },
    },
  ], [envUrl]);

  return (
    <div style={{ padding: Spacings.Size16 }}>
      <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: Spacings.Size16 }}>
        <Heading level={2}>OneAgent Deployments</Heading>
        <Flex flexDirection="row" alignItems="center" style={{ gap: 8 }}>
          <Text style={{ fontSize: '0.85rem', color: '#666' }}>Licenças HU:</Text>
          <input
            type="number"
            value={licensedHU}
            min={0}
            onChange={e => setLicensedHU(Number(e.target.value))}
            style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.9rem' }}
          />
          <Button onClick={load} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </Button>
        </Flex>
      </Flex>

      {!loading && agents.length > 0 && (
        <Flex flexDirection="row" flexWrap="wrap" style={{ gap: 8, marginBottom: Spacings.Size8 }}>
          <SummaryCard
            label="Total Hosts"
            value={summary.total}
            active={filterState === null}
            onClick={() => setFilterState(null)}
          />
          <SummaryCard label="HU Usados" value={summary.totalHU.toFixed(1)} color="#1f6bc9" />
          <SummaryCard label="HU Licenciados" value={licensedHU} color="#6e6e6e" />
          <SummaryCard
            label="HU Restantes"
            value={summary.remainingHU.toFixed(1)}
            color={summary.remainingHU < 0 ? '#c81920' : '#19781c'}
          />
          <SummaryCard
            label="Uso (%)"
            value={`${summary.usedPct.toFixed(1)}%`}
            color={summary.usedPct > 90 ? '#c81920' : summary.usedPct > 70 ? '#c85c00' : '#19781c'}
          />
          <SummaryCard
            label={`Running (${summary.running})`}
            value={summary.running}
            color="#19781c"
            active={filterState === 'RUNNING'}
            onClick={() => toggleFilter('RUNNING')}
          />
          <SummaryCard
            label={`Outros (${summary.total - summary.running})`}
            value={summary.total - summary.running}
            color="#6e6e6e"
            active={filterState === '__OTHER__'}
            onClick={() => toggleFilter('__OTHER__')}
          />
        </Flex>
      )}

      {!loading && agents.length > 0 && (
        <Flex flexDirection="row" alignItems="center" style={{ gap: 12, marginBottom: Spacings.Size16 }}>
          {(() => {
            const unknownCount = agents.filter(a => a.state === 'UNKNOWN').length;
            if (unknownCount === 0) return null;
            return (
              <button
                onClick={() => setShowUnknown(s => !s)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: `1px solid ${showUnknown ? '#9e9e9e' : '#ddd'}`,
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  fontWeight: 600,
                  background: showUnknown ? '#9e9e9e22' : '#f5f5f5',
                  color: showUnknown ? '#555' : '#9e9e9e',
                  transition: 'all 0.15s',
                }}
              >
                {showUnknown ? `Ocultar UNKNOWN (${unknownCount})` : `Exibir UNKNOWN (${unknownCount})`}
              </button>
            );
          })()}
          {filterState && (
            <Flex flexDirection="row" alignItems="center" style={{ gap: 6, padding: '4px 10px', background: '#e8f4e8', borderRadius: 6, border: '1px solid #a0d0a0' }}>
              <Text style={{ fontSize: '0.85rem', fontWeight: 600, color: '#19781c' }}>
                Filtro: {STATE_LABEL[filterState] ?? filterState} — {filteredAgents.length} host(s)
              </Text>
              <button
                onClick={() => setFilterState(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#19781c', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}
              >×</button>
            </Flex>
          )}
        </Flex>
      )}

      {selectedIds.length > 0 && (
        <Surface elevation="raised" style={{ marginBottom: Spacings.Size8 }}>
          <Flex flexDirection="row" alignItems="center" padding={8} style={{ gap: 12 }}>
            <Text style={{ fontWeight: 600, flex: 1 }}>{selectedIds.length} host(s) selecionado(s)</Text>
            <Button
              variant="emphasized"
              color="critical"
              loading={actionLoading}
              disabled={actionLoading}
              onClick={() => handleMonitoring(false)}
            >
              Desativar
            </Button>
            <Button
              variant="emphasized"
              color="success"
              loading={actionLoading}
              disabled={actionLoading}
              onClick={() => handleMonitoring(true)}
            >
              Ativar
            </Button>
          </Flex>
        </Surface>
      )}

      {error && (
        <Text style={{ color: '#c81920', marginBottom: Spacings.Size16 }}>{error}</Text>
      )}

      {loading && (
        <Flex justifyContent="center" style={{ padding: Spacings.Size32 }}>
          <div style={{ fontSize: '1rem', color: '#666' }}>Carregando deployments...</div>
        </Flex>
      )}

      {!loading && (
        <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: Spacings.Size8 }}>
          <FilterBar onFilterChange={onFilterChange} style={{ flex: 1 }}>
          <FilterBar.Item name="name" label="Host">
            <TextInput placeholder="Buscar por nome..." />
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
          data={filteredData}
          columns={columns}
          sortable
          resizable
          fullWidth
          fullHeight
          selectableRows
          rowId={(row: OneAgentRow) => row.entityId}
          selectedRows={selectedRows}
          onRowSelectionChange={setSelectedRows}
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
            {error ? 'Erro ao carregar dados.' : 'Nenhum deployment encontrado.'}
          </DataTableV2.EmptyState>
        </DataTableV2>
        </div>
      )}

      {!loading && agents.length > 0 && (
        <Text style={{ fontSize: '0.75rem', color: '#888', marginTop: Spacings.Size8 }}>
          Full Stack HU pela RAM: ate 1.6GB=0.1 | ate 4GB=0.25 | ate 8GB=0.50 | ate 16GB=1 | acima: ceil(RAM/16). Infrastructure = Full Stack × 0.3, cap 1.0 HU (acima de 64 GB).
          RAM Paga = teto da faixa atual. Nao Alocada = espaco disponivel na faixa sem custo adicional.
        </Text>
      )}
    </div>
  );
};

export default OneAgent;
