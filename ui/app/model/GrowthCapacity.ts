import type { Timeseries } from '@dynatrace/strato-components-preview/charts';

export const DAY_MS = 86_400_000;
export const FORECAST_DAYS = 90;
export const VALIDATION_DAYS = 28;
export const FORECAST_KEYS = ['cpuUsed', 'memoryUsed', 'throughput', 'latency'] as const;
export type ForecastKey = typeof FORECAST_KEYS[number];
export type SignalKey = ForecastKey | 'cpuCapacity' | 'memoryCapacity' | 'cpuReserved' | 'memoryReserved';
export type GrowthSignals = Partial<Record<SignalKey, Timeseries>>;
export interface GrowthHistory {
  signals: GrowthSignals;
  from: number;
  to: number;
  intervalMs: number;
  issues: string[];
}

/** Twelve calendar months, ending before today's incomplete UTC bucket. */
export function annualWindow(anchor = new Date()) {
  const to = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const year = anchor.getUTCFullYear() - 1;
  const month = anchor.getUTCMonth();
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return { from: Date.UTC(year, month, day), to, intervalMs: DAY_MS };
}

export function dailyValues(history: GrowthHistory, key: SignalKey): (number | null)[] {
  const values = new Map((history.signals[key]?.datapoints ?? [])
    .filter(p => Number.isFinite(p.value) && p.value >= 0 && Number.isFinite(+p.start))
    .map(p => [+p.start, p.value]));
  return Array.from({ length: Math.round((history.to - history.from) / DAY_MS) }, (_, i) => values.get(history.from + i * DAY_MS) ?? null);
}

export const mean = (values: (number | null)[]): number | undefined => {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : undefined;
};

export function changePercent(before?: number, after?: number) {
  return before !== undefined && before > 0 && after !== undefined ? (after / before - 1) * 100 : undefined;
}

export function describeHistory(history: GrowthHistory, key: SignalKey) {
  const values = dailyValues(history, key);
  const count = values.filter(v => v !== null).length;
  const coverage = count / Math.max(1, values.length);
  const first = values.findIndex(v => v !== null);
  let last = values.length - 1;
  while (last >= 0 && values[last] === null) last--;
  const recentMean = mean(values.slice(-30));
  const firstMonth = values.slice(0, 30);
  const lastMonth = values.slice(-30);
  const yearChange = firstMonth.filter(v => v !== null).length >= 24 && lastMonth.filter(v => v !== null).length >= 24
    ? changePercent(mean(firstMonth), recentMean) : undefined;
  let reason: string | undefined;
  if (coverage < 0.8 || count < 180 || first > 30) reason = 'Histórico anual insuficiente: requer 80% de cobertura e dados no primeiro mês.';
  else if (last !== values.length - 1) reason = 'Falta o último dia completo; previsão suspensa para não usar uma base desatualizada.';
  else if (lastMonth.filter(v => v !== null).length < 24) reason = 'Há muitas lacunas nos últimos 30 dias.';
  return { values, count, coverage, first: first >= 0 ? history.from + first * DAY_MS : undefined,
    latest: last >= 0 ? values[last] ?? undefined : undefined,
    latestTime: last >= 0 ? history.from + last * DAY_MS : undefined,
    recentMean, yearChange, reason };
}

export interface ForecastPoint { time: number; point: number; lower: number; upper: number }
export interface ForecastValidation { days: number; mae: number; wape?: number; intervalCoverage: number }
export interface SignalForecast {
  key: ForecastKey;
  points: ForecastPoint[];
  validation?: ForecastValidation;
  warnings: string[];
}

/** Held-out observations never enter the validation model's training input. */
export function assessForecast(points: ForecastPoint[], actual: (number | null)[]): ForecastValidation | undefined {
  const pairs = points.flatMap((p, i) => actual[i] !== null && Number.isFinite(actual[i]) ? [{ p, actual: actual[i] as number }] : []);
  if (pairs.length < 20) return undefined;
  const error = pairs.reduce((sum, { p, actual }) => sum + Math.abs(p.point - actual), 0);
  const total = pairs.reduce((sum, { actual }) => sum + Math.abs(actual), 0);
  return { days: pairs.length, mae: error / pairs.length, wape: total > 0 ? error / total * 100 : undefined,
    intervalCoverage: pairs.filter(({ p, actual }) => actual >= p.lower && actual <= p.upper).length / pairs.length * 100 };
}

export function capacityOutlook(history: GrowthHistory, forecast: SignalForecast | undefined, capacityKey: 'cpuCapacity' | 'memoryCapacity') {
  const capacity = dailyValues(history, capacityKey).at(-1);
  const final = forecast?.points.at(-1);
  if (!forecast || !final || capacity === undefined || capacity === null || capacity <= 0) return undefined;
  const current = dailyValues(history, forecast.key).at(-1);
  const crossing = (fraction: number, bound: 'point' | 'upper') => current !== null && current !== undefined && current >= capacity * fraction
    ? history.to : forecast.points.find(p => p[bound] >= capacity * fraction)?.time;
  return { capacity, currentPercent: current === null || current === undefined ? undefined : current / capacity * 100,
    planningDate: crossing(0.8, 'point'), saturationDate: crossing(1, 'point'), possibleSaturationDate: crossing(1, 'upper'),
    finalPercent: final.point / capacity * 100 };
}
