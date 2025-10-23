import { eventsClient, metricsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { Timeframe } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";
import { GrailDqlQuery } from "../core/GrailClient";





export async function NodesMetrics(metric : string, $kubernetsCluster, $Namespace, $workload, timeFrame? : Timeframe) {
    
  let toRelationship = ',in("dt.entity.kubernetes_node",entitySelector("type(~"KUBERNETES_NODE~")';
  toRelationship += ',toRelationship.runsOn(type(~"CLOUD_APPLICATION_INSTANCE~")';
  toRelationship += ',fromRelationship.isInstanceOf(type(~"CLOUD_APPLICATION~")';
  toRelationship += ',toRelationship.isNamespaceOfCa(type(~"CLOUD_APPLICATION_NAMESPACE~"),entityName.equals(~'+$Namespace+'~))))"))';
  
  if(!$Namespace || $Namespace == "all")
    toRelationship = '';

  let clusterFilter = ',eq("k8s.cluster.name","'+$kubernetsCluster+'")'
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''

  let workloadFilter = ',in("dt.entity.kubernetes_node", entitySelector("type(~"KUBERNETES_NODE~"),toRelationship.runsOn(type(~"CLOUD_APPLICATION_INSTANCE~"),fromRelationships.isInstanceOf(type(~"CLOUD_APPLICATION~"),entityName.equals(~'+$workload+'~)))"))'
  if(!$workload || $workload == "all")
    workloadFilter = ''

  
  //:filter(eq("k8s.cluster.name","openshift"))
  // const metricSelector = "builtin:kubernetes.node.pods"
  const filter = ':filter(and(eq("pod_condition","Ready"),eq("pod_phase","Running"),eq("pod_status","Running")'+toRelationship+clusterFilter+workloadFilter+'))';
  const split  = ':splitBy("k8s.node.name")'
  
  const metricSelector = metric+filter+':last';

  return clientClassic(metricSelector,timeFrame)
}


export async function LastHostMetric(metric : string, $kubernetsCluster, $Namespace, $workload, timeFrame? : Timeframe) {
      
  let clusterFilter = `| filter in(dt.entity.host,classicEntitySelector("type(HOST),toRelationship.isClusterOfHost(type(KUBERNETES_CLUSTER),entityName.equals(${$kubernetsCluster}))"))`
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''

  let nameSpaceFilter = `| filter in(dt.entity.host,classicEntitySelector("type(HOST),toRelationship.isCgiOfHost(type(CONTAINER_GROUP_INSTANCE),fromRelationship.isCgiOfNamespace(type(CLOUD_APPLICATION_NAMESPACE),entityName.equals(${$Namespace})))"))`
  if(!$Namespace || $Namespace == "all")
    nameSpaceFilter = '';

  

  let workloadFilter = `| filter in(dt.entity.host, entitySelector("type(HOST),toRelationship.isCgiOfHost(type(CONTAINER_GROUP_INSTANCE),fromRelationship.isCgiOfCa(type(CLOUD_APPLICATION),entityName.equals(${$workload})))"))`
  if(!$workload || $workload == "all")
    workloadFilter = ''

  
  const dql = `
    timeseries { values=avg({${metric}}), by:{dt.entity.host} }
    | fieldsAdd name=entityName(dt.entity.host), kubernetesLabels=entityAttr(dt.entity.host,"kubernetesLabels")
    | filter isNotNull(kubernetesLabels)
    ${clusterFilter}
    ${nameSpaceFilter}
    ${workloadFilter}
    | fieldsAdd value = arrayLast(values), id=dt.entity.host
    | fields name, value, id
  `

  return GrailDqlQuery(dql,timeFrame)
}