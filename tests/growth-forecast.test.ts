import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { analyzersClient, type AnalyzerResult } from '@dynatrace-sdk/client-davis-analyzers';
import { forecastInput, forecastSignal, parseForecast } from '../ui/app/services/k8s/GrowthForecast';
import { annualWindow, DAY_MS, GrowthHistory } from '../ui/app/model/GrowthCapacity';

jest.mock('@dynatrace-sdk/client-davis-analyzers', () => ({ analyzersClient: {
  executeAnalyzer: jest.fn(), pollAnalyzerExecution: jest.fn(), cancelAnalyzerExecution: jest.fn(),
} }));

function result(from: number, days = 90): AnalyzerResult {
  return { resultId: 'test', resultStatus: 'SUCCESSFUL', executionStatus: 'COMPLETED', input: {}, output: [{
    analysisStatus: 'OK', forecastQualityAssessment: 'VALID', timeSeriesDataWithPredictions: {
      records: [{ timeframe: { start: new Date(from).toISOString() }, interval: String(DAY_MS * 1000000),
        'dt.davis.forecast:point': Array(days).fill(100), 'dt.davis.forecast:lower': Array(days).fill(90), 'dt.davis.forecast:upper': Array(days).fill(110) }],
      types: [], metadata: {},
    },
  }] };
}
function history(): GrowthHistory {
  const window = annualWindow(new Date('2026-09-17'));
  return { ...window, issues: [], signals: { cpuUsed: { name: 'CPU', datapoints: Array.from({ length: 365 }, (_, i) => ({
    start: new Date(window.from + i * DAY_MS), value: i >= 337 ? 1234567 : 100,
  })) } } };
}

beforeEach(() => { jest.clearAllMocks(); });

describe('native forecast contract', () => {
  it('keeps missing points as null, forces doubles and has no user parameters', () => {
    const input = forecastInput([1, null, 3], Date.parse('2025-09-17'), 90);
    expect(input.timeSeriesData).toContain('array(1.0,null,3.0)');
    expect(input).toMatchObject({ forecastHorizon: 90, forecastOffset: 0, coverageProbability: 0.9 });
  });

  it('parses the real analyzer record layout including string durations', () => {
    const from = Date.parse('2026-09-17');
    const points = parseForecast(result(from), from, 90);
    expect(points).toHaveLength(90);
    expect(points[89]).toEqual({ time: from + 89 * DAY_MS, point: 100, lower: 90, upper: 110 });
  });

  it('rejects failed, invalid, stale or incomplete predictions', () => {
    const from = Date.parse('2026-09-17');
    const invalid = result(from);
    invalid.output[0].forecastQualityAssessment = 'INVALID';
    expect(() => parseForecast(invalid, from, 90)).toThrow();
    expect(() => parseForecast(result(from + DAY_MS), from, 90)).toThrow();
    expect(() => parseForecast(result(from, 2), from, 90)).toThrow();
    expect(() => parseForecast({ ...result(from), resultStatus: 'FAILED' }, from, 90)).toThrow();
  });

  it('trains the final prediction on all twelve months and excludes held-out days from validation', async () => {
    const data = history();
    jest.mocked(analyzersClient.executeAnalyzer)
      .mockResolvedValueOnce({ result: result(data.to) })
      .mockResolvedValueOnce({ result: result(data.to - 28 * DAY_MS, 28) });
    const forecast = await forecastSignal(data, 'cpuUsed');
    const calls = jest.mocked(analyzersClient.executeAnalyzer).mock.calls;
    expect(calls[0][0].body.timeSeriesData).toContain('1234567.0');
    expect(calls[1][0].body.timeSeriesData).not.toContain('1234567.0');
    expect(calls[1][0].body.forecastHorizon).toBe(28);
    expect(forecast.validation?.days).toBe(28);
    expect(forecast.validation?.wape).toBeGreaterThan(99);
  });

  it('polls pending executions and preserves valid forecast if validation fails', async () => {
    const data = history();
    jest.mocked(analyzersClient.executeAnalyzer)
      .mockResolvedValueOnce({ requestToken: 'pending', result: { ...result(data.to), executionStatus: 'RUNNING' } })
      .mockRejectedValueOnce(new Error('validation unavailable'));
    jest.mocked(analyzersClient.pollAnalyzerExecution).mockResolvedValue({ result: result(data.to) });
    const forecast = await forecastSignal(data, 'cpuUsed');
    expect(analyzersClient.pollAnalyzerExecution).toHaveBeenCalled();
    expect(forecast.points).toHaveLength(90);
    expect(forecast.validation).toBeUndefined();
    expect(forecast.warnings).toHaveLength(1);
  });

  it('refuses incomplete annual data without calling the model', async () => {
    const data = history();
    data.signals.cpuUsed!.datapoints.splice(0, 200);
    await expect(forecastSignal(data, 'cpuUsed')).rejects.toThrow('Histórico anual insuficiente');
    expect(analyzersClient.executeAnalyzer).not.toHaveBeenCalled();
  });
});
