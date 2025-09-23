import { TimeframeV2 } from "@dynatrace/strato-components-preview/core"
import { clientClassic, MetricResult } from "../core/MetricsClientClassic"
import { pickResolution } from "../../components/timeframe/resolution";
import { expandGroups } from "./expandGroups";



export function classicBaseLineBy(
  metricResult : MetricResult, 
  timeframe? : TimeframeV2, 
  aggregation = ":avg", 
  toUnit = "", 
  examples = 3,
  plusResolution = 0){

  const expandedQuerys = expandGroups(metricResult.baseQuery)
  const querys = new Array<string>()
  expandedQuerys.forEach(baseQuery => {
    for(let i =0; i<examples; i++){
      querys.push(`((${baseQuery}):timeshift(-${7*(i+1)}d)${aggregation}:default(0,always)${toUnit})`)
    }
  });
  const query = `(${querys.join('+')})/ ${examples}`;
  return clientClassic(query, timeframe,pickResolution((examples*7)+plusResolution,timeframe),metricResult.entitySelector)
}

export function classicBaseLine(baseQuery : string, timeframe? : TimeframeV2, toUnit? : string, examples = 3){
    const querys = new Array<string>()
    
    for(let i =0; i<examples; i++){
        querys.push(baseQuery+`:timeshift(-${7*(i+1)}d):avg:default(0,always)${toUnit}`)
    }
    
    const query = `${querys.join('+')}`;

    return clientClassic(query, timeframe, pickResolution(examples*7,timeframe)).then(res => {
      res?.response?.result.forEach(col => {
        col.data.forEach(ms => {
          ms.values = ms.values.map(v => v / examples);
        });
      });
      return res;
    });
}