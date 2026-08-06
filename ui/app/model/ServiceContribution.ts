// Métricas de "contribuição para o todo" de um serviço dentro de uma categoria
// (ex.: Services vs. Called Services outside of the namespace). As três métricas
// combinam currCount (throughput) e currResponse (tempo de resposta) de formas
// diferentes — ver documentação completa em
// ui/app/pages/dashboards/ServiceContributionDocs.tsx (rota /dashboards/service-contribution-docs).
//
// IMPORTANTE: os totais usados nos cálculos são sempre a soma do próprio array
// `rows` recebido. Cada categoria (Services, CallServices) deve chamar esta
// função com a SUA PRÓPRIA lista — nunca combine as duas antes de calcular,
// senão a contribuição de um serviço "vaza" para a soma da outra categoria.

export interface ContributionInput {
  currCount?: number | null;
  currResponse?: number | null;
}

export interface ServiceContribution {
  /** Fatia do throughput total da categoria (0–1): currCount_i / Σ currCount. */
  throughputShare: number;
  /**
   * Fatia da carga total da categoria (0–1), no sentido da Lei de Little
   * (L = λ·W): (currCount_i × currResponse_i) / Σ (currCount × currResponse).
   * Quanto da "concorrência"/capacidade consumida do sistema pertence a este
   * serviço — um serviço lento e raro pode pesar tanto quanto um rápido e
   * frequente.
   */
  loadShare: number;
  /**
   * Impacto marginal na latência média da categoria, na mesma unidade de
   * currResponse: quanto a média mudaria se este serviço fosse removido do
   * cálculo (totalAvg - avgSemEste). Positivo = este serviço está puxando a
   * média geral para cima; negativo = está puxando para baixo.
   */
  latencyImpact: number;
}

export function withServiceContributions<T extends ContributionInput>(
  rows: T[],
): Array<T & ServiceContribution> {
  const totalCount = rows.reduce((sum, r) => sum + (r.currCount ?? 0), 0);
  const totalLoad = rows.reduce((sum, r) => sum + (r.currCount ?? 0) * (r.currResponse ?? 0), 0);
  const totalAvgResponse = totalCount > 0 ? totalLoad / totalCount : 0;

  return rows.map((r) => {
    const count = r.currCount ?? 0;
    const response = r.currResponse ?? 0;
    const load = count * response;

    const throughputShare = totalCount > 0 ? count / totalCount : 0;
    const loadShare = totalLoad > 0 ? load / totalLoad : 0;

    const remainingCount = totalCount - count;
    const remainingLoad = totalLoad - load;
    const avgWithout = remainingCount > 0 ? remainingLoad / remainingCount : 0;
    const latencyImpact = totalAvgResponse - avgWithout;

    return { ...r, throughputShare, loadShare, latencyImpact };
  });
}
