import { Timeframe } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "./core/MetricsClientClassic";


export function KpiBuiltinGeneric(type: string, metric: string, application : string, aggregation : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("${type}"),entityName.equals("${application}")`
    const querysBymetric = `${metric}:splitBy():fold(${aggregation})`
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
} 