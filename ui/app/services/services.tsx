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
        | lookup [
            timeseries v = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }
            | join on: { dt.entity.service, interval },[
                timeseries v_7d = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }, shift: -7d
                ], fields: { v_7d }
            | join on:{ dt.entity.service, interval }, [
                timeseries v_14d = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }, shift: -14d
                ], fields:{ v_14d }
            | join on:{ dt.entity.service, interval }, [
                timeseries v_21d = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }, shift: -21d
                ], fields:{ v_21d }
            | fieldsRemove timeframe, interval
            | fields currResponse = v, baseResponse = (v_7d+v_14d+v_21d)/3, v_7d, v_14d, v_21d, dt.entity.service
            ], sourceField:id, lookupField:dt.entity.service, fields:{currResponse,baseResponse}, executionOrder:leftFirst
            | lookup [
            timeseries v = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }
            | join on: { dt.entity.service, interval },[
                timeseries v_7d = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }, shift: -7d
                ], fields: { v_7d }
            | join on:{ dt.entity.service, interval }, [
                timeseries v_14d = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }, shift: -14d
                ], fields:{ v_14d }
            | join on:{ dt.entity.service, interval }, [
                timeseries v_21d = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }, shift: -21d
                ], fields:{ v_21d }
            | fieldsRemove timeframe, interval
            | fields currCount = v, baseCount = (v_7d+v_14d+v_21d)/3, v_7d, v_14d, v_21d, dt.entity.service
        ], sourceField:id, lookupField:dt.entity.service, fields:{currCount,baseCount}, executionOrder:leftFirst
    `
    // console.log(dql)
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
            | lookup [
                timeseries v = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }
                | join on: { dt.entity.service, interval },[
                    timeseries v_7d = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }, shift: -7d
                    ], fields: { v_7d }
                | join on:{ dt.entity.service, interval }, [
                    timeseries v_14d = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }, shift: -14d
                    ], fields:{ v_14d }
                | join on:{ dt.entity.service, interval }, [
                    timeseries v_21d = avg(dt.service.request.response_time, scalar: true), by:{ dt.entity.service }, shift: -21d
                    ], fields:{ v_21d }
                | fieldsRemove timeframe, interval
                | fields currResponse = v, baseResponse = (v_7d+v_14d+v_21d)/3, v_7d, v_14d, v_21d, dt.entity.service
                ], sourceField:lookupId, lookupField:dt.entity.service, fields:{currResponse,baseResponse}, executionOrder:leftFirst
                | lookup [
                timeseries v = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }
                | join on: { dt.entity.service, interval },[
                    timeseries v_7d = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }, shift: -7d
                    ], fields: { v_7d }
                | join on:{ dt.entity.service, interval }, [
                    timeseries v_14d = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }, shift: -14d
                    ], fields:{ v_14d }
                | join on:{ dt.entity.service, interval }, [
                    timeseries v_21d = sum(dt.service.request.count, scalar: true), by:{ dt.entity.service }, shift: -21d
                    ], fields:{ v_21d }
                | fieldsRemove timeframe, interval
                | fields currCount = v, baseCount = (v_7d+v_14d+v_21d)/3, v_7d, v_14d, v_21d, dt.entity.service
            ], sourceField:lookupId, lookupField:dt.entity.service, fields:{currCount,baseCount}, executionOrder:leftFirst
        ],
        sourceField: calls.dt.entity.service,
        lookupField: lookupId,
        fields: { lookupId, entity.name, serviceTechnologyTypes, currResponse,baseResponse,currCount,baseCount }
        | filter isNotNull(lookupId)
        | fieldsRemove id, calls.dt.entity.service
        | dedup lookupId
    `
    return GrailDqlQuery(dql,timeframe);
}