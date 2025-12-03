import { Timeframe } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";
import { pickResolution } from "app/components/timeframe/resolution";


export function builtinDurationUserActionByFront(
    frontName : string, timeframe? : Timeframe, 
    agreggation : "median" | "avg" | "percentile(90)" | "percentile(99)" = "median"
) {
    const entrySelection = `type(APPLICATION),entityName.equals(${frontName})`
    const xhr = `builtin:apps.web.actionDuration.xhr.browser:${agreggation}:splitBy()`
    const load = `builtin:apps.web.actionDuration.load.browser:${agreggation}:splitBy()`

    const loadCount = "builtin:apps.web.actionCount.load.browser:splitBy()"
    const xhrCount = "builtin:apps.web.actionCount.xhr.browser:splitBy()"

    const num = `((${xhr}*${xhrCount}):fold(sum) + (${load}*${loadCount}):fold(sum))`

    // Denominador: total de ações
    const den = `(${xhrCount}:fold(sum) + ${loadCount}:fold(sum))`

    const query = `(${num})/(${den})`

    return clientClassic(query,timeframe,undefined,entrySelection)
}


export function builtinNetworkContributionByFront(
    frontName : string, timeframe? : Timeframe, 
    agreggation : "median" | "avg" | "percentile(90)" | "percentile(99)" = "median"
) {
    const entrySelection = `type(APPLICATION),entityName.equals(${frontName})`
    const xhr = `builtin:apps.web.networkContribution.xhr:${agreggation}:splitBy()`
    const load = `builtin:apps.web.networkContribution.load:${agreggation}:splitBy()`

    const loadCount = "builtin:apps.web.actionCount.load.browser:splitBy()"
    const xhrCount = "builtin:apps.web.actionCount.xhr.browser:splitBy()"

    const num = `((${xhr}*${xhrCount}):fold(sum) + (${load}*${loadCount}):fold(sum))`

    // Denominador: total de ações
    const den = `(${xhrCount}:fold(sum) + ${loadCount}:fold(sum))`

    const query = `(${num})/(${den})`

    return clientClassic(query,timeframe,undefined,entrySelection)
}

export function builtinServerContributionByFront(
    frontName : string, timeframe? : Timeframe, 
    agreggation : "median" | "avg" | "percentile(90)" | "percentile(99)" = "median"
) {
    const entrySelection = `type(APPLICATION),entityName.equals(${frontName})`
    const xhr = `builtin:apps.web.serverContribution.xhr:${agreggation}:splitBy()`
    const load = `builtin:apps.web.serverContribution.load:${agreggation}:splitBy()`

    const loadCount = "builtin:apps.web.actionCount.load.browser:splitBy()"
    const xhrCount = "builtin:apps.web.actionCount.xhr.browser:splitBy()"

    const num = `((${xhr}*${xhrCount}):fold(sum) + (${load}*${loadCount}):fold(sum))`

    // Denominador: total de ações
    const den = `(${xhrCount}:fold(sum) + ${loadCount}:fold(sum))`

    const query = `(${num})/(${den})`

    return clientClassic(query,timeframe,undefined,entrySelection)
}

export function builtinThroughputUserActionByFront(frontName : string, timeframe? : Timeframe) {
    const entrySelection = `type(APPLICATION),entityName.equals(${frontName})`
    const querysBymetric = "builtin:apps.web.actionCount.(xhr,load).browser:splitBy():sum"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}


export function builtinApdexByFront(frontName : string, timeframe? : Timeframe) {
    // eslint-disable-next-line no-secrets/no-secrets
    const entrySelection = `type("APPLICATION"),entityName.equals("${frontName}")`
    const querysBymetric = "builtin:apps.web.apdex.userType:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
} 

export function builtinErrosRateByFront(frontName : string, timeframe? : Timeframe) {
    const entrySelection = `type(APPLICATION),entityName.equals(${frontName})`
    const querysBymetric = `
        builtin:apps.web.countOfErrors:splitBy():fold
        /
        (
            builtin:apps.web.actionCount.load.browser:splitBy():fold
            +
            builtin:apps.web.actionCount.xhr.browser:splitBy():fold
        )`
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}