import type { Timeseries } from '@dynatrace/strato-components-preview/charts';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { units } from '@dynatrace-sdk/units';

import { classicBaseLineBy } from 'app/services/builtin/baseLineService';
import { kubernetesWorkload } from 'app/services/k8s/WorkloadService';
import { BASELINE_LABEL, CHART_COLORS } from '../style/ChartColors';

interface WorkloadPodBaseline {
  series: Timeseries[];
  desiredPods?: number;
}

/**
 * Aproxima a baseline esperada de um pod dividindo a baseline agregada do
 * workload pela quantidade média de réplicas desejadas no período atual.
 */
export async function workloadPodBaseline(
  resource: 'cpu' | 'memory',
  cluster: string,
  namespace: string,
  workload: string,
  timeframe: Timeframe,
  nowResolution: string,
  baselineResolution: string,
): Promise<WorkloadPodBaseline> {
  const metricName = resource === 'cpu' ? 'cpu_usage' : 'memory_working_set';
  const classicUnit = resource === 'cpu' ? 'MilliCores' : 'Byte';
  const chartUnit = resource === 'cpu' ? units.unspecified.millicore : units.data.byte;

  const [workloadUsage, desiredPodsResult] = await Promise.all([
    kubernetesWorkload(
      metricName,
      cluster,
      namespace,
      workload,
      timeframe,
      'sum',
      false,
      undefined,
      nowResolution,
    ),
    kubernetesWorkload(
      'pods_desired',
      cluster,
      namespace,
      workload,
      timeframe,
      'max:fold(avg)',
      false,
      undefined,
      nowResolution,
    ),
  ]);

  const desiredPods = desiredPodsResult.getFirstValueOfFirstMetric()?.value;
  if (!desiredPods || !Number.isFinite(desiredPods) || desiredPods <= 0) {
    return { series: [] };
  }

  const baseline = await classicBaseLineBy(
    workloadUsage,
    timeframe,
    '',
    '',
    3,
    baselineResolution,
  );
  const workloadBaseline = await baseline.metricDataToTimeseries(BASELINE_LABEL, classicUnit);

  return {
    desiredPods,
    series: workloadBaseline.map((item) => ({
      ...item,
      name: BASELINE_LABEL,
      color: CHART_COLORS.baseline,
      unit: chartUnit,
      datapoints: item.datapoints.map((datapoint) => ({
        ...datapoint,
        value: typeof datapoint.value === 'number'
          ? datapoint.value / desiredPods
          : datapoint.value,
      })),
    })),
  };
}

/**
 * Fallback para tenants/períodos sem a métrica de limite no nível do pod.
 * Segue a aproximação solicitada: limite agregado do workload / pods desejados.
 */
export async function workloadPodLimitFallback(
  resource: 'cpu' | 'memory',
  cluster: string,
  namespace: string,
  workload: string,
  timeframe: Timeframe,
  resolution: string,
): Promise<number | undefined> {
  const [workloadLimit, desiredPodsResult] = await Promise.all([
    kubernetesWorkload(
      resource === 'cpu' ? 'limits_cpu' : 'limits_memory',
      cluster,
      namespace,
      workload,
      timeframe,
      'max:fold(max):last',
      false,
      undefined,
      resolution,
    ),
    kubernetesWorkload(
      'pods_desired',
      cluster,
      namespace,
      workload,
      timeframe,
      'max:fold(avg)',
      false,
      undefined,
      resolution,
    ),
  ]);

  const limit = workloadLimit.getFirstValueOfFirstMetric()?.value;
  const desiredPods = desiredPodsResult.getFirstValueOfFirstMetric()?.value;
  if (
    !limit || !Number.isFinite(limit) || limit <= 0 ||
    !desiredPods || !Number.isFinite(desiredPods) || desiredPods <= 0
  ) {
    return undefined;
  }

  return limit / desiredPods;
}
