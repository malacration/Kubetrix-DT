import { monitoredEntitiesClient, settingsObjectsClient } from '@dynatrace-sdk/client-classic-environment-v2';
import type { Entity } from '@dynatrace-sdk/client-classic-environment-v2';

// ── Regras oficiais Dynatrace Full Stack Host Units (baseado em RAM) ──────────
//
// ≤ 4 GB  → 0.25 HU
// ≤ 8 GB  → 0.50 HU
// ≤ 16 GB → 1 HU
// > 16 GB → ceil(RAM_GB / 16)  → somente inteiros
//
// Exemplo: 75.86 GB → 75.86/16 = 4.74 → ceil → 5 HU
// ─────────────────────────────────────────────────────────────────────────────

export interface OneAgentRow {
  entityId: string;
  name: string;
  agentVersion: string;
  hostGroup: string;
  monitoringMode: string;
  cpuCores: number;
  physicalMemoryGB: number;
  paidMemoryGB: number;
  headroomGB: number;
  hostUnits: number;
  reduceToGB: number | null;
  increaseToGB: number;
  state: string;
  stateOrder: number;
  osType: string;
}

// ── Cálculo de HU pela RAM ───────────────────────────────────────────────────

function calcFullStackHU(gb: number): number {
  if (gb <= 1.6) return 0.1;
  if (gb <= 4)   return 0.25;
  if (gb <= 8)   return 0.50;
  if (gb <= 16)  return 1;
  return Math.ceil(gb / 16);
}

export function calcHostUnits(physicalMemoryBytes: number, mode: string): number {
  if (mode === 'DISCOVERY') return 0;

  const gb = physicalMemoryBytes / (1024 ** 3);
  const fullStackHU = calcFullStackHU(gb);

  if (mode === 'FULL_STACK' || mode === 'STANDALONE') return fullStackHU;

  // CLOUD_INFRASTRUCTURE / INFRASTRUCTURE: 30% of Full Stack, capped at 1.0 HU
  return Math.min(fullStackHU * 0.3, 1.0);
}

// Teto de memoria (GB) da faixa de HU atual
function paidCeilingGB(hu: number): number {
  if (hu === 0.1)  return 1.6;
  if (hu === 0.25) return 4;
  if (hu === 0.50) return 8;
  return hu * 16; // 1 HU -> 16 GB, 2 HU -> 32 GB, etc.
}

// Max. RAM para cair uma faixa abaixo (null = ja esta no minimo)
function reduceTierCeilingGB(hu: number): number | null {
  if (hu <= 0.1)   return null;
  if (hu === 0.25) return 1.6;
  if (hu === 0.50) return 4;
  if (hu === 1)    return 8;
  return (hu - 1) * 16;
}

const STATE_SORT_ORDER: Record<string, number> = {
  RUNNING: 0,
  MONITORING_DISABLED: 1,
  SHUTDOWN: 2,
  OFFLINE: 3,
  STOPPED: 4,
  UNKNOWN: 5,
};

function toRow(entity: Entity): OneAgentRow {
  const p = entity.properties ?? {};

  const mode = String(p['monitoringMode'] ?? '');
  const physMem = Number(p['physicalMemory'] ?? 0);
  const physGB = physMem / (1024 ** 3);
  const fullStackHU = calcFullStackHU(physGB);
  const hu = calcHostUnits(physMem, mode);
  // Ceiling and tier reduction are always based on Full Stack RAM tiers,
  // even for Infrastructure mode (where HU = FS × 0.3).
  const paid = paidCeilingGB(fullStackHU);

  return {
    entityId: entity.entityId ?? '',
    name: entity.displayName ?? '—',
    agentVersion: String(p['installerVersion'] ?? '—'),
    hostGroup: String(p['hostGroupName'] ?? '—'),
    monitoringMode: mode,
    cpuCores: Number(p['cpuCores'] ?? p['logicalCpuCores'] ?? 0),
    physicalMemoryGB: physGB,
    paidMemoryGB: paid,
    headroomGB: paid - physGB,
    hostUnits: hu,
    reduceToGB: reduceTierCeilingGB(fullStackHU),
    increaseToGB: paid,
    state: String(p['state'] ?? 'UNKNOWN'),
    stateOrder: STATE_SORT_ORDER[String(p['state'] ?? 'UNKNOWN')] ?? 9,
    osType: String(p['osType'] ?? ''),
  };
}

// ── Fetch com paginação ──────────────────────────────────────────────────────

const BATCH_SIZE = 50;

