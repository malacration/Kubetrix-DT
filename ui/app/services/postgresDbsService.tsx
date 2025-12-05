import { QueryResult } from "@dynatrace-sdk/client-query";
import { GrailDqlQuery } from "./core/GrailClient";




export function getPostgresDbs(timeframe) : Promise<QueryResult | { error: string; } >{
    const dql = `
        fetch \`dt.entity.sql:postgres_database\` | fieldsAdd database 
    `
    return GrailDqlQuery(dql,timeframe);
}


export function getServicesByIdPostgresDb(idDatabase, timeframe) : Promise<QueryResult | { error: string; }>{
    const dql = `
        fetch dt.entity.sql:postgres_database
        | filter id == "${idDatabase}"
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