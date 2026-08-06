import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { QueryResult } from '@dynatrace-sdk/client-query';
import { GrailDqlQuery } from '../core/GrailClient';
import { NowBaseline } from 'app/components/widget/kpiCore';
import { pickResolution } from 'app/components/timeframe/resolution';

// Consulta as métricas da extensão Oracle SQL (com.dynatrace.extension.sql-oracle.*) via Grail/DQL.
// Diferente do Postgres (extensão clássica, expõe entidades CUSTOM_DEVICE consultáveis pela
// Classic Metrics API v1/v2 com `type("sql:postgres_database")`), a extensão Oracle usada neste
// tenant é Extension 2.0 e registra entidades Smartscape nativas (DB_DATABASE_ORACLE,
// DB_INSTANCE_ORACLE, DB_CLUSTER_ORACLE) em vez de custom devices — por isso aqui usamos DQL puro.
//
// IMPORTANTE (confirmado contra o tenant real em ago/2026): nem toda métrica dessa extensão é
// reportada por PDB. Algumas são só por instância RAC:
//   - escopo "database" (dimensão container.name = nome da PDB): sessions.*, tablespaces.usage,
//     queries.dbTime.count, queries.cpuTime.count
//   - escopo "instance" (dimensão instance.name = nome da instância RAC, ex: CDBJUDTJ1):
//     limits.*_utilization, memory.pga.*, memory.sga.*, cpu.*, wait.events*
// Ao adicionar KPIs novos, valide o escopo real antes de assumir container.name.

export type OracleMetricScope = 'database' | 'instance';

function quoteList(values: string[]): string {
  return values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(', ');
}

function buildFilterClause(scope: OracleMetricScope, candidateNames: string[]): string {
  const field = scope === 'database' ? 'container.name' : 'instance.name';
  return `in(${field}, array(${quoteList(candidateNames)}))`;
}

/**
 * Retorna { now, baseline } para uma métrica da extensão Oracle, com baseline calculada
 * pela mediana dos mesmos horários há 7, 14 e 21 dias (mesmo padrão usado em services.tsx).
 */
export async function oracleMetricNowBaseline(
  metricKey: string,
  aggregation: 'avg' | 'sum' | 'max' | 'min',
  scope: OracleMetricScope,
  candidateNames: string[],
  timeframe?: Timeframe,
): Promise<NowBaseline> {
  if (!candidateNames?.length) {
    return { now: NaN, baseline: NaN };
  }

  const filterClause = buildFilterClause(scope, candidateNames);

  // IMPORTANTE: usar `join kind: leftOuter`. Quando uma janela deslocada (ex: shift: -21d) não
  // tem NENHUM dado — comum logo após ligar uma extensão nova, como a do Oracle aqui — o join
  // por padrão (inner) descarta a linha inteira do resultado, derrubando "now" junto com
  // "baseline" mesmo quando o valor atual existe. Com leftOuter, o campo do lado que faltou
  // vira null e a linha principal (com "now") sobrevive. `arrayMedian` ignora nulls (mesmo
  // comportamento de arrayAvg/arraySum), então a baseline vira null (não NaN/erro) quando não
  // há nenhum histórico ainda — ver
  // oracleDatabaseHasData()/OracleKpiGeneric para como isso é tratado na UI.
  const dql = `
    timeseries v = ${aggregation}(\`${metricKey}\`, scalar: true), filter: ${filterClause}
    | join kind: leftOuter, on: { interval }, [
        timeseries v_7d = ${aggregation}(\`${metricKey}\`, scalar: true), filter: ${filterClause}, shift: -7d
      ], fields: { v_7d }
    | join kind: leftOuter, on: { interval }, [
        timeseries v_14d = ${aggregation}(\`${metricKey}\`, scalar: true), filter: ${filterClause}, shift: -14d
      ], fields: { v_14d }
    | join kind: leftOuter, on: { interval }, [
        timeseries v_21d = ${aggregation}(\`${metricKey}\`, scalar: true), filter: ${filterClause}, shift: -21d
      ], fields: { v_21d }
    | fields now = v, baseline = arrayMedian(array(v_7d, v_14d, v_21d))
  `;

  const result = await GrailDqlQuery(dql, timeframe);

  if (!result || 'error' in (result as any)) {
    console.error('Erro ao consultar métrica Oracle', metricKey, (result as any)?.error);
    return { now: NaN, baseline: NaN };
  }

  const record = (result as any).records?.[0] ?? {};
  const now = record.now;
  const baseline = record.baseline;

  return {
    // `now` pode legitimamente não existir ainda (instância recém-detectada, sem dado no
    // timeframe atual) — nesse caso é NaN mesmo, para o KpiCore mostrar o estado de loading/vazio.
    now: now == null ? NaN : Number(now),
    // `baseline` ausente é um caso ESPERADO (sem histórico suficiente), não um erro: mantemos
    // NaN para acionar o fallback "Sem baseline" do KpiCore, em vez de mascarar com 0.
    baseline: baseline == null ? NaN : Number(baseline),
  };
}

/**
 * Retorna a série temporal (não escalar) de uma métrica Oracle, no formato bruto de saída do
 * comando `timeseries` do DQL — pronta para `convertQueryResultToTimeseries` (mesmo conversor já
 * usado pelos gráficos de workload, ver WorkloadResponseTime.tsx / WorkloadService.tsx).
 */
export function oracleMetricTimeseries(
  metricKey: string,
  aggregation: 'avg' | 'sum' | 'max' | 'min',
  scope: OracleMetricScope,
  candidateNames: string[],
  timeframe?: Timeframe,
  resolution?: string,
): Promise<QueryResult | { error: string }> {
  if (!candidateNames?.length) {
    return Promise.resolve({ error: 'Nenhuma instância candidata informada.' });
  }

  const filterClause = buildFilterClause(scope, candidateNames);
  const interval = pickResolution(0, timeframe, resolution);

  const dql = `
    timeseries value = ${aggregation}(\`${metricKey}\`), filter: ${filterClause}, interval: ${interval}
  `;

  return GrailDqlQuery(dql, timeframe);
}

/**
 * Resolve, dentre os nomes candidatos de PDB, qual efetivamente existe no tenant
 * (tem pelo menos uma métrica reportada). Usado para exibir mensagem clara quando
 * nenhum candidato bate com a instância monitorada pela extensão.
 */
export async function oracleDatabaseHasData(
  candidateNames: string[],
  timeframe?: Timeframe,
): Promise<boolean> {
  if (!candidateNames?.length) return false;

  const filterClause = buildFilterClause('database', candidateNames);
  const dql = `
    timeseries v = sum(\`com.dynatrace.extension.sql-oracle.sessions.all\`, scalar: true), filter: ${filterClause}
    | fields hasData = isNotNull(v) and v > 0
  `;

  const result = await GrailDqlQuery(dql, timeframe);
  if (!result || 'error' in (result as any)) return false;
  const record = (result as any).records?.[0];
  return Boolean(record?.hasData);
}
