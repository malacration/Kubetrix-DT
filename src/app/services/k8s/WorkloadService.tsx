import { TimeframeV2 } from "@dynatrace/strato-components-preview/core"
import { clientClassic, MetricResult } from "../core/MetricsClientClassic"
import { eventsClient, metricsClient } from "@dynatrace-sdk/client-classic-environment-v2";

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


export function  responseTime($kubernetsCluster?, $Namespace?, $workload?, timeFrame? : TimeframeV2) : Promise<MetricResult>{
  
  let clusterFilter = 'in("dt.entity.service", entitySelector("type(~"SERVICE~"),toRelationship.isClusterOfService(type(~"KUBERNETES_CLUSTER~"),entityName.equals(~"'+$kubernetsCluster+'~"))"))'
  if(!$kubernetsCluster || $kubernetsCluster == "all")
    clusterFilter = ''
  
  let namespaceFilter = 'in("dt.entity.service", entitySelector("type(~"SERVICE~"),toRelationship.isNamespaceOfService(type(~"CLOUD_APPLICATION_NAMESPACE~"),entityName.equals(~"'+$Namespace+'~"))"))'
  if(!$Namespace || $Namespace == "all")
    namespaceFilter = ''

  let workloadFilter = 'in("dt.entity.service", entitySelector("type(~"SERVICE~"),toRelationship.isNamespaceOfService(type(~"CLOUD_APPLICATION_NAMESPACE~"),fromRelationship.isNamespaceOfCa(type(~"CLOUD_APPLICATION~"),entityName.equals(~"'+$workload+'~")))"))'
  if(!$workload || $workload == "all")
    workloadFilter = ''
  
  const allFilters = [clusterFilter, namespaceFilter, workloadFilter].filter(f => f !== '').join(',');

  const metric = "builtin:service.response.time"
  let filter = ':filter(and('+allFilters+'))';
  if(allFilters == "")
    filter = ""
  const split  = ':splitBy()'
  
  //:filter(and(in("dt.entity.service", entitySelector("type(~"SERVICE~"),toRelationship.isClusterOfService(type(~"KUBERNETES_CLUSTER~"),entityName.equals(~"openshift~"))"))))
  const metricSelector = metric+filter+split+":avg:toUnit(MicroSecond,Second)";

  return clientClassic(metricSelector,timeFrame)
}

export function  kubernetesWorkload(metricName : string,
    $kubernetsCluster?, 
    $Namespace?, 
    $workload?, 
    timeFrame? : TimeframeV2,
    extra? : string) : Promise<MetricResult>{

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
  const split  = ':splitBy()'
  const metricSelector = metric+filter+split+ (extra ? ":"+extra : "");
  
  return clientClassic(metricSelector,timeFrame)
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