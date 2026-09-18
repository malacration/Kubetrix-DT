import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { units } from '@dynatrace-sdk/units';
import { annualWindow, GrowthHistory, GrowthSignals } from 'app/model/GrowthCapacity';
import { GrailDqlQuery } from '../core/GrailClient';
import { isQueryResult, timeseriesCommandResultToChartSeries } from '../core/GrailConverter';
import { clusterCpuCapacity, clusterMemoryCapacity } from './ClusterCapacity';

export function serviceGrowthQuery(cluster: string, interval: string, metric: 'throughput' | 'latency') {
  if (!/^\d+[smhd]$/.test(interval)) throw new Error('Resolução inválida.');
  const aggregation = metric === 'throughput'
    ? 'sum(dt.service.request.count, rate: 1s)'
    : 'avg(dt.service.request.response_time)';
  return `timeseries value = ${aggregation}, interval: ${interval}, filter: { k8s.cluster.name == ${JSON.stringify(cluster)} }`;
}

export async function loadGrowthHistory(cluster: string, anchor = new Date()): Promise<GrowthHistory> {
  if (!cluster || cluster === 'all') throw new Error('Selecione um cluster para comparar tráfego e capacidade no mesmo escopo.');
  const { from, to, intervalMs } = annualWindow(anchor);
  const interval = '24h';
  // The annual window is independent of all dashboard timeframe/URL settings.
  const fixed: Timeframe = {
    from: { type: 'iso8601', value: new Date(from).toISOString(), absoluteDate: new Date(from).toISOString() },
    to: { type: 'iso8601', value: new Date(to).toISOString(), absoluteDate: new Date(to).toISOString() },
  };
  const signals: GrowthSignals = {};
  const issues: string[] = [];
  const serviceSeries = async (metric: 'throughput' | 'latency') => {
    const result = await GrailDqlQuery(serviceGrowthQuery(cluster, interval, metric), fixed);
    if (!isQueryResult(result)) throw new Error(result.error);
    const series = timeseriesCommandResultToChartSeries(result,
      metric === 'throughput' ? 'Throughput (req/s)' : 'Tempo de resposta médio',
      metric === 'latency' ? units.time.millisecond : undefined)[0];
    if (series && metric === 'latency') series.datapoints = series.datapoints.map(p => ({ ...p, value: p.value / 1000 }));
    return series;
  };
  const results = await Promise.allSettled([
    serviceSeries('throughput'), serviceSeries('latency'),
    clusterCpuCapacity(cluster, fixed, interval), clusterMemoryCapacity(cluster, fixed, interval),
  ]);
  const [throughput, latency, cpu, memory] = results;
  if (throughput.status === 'fulfilled') signals.throughput = throughput.value;
  if (latency.status === 'fulfilled') signals.latency = latency.value;
  if (cpu.status === 'fulfilled') Object.assign(signals, {
    cpuUsed: cpu.value.used, cpuCapacity: cpu.value.available, cpuReserved: cpu.value.reserved,
  });
  if (memory.status === 'fulfilled') Object.assign(signals, {
    memoryUsed: memory.value.used, memoryCapacity: memory.value.available, memoryReserved: memory.value.reserved,
  });
  const labels = ['throughput', 'tempo de resposta', 'CPU', 'memória'];
  results.forEach((result, index) => {
    if (result.status === 'rejected') issues.push(`Falha ao consultar ${labels[index]}. Tente atualizar a página.`);
  });
  // The shared capacity loader tolerates unavailable individual metrics. Surface them here.
  const names: Record<keyof GrowthSignals, string> = {
    throughput: 'Throughput', latency: 'Tempo de resposta', cpuUsed: 'CPU usada', cpuCapacity: 'CPU alocável',
    cpuReserved: 'CPU reservada', memoryUsed: 'Memória usada', memoryCapacity: 'Memória alocável', memoryReserved: 'Memória reservada',
  };
  for (const key of Object.keys(names) as (keyof GrowthSignals)[]) {
    const series = signals[key];
    if (series) {
      if (key === 'cpuCapacity' || key === 'memoryCapacity') series.name = names[key];
      series.datapoints = series.datapoints.filter(p => Number.isFinite(p.value) && p.value >= 0 && +p.start >= from && +p.start + intervalMs <= to);
      if (!series.datapoints.length) signals[key] = undefined;
    }
    if (!signals[key]) issues.push(`${names[key]} sem dados neste período.`);
  }
  return { signals, from, to, intervalMs, issues };
}
