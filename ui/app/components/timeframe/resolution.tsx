import { differenceInCalendarDays, differenceInHours } from 'date-fns';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { Option } from '../form/Select';

/** Options shown in the resolution filter. "auto" reuses {@link pickResolution}. */
export const RESOLUTION_OPTIONS: Option[] = [
  new Option('Auto', 'auto'),
  new Option('1 minute', '1m'),
  new Option('5 minutes', '5m'),
  new Option('10 minutes', '10m'),
  new Option('30 minutes', '30m'),
  new Option('1 hour', '1h'),
  new Option('6 hours', '6h'),
  new Option('1 day', '1d'),
];

/** Menor resolução aceita pela Metrics API v2 (Classic e Grail): 1 minuto. */
export const MIN_RESOLUTION_MS = 60_000;

/** Limite de pontos por série ("tuple") da Metrics API v2 — acima disso a API só processa os primeiros. */
export const MAX_DATAPOINTS_PER_SERIES = 10_080;

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

function resolutionToMs(res: string): number {
  const match = res.match(/^(\d+)([smhd])$/);
  if (!match) return MIN_RESOLUTION_MS;
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

function msToResolution(ms: number): string {
  if (ms >= UNIT_MS.d && ms % UNIT_MS.d === 0) return `${ms / UNIT_MS.d}d`;
  if (ms >= UNIT_MS.h && ms % UNIT_MS.h === 0) return `${ms / UNIT_MS.h}h`;
  return `${Math.max(1, Math.round(ms / UNIT_MS.m))}m`;
}

function timeframeRangeMs(timeframe?: Timeframe): number {
  if (!timeframe?.from?.absoluteDate) return 0;
  const from = new Date(timeframe.from.absoluteDate).getTime();
  const to = timeframe?.to?.absoluteDate ? new Date(timeframe.to.absoluteDate).getTime() : Date.now();
  return Math.max(0, to - from);
}

/**
 * Ajusta a resolução desejada aos limites reais da Dynatrace Metrics API v2:
 * nunca mais fina que 1 minuto, e nunca fina o bastante para estourar o limite
 * de 10.080 pontos por série no intervalo selecionado (a API trunca em vez de
 * coalescer automaticamente, então o ajuste é feito aqui antes do request).
 */
export function clampResolutionToApiLimits(resolution: string, timeframe?: Timeframe): string {
  let ms = Math.max(resolutionToMs(resolution), MIN_RESOLUTION_MS);

  const rangeMs = timeframeRangeMs(timeframe);
  if (rangeMs > 0) {
    const minMsForRange = Math.ceil(rangeMs / MAX_DATAPOINTS_PER_SERIES);
    ms = Math.max(ms, minMsForRange);
  }

  return msToResolution(ms);
}

export function resolutionForDays(days: number): string {
    if (days <= 14) return '1m';       // ≤ 14 dias → 1 min
    if (days <= 28) return '5m';       // ≤ 28 dias → 5 min
    if (days <= 400) return '1h';      // ≤ 400 dias → 1 h
    return '1d';                       // > 400 dias → 1 dia
  }
    

  /**
   * @param manualResolution Override vindo da seleção do usuário ("1m", "5m", ...).
   *   Passe "auto" (ou omita) para manter o cálculo automático abaixo. Em ambos
   *   os casos o resultado final é ajustado aos limites reais da API — ver
   *   {@link clampResolutionToApiLimits}.
   */
  export function pickResolution(
    extraDays: number,
    timeframe?: Timeframe,
    manualResolution?: string,
  ): string {
    if (manualResolution && manualResolution !== 'auto') {
      return clampResolutionToApiLimits(manualResolution, timeframe);
    }

    // 1. calcula quantos dias o dado mais antigo está distante de hoje
    let diffDias = 0;
    let diffHour = 0

    if (timeframe?.from?.absoluteDate) {
      const from = new Date(timeframe.from.absoluteDate);
      const to   = timeframe?.to?.absoluteDate
        ? new Date(timeframe.to.absoluteDate)
        : new Date();

      diffDias += Math.max(
        0,
        differenceInCalendarDays(to, from),
      );
      diffHour = Math.max(
        0,
        differenceInHours(to, from),
      );
    }
    const daysSpan = extraDays + diffDias

    let auto: string;
    if (daysSpan < 14)
      auto = '1m';
    else if (daysSpan < 28 && diffDias < 1)
      auto = '5m';
    else if (daysSpan < 28 && diffHour > 10 && diffDias < 2)
      auto = '10m';
    else if (daysSpan < 28 && diffDias >= 2)
      auto = '30m';
    else if (daysSpan < 400)
      auto = '1h';
    else
      auto = '1d';

    return clampResolutionToApiLimits(auto, timeframe);
  }

  /** Menor resolução aceita para séries de baseline (comparação com histórico). */
  export const MIN_BASELINE_RESOLUTION_MS = 5 * UNIT_MS.m;

  /**
   * Resolução para séries de baseline (média/mediana de N dias atrás, ex.: 7/14/21
   * dias). Nunca mais fina que 5 minutos — baseline é uma referência suavizada de
   * comparação, não a série principal que o usuário está inspecionando, e uma
   * resolução muito fina nela é mais ruído estatístico do que sinal útil.
   *
   * Isso vale mesmo com uma resolução manual escolhida pelo usuário no filtro
   * "Resolution": esse piso é uma decisão de qualidade estatística da baseline,
   * independente de qual resolução ele quer ver na série "now".
   *
   * Substitui o antigo padrão de somar "dias extras" fictícios em pickResolution
   * (ex.: pickResolution(21, ...)) só para empurrar o resultado para 5m — esse
   * truque é frágil (depende de acertar o número mágico certo) e já causou uma
   * regressão real nesta base de código quando o padding foi ajustado por outro
   * motivo. Este helper deixa a regra explícita.
   */
  export function pickBaselineResolution(timeframe?: Timeframe, manualResolution?: string): string {
    const computed = pickResolution(0, timeframe, manualResolution);
    const ms = Math.max(resolutionToMs(computed), MIN_BASELINE_RESOLUTION_MS);
    return msToResolution(ms);
  }