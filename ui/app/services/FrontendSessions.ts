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

export function sessionBaselineSelector(selector: string): string {
  // Preserve missing samples: a baseline point requires all three reference weeks.
  // value keeps the cardinality aggregation; avg/sum/default(0) would distort sessions.
  return `(${[7, 14, 21].map(days => `(${selector}:timeshift(-${days}d))`).join('+')})/3`;
}

export async function loadFrontendSessions(frontends: FrontendOption[], timeframe: Timeframe, resolution?: string) {
  if (!frontends.length) return { total: [], individual: [], baselineTotal: [], baselineIndividual: [], resolution: '', notices: [] as string[] };
  const selectors = [true, false].map(total => sessionMetricSelector(frontends.map(f => f.id), total));
  // Use identical buckets for current and reference weeks. Distinct sessions cannot
  // be rescaled by dividing by a resolution ratio (unlike request counts).
  const sharedResolution = pickBaselineResolution(timeframe, resolution, 21);
  // Query each series separately: optional history must not invalidate current
  // data, and responses must not be mapped by the order of a multi-selector result.
  const queries = [...selectors, ...selectors.map(sessionBaselineSelector)];
  const results = await Promise.allSettled(queries.map(async query => {
    const response = (await clientClassic(query, timeframe, sharedResolution)).raw();
    if (response.nextPageKey) throw new Error('A consulta retornou dados parciais. Selecione menos frontends.');
    return response;
  }));
  const notices: string[] = [];
  const convert = (index: number): Timeseries[] => {
    const result = results[index];
    if (result.status === 'rejected') {
      if (index < 2) throw result.reason;
      notices.push(`Baseline ${index === 2 ? 'total' : 'por frontend'} indisponível: ${String(result.reason?.message ?? result.reason)}`);
      return [];
    }
    const response = result.value;
    const warnings = [...(response.warnings ?? []), ...response.result.flatMap(r => r.warnings ?? [])];
    notices.push(...warnings.map(warning => `${index >= 2 ? 'Baseline' : 'Sessões atuais'}: ${warning}`));
    const windowMs = resolutionToMs(response.resolution);
    return response.result.flatMap(collection => collection.data).flatMap(series => {
      const id = series.dimensionMap?.['dt.entity.application'];
      const frontend = frontends.find(f => f.id === id);
      if (index % 2 === 1 && !frontend) return [];
      return [{
        name: `${index >= 2 ? 'Baseline (21d) — ' : ''}${index % 2 === 0 ? 'Total dos frontends selecionados' : `${frontend?.name ?? id} (${id})`}`,
        unit: 'Count',
        datapoints: series.timestamps.flatMap((timestamp, i) => {
          const value = series.values[i];
          return typeof value === 'number' && Number.isFinite(value) && Number.isFinite(timestamp)
            ? [{ start: new Date(timestamp), end: new Date(timestamp + windowMs), value }] : [];
        }),
      }];
    });
  };
  const total = convert(0), individual = convert(1), baselineTotal = convert(2), baselineIndividual = convert(3);
  const first = results[0];
  return { total, individual, baselineTotal, baselineIndividual,
    resolution: first.status === 'fulfilled' ? first.value.resolution : sharedResolution,
    notices: [...new Set(notices)] };
}
