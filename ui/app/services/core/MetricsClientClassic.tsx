import { MetricData, metricsClient, MetricSeriesCollection } from "@dynatrace-sdk/client-classic-environment-v2";
// import { Timeseries, TimeseriesChartProps } from "@dynatrace/strato-components-preview";
import { TimeseriesChartProps, Timeseries, HoneycombTileNumericData } from '@dynatrace/strato-components-preview/charts';

import { Timeframe } from "@dynatrace/strato-components-preview/core";
// import { queryExecutionClient } from "@dynatrace-sdk/client-query";

function shiftTime(base: Date, offsetMs: number): string {
  return new Date(base.getTime() + offsetMs).toISOString();
}

export async function clientClassic(
  metricSelector: string,
  timeFrame? : Timeframe,
  resolution? : string,
  entitySelector?: string
): Promise<MetricResult> {
  
  const now = new Date();
  const toTime = timeFrame?.to.absoluteDate ? new Date(timeFrame.to.absoluteDate) : now;
  const fromTime = timeFrame?.from.absoluteDate ? new Date(timeFrame.from.absoluteDate) : new Date(toTime.getTime() - 2 * 60 * 60 * 1000);


  return metricsClient.query({
    entitySelector,
    metricSelector,
    acceptType: "application/json; charset=utf-8",
    from: fromTime.toISOString(),
    to: toTime.toISOString(),
    resolution: resolution
  }).then(it => Object.assign(new MetricResult(it,metricSelector,entitySelector), it));
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
  
  constructor(
    public response: MetricData,
    public baseQuery : string,
    public entitySelector? : string) {

    }

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
  
  unitCache = new Map<string, string>();

  getByMetric(searchMetric : string): MetricSeriesCollection | undefined {
    const result = this.response?.result
      ?.filter(it =>      String(it.metricId ?? '').includes(searchMetric))
      ?.at(0)
    return result;
  }

  getFirstValueByMetric(searchMetric : string): | { value: number; timestamp?: number, metricId : string } | undefined {
    const result = this.response?.result
      ?.filter(it =>      String(it.metricId ?? '').includes(searchMetric))
      ?.at(0)
    const serie = result?.data?.[0];
    if (!serie?.values?.length) return undefined;

    for (let i = 0; i < serie.values.length; i++) {
      const v = serie.values[i];
      if (v != null && Number.isFinite(v)) {
        return { value: v, timestamp: serie.timestamps?.[i], metricId : result?.metricId ?? '' };
      }
    }
    return undefined;
  }

  getFirstValueOfFirstMetric(): | { value: number; timestamp?: number, metricId : string } | undefined {
    const result = this.response?.result?.[0]
    const serie = result?.data?.[0];
    if (!serie?.values?.length) return undefined;

    for (let i = 0; i < serie.values.length; i++) {
      const v = serie.values[i];
      if (v != null && Number.isFinite(v)) {
        return { value: v, timestamp: serie.timestamps?.[i], metricId : result.metricId };
      }
    }
    return undefined;
  }

  async metricDataToTimeseries(defaultName? : string, unitCache? : undefined | string): Promise<Timeseries[]> {
    const seriesMap = new Map<string, Timeseries>();
    const windowMs = resolutionToMs(this.response.resolution ?? '1m');

    for (const collection of this.response.result) {
      const unit = unitCache? unitCache :  await getMetricUnit(collection.metricId);
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
            center: new Date(ts),
            value: ms.values[idx],
          });
        });
      }
    }

    return [...seriesMap.values()];
  }

  plus(t){
    console.log("plus t")
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


export class MetricSeriesCollectionHandl {

  /** Média dos valores numéricos (ignora null/NaN). */
  getAvg(series?: MetricSeriesCollection): number {
    const { sum, count } = this.#fold(series);
    return count ? sum / count : 0;
  }

  /** Soma dos valores numéricos (ignora null/NaN). */
  getSum(series: MetricSeriesCollection): number {
    const { sum, count } = this.#fold(series);
    return count ? sum : 0;
  }

  /** Último valor global (maior timestamp entre todas as séries). */
  getLast(series: MetricSeriesCollection): number | null {
    let bestTs = -Infinity;
    let bestVal: number | null = null;

    for (const s of series?.data ?? []) {
      const ts: number[] | undefined = (s as any)?.timestamps;
      const vals: Array<number | null | undefined> | undefined = (s as any)?.values;
      if (!ts || !vals || ts.length === 0) continue;

      // varre de trás pra frente para achar o último não-nulo desta série
      for (let i = ts.length - 1; i >= 0; i--) {
        const v = vals[i];
        const t = ts[i] ?? -Infinity;
        if (v != null && Number.isFinite(v) && t > bestTs) {
          bestTs = t;
          bestVal = Number(v);
          break;
        }
      }
    }
    return bestVal;
  }

  // ----------------- helpers -----------------
  #fold(series?: MetricSeriesCollection): { sum: number; count: number } {
    let sum = 0;
    let count = 0;

    for (const s of series?.data ?? []) {
      const vals: Array<number | null | undefined> | undefined = (s as any)?.values;
      if (!vals) continue;
      for (const v of vals) {
        if (v != null && Number.isFinite(v)) {
          sum += Number(v);
          count++;
        }
      }
    }
    return { sum, count };
  }
}