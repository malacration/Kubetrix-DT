import type { KubernetesPodResourceLimit } from 'app/services/k8s/WorkloadService';

export interface PodResourceThreshold {
  label: string;
  value: number;
  pods: string[];
}

function compactPodName(name: string): string {
  if (name.length <= 28) return name;
  return `${name.slice(0, 14)}…${name.slice(-11)}`;
}

/**
 * Associa cada pod ao seu limite e agrupa valores idênticos. Réplicas do mesmo
 * workload normalmente têm o mesmo limite, então o gráfico recebe apenas uma
 * linha em vez de repetir uma linha/legenda para cada pod.
 */
export function buildPodResourceThresholds(
  podNames: string[],
  directLimits: KubernetesPodResourceLimit[],
  fallbackLimit?: number,
): PodResourceThreshold[] {
  const directByPod = new Map(
    directLimits
      .filter(limit => Number.isFinite(limit.value) && limit.value > 0)
      .map(limit => [limit.pod, limit.value]),
  );
  const grouped = new Map<string, { value: number; pods: string[]; estimated: boolean }>();

  podNames.forEach(pod => {
    const direct = directByPod.get(pod);
    const value = direct ?? fallbackLimit;
    if (!value || !Number.isFinite(value) || value <= 0) return;

    const key = value.toPrecision(12);
    const current = grouped.get(key);
    if (current) {
      current.pods.push(pod);
      current.estimated = current.estimated && direct === undefined;
      return;
    }

    grouped.set(key, {
      value,
      pods: [pod],
      estimated: direct === undefined,
    });
  });

  const groups = Array.from(grouped.values()).sort((left, right) => left.value - right.value);
  return groups.map(group => {
    if (groups.length === 1) {
      return {
        value: group.value,
        label: group.estimated ? 'Limite estimado por pod' : 'Limite por pod',
        pods: group.pods,
      };
    }

    const target = group.pods.length === 1
      ? compactPodName(group.pods[0])
      : `${group.pods.length} pods`;
    return {
      value: group.value,
      label: `${group.estimated ? 'Limite estimado' : 'Limite'} • ${target}`,
      pods: group.pods,
    };
  });
}
