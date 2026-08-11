import Colors from '@dynatrace/strato-design-tokens/colors';

// Paleta de cores compartilhada por todos os TimeseriesChart do app. Sem isso, cada gráfico
// deixava a cor a cargo da paleta categórica automática da lib, que atribui cor por ORDEM da
// série no array — então o mesmo papel semântico (métrica atual, baseline de N dias atrás,
// throttle) saía com uma cor diferente em cada gráfico, dependendo de quantas séries vinham
// antes dela. Aqui a cor é sempre amarrada ao PAPEL da série, não à posição.
export const CHART_COLORS = {
  /** Série principal / valor atual (uso de CPU, throughput, tempo de resposta, métrica de banco...). */
  current: Colors.Charts.Categorical.Color01.Default,
  /** Comparação com histórico ("Baseline (21d)"). */
  baseline: Colors.Charts.Categorical.Color05.Default,
  /** Throttle, erros, degradação. */
  critical: Colors.Charts.Status.Critical.Default,
  /** Linha de limite/threshold (request/limit de CPU e memória no K8s). */
  threshold: Colors.Charts.Threshold.Bad.Default,
} as const;

/**
 * Rótulo padrão da série de comparação histórica — mesmo texto em todos os gráficos
 * (Throughput, CPU, Memória, Response Time). Reflete a janela real usada: média de
 * 7/14/21 dias atrás (mesma janela dos KPIs — ver classicBaseLineBy/responseTime),
 * não só 7 dias. Se a janela mudar de novo, atualizar aqui também.
 */
export const BASELINE_LABEL = 'Baseline (21d)';

/**
 * Monta o colorPalette (Record nome→cor) de um gráfico "métrica atual + baseline",
 * o padrão mais comum no app (CPU/Memory/Throughput/Response Time por workload).
 */
export function currentBaselinePalette(currentSeriesName: string): Record<string, string> {
  return {
    [currentSeriesName]: CHART_COLORS.current,
    [BASELINE_LABEL]: CHART_COLORS.baseline,
  };
}
