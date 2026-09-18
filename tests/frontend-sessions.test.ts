jest.mock('app/services/core/GrailClient', () => ({ GrailDqlQuery: jest.fn() }));
jest.mock('app/services/core/MetricsClientClassic', () => ({ clientClassic: jest.fn() }));
jest.mock('app/components/timeframe/resolution', () => ({ pickBaselineResolution: jest.fn(() => '1h'), resolutionToMs: () => 60000 }));
import { frontendDiscoveryQuery, sessionBaselineSelector, sessionMetricSelector, loadFrontendSessions, discoverSessionFrontends } from '../ui/app/services/FrontendSessions';
import { clientClassic } from 'app/services/core/MetricsClientClassic';
import { GrailDqlQuery } from 'app/services/core/GrailClient';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
const a = { id: 'APPLICATION-AAAAAAAAAAAAAAAA', name: 'A' };
const b = { id: 'APPLICATION-BBBBBBBBBBBBBBBB', name: 'B' };
const timeframe = {} as Timeframe;
test('discovery intersects service scope and deduplicates frontend relationships', () => {
  const query = frontendDiscoveryQuery({ cluster: 'cluster', namespace: 'ns', workload: 'work' });
  expect(query).toContain('serviceId in [fetch dt.entity.service');
  expect(query).toContain('isClusterOfService');
  expect(query).toContain('isNamespaceOfService');
  expect(query).toContain('isServiceOf');
  expect(query).toContain('by: {frontendId, frontendName}');
  expect(frontendDiscoveryQuery({cluster: 'all'})).not.toContain('classicEntitySelector');
});
test('quotes scoped names within nested selectors', () => {
  const query = frontendDiscoveryQuery({ namespace: 'a"b\\c' });
  const literal = query.match(/classicEntitySelector\((.*)\)\)/)![1];
  expect(JSON.parse(literal)).toBe('type(SERVICE),toRelationship.isNamespaceOfService(type(CLOUD_APPLICATION_NAMESPACE),entityName.equals("a\\"b\\\\c"))');
});
test('A+B selection excludes other frontends and uses cardinality aggregation', () => {
  expect(sessionMetricSelector([a.id, b.id], true)).toBe(`builtin:apps.web.activeSessions:filter(or(eq("dt.entity.application","${a.id}"),eq("dt.entity.application","${b.id}"))):splitBy():value`);
  expect(sessionMetricSelector([a.id], false)).toContain(':splitBy("dt.entity.application"):value');
  expect(() => sessionMetricSelector([], true)).toThrow();
  expect(() => sessionMetricSelector(['invalid'], true)).toThrow();
});
test('empty selection does not query all applications', async () => {
  jest.mocked(clientClassic).mockClear();
  expect((await loadFrontendSessions([], timeframe)).total).toEqual([]);
  expect(clientClassic).not.toHaveBeenCalled();
});
test('preserves backend total, gaps and genuine zero; does not sum frontend counts', async () => {
  const series = (value: number, id?: string) => ({ dimensionMap: id ? {'dt.entity.application': id} : {}, timestamps: [0,60000,120000], values: [value,null,0] });
  jest.mocked(clientClassic).mockImplementation(async query => ({raw: () => ({resolution:'1m',result:[{data:query.includes('splitBy()') ? [series(15)] : [series(10,a.id),series(8,b.id)]}]})}) as never);
  const result = await loadFrontendSessions([a,b], timeframe);
  expect(result.total[0].datapoints.map(p => p.value)).toEqual([15,0]);
  expect(result.individual).toHaveLength(2);
  expect(result.total[0].datapoints[0].end).toEqual(new Date(60000));
});
test('discovery errors remain errors, not empty frontend lists', async () => {
  jest.mocked(GrailDqlQuery).mockResolvedValue({error: 'Denied'});
  await expect(discoverSessionFrontends({}, timeframe)).rejects.toThrow('Denied');
});
test('partial metric results are not displayed as complete counts', async () => {
  jest.mocked(clientClassic).mockResolvedValue({raw: () => ({nextPageKey:'next',result:[]})} as never);
  await expect(loadFrontendSessions([a], timeframe)).rejects.toThrow('parciais');
});

test('baseline uses matching weekly intervals without inventing zero activity', () => {
  const selector = sessionMetricSelector([a.id,b.id], true);
  const baseline = sessionBaselineSelector(selector);
  for (const days of [7,14,21]) expect(baseline).toContain(`${selector}:timeshift(-${days}d)`);
  expect(baseline).toMatch(/\/3$/);
  expect(baseline).not.toMatch(/default|:avg|:sum/);
});
test('total and per-frontend baseline are plotted at the shared resolution', async () => {
  const series = (value: number, id?: string) => ({dimensionMap: id ? {'dt.entity.application':id} : {},timestamps:[0],values:[value]});
  jest.mocked(clientClassic).mockImplementation(async query => ({raw: () => ({resolution:'1h',result:[{data:query.includes('splitBy()') ? [series(query.includes('timeshift') ? 12 : 15)] : [series(query.includes('timeshift') ? 7 : 10,a.id)]}]})}) as never);
  const result = await loadFrontendSessions([a,b], timeframe, '1m');
  expect(jest.mocked(clientClassic).mock.calls.at(-1)?.[2]).toBe('1h');
  expect(result.baselineTotal[0].datapoints[0].value).toBe(12);
  expect(result.baselineIndividual[0].name).toContain('Baseline (21d) — A');
  expect(result.total[0].datapoints[0].value).toBe(15);
});

test('baseline failure cannot hide current sessions; warnings preserve data', async () => {
  jest.mocked(clientClassic).mockImplementation(async query => {
    if (query.includes('timeshift')) throw new Error('Historical metric unavailable');
    return {raw: () => ({resolution:'1h', warnings:['Resolution adjusted'], result:[{data:[{dimensionMap:query.includes('splitBy()') ? {} : {'dt.entity.application':a.id}, timestamps:[0],values:[42]}]}]})} as never;
  });
  const result = await loadFrontendSessions([a],timeframe);
  expect(result.total[0].datapoints[0].value).toBe(42);
  expect(result.individual[0].datapoints[0].value).toBe(42);
  expect(result.baselineTotal).toEqual([]);
  expect(result.notices.join(' ')).toContain('Historical metric unavailable');
  expect(result.notices.join(' ')).toContain('Resolution adjusted');
});
