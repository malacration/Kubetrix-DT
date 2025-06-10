import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { GrailDqlQuery } from '../core/GrailClient';


export async function getNamesSpaces(clusterName = "all", timeframe? : TimeframeV2) {
    const dql = `
        data record(name = "all")
        | append [
            fetch dt.entity.cloud_application_namespace
            | fields id, name = entity.name
            | filter "${clusterName}" == "all"
                or in(
                    id,
                    classicEntitySelector(
                        concat(
                            "type(CLOUD_APPLICATION_NAMESPACE),toRelationship.isClusterOfNamespace(type(KUBERNETES_CLUSTER),entityName.equals(",
                            "${clusterName}",
                            "))"
                        )
                    )
                )
            | fields name
        ]
    `;
    const result = await GrailDqlQuery(dql,timeframe);
    return result
}