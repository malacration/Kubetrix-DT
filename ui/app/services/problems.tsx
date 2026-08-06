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