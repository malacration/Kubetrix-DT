import { describe, expect, it } from '@jest/globals';
import { annualWindow, assessForecast, capacityOutlook, dailyValues, DAY_MS, describeHistory, FORECAST_DAYS, GrowthHistory, SignalForecast } from '../ui/app/model/GrowthCapacity';

function history(): GrowthHistory {
  const window = annualWindow(new Date('2026-09-17T15:23:00Z'));
  const count = (window.to - window.from) / DAY_MS;
  return { ...window, issues: [], signals: {
    cpuUsed: { name: 'CPU', datapoints: Array.from({ length: count }, (_, i) => ({ start: new Date(window.from + i * DAY_MS), value: 100 + i })) },
    cpuCapacity: { name: 'Alocável', datapoints: Array.from({ length: count }, (_, i) => ({ start: new Date(window.from + i * DAY_MS), value: 1000 })) },
  } };
}

describe('annual history', () => {
  it('uses twelve calendar months ending before the current UTC day', () => {
    expect(annualWindow(new Date('2026-09-17T23:59:00Z'))).toEqual({ from: Date.parse('2025-09-17'), to: Date.parse('2026-09-17'), intervalMs: DAY_MS });
    const leap = annualWindow(new Date('2024-02-29T12:00:00Z'));
    expect(leap.from).toBe(Date.parse('2023-02-28'));
    expect((leap.to - leap.from) / DAY_MS).toBe(366);
  });

  it('aligns by timestamp, preserves zero and keeps missing values as gaps', () => {
    const data = history();
    data.signals.cpuUsed!.datapoints[0].value = 0;
    data.signals.cpuUsed!.datapoints.splice(1, 1);
    data.signals.cpuUsed!.datapoints.reverse();
    expect(dailyValues(data, 'cpuUsed').slice(0, 3)).toEqual([0, null, 102]);
  });

  it('allows CPU prediction without service metrics', () => {
    const summary = describeHistory(history(), 'cpuUsed');
    expect(summary.reason).toBeUndefined();
    expect(summary.count).toBe(365);
    expect(summary.coverage).toBe(1);
    expect(summary.latest).toBe(464);
    expect(summary.yearChange).toBeCloseTo((449.5 / 114.5 - 1) * 100);
  });

  it('refuses a short retained history instead of silently shrinking the annual window', () => {
    const data = history();
    data.signals.cpuUsed!.datapoints.splice(0, 200);
    expect(describeHistory(data, 'cpuUsed').reason).toContain('Histórico anual insuficiente');
    expect(dailyValues(data, 'cpuUsed')).toHaveLength(365);
  });

  it('refuses missing recent days even with high overall coverage', () => {
    const data = history();
    data.signals.cpuUsed!.datapoints.pop();
    expect(describeHistory(data, 'cpuUsed').reason).toContain('último dia');
  });

  it('does not count non-finite values or future data as observations', () => {
    const data = history();
    data.signals.cpuUsed!.datapoints[0].value = NaN;
    data.signals.cpuUsed!.datapoints.push({ start: new Date(data.to), value: 99999 });
    expect(describeHistory(data, 'cpuUsed').count).toBe(364);
    expect(describeHistory(data, 'cpuUsed').latest).toBe(464);
  });
});

describe('validation and saturation', () => {
  it('calculates out-of-sample error and empirical interval coverage', () => {
    const points = Array.from({ length: 28 }, (_, i) => ({ time: i * DAY_MS, point: 110, lower: 90, upper: 120 }));
    expect(assessForecast(points, Array(28).fill(100))).toEqual({ days: 28, mae: 10, wape: 10, intervalCoverage: 100 });
    expect(assessForecast(points, Array(28).fill(0))?.wape).toBeUndefined();
    expect(assessForecast(points, Array(28).fill(null))).toBeUndefined();
  });

  const forecast = (data: GrowthHistory): SignalForecast => ({ key: 'cpuUsed', warnings: [], points: Array.from({ length: FORECAST_DAYS }, (_, i) => ({
    time: data.to + i * DAY_MS, point: 500 + i * 10, lower: 400 + i * 10, upper: 600 + i * 10,
  })) });

  it('distinguishes central crossing from risk at the upper prediction bound', () => {
    const data = history();
    const outlook = capacityOutlook(data, forecast(data), 'cpuCapacity')!;
    expect(outlook.planningDate).toBe(data.to + 30 * DAY_MS);
    expect(outlook.saturationDate).toBe(data.to + 50 * DAY_MS);
    expect(outlook.possibleSaturationDate).toBe(data.to + 40 * DAY_MS);
    expect(outlook.currentPercent).toBeCloseTo(46.4);
  });

  it('uses latest capacity after scale-out, not the annual average', () => {
    const data = history();
    data.signals.cpuCapacity!.datapoints.at(-1)!.value = 2000;
    const outlook = capacityOutlook(data, forecast(data), 'cpuCapacity')!;
    expect(outlook.saturationDate).toBeUndefined();
    expect(outlook.currentPercent).toBeCloseTo(23.2);
  });

  it('does not infer unlimited headroom from missing or zero capacity', () => {
    const data = history();
    data.signals.cpuCapacity!.datapoints.pop();
    expect(capacityOutlook(data, forecast(data), 'cpuCapacity')).toBeUndefined();
    data.signals.cpuCapacity!.datapoints.push({ start: new Date(data.to - DAY_MS), value: 0 });
    expect(capacityOutlook(data, forecast(data), 'cpuCapacity')).toBeUndefined();
  });

  it('reports already exhausted capacity at the base date', () => {
    const data = history();
    data.signals.cpuCapacity!.datapoints.at(-1)!.value = 400;
    expect(capacityOutlook(data, forecast(data), 'cpuCapacity')?.saturationDate).toBe(data.to);
  });
});
