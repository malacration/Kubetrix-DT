import { Timeframe } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";


export function builtinSessionCountByDatabase(dataBase : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("sql:postgres_database"),entityName.equals("${dataBase}")`
    const querysBymetric = "postgres.sessions.count:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
} 



export function builtinSessionTimeByDatabase(dataBase : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("sql:postgres_database"),entityName.equals("${dataBase}")`
    const querysBymetric = "postgres.session_time.count:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
} 

export function activeConnectionByDatabase(dataBase : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("sql:postgres_database"),entityName.equals("${dataBase}")`
    const querysBymetric = "postgres.activity.active:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}

export function conflictsByDatabase(dataBase : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("sql:postgres_database"),entityName.equals("${dataBase}")`
    const querysBymetric = "postgres.conflicts.count:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
} 