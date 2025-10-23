import { QueryResult } from "@dynatrace-sdk/client-query";
import { GrailDqlQuery } from "./core/GrailClient";




export function getFrontends(timeframe) : Promise<QueryResult | { error: string; } >{
    const dql = `
        fetch dt.entity.application 
    `
    return GrailDqlQuery(dql,timeframe);
}


export function getServicesByIdFrontend(idFrontend, timeframe) : Promise<QueryResult | { error: string; }>{
    const dql = `
        fetch dt.entity.application
        | filter id == "${idFrontend}"
        | fieldsAdd entity.name
        | fieldsFlatten calls
        | expand call=calls.dt.entity.service
        | fields call, id, front_name = entity.name
        | lookup  [
            fetch dt.entity.service
            | fieldsAdd entity.name
            | fields lookupId=id, entity.name, serviceTechnologyTypes
        ],
        sourceField: call,
        lookupField: lookupId,
        fields: { lookupId, entity.name, serviceTechnologyTypes } 
    `
    return GrailDqlQuery(dql,timeframe);
}