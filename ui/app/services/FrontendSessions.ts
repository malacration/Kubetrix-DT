import type { MetricData, MetricSeries } from '@dynatrace-sdk/client-classic-environment-v2';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import type { Timeseries } from '@dynatrace/strato-components-preview/charts';
import { GrailDqlQuery } from './core/GrailClient';
import { clientClassic } from './core/MetricsClientClassic';
import { pickBaselineResolution, resolutionToMs } from 'app/components/timeframe/resolution';

export interface FrontendOption { id: string; name: string }
export interface FrontendScope { cluster?: string; namespace?: string; workload?: string }
const applicationId = /^APPLICATION-[A-F0-9]{16}$/;

export function frontendDiscoveryQuery(scope: FrontendScope): string {
  const definitions = [
    [scope.cluster, 'toRelationship.isClusterOfService', 'KUBERNETES_CLUSTER'],
    [scope.namespace, 'toRelationship.isNamespaceOfService', 'CLOUD_APPLICATION_NAMESPACE'],
    [scope.workload, 'fromRelationship.isServiceOf', 'CLOUD_APPLICATION'],
  ];
  const filters = definitions.filter(([value]) => value && value !== 'all').map(([value, relation, type]) => {
    const selector = `type(SERVICE),${relation}(type(${type}),entityName.equals(${JSON.stringify(value)}))`;
    return `| filter in(id, classicEntitySelector(${JSON.stringify(selector)}))`;
  }).join('\n');
  return `fetch dt.entity.application
| fields frontendId = id, frontendName = entity.name, serviceIds = calls[dt.entity.service]
| expand serviceId = serviceIds
| filter serviceId in [fetch dt.entity.service
| filter serviceType != "DATABASE_SERVICE" AND serviceType != "QUEUE_LISTENER_SERVICE"
${filters}
| fields id]
| summarize relatedServices = countDistinct(serviceId), by: {frontendId, frontendName}
| sort frontendName asc`;
}

export async function discoverSessionFrontends(scope: FrontendScope, timeframe: Timeframe): Promise<FrontendOption[]> {
  const result = await GrailDqlQuery(frontendDiscoveryQuery(scope), timeframe);
  if ('error' in result) throw new Error(result.error);
  return (result.records ?? []).flatMap(record => {
    const id = record?.frontendId;
    return typeof id === 'string' && applicationId.test(id)
      ? [{ id, name: String(record?.frontendName ?? id) }] : [];
  });
}

export function sessionMetricSelector(ids: string[], total: boolean): string {
  if (!ids.length || ids.some(id => !applicationId.test(id))) throw new Error('Seleção de frontends inválida.');
  const filter = [...new Set(ids)].map(id => `eq("dt.entity.application","${id}")`).join(',');
  // Active sessions is a cardinality metric: use value, never sum per-app counts.
  return `builtin:apps.web.activeSessions:filter(or(${filter})):splitBy(${total ? '' : '"dt.entity.application"'}):value`;
}

/**
 * Um seletor por semana de referência (-7d/-14d/-21d), em vez de concatenar as três
 * numa única expressão `(a)+(b)+(c))/3`. Com muitos frontends selecionados, o filtro
 * `or(eq(...),eq(...),...)` já é grande sozinho — repeti-lo 3x na mesma URL (a API
 * Classic Metrics só aceita GET, sem fallback POST) estourava o limite do servidor
 * (414 Request-URI Too Long) a partir de ~30 frontends. Cada semana vira sua própria
 * consulta (1/3 do tamanho) e a média é feita aqui no cliente.
 */
export function sessionBaselineTimeshiftSelectors(selector: string): string[] {
  return [7, 14, 21].map(days => `${selector}:timeshift(-${days}d)`);
}

function dimensionKey(series: MetricSeries): string {
  return JSON.stringify(series.dimensionMap ?? {});
}

/**
 * Combina as 3 respostas (uma por semana de referência) numa média por ponto —
 * casando séries pelo dimensionMap (não por posição: uma semana pode simplesmente não
 * ter uma dimensão que outra tem, ex. um frontend sem sessão naquela semana).
 * Preserva o comportamento original: um ponto de baseline só existe se as TRÊS
 * semanas tiverem valor ali — value é uma métrica de cardinalidade, então
 * avg/sum/default(0) distorceria a contagem de sessões distintas.
 */
function averageAcrossWeeks(responses: MetricData[]): MetricData {
  const [base, ...rest] = responses;
  const seriesMaps = rest.map(r => {
    const byCollection = new Map<string, Map<string, MetricSeries>>();
    r.result.forEach((collection, ci) => {
      const map = new Map<string, MetricSeries>();
      for (const s of collection.data) map.set(dimensionKey(s), s);
      byCollection.set(String(ci), map);
    });
    return byCollection;
  });

  const result = base.result.map((collection, ci) => ({
    ...collection,
    data: collection.data.map(series => {
      const key = dimensionKey(series);
      const others = seriesMaps.map(m => m.get(String(ci))?.get(key));
      const values = series.timestamps.map((_, i) => {
        const raw = [series.values[i], ...others.map(s => s?.values?.[i])];
        const points: number[] = [];
        for (const v of raw) {
          if (typeof v !== 'number' || !Number.isFinite(v)) return null;
          points.push(v);
        }
        return points.reduce((sum, v) => sum + v, 0) / points.length;
      });
      return { ...series, values: values as number[] };
    }),
  }));

  return { ...base, result };
}

export async function loadFrontendSessions(frontends: FrontendOption[], timeframe: Timeframe, resolution?: string) {
  if (!frontends.length) return { total: [], individual: [], baselineTotal: [], baselineIndividual: [], resolution: '', notices: [] as string[] };
  const selectors = [true, false].map(total => sessionMetricSelector(frontends.map(f => f.id), total));
  // Use identical buckets for current and reference weeks. Distinct sessions cannot
  // be rescaled by dividing by a resolution ratio (unlike request counts).
  const sharedResolution = pickBaselineResolution(timeframe, resolution, 21);

  const runQuery = async (query: string) => {
    const response = (await clientClassic(query, timeframe, sharedResolution)).raw();
    if (response.nextPageKey) throw new Error('A consulta retornou dados parciais. Selecione menos frontends.');
    return response;
  };

  // current (total, individual) — 2 consultas — e baseline (total, individual) — 3
  // consultas CADA (uma por semana), todas em paralelo.
  const [currentResults, baselineResultsBySelector] = await Promise.all([
    Promise.allSettled(selectors.map(runQuery)),
    Promise.all(selectors.map(selector => (
      Promise.allSettled(sessionBaselineTimeshiftSelectors(selector).map(runQuery))
    ))),
  ]);

  const notices: string[] = [];
  const toTimeseries = (response: MetricData, label: string, matchFrontend: boolean): Timeseries[] => {
    const warnings = [...(response.warnings ?? []), ...response.result.flatMap(r => r.warnings ?? [])];
    notices.push(...warnings.map(warning => `${label}: ${warning}`));
    const windowMs = resolutionToMs(response.resolution);
    return response.result.flatMap(collection => collection.data).flatMap(series => {
      const id = series.dimensionMap?.['dt.entity.application'];
      const frontend = frontends.find(f => f.id === id);
      if (matchFrontend && !frontend) return [];
      return [{
        name: `${label.startsWith('Baseline') ? 'Baseline (21d) — ' : ''}${matchFrontend ? `${frontend?.name ?? id} (${id})` : 'Total dos frontends selecionados'}`,
        unit: 'Count',
        datapoints: series.timestamps.flatMap((timestamp, i) => {
          const value = series.values[i];
          return typeof value === 'number' && Number.isFinite(value) && Number.isFinite(timestamp)
            ? [{ start: new Date(timestamp), end: new Date(timestamp + windowMs), value }] : [];
        }),
      }];
    });
  };

  const convertCurrent = (index: 0 | 1): Timeseries[] => {
    const result = currentResults[index];
    if (result.status === 'rejected') throw result.reason;
    return toTimeseries(result.value, 'Sessões atuais', index === 1);
  };

  const convertBaseline = (index: 0 | 1): Timeseries[] => {
    const label = index === 0 ? 'total' : 'por frontend';
    const settled = baselineResultsBySelector[index];
    const fulfilled = settled.filter((r): r is PromiseFulfilledResult<MetricData> => r.status === 'fulfilled');
    if (fulfilled.length < settled.length) {
      const rejected = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      notices.push(`Baseline ${label} indisponível: ${String(rejected?.reason?.message ?? rejected?.reason)}`);
      return [];
    }
    const merged = averageAcrossWeeks(fulfilled.map(r => r.value));
    return toTimeseries(merged, 'Baseline', index === 1);
  };

  const total = convertCurrent(0), individual = convertCurrent(1);
  const baselineTotal = convertBaseline(0), baselineIndividual = convertBaseline(1);
  const first = currentResults[0];
  return { total, individual, baselineTotal, baselineIndividual,
    resolution: first.status === 'fulfilled' ? first.value.resolution : sharedResolution,
    notices: [...new Set(notices)] };
}
