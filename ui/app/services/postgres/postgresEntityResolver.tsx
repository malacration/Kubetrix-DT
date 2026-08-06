import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { GrailDqlQuery } from '../core/GrailClient';

// A extensão Postgres identifica o database pela Classic Metrics API via
// `type("sql:postgres_database"), entityName.equals("<nome>")` — mas o nome real da entidade
// NÃO é igual ao valor cru da dimensão `database` nem ao nome do SERVICE detectado pelo OneAgent.
// Confirmado no tenant: a dimensão `database` traz "pjesg", mas o `entity.name` real é
// "pjesg (PJE-BD-SG.pjro.local:5432)" — é ESSE valor que entityName.equals() precisa receber.
//
// Passar o nome "adivinhado" (ex: apenas "pjesg") direto para entityName.equals() nunca casa com
// nada; a Classic API então retorna vazio, e os helpers de agregação (MetricSeriesCollectionHandl)
// tratam "sem dado" como 0 em vez de erro — por isso os KPIs Postgres apareciam todos zerados.
//
// Esta função resolve o nome real consultando `dt.entity.sql:postgres_database` (Grail) e
// comparando os candidatos contra a dimensão `database` OU o próprio `entity.name`, evitando
// tentar adivinhar a formatação "nome (host:porta)".
function quoteList(values: string[]): string {
  return values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(', ');
}

export type ResolvedPostgresDatabase = {
  // Nome real da entidade CUSTOM_DEVICE, ex: "pjesg (PJE-BD-SG.pjro.local:5432)" — usado pela
  // Classic Metrics API (entityName.equals(...), ver KpiGeneric.tsx e os KPIs em _postgres/kpis).
  entityName: string;
  // Valor cru da dimensão `database`, ex: "pjesg" — usado para filtrar métricas via DQL/Grail
  // (`timeseries ..., filter: database == "..."`, ver postgresMetricTimeseries.tsx). É um valor
  // DIFERENTE do entityName: as métricas em metric.series não carregam a dimensão entity.name,
  // só a dimensão database crua.
  database: string;
};

export async function resolvePostgresDatabase(
  candidateNames: string[],
  timeframe?: Timeframe,
): Promise<ResolvedPostgresDatabase | null> {
  if (!candidateNames?.length) return null;

  const quoted = quoteList(candidateNames);
  const dql = `
    fetch \`dt.entity.sql:postgres_database\`
    | fieldsAdd database
    | filter in(database, array(${quoted})) or in(entity.name, array(${quoted}))
    | fields entity.name, database
    | limit 1
  `;

  const result = await GrailDqlQuery(dql, timeframe);
  if (!result || 'error' in (result as any)) {
    console.error('Erro ao resolver entidade Postgres', candidateNames, (result as any)?.error);
    return null;
  }

  const record = (result as any).records?.[0];
  if (!record?.['entity.name'] || !record?.database) return null;

  return { entityName: record['entity.name'], database: record.database };
}
