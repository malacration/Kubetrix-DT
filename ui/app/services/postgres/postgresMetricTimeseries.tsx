import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { QueryResult } from '@dynatrace-sdk/client-query';
import { GrailDqlQuery } from '../core/GrailClient';
import { pickResolution } from 'app/components/timeframe/resolution';

// Consulta uma métrica Postgres como série ao longo do tempo, via Grail/DQL — mesmo caminho já
// comprovado para o Oracle (ver oracleDatabaseService.tsx / oracleMetricTimeseries).
//
// Histórico: a primeira tentativa aqui reaproveitava a Classic Metrics API (mesmo caminho dos
// KPIs), só que com resolução explícita — mesmo assim os gráficos continuaram voltando um único
// ponto. Sem conseguir depurar o comportamento da Classic API diretamente (não há acesso via
// dtctl, só DQL), a saída mais confiável foi trocar para DQL puro, que já é validado e funciona
// para o Oracle.
//
// IMPORTANTE: aqui o filtro é pela dimensão CRUA `database` (ex: "pjesg"), NÃO pelo entity.name
// formatado "nome (host:porta)" que a Classic API precisa — metric.series não carrega a dimensão
// entity.name, só `database`. Por isso o resolvedor (postgresEntityResolver.tsx) agora devolve os
// dois valores separadamente.
export function postgresMetricTimeseries(
  metricKey: string,
  database: string,
  aggregation: 'avg' | 'sum' | 'max' | 'min',
  timeframe?: Timeframe,
  resolution?: string,
): Promise<QueryResult | { error: string }> {
  if (!database) {
    return Promise.resolve({ error: 'Nenhum database informado.' });
  }

  const interval = pickResolution(0, timeframe, resolution);
  const dql = `
    timeseries value = ${aggregation}(${metricKey}), filter: database == "${database.replace(/"/g, '\\"')}", interval: ${interval}
  `;

  return GrailDqlQuery(dql, timeframe);
}
