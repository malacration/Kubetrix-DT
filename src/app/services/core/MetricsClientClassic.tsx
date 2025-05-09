
import { metricsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { TimeframeV2 } from "@dynatrace/strato-components-preview/core";
// import { queryExecutionClient } from "@dynatrace-sdk/client-query";

function shiftTime(base: Date, offsetMs: number): string {
  return new Date(base.getTime() + offsetMs).toISOString();
}

export async function clientClassic(
  metricSelector: string,
  timeFrame? : TimeframeV2
): Promise<MetricResult> {
  
  const now = new Date();
  const toTime = timeFrame?.to.absoluteDate ? new Date(timeFrame.to.absoluteDate) : now;
  const fromTime = timeFrame?.from.absoluteDate ? new Date(timeFrame.from.absoluteDate) : new Date(toTime.getTime() - 2 * 60 * 60 * 1000);

  //TODO colocar if para debug info
  console.log({
    metricSelector,
    acceptType: "application/json; charset=utf-8",
    from: fromTime.toISOString(),
    to: toTime.toISOString(),
  })
  const response = await metricsClient.query({
    metricSelector,
    acceptType: "application/json; charset=utf-8",
    from: fromTime.toISOString(),
    to: toTime.toISOString(),
  });

  return Object.assign(new MetricResult(response), response);
}


export class MetricResult {
  constructor(private response: any) {}

  raw() {
    return this.response;
  }

  dimensionsOnly() {
    const data = this.response.result?.[0]?.data ?? [];
    return data.map((item: any) => ({
      ...item.dimensionMap,
      value: item.values ?? null,
      timestamp: item.timestamps ?? null,
    }));
  }

  valuesOnly() {
    return this.response.result?.[0]?.data?.map((item: any) => item.values) ?? [];
  }

  timestampsOnly() {
    return this.response.result?.[0]?.data?.map((item: any) => item.timestamps) ?? [];
  }
}