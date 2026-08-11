import { Timeframe } from "@dynatrace/strato-components-preview/core"
import { clientClassic, MetricResult } from "../core/MetricsClientClassic"
import { classicBaseLine } from "../builtin/baseLineService";
import { GrailDqlQuery } from "../core/GrailClient";
import { QueryResult } from "@dynatrace-sdk/client-query";
import { pickResolution, pickPairedResolutions } from "app/components/timeframe/resolution";

export async function getWorkloads(kubernetsCluster = 'all', Namespace = 'all',timeFrame? : Timeframe) {

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


export function  responseTime($kubernetsCluster?, $Namespace?, $workload?, timeFrame? : Timeframe, isBaseLine = false, resolution? : string, aggregation : 'avg' | 'median' = 'median') : Promise<QueryResult | { error: string; }>{

  const metric = "response_time"

  let clusterFilter = `matchesValue(k8s.cluster.name, "${$kubernetsCluster}")`
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''
  
  let namespaceFilter = `matchesValue(k8s.namespace.name, "${$Namespace}")`
  if(!$Namespace || $Namespace == "all")
    namespaceFilter = ''

  let workloadFilter = `matchesValue(k8s.workload.name, "${$workload}")`
  if(!$workload || $workload == "all")
    workloadFilter = ''
  
  const allFilters = [clusterFilter, namespaceFilter, workloadFilter].filter(f => f !== '').join(' AND ');

  let filter = `
    , filter: { 
      ${allFilters}
    }
  `
  if(allFilters == "")
    filter = ""

  const { now: intervalNow, baseline: intervalBase } = pickPairedResolutions(timeFrame,resolution)

  // "now" e baseline seguem a mesma agregação (avg ou median), escolhida pelo
  // toggle do widget. median(...) precisa de rollup: (median/percentile/percentRank
  // exigem, senão a query volta vazia em silêncio); avg(...) não precisa.
  const nowAgg = aggregation === 'median'
    ? 'median(dt.service.request.response_time, rollup: avg)'
    : 'avg(dt.service.request.response_time)'
  const bucketAgg = nowAgg // mesma expressão por bucket nas 3 janelas da baseline

  // Combinação das 3 semanas (7d/14d/21d) em um único valor de baseline:
  // - avg: summarize direto com avg(baseline[]) (forma iterativa suportada).
  // - median: summarize só suporta median() na forma escalar, não na iterativa
  //   (campo[]) — testado, dá erro ITERATIVE_EXPRESSION_FOR_AGGREGATION_FUNCTIONS.
  //   Como são sempre exatamente 3 valores, sum-min-max sobra o valor do meio —
  //   ou seja, a própria mediana — sem precisar de mediana iterativa nativa (que a
  //   API não suporta aqui). Ressalva: se um bucket tiver só 2 dos 3 valores (ex.:
  //   workload que não existia 21 dias atrás), a conta não é mais a mediana
  //   correta desse bucket.
  const combineBaseline = aggregation === 'median'
    ? `| summarize {
            baseline_sum = sum(baseline[]),
            baseline_min = min(baseline[]),
            baseline_max = max(baseline[])
          }, by:{ timeframe, interval }
        | fieldsAdd baseline = iCollectArray(baseline_sum[] - baseline_min[] - baseline_max[])
        | fieldsKeep timeframe, interval, baseline`
    : `| summarize baseline = avg(baseline[]), by:{ timeframe, interval }
        | fieldsKeep timeframe, interval, baseline`

  const dql = `
    timeseries
      now=${nowAgg}, interval:${intervalNow}
      ${filter}
      | append [
          timeseries baseline = ${bucketAgg}, shift:-7d, interval:${intervalBase}
          ${filter}
        | append [
            timeseries baseline = ${bucketAgg}, shift:-14d, interval:${intervalBase}
            ${filter}
        ]
        | append [
            timeseries baseline = ${bucketAgg}, shift:-21d, interval:${intervalBase}
            ${filter}
        ]
        ${combineBaseline}
      ]
  `
  return GrailDqlQuery(dql,timeFrame)
}

export function  kubernetesWorkload(metricName : string,
    $kubernetsCluster?,
    $Namespace?,
    $workload?,
    timeFrame? : Timeframe,
    extra? : string,
    isTimeshift = false,
    split = ':splitBy()',
    resolution? : string) : Promise<MetricResult>{

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

  const metric = `builtin:kubernetes.workload.${metricName}`
  let filter = ':filter(and('+allFilters+'))';
  if(allFilters == "")
    filter = ""
  
  let timeshift = ""
  if(isTimeshift)
    timeshift = ":timeshift(-7d)"

  const metricSelector = metric+filter+split+ (extra ? ":"+extra : "")+timeshift;

  return clientClassic(metricSelector,timeFrame,pickResolution(0,timeFrame,resolution))
}

export function serviceWorkload(metricName : string,
  $kubernetsCluster?,
  $Namespace?,
  $workload?,
  timeFrame? : Timeframe,
  extra? : string,
  isTimeshift = false,
  plusResolution = 0,
  resolution? : string) : Promise<MetricResult>{

  // eslint-disable-next-line no-secrets/no-secrets
  let clusterFilter = `toRelationship.isClusterOfService(type("KUBERNETES_CLUSTER"),entityName.equals("${$kubernetsCluster}"))`
  if(!$kubernetsCluster || $kubernetsCluster == "all"){
    clusterFilter = ''
  }
    

  // eslint-disable-next-line no-secrets/no-secrets
  let namespaceFilter = `toRelationship.isNamespaceOfService(type("CLOUD_APPLICATION_NAMESPACE"),entityName.equals("${$Namespace}"))`
  if(!$Namespace || $Namespace == "all")
    namespaceFilter = ''

  
  // eslint-disable-next-line no-secrets/no-secrets
  let workloadFilter = `fromRelationship.isServiceOf(type("CLOUD_APPLICATION"),entityName.equals("${$workload}"))`
  if(!$workload || $workload == "all")
    workloadFilter = ''

  const allFilters = [clusterFilter, namespaceFilter, workloadFilter].filter(f => f !== '').join(',');
  let entrySelector : undefined | string = `type("SERVICE"),${allFilters}`//':filter(and('+allFilters+'))';
  if(allFilters == "")
    entrySelector = undefined
  
  const metric = `builtin:service.${metricName}`
  const split  = ':splitBy()'

  let timeshift = ""
  if(isTimeshift)
    timeshift = ":timeshift(-7d)"

  const metricSelector = metric+split+ (extra ? ":"+extra : "")+timeshift;

  const resolutionNow = pickResolution(plusResolution,timeFrame,resolution)

  return clientClassic(metricSelector,timeFrame,resolutionNow,entrySelector)
}

function transformarJson(input) {
  const records = [];
  const metricResults = input.result[0].data;

  metricResults.forEach(entry => {
    const dimensionMap = normalizeKeys(entry.dimensionMap);
    const timestamps = entry.timestamps.map(ts => ts);
    const values = entry.values;

    const record = {
      timeframe: extractTimeframeFromRecords([{ timestamp: timestamps }]),
      interval: calculateInterval(timestamps),
      ...dimensionMap,
      //timestamp: timestamps,
      values: values,
    };

    records.push(record);
  });

  return {
    records,
    types: [
      {
        indexRange: [0, records.length - 1],
        mappings: {
          ...getFieldTypes(records),
          //timestamp: { type: "timestamp" },
          interval: { type: "duration"},
          timeframe: { type: "timeframe"},
        }
      }
    ],
    metadata: {
      grail: {
        canonicalQuery: "transformed metric data",
        timezone: "UTC",
        scannedRecords: records.length,
        locale: "pt-BR",
        notifications: [],
        sampled: false,
        fieldName: "values",
        analysisTimeframe: extractTimeframeFromRecords(records)
      }
    }
  };
}

function normalizeKeys(obj) {
  const newObj = {};
  for (const key in obj) {
    const normalizedKey = key.replace(/\s+/g, '.');
    newObj[normalizedKey] = obj[key];
  }
  return newObj;
}


function getFieldTypes(records) {
  if (!records.length) return {};

  const sample = records[0];
  const fieldTypes = {};

  for (const key in sample) {
    const value = sample[key];

    if (Array.isArray(value)) {
      // Detecta o tipo do primeiro valor não-nulo do array
      const first = value.find(v => v !== null && v !== undefined);

      let elementType = typeof first;
      if (elementType === "number") {
        elementType = Number.isInteger(first) ? "double" : "double"; // todo ajustar isso depois
      } else if (elementType === "boolean") {
        elementType = "boolean";
      } else if (elementType === "string") {
        elementType = "string";
      } else {
        elementType = "unknown";
      }

      fieldTypes[key] = {
        type: "array",
        types: [
          {
            indexRange: [0, value.length - 1],
            mappings: {
              element: {
                type: elementType
              }
            }
          }
        ]
      };
    } else {
      let valueType = typeof value;
      if (valueType === "number") {
        valueType = Number.isInteger(value) ? "double" : "double"; // todo ajustar isso depois
      }

      fieldTypes[key] = {
        type: valueType
      };
    }
  }

  return fieldTypes;
}


function extractTimeframeFromRecords(records, timestampField = "timestamp") {
  const timestamps = [];

  for (const record of records) {
    const tsField = record[timestampField];

    const values = Array.isArray(tsField) ? tsField : [tsField];

    for (const t of values) {
      if (typeof t === "number" && !isNaN(t)) {
        timestamps.push(t);
      } else if (typeof t === "string") {
        const parsed = Date.parse(t);
        if (!isNaN(parsed)) {
          timestamps.push(parsed);
        }
      }
    }
  }

  if (!timestamps.length) {
    console.warn("Nenhum timestamp válido encontrado.");
    return null;
  }

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);

  return {
    start: new Date(min).toISOString(),
    end: new Date(max).toISOString()
  };
}

function calculateInterval(timestamps) {
  const parsedTimestamps = timestamps
    .map(t => typeof t === "string" ? Date.parse(t) : t)
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);

  if (parsedTimestamps.length < 2) return 0;

  const start = parsedTimestamps[0];
  const end = parsedTimestamps[parsedTimestamps.length - 1];
  const step = (end - start) / (parsedTimestamps.length - 1);

  return Math.round(step)*1000;
}