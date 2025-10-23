import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { clientClassic, MetricResult } from '../core/MetricsClientClassic'


export async function getClusters(timeframe? : Timeframe) {
    const result = await clientClassic(
        "builtin:kubernetes.cluster.readyz:last",
        timeframe
    );
    return result.dimensionsOnly()
}



export function  kubernetesMetrics(metricName : string,
    $kubernetsCluster?, 
    $Namespace?, 
    $workload?, 
    timeFrame? : Timeframe,
    extra? : string,
    isTimeshift = false) : Promise<MetricResult>{

  let clusterFilter = 'eq("k8s.cluster.name","'+$kubernetsCluster+'")'
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''
  
  let namespaceFilter = 'eq("k8s.namespace.name","'+$Namespace+'")'
  if(!$Namespace || $Namespace == "all")
    namespaceFilter = ''

  let workloadFilter = 'eq("k8s.workload.name","'+$workload+'")'
  if(!$workload || $workload == "all")
    workloadFilter = ''
  
  const allFilters = [clusterFilter, namespaceFilter, workloadFilter].filter(f => f !== '').join(',');

  const metric = `builtin:kubernetes.${metricName}`
  let filter = ':filter(and('+allFilters+'))';
  if(allFilters == "")
    filter = ""
  
  let timeshift = ""
  if(isTimeshift)
    timeshift = ":timeshift(-7d)"

  const metricSelector = metric+filter+ (extra ? ":"+extra : "")+timeshift;
  
  return clientClassic(metricSelector,timeFrame)
}