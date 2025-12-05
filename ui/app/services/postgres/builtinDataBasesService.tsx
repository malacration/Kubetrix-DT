import { Timeframe } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";


export function builtinSessionByDatabase(dataBase : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("APPLICATION"),entityName.equals("${dataBase}")`
    const querysBymetric = "builtin:apps.web.apdex.userType:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
} 