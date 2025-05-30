import { executeDqlQuery, QueryResult } from "./core/MetricsClient";




export function ProblemsGetActive(cluster,namespace,workload,timeframe) : Promise<QueryResult>{
    const dql = `
        fetch dt.davis.problems 
        | filter event.status == "ACTIVE"
        | filter "${cluster}" == "all" or k8s.cluster.name == "${cluster}"
        | filter "${namespace}" == "all" or k8s.namespace.name == "${namespace}"
        | filter "${workload}" == "all" or k8s.workload.name == "${workload}"

    `
    return executeDqlQuery(dql,timeframe);
}