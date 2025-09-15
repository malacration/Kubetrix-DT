import { TimeframeV2 } from "@dynatrace/strato-components-preview/core"
import { clientClassic, MetricResult } from "../core/MetricsClientClassic"
import { classicBaseLine } from "../builtin/baseLineService";
import { GrailDqlQuery } from "../core/GrailClient";
import { QueryResult } from "@dynatrace-sdk/client-query";
import { pickResolution } from "src/app/components/timeframe/resolution";

export async function getWorkloads(kubernetsCluster = 'all', Namespace = 'all',timeFrame? : TimeframeV2) {

  const filterCluster = kubernetsCluster == "all" ? '' : ':filter(eq("k8s.cluster.name",'+kubernetsCluster+'))'
  const filterNameSapce = Namespace == "all" ? '' : ':filter(eq("k8s.namespace.name",'+Namespace+'))'
  const metric = "builtin:kubernetes.pods"
  const split = ':splitBy("k8s.workload.name"):last'
  const metricaSelector = metric+filterCluster+filterNameSapce+split

  const data = await clientClassic(metricaSelector,timeFrame)

  return data.raw().result.flatMap(resultItem =>
    resultItem.data.map(dataItem => dataItem.dimensionMap["k8s.workload.name"])
  );
}


export function  serviceMetricByApplicationName(applicationName : string,timeFrame? : TimeframeV2, 
  metric = "dt.service.request.response_time", 
  aggregation = "avg") : Promise<QueryResult | { error: string; }>{
  
  const filter = `, filter: in(dt.entity.service, classicEntitySelector("type(SERVICE),toRelationship.CALLS(type(APPLICATION),entityName.equals(${applicationName}))"))`
  const intervalNow = pickResolution(0,timeFrame)
  const intervalBase = pickResolution(21,timeFrame)
  const dql = `
    timeseries 
      nowScalar = ${aggregation}(${metric}, scalar: true), interval:${intervalNow}
      ${filter}
      | append [
          timeseries baselineScalar = ${aggregation}(${metric}, scalar: true), shift:-7d, interval:${intervalBase}
          ${filter}
        | append [
            timeseries baselineScalar = ${aggregation}(${metric}, scalar: true), shift:-14d, interval:${intervalBase}
            ${filter}
        ]
        | append [
            timeseries baselineScalar = ${aggregation}(${metric}, scalar: true), shift:-21d, interval:${intervalBase}
            ${filter}
        ]
        | summarize baselineScalar = avg(baselineScalar), by:{ timeframe, interval }
        | fieldsKeep timeframe, interval, baselineScalar
      ]
  `
  return GrailDqlQuery(dql,timeFrame)
}



export function  responseTimePercentilByApplicationName(
  applicationName : string,
  timeFrame? : TimeframeV2, p=90) : Promise<QueryResult | { error: string; }>{
  
  const filter = `, filter: in(dt.entity.service, classicEntitySelector("type(SERVICE),toRelationship.CALLS(type(APPLICATION),entityName.equals(${applicationName}))"))`
  const intervalNow = pickResolution(0,timeFrame)
  const intervalBase = pickResolution(21,timeFrame)
  const dql = `
    timeseries 
      now=percentile(dt.service.request.response_time,${p}), nowScalar = percentile(dt.service.request.response_time, ${p}, scalar: true), interval:${intervalNow}
      ${filter}
      | append [
          timeseries baseline = percentile(dt.service.request.response_time,${p}), baselineScalar = percentile(dt.service.request.response_time, ${p}, scalar: true), shift:-7d, interval:${intervalBase}
          ${filter}
        | append [
            timeseries baseline = percentile(dt.service.request.response_time,${p}), baselineScalar = percentile(dt.service.request.response_time, ${p}, scalar: true), shift:-14d, interval:${intervalBase}
            ${filter}
        ]
        | append [
            timeseries baseline = percentile(dt.service.request.response_time,${p}), baselineScalar = percentile(dt.service.request.response_time, ${p}, scalar: true), shift:-21d, interval:${intervalBase}
            ${filter}
        ]
        | summarize baseline = avg(baseline[]), baselineScalar = avg(baselineScalar), by:{ timeframe, interval }
        | fieldsKeep timeframe, interval, baseline, baselineScalar
      ]
  `
  return GrailDqlQuery(dql,timeFrame)
}

export function serviceByApplication(metricName : string,
  applicationName : string, 
  timeFrame? : TimeframeV2,
  extra? : string,
  isBaseline = false) : Promise<MetricResult>{

  const applicationFilter = `in("dt.entity.service", entitySelector("type(~"SERVICE~"),toRelationship.CALLS(type(~"APPLICATION~"),entityName.equals(~"${applicationName}~"))"))`
  const filter = ':filter(and('+applicationFilter+'))';
  const metric = `builtin:service.${metricName}`
  const split  = ':splitBy()'
  

  const metricSelector = metric+filter+split+ (extra ? ":"+extra : "");

  if(isBaseline){
    return clientClassic(metricSelector,timeFrame)
  }else{
    return clientClassic(metricSelector,timeFrame)
  }
    //timeshift = ":timeshift(-7d)"
}
