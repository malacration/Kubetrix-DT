import { kubernetesWorkload } from "app/services/k8s/WorkloadService"
import { Timeframe } from "@dynatrace/strato-components-preview/core"
import { MetricResult } from "app/services/core/MetricsClientClassic"



export function getOptimizationData(
    kubernetsCluster?,
    Namespace?,
    workload?,
    timeFrame? : Timeframe) : Promise<MetricResult[]> {

    const split = ':splitBy("k8s.workload.name","k8s.namespace.name","k8s.cluster.name")'

    // Uso de CPU — sem default(0,always) para não contaminar fold(avg) com zeros de períodos sem dados
    const cpuUsageMaxPromise = kubernetesWorkload("cpu_usage", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    const cpuUsageAvgPromise = kubernetesWorkload("cpu_usage", kubernetsCluster,
        Namespace, workload, timeFrame,
        'avg:fold(avg)',
        false, split
    )

    // Configurações estáticas — fold(max) (API não suporta fold(last))
    const cpuRequestPromise = kubernetesWorkload("requests_cpu", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    // pods_desired com fold(avg) = escala típica do período (melhor divisor que o pico com fold(max))
    const podsDesiredPromise = kubernetesWorkload("pods_desired", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(avg)',
        false, split
    )

    // CPU throttled em duas versões:
    // max → detectar se throttling ocorreu alguma vez (usado em hasCpuThrottled, getMax)
    const cpuThrottledMaxPromise = kubernetesWorkload("cpu_throttled", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    // avg → magnitude típica de throttling (usado em getMin, median para CPU limit)
    const cpuThrottledAvgPromise = kubernetesWorkload("cpu_throttled", kubernetsCluster,
        Namespace, workload, timeFrame,
        'avg:fold(avg)',
        false, split
    )

    const limitCpuPromise = kubernetesWorkload("limits_cpu", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    const memoryRequestPromise = kubernetesWorkload("requests_memory", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    const memoryLimitPromise = kubernetesWorkload("limits_memory", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    const memoryUsageMaxPromise = kubernetesWorkload("memory_working_set", kubernetsCluster,
        Namespace, workload, timeFrame,
        'max:fold(max)',
        false, split
    )

    // Sem default(0,always) — avg só considera períodos em que o workload estava ativo
    const memoryUsageAvgPromise = kubernetesWorkload("memory_working_set", kubernetsCluster,
        Namespace, workload, timeFrame,
        'avg:fold(avg)',
        false, split
    )

    return Promise.all<MetricResult>([
        podsDesiredPromise,
        limitCpuPromise,
        cpuUsageMaxPromise,
        cpuUsageAvgPromise,
        cpuRequestPromise,
        cpuThrottledMaxPromise,
        cpuThrottledAvgPromise,
        memoryRequestPromise,
        memoryLimitPromise,
        memoryUsageMaxPromise,
        memoryUsageAvgPromise
    ]);
}
