import { GrailDqlQuery, QueryResult } from "./core/GrailClient";


/**
 * Lista todos os problemas (dt.davis.problems) do ambiente.
 *
 * @param categories  Valores de event.category a manter (vindos do alerting
 *                    profile selecionado). Se null/vazio, não filtra por categoria.
 * @param fromExpr    Expressão de início do timeframe em DQL (ex.: "now()-24h").
 */
export function ProblemsList(
  categories: string[] | null,
  fromExpr = "now()-24h",
): Promise<QueryResult> {
  const catFilter =
    categories && categories.length
      ? `| filter in(event.category, {${categories
          .map(c => `"${c}"`)
          .join(", ")}})`
      : "";

  const dql = `
    fetch dt.davis.problems, from:${fromExpr}
    ${catFilter}
    | sort event.start desc
    | limit 1000
  `;

  return GrailDqlQuery(dql);
}


export function ProblemsGetActive(cluster,namespace,workload,timeframe) : Promise<QueryResult>{
    const dql = `
        fetch dt.davis.problems
        | filter event.status == "ACTIVE"
        | filter "${cluster}" == "all" or matchesValue(k8s.cluster.name,"${cluster}")
        | filter "${namespace}" == "all" or matchesValue(k8s.namespace.name,"${namespace}")
        | filter "${workload}" == "all" or matchesValue(k8s.workload.name,"${workload}")

    `
    return GrailDqlQuery(dql,timeframe);
}

export interface EntityProblem {
  id: string;
  displayId: string;
  name: string;
  category: string;
}

/**
 * Problemas ATIVOS do ambiente inteiro, agrupados por entidade afetada (serviço ou
 * aplicação de frontend) — usado pelo Mapa de Chamadas pra marcar em vermelho os nodes
 * com um problema em aberto. `affected_entity_ids` é um array por problema; expandir e
 * agrupar do lado do cliente é mais simples que tentar um `summarize` com array no DQL.
 */
export async function getActiveProblemsByEntity(): Promise<Map<string, EntityProblem[]>> {
  const dql = `
    fetch dt.davis.problems
    | filter event.status == "ACTIVE"
    | fieldsAdd aff = affected_entity_ids
    | expand aff
    | filter startsWith(aff, "SERVICE-") or startsWith(aff, "APPLICATION-")
    | fields id = event.id, displayId = display_id, name = event.name, category = event.category, aff
    | limit 2000
  `;
  const result = await GrailDqlQuery(dql);
  const byEntity = new Map<string, EntityProblem[]>();
  const records = 'records' in result ? result.records ?? [] : [];
  for (const r of records as Record<string, unknown>[]) {
    const entityId = r.aff as string | undefined;
    if (!entityId) continue;
    const list = byEntity.get(entityId) ?? [];
    list.push({
      id: r.id as string,
      displayId: (r.displayId as string) ?? (r.id as string),
      name: (r.name as string) ?? 'Problema',
      category: (r.category as string) ?? '',
    });
    byEntity.set(entityId, list);
  }
  return byEntity;
}