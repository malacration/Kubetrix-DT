import { TimeframeV2 } from "@dynatrace/strato-components-preview/core";
import { clientClassic } from "../core/MetricsClientClassic";


export function builtinDurationUserActionByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const querysBymetric = "builtin:apps.web.action.(duration.xhr.browser,duration.load.browser,count.load.browser,count.xhr.browser):splitBy()"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}

export function builtinThroughputUserActionByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const querysBymetric = "builtin:apps.web.action.count.(xhr,load).browser:splitBy():sum"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}


export function builtinApdexByFront(frontName : string, timeframe? : TimeframeV2) {
    const entrySelection = `type(APPLICATION_METHOD),fromRelationship.isApplicationMethodOf(type(APPLICATION),entityName.equals(${frontName}))`
    const querysBymetric = "builtin:apps.web.action.apdex:splitBy():avg"
    return clientClassic(querysBymetric,timeframe,undefined,entrySelection)
}