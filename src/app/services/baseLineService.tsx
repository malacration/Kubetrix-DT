import { TimeframeV2 } from "@dynatrace/strato-components-preview/core"
import { clientClassic } from "./core/MetricsClientClassic"
import { startOfHour, addHours, addMinutes } from 'date-fns';
import { pickResolution, resolutionForDays } from "../components/timeframe/resolution";



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

export function alignTimeframe(tf: TimeframeV2, threshold = 15): TimeframeV2 {
  const from = addMinutes(startOfHour(new Date(tf.from.absoluteDate)),-30);

  const toDate = new Date(tf.to.absoluteDate);
  const minutes = toDate.getMinutes();

  const to =
    minutes >= threshold
      ? startOfHour(addMinutes(toDate, 15)) // próxima hora
      : startOfHour(toDate);             // hora atual

  return {
    from: { type: 'iso8601', absoluteDate: from.toISOString() },
    to:   { type: 'iso8601', absoluteDate: to.toISOString()   },
  };
}