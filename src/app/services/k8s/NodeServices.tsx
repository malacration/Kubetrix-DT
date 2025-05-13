import { eventsClient, metricsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { TimeframeV2 } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";



export async function NodesCpuOverload($kubernetsCluster, $Namespace, $workload, timeFrame? : TimeframeV2) {
    
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
  if($workload || $workload == "all")
    workloadFilter = ''

  
  //:filter(eq("k8s.cluster.name","openshift"))
  const metric = "builtin:kubernetes.node.pods"
  const filter = ':filter(and(eq("pod_condition","Ready"),eq("pod_phase","Running"),eq("pod_status","Running")'+toRelationship+clusterFilter+workloadFilter+'))';
  const split  = ':splitBy("k8s.node.name")'
  
  const metricSelector = metric+filter+':last';

  return clientClassic(metricSelector,timeFrame)
}