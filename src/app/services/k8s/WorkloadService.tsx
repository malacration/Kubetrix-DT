import { TimeframeV2 } from "@dynatrace/strato-components-preview/core"
import { clientClassic } from "../core/MetricsClientClassic"


export async function getWorkloads(kubernetsCluster = 'all', Namespace = 'all',timeFrame? : TimeframeV2) {

  const filterCluster = kubernetsCluster == "all" ? '' : ':filter(eq("k8s.cluster.name",'+kubernetsCluster+'))'
  const filterNameSapce = Namespace == "all" ? '' : ':filter(eq("k8s.namespace.name",'+Namespace+'))'
  const metric = "builtin:kubernetes.pods"
  const split = ':splitBy("k8s.workload.name"):last'
  const metricaSelector = metric+filterCluster+filterNameSapce+split

  const data = await clientClassic(metricaSelector,timeFrame)

  return ["All", ...data.raw().result.flatMap(resultItem =>
    resultItem.data.map(dataItem => dataItem.dimensionMap["k8s.workload.name"])
  )];
}