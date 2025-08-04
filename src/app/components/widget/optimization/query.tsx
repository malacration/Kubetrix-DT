import { kubernetesWorkload } from "src/app/services/k8s/WorkloadService"
import { TimeframeV2 } from "@dynatrace/strato-components-preview/core"
import { MetricResult } from "src/app/services/core/MetricsClientClassic"



export function getOptimizationData(
    kubernetsCluster?, 
    Namespace?, 
    workload?, 
    timeFrame? : TimeframeV2) : Promise<MetricResult[]> {

    const split = ':splitBy("k8s.workload.name","k8s.namespace.name","k8s.cluster.name")'

    //uso de CPU
    const cpuUsageMaxPromise = kubernetesWorkload("cpu_usage",kubernetsCluster, 
        Namespace, 
        workload, 
        timeFrame,
        'max:default(0,always):fold(max):last',
        false,
        split
    )

    const cpuUsageAvgPromise = kubernetesWorkload("cpu_usage",kubernetsCluster, 
      Namespace, 
      workload, 
      timeFrame,
      'avg:default(0,always):fold(avg):last',
      false,
      split
  )

    const cpuRequestPromise = kubernetesWorkload("requests_cpu",kubernetsCluster, 
        Namespace, 
        workload, 
        timeFrame,
        'max:default(0,always):fold(max):last',
        false,
        split
    )

    const podsDesiredPromise = kubernetesWorkload("pods_desired",kubernetsCluster, 
        Namespace, 
        workload, 
        timeFrame,
        'max:default(0,always):fold(max):last',
        false,
        split
    )


    const cpuThrottledPromise = kubernetesWorkload("cpu_throttled",kubernetsCluster, 
        Namespace, 
        workload, 
        timeFrame,
        'max:default(0,always):fold(max):last',
        false,
        split
    )

    const limitCpuPromise = kubernetesWorkload("limits_cpu",kubernetsCluster, 
      Namespace, 
      workload, 
      timeFrame,
      'max:default(0,always):fold(max):last',
      false,
      split
    )


    const memoryRequestPromise = kubernetesWorkload("requests_memory",kubernetsCluster, 
      Namespace, 
      workload, 
      timeFrame,
      'max:default(0,always):fold(max):last',
      false,
      split
    )


    const memoryLimitPromise = kubernetesWorkload("limits_memory",kubernetsCluster, 
      Namespace, 
      workload, 
      timeFrame,
      'max:default(0,always):fold(max):last',
      false,
      split
    )

    const memoryUsageMaxPromise = kubernetesWorkload("memory_working_set",kubernetsCluster, 
      Namespace, 
      workload, 
      timeFrame,
      'max:default(0,always):fold(max):last',
      false,
      split
    )

    const memoryUsageAvgPromise = kubernetesWorkload("memory_working_set",kubernetsCluster, 
      Namespace, 
      workload, 
      timeFrame,
      'avg:default(0,always):fold(avg):last',
      false,
      split
    )


    

    return Promise.all<MetricResult>([
        podsDesiredPromise,
        limitCpuPromise,
        cpuUsageMaxPromise,
        cpuUsageAvgPromise,
        cpuRequestPromise,
        cpuThrottledPromise,
        memoryRequestPromise,
        memoryLimitPromise,
        memoryUsageMaxPromise,
        memoryUsageAvgPromise
    ]);
}


type Parsed = {
    namespace: string;
    workload: string;
    // pego só o 1º value; ajuste se quiser média, soma etc.
    value: number;
  };
  
export async function teste(
    cluster?: string,
    ns?: string,
    workload?: string,
    tf?: TimeframeV2
  ) {
    const agg = ":max:default(0,always):fold(max)";
    const split = ':splitBy("k8s.workload.name","k8s.namespace.name")';
  
    const cfg = [
      { key: "cpuUsage",     metric: "cpu_usage" },
      { key: "cpuRequest",   metric: "requests_cpu" },
      { key: "podsDesired",  metric: "pods_desired" },
      { key: "cpuThrottled", metric: "cpu_throttled" },
    ] as const;
  
    const pairs = await Promise.all(
      cfg.map(async ({ key, metric }) => {
        const raw = await kubernetesWorkload(
          metric,
          cluster,
          ns,
          workload,
          tf,
          agg,
          false,
          split
        );
  
        /* ---------------------------------------------------
           Estrutura que você mostrou (_métrica_ → response →
           result[0].data[]). Fazemos:
           1) response.result.flatMap(...)
           2) mapeamos só p/ os campos que interessam.
        ---------------------------------------------------- */
        const data: Parsed[] =
          raw.raw()?.result?.flatMap(r =>
            r.data.map(d => ({
              namespace: d.dimensionMap["k8s.namespace.name"],
              workload:  d.dimensionMap["k8s.workload.name"],
              value:     d.values[0]            // primeiro (ou único) valor
            }))
          ) ?? [];
  
        return [key, data] as const;   // vira par [chave, valor]
      })
    );
  
    return Object.fromEntries(pairs) as Record<
      (typeof cfg)[number]["key"],
      Parsed[]
    >;
  }