import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GrailDqlQuery } from '../ui/app/services/core/GrailClient';
import { clusterCpuCapacity, clusterMemoryCapacity } from '../ui/app/services/k8s/ClusterCapacity';
import { loadGrowthHistory, serviceGrowthQuery } from '../ui/app/services/k8s/GrowthCapacity';
import { DAY_MS } from '../ui/app/model/GrowthCapacity';

jest.mock('../ui/app/services/core/GrailClient', () => ({ GrailDqlQuery: jest.fn() }));
jest.mock('../ui/app/services/k8s/ClusterCapacity', () => ({ clusterCpuCapacity: jest.fn(), clusterMemoryCapacity: jest.fn() }));
jest.mock('@dynatrace-sdk/units', () => ({ units: { time: { millisecond: 'ms' } } }));
const anchor = new Date('2026-09-17T13:22:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(clusterCpuCapacity).mockResolvedValue({});
  jest.mocked(clusterMemoryCapacity).mockResolvedValue({});
  jest.mocked(GrailDqlQuery).mockResolvedValue({ records: [], types: [], metadata: {} });
});

describe('annual loading', () => {
  it('requires one cluster before querying', async () => {
    await expect(loadGrowthHistory('all', anchor)).rejects.toThrow('Selecione um cluster');
    expect(GrailDqlQuery).not.toHaveBeenCalled();
  });

  it('escapes cluster literals and normalizes throughput to seconds', () => {
    const cluster = 'cluster"\\name';
    expect(serviceGrowthQuery(cluster, '24h', 'throughput')).toContain(`k8s.cluster.name == ${JSON.stringify(cluster)}`);
    expect(serviceGrowthQuery(cluster, '24h', 'throughput')).toContain('rate: 1s');
    expect(() => serviceGrowthQuery(cluster, '5m | limit 1', 'latency')).toThrow();
  });

  it('always requests twelve months of daily data from all sources', async () => {
    const data = await loadGrowthHistory('eks-prd', anchor);
    expect(data.from).toBe(Date.parse('2025-09-17T00:00:00Z'));
    expect(data.to).toBe(Date.parse('2026-09-17T00:00:00Z'));
    expect(data.intervalMs).toBe(DAY_MS);
    expect(clusterCpuCapacity).toHaveBeenCalledWith('eks-prd', expect.objectContaining({
      from: expect.objectContaining({ absoluteDate: '2025-09-17T00:00:00.000Z' }),
      to: expect.objectContaining({ absoluteDate: '2026-09-17T00:00:00.000Z' }),
    }), '24h');
    expect(clusterMemoryCapacity).toHaveBeenCalledWith(...jest.mocked(clusterCpuCapacity).mock.calls[0]);
    expect(jest.mocked(GrailDqlQuery).mock.calls[0][1]).toEqual(jest.mocked(clusterCpuCapacity).mock.calls[0][1]);
  });

  it('keeps independent results on failure and converts microseconds to milliseconds', async () => {
    jest.mocked(GrailDqlQuery).mockResolvedValueOnce({ error: 'Permission denied' }).mockResolvedValueOnce({
      records: [{ timeframe: { start: '2025-09-17T00:00:00Z', end: '2026-09-17T00:00:00Z' }, interval: DAY_MS * 1000000, value: [200000, null, 400000] }], types: [], metadata: {},
    });
    const data = await loadGrowthHistory('openshift-prd', anchor);
    expect(data.signals.throughput).toBeUndefined();
    expect(data.signals.latency!.datapoints.map(p => p.value)).toEqual([200, 400]);
    expect(data.issues).toContain('CPU alocável sem dados neste período.');
  });
});
