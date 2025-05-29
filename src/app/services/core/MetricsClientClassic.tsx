
import { MetricData, metricsClient } from "@dynatrace-sdk/client-classic-environment-v2";
// import { Timeseries, TimeseriesChartProps } from "@dynatrace/strato-components-preview";
import { TimeseriesChartProps, Timeseries, HoneycombTileNumericData } from '@dynatrace/strato-components-preview/charts';

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
  console.log(metricSelector)

  const response = await metricsClient.query({
    metricSelector,
    acceptType: "application/json; charset=utf-8",
    from: fromTime.toISOString(),
    to: toTime.toISOString(),
  });

  return Object.assign(new MetricResult(response), response);
}


const unitCache = new Map<string, string>();

export async function getMetricUnit(metricKey: string): Promise<string | undefined> {
  if (unitCache.has(metricKey)) {
    return unitCache.get(metricKey);
  }

  const desc = await metricsClient.metric({
    acceptType: 'application/json; charset=utf-8',
    metricKey,
  });

  unitCache.set(metricKey, desc?.unit??'');
  return desc.unit;
}


export class MetricResult {
  constructor(private response: MetricData) {}

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

  getTimeSerie() : Array<Timeseries> {
    return []
  }
  unitCache = new Map<string, string>();

  async metricDataToTimeseries(defaultName? : string): Promise<Timeseries[]> {
    const seriesMap = new Map<string, Timeseries>();
    const windowMs = resolutionToMs(this.response.resolution ?? '1m');

    for (const collection of this.response.result) {
      const unit = await getMetricUnit(collection.metricId);

      for (const ms of collection.data) {
        const hasDims = ms.dimensionMap && Object.keys(ms.dimensionMap).length > 0;

        const name = hasDims
          ? Object.values(ms.dimensionMap).join(' | ')
          : defaultName??collection.metricId;

        if (!seriesMap.has(name)) {
          seriesMap.set(name, { name, datapoints: [], unit });
        }

        const serie = seriesMap.get(name)!;
        ms.timestamps.forEach((ts, idx) => {
          serie.datapoints.push({
            start: new Date(ts),
            end:   new Date(ts + windowMs),
            value: ms.values[idx],
          });
        });
      }
    }

    return [...seriesMap.values()];
  }
  
  getHoneycomb(key: string): HoneycombTileNumericData[] {
    const accumulator: Record<string, number> = {};
  
    for (const data of this.response.result.flatMap(it => it.data)) {
      const { dimensionMap, values } = data;
      const name = dimensionMap[key];
  
      if (!name) {
        console.warn(`Chave "${key}" não encontrada em:`, dimensionMap);
        continue;
      }
  
      for (const v of values) {
        // ⇢ pula se null ou undefined
        if (v == null) continue;
  
        // ⇢ pula se não for número ou for NaN
        if (typeof v !== 'number' || Number.isNaN(v)) continue;
  
        accumulator[name] = (accumulator[name] ?? 0) + v;
      }
    }
  
    return Object.entries(accumulator).map(([name, value]) => ({ name, value }));
  }  
}


const resolutionToMs = (res: string): number => {
  const [, num, unit] = res.match(/^(\d+)([smhd])$/)!; // s-econds, m-inutes, h-ours, d-ays
  const mult = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(num) * mult[unit as keyof typeof mult];
};