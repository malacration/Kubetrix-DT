import { GrailDqlQuery, QueryResult } from "./core/GrailClient";




export function ProblemsGetActive(cluster,namespace,workload,timeframe) : Promise<QueryResult>{
    const dql = `
        fetch dt.davis.problems 
        | filter event.status == "ACTIVE"
        | filter "${cluster}" == "all" or matchesValue(k8s.cluster.name,"${cluster}")
        | filter "${namespace}" == "all" or matchesValue(k8s.namespace.name,"${namespace}")
        | filter "${workload}" == "all" or matchesValue(k8s.workload.name,"${workload}")

    `
    return GrailDqlQuery(dql,timeframe);
}