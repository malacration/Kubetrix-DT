import { analyzersClient, type AnalyzerResult } from '@dynatrace-sdk/client-davis-analyzers';
import { assessForecast, DAY_MS, describeHistory, FORECAST_DAYS, ForecastKey, ForecastPoint, GrowthHistory, SignalForecast, VALIDATION_DAYS } from 'app/model/GrowthCapacity';
import { isQueryResult } from '../core/GrailConverter';

const ANALYZER = 'dt.statistics.GenericForecastAnalyzer';

/** Pass exactly the already displayed history, preserving gaps and numeric types. */
export function forecastInput(values: (number | null)[], from: number, horizon: number) {
  const literal = (value: number | null) => value === null || !Number.isFinite(value) ? 'null'
    : Number.isInteger(value) && !String(value).includes('e') ? `${value}.0` : String(value);
  const to = from + values.length * DAY_MS;
  return {
    timeSeriesData: `data record(timeframe = timeframe(from: toTimestamp("${new Date(from).toISOString()}"), to: toTimestamp("${new Date(to).toISOString()}")), interval = 24h, value = array(${values.map(literal).join(',')})) | limit 1`,
    forecastHorizon: horizon,
    forecastOffset: 0, // Incomplete days have already been excluded.
    coverageProbability: 0.9,
    applyZeroLowerBoundHeuristic: true,
    nPaths: 200,
  };
}

/** Only a complete, valid, correctly dated forecast is eligible for capacity decisions. */
export function parseForecast(result: AnalyzerResult, from: number, days: number): ForecastPoint[] {
  if (result.executionStatus !== 'COMPLETED' || result.resultStatus === 'FAILED') throw new Error('O modelo não concluiu a previsão.');
  const output = result.output[0];
  if (output?.analysisStatus !== 'OK' || output?.forecastQualityAssessment !== 'VALID') {
    throw new Error('O modelo não encontrou uma previsão válida para este histórico.');
  }
  const data: unknown = output.timeSeriesDataWithPredictions;
  if (!isQueryResult(data)) throw new Error('O modelo retornou uma série inválida.');
  const record = data.records?.[0];
  const timeframe = record?.timeframe as { start?: string } | undefined;
  const start = Date.parse(timeframe?.start ?? '');
  const interval = Number(record?.interval) / 1_000_000;
  const point = record?.['dt.davis.forecast:point'];
  const lower = record?.['dt.davis.forecast:lower'];
  const upper = record?.['dt.davis.forecast:upper'];
  if (interval !== DAY_MS || !Array.isArray(point) || !Array.isArray(lower) || !Array.isArray(upper)) throw new Error('Resolução inesperada na previsão.');
  const offset = (from - start) / DAY_MS;
  if (!Number.isInteger(offset) || offset < 0) throw new Error('A previsão está desalinhada com o histórico.');
  const points = Array.from({ length: days }, (_, i) => {
    const index = i + offset;
    const values = [point[index], lower[index], upper[index]];
    if (!values.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('A previsão contém dias sem resultado.');
    const [p, l, u] = values as number[];
    if (l > p || p > u || u < 0) throw new Error('A previsão contém limites inconsistentes.');
    return { time: from + i * DAY_MS, point: Math.max(0, p), lower: Math.max(0, l), upper: Math.max(0, u) };
  });
  return points;
}

async function executeForecast(values: (number | null)[], from: number, days: number, signal?: AbortSignal) {
  let requestToken: string | undefined;
  let completed = false;
  try {
    let response = await analyzersClient.executeAnalyzer({ analyzerName: ANALYZER,
      body: forecastInput(values, from, days), timeoutSeconds: 1, abortSignal: signal });
    requestToken = response.requestToken;
    for (let attempt = 0; response.result.executionStatus === 'RUNNING' && attempt < 120; attempt++) {
      if (signal?.aborted) throw new Error('Análise cancelada.');
      if (!requestToken) throw new Error('O modelo não retornou um token para acompanhamento.');
      // Bounded long polling, with abort on cluster changes or unmount.
      response = await analyzersClient.pollAnalyzerExecution({ analyzerName: ANALYZER, requestToken, timeoutSeconds: 1, abortSignal: signal });
    }
    completed = response.result.executionStatus === 'COMPLETED';
    return { points: parseForecast(response.result, from + values.length * DAY_MS, days),
      warnings: response.result.logs?.filter(log => log.level === 'WARNING' || log.level === 'SEVERE').map(log => log.message) ?? [] };
  } finally {
    if (requestToken && !completed) {
      await analyzersClient.cancelAnalyzerExecution({ analyzerName: ANALYZER, requestToken }).catch(() => undefined);
    }
  }
}

export async function forecastSignal(history: GrowthHistory, key: ForecastKey, signal?: AbortSignal): Promise<SignalForecast> {
  const description = describeHistory(history, key);
  if (description.reason) throw new Error(description.reason);
  const predicted = await executeForecast(description.values, history.from, FORECAST_DAYS, signal);
  const warnings = [...predicted.warnings];
  let validation: SignalForecast['validation'];
  try {
    // A second run excludes the final 28 days to measure true out-of-sample error.
    const training = description.values.slice(0, -VALIDATION_DAYS);
    const heldOut = description.values.slice(-VALIDATION_DAYS);
    const backtest = await executeForecast(training, history.from, VALIDATION_DAYS, signal);
    validation = assessForecast(backtest.points, heldOut);
    warnings.push(...backtest.warnings);
    if (!validation) warnings.push('Não há observações suficientes para validar os últimos 28 dias.');
  } catch (error) {
    if (signal?.aborted) throw error;
    warnings.push('Não foi possível validar a previsão contra os últimos 28 dias.');
  }
  return { key, points: predicted.points, validation, warnings };
}