export async function setHostMonitoring(hostIds: string[], enabled: boolean): Promise<void> {
  for (let i = 0; i < hostIds.length; i += BATCH_SIZE) {
    const batch = hostIds.slice(i, i + BATCH_SIZE);
    await settingsObjectsClient.postSettingsObjects({
      body: batch.map(id => ({
        schemaId: 'builtin:host.monitoring',
        scope: id,
        value: { enabled },
      })),
      validateOnly: false,
    });
  }
}

export interface DisabledHostRow {
  entityId: string;
  name: string;
  detectedName: string;
  osType: string;
  hostGroup: string;
  cpuCores: number;
  physicalMemoryGB: number;
  hostUnits: number;
  agentVersion: string;
  autoInjection: boolean | null;
  networkZone: string;
  cloudType: string;
  hypervisorType: string;
  lastSeenAt: string;
  objectId: string;
}

export async function fetchDisabledHosts(): Promise<DisabledHostRow[]> {
  const all: Array<{ objectId: string; scope: string; autoInjection: boolean | null }> = [];
  let nextPageKey: string | undefined;

  do {
    const res = await settingsObjectsClient.getSettingsObjects({
      schemaIds: 'builtin:host.monitoring',
      fields: 'objectId,value,scope',
      pageSize: 500,
      nextPageKey,
    });

    for (const item of res.items ?? []) {
      const val = item.value as { enabled?: boolean; autoInjection?: boolean } | undefined;
      if (val?.enabled === false && item.scope) {
        all.push({
          objectId: item.objectId ?? '',
          scope: item.scope,
          autoInjection: val.autoInjection ?? null,
        });
      }
    }
    nextPageKey = res.nextPageKey;
  } while (nextPageKey);

  if (all.length === 0) return [];

  const CHUNK = 50;
  const entityMap: Record<string, Omit<DisabledHostRow, 'entityId' | 'objectId'>> = {};

  for (let i = 0; i < all.length; i += CHUNK) {
    const ids = all.slice(i, i + CHUNK).map(h => `"${h.scope}"`).join(',');
    const entRes = await monitoredEntitiesClient.getEntities({
      entitySelector: `entityId(${ids})`,
      fields: '+properties',
      from: 'now-5y',
      pageSize: CHUNK,
    });
    for (const e of entRes.entities ?? []) {
      if (!e.entityId) continue;
      const p = e.properties ?? {};
      const physMem = Number(p['physicalMemory'] ?? 0);
      const mode = String(p['monitoringMode'] ?? 'FULL_STACK');
      const lastSeen = e.lastSeenTms ? new Date(e.lastSeenTms).toLocaleDateString('pt-BR') : '—';
      entityMap[e.entityId] = {
        name: e.displayName ?? e.entityId,
        detectedName: String(p['detectedName'] ?? e.displayName ?? ''),
        osType: String(p['osType'] ?? ''),
        hostGroup: String(p['hostGroupName'] ?? '—'),
        cpuCores: Number(p['cpuCores'] ?? p['logicalCpuCores'] ?? 0),
        physicalMemoryGB: physMem / (1024 ** 3),
        hostUnits: calcHostUnits(physMem, mode),
        agentVersion: String(p['installerVersion'] ?? '—'),
        autoInjection: null,
        networkZone: String(p['networkZoneId'] ?? p['networkZone'] ?? '—'),
        cloudType: String(p['cloudType'] ?? '—'),
        hypervisorType: String(p['hypervisorType'] ?? '—'),
        lastSeenAt: lastSeen,
      };
    }
  }

  const fallback: Omit<DisabledHostRow, 'entityId' | 'objectId'> = {
    name: '', detectedName: '', osType: '', hostGroup: '—',
    cpuCores: 0, physicalMemoryGB: 0, hostUnits: 0, agentVersion: '—',
    autoInjection: null, networkZone: '—', cloudType: '—',
    hypervisorType: '—', lastSeenAt: '—',
  };

  return all.map(h => ({
    entityId: h.scope,
    objectId: h.objectId,
    ...(entityMap[h.scope] ?? { ...fallback, name: h.scope }),
    autoInjection: h.autoInjection,
  }));
}

export async function fetchAllOneAgentDeployments(): Promise<OneAgentRow[]> {
  const all: Entity[] = [];
  let nextPageKey: string | undefined;

  do {
    const result = await monitoredEntitiesClient.getEntities({
      entitySelector: 'type(HOST)',
      fields: '+properties',
      from: 'now-5y',
      pageSize: 500,
      nextPageKey,
    });
    if (result.entities) {
      all.push(...result.entities);
    }
    nextPageKey = result.nextPageKey;
  } while (nextPageKey);

  return all.map(toRow);
}
