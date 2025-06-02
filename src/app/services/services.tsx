import { executeDqlQuery, QueryResult } from "./core/MetricsClient";




export function getServices(cluster,namespace,workload,timeframe) : Promise<QueryResult>{
       
    let clusterFilter = `| filter in(id, classicEntitySelector("type(SERVICE), toRelationship.isClusterOfService(type(KUBERNETES_CLUSTER), entityName.equals(${cluster}))"))`
    if(!cluster || cluster == "all")
        clusterFilter = ""
    
    let namespaceFilter = `| filter in(id, classicEntitySelector("type(SERVICE), toRelationship.isNamespaceOfService(type(CLOUD_APPLICATION_NAMESPACE), entityName.equals(${namespace}))"))`
    if(!namespace || namespace == "all")
        namespaceFilter = ""
    
    let workloadFilter = `| filter in(id, classicEntitySelector("type(SERVICE), fromRelationship.isServiceOf(type(CLOUD_APPLICATION), entityName.equals(${workload}))"))`
    if(!workload || workload == "all")
        workloadFilter = ""

    const dql = `
        fetch dt.entity.service
        | fieldsAdd stringId = toString(id)
        | fieldsAdd id, entity.name, serviceType, lifetime, lifeTimeEndMillis = unixMillisFromTimestamp(lifetime[end])
        | filter serviceType != "DATABASE_SERVICE" AND serviceType != "QUEUE_LISTENER_SERVICE"
        ${clusterFilter}
        ${namespaceFilter}
        ${workloadFilter}
    `
    return executeDqlQuery(dql,timeframe);
}