import { TimeframeV2 } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";
import { pickResolution } from "src/app/components/timeframe/resolution";


export function builtinDurationUserActionByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const xhr = "builtin:apps.web.action.duration.xhr.browser:splitBy()"
    const load = "builtin:apps.web.action.duration.load.browser:splitBy()"

    const loadCount = "builtin:apps.web.action.count.load.browser:splitBy()"
    const xhrCount = "builtin:apps.web.action.count.xhr.browser:splitBy()"

    const num = `((${xhr}*${xhrCount}):fold(sum) + (${load}*${loadCount}):fold(sum))`

    // Denominador: total de ações
    const den = `(${xhrCount}:fold(sum) + ${loadCount}:fold(sum))`

    const query = `(${num})/(${den})`

    return clientClassic(query,timeframe,undefined,entrySelection)
}

export function builtinThroughputUserActionByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const querysBymetric = "builtin:apps.web.action.count.(xhr,load).browser:splitBy():sum"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}


export function builtinApdexByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const querysBymetric = "builtin:apps.web.action.apdex:splitBy():fold(avg)"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}

export function builtinErrosCountByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const querysBymetric = "builtin:apps.web.action.countOfErrors:splitBy():fold"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}