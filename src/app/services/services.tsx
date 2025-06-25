import { GrailDqlQuery, QueryResult } from "./core/GrailClient";




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
        | fieldsAdd stringId = toString(id), serviceTechnologyTypes
        | fieldsAdd id, entity.name, serviceType, lifetime, lifeTimeEndMillis = unixMillisFromTimestamp(lifetime[end])
        | filter serviceType != "DATABASE_SERVICE" AND serviceType != "QUEUE_LISTENER_SERVICE"
        ${clusterFilter}
        ${namespaceFilter}
        ${workloadFilter}
    `
    return GrailDqlQuery(dql,timeframe);
}


export function getCallServices(cluster,namespace,workload,timeframe) : Promise<QueryResult>{

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
        | fieldsAdd entity.name
        ${clusterFilter}
        ${namespaceFilter}
        ${workloadFilter}
        | filter isNotNull(calls)
        | fieldsFlatten calls
        | expand calls.dt.entity.service
        | fields id, calls.dt.entity.service
        | lookup  [
            fetch dt.entity.service
            | fieldsAdd entity.name
            ${clusterFilter.replace("filter","filterOut")}
            ${namespaceFilter.replace("filter","filterOut")}
            ${workloadFilter.replace("filter","filterOut")}
            | fields lookupId = id, entity.name, serviceTechnologyTypes
        ],
        sourceField: calls.dt.entity.service,
        lookupField: lookupId,
        fields: { lookupId, entity.name, serviceTechnologyTypes }
        | filter isNotNull(lookupId)
        | dedup lookupId
    `
    return GrailDqlQuery(dql,timeframe);
}