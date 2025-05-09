import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { clientClassic, MetricResult } from '../core/MetricsClientClassic'


export async function getClusters(timeframe? : TimeframeV2) {
    console.log("timeFrameV2",timeframe)
    const result = await clientClassic(
        "builtin:kubernetes.cluster.readyz:last",
        timeframe
    );
    return result.dimensionsOnly()
}