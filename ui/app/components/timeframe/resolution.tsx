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

export function resolutionToMs(res: string): number {
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

  /**
   * Resolução mínima (mais grossa) que garante dado disponível pra uma consulta que
   * alcança até `maxShiftDays` dias atrás do INÍCIO do timeframe selecionado — o
   * "piso de disponibilidade de dado" que uma baseline de 7/14/21 dias sempre tem
   * que respeitar. A Metrics API só mantém granularidade fina (1 minuto) pros
   * primeiros ~14 dias de histórico; além disso os dados já vêm pré-agregados mais
   * grosso, e pedir uma resolução fina demais pra essa idade simplesmente não
   * retorna nada (é por isso que a baseline "sumia" com um timeframe de 7 dias: 7
   * dias de "now" + até 21 dias de shift = dado de até 28 dias atrás, fora da
   * janela de granularidade fina).
   *
   * SEMPRE calculado em modo automático (ignora resolução manual) — é um limite
   * técnico da API, não uma preferência do usuário. Reaproveita os mesmos degraus
   * de {@link pickResolution} (14/28/400 dias), como se "now" tivesse os dias do
   * timeframe selecionado MAIS os `maxShiftDays` que o shift mais distante alcança.
   */
  export function dataAvailabilityFloor(timeframe?: Timeframe, maxShiftDays = 21): string {
    return pickResolution(maxShiftDays, timeframe, 'auto');
  }

  /**
   * Resolução para séries de baseline (média/mediana de N dias atrás — 7/14/21 por
   * padrão, ver classicBaseLineBy/responseTime).
   *
   * Diferente de {@link pickResolution}, uma resolução manual aqui NÃO tem
   * prioridade absoluta: ela só é respeitada se ainda for igual ou mais grossa que
   * {@link dataAvailabilityFloor}. Pedir uma resolução manual fina demais pra
   * baseline nunca traz dado nenhum (não é uma questão de preferência, é um limite
   * técnico), então preferimos subir pra uma resolução mais grossa a mostrar a
   * baseline vazia.
   */
  export function pickBaselineResolution(
    timeframe?: Timeframe,
    manualResolution?: string,
    maxShiftDays = 21,
  ): string {
    const floor = dataAvailabilityFloor(timeframe, maxShiftDays);

    if (!manualResolution || manualResolution === 'auto') {
      return floor;
    }

    const manualClamped = clampResolutionToApiLimits(manualResolution, timeframe);
    return resolutionToMs(manualClamped) >= resolutionToMs(floor) ? manualClamped : floor;
  }

  /**
   * Quantas vezes a resolução da baseline é mais grossa que a de "now" (>= 1).
   * Necessário só pra métricas de SOMA (ex.: Throughput): como a baseline pode
   * calcular numa resolução mais grossa que "now" (ver pickBaselineResolution), um
   * bucket de Nx o tamanho de um bucket de "now" soma ~Nx o valor pela própria
   * natureza da soma — então o valor de cada ponto da baseline precisa ser
   * dividido por essa razão antes de comparar com "now", senão a baseline aparece
   * artificialmente maior/menor mesmo com a taxa real idêntica. Métricas de média
   * (CPU, memória, tempo de resposta) não precisam dessa renormalização — média já
   * é praticamente invariante ao tamanho do bucket.
   */
  export function resolutionRatio(coarser: string, finer: string): number {
    return resolutionToMs(coarser) / resolutionToMs(finer);
  }

  /** Degraus nomeados de resolução, do mais fino ao mais grosso — usado pra achar "um degrau mais fino que X". */
  const RESOLUTION_LADDER = ['1m', '5m', '10m', '30m', '1h', '6h', '1d'] as const;

  function oneStepFiner(res: string): string {
    const ms = resolutionToMs(res);
    const idx = RESOLUTION_LADDER.findIndex((r) => resolutionToMs(r) >= ms);
    const finerIdx = idx === -1 ? RESOLUTION_LADDER.length - 1 : Math.max(0, idx - 1);
    return RESOLUTION_LADDER[finerIdx];
  }

  /**
   * Calcula as resoluções de "now" e baseline juntas, garantindo que não fiquem
   * absurdamente distantes uma da outra em modo automático — ex.: se a baseline
   * precisa subir pra 1h (dado de 28 dias, ver dataAvailabilityFloor), "now" não
   * fica mais fina que 30 minutos (um degrau mais fino que a baseline), mesmo que
   * o timeframe selecionado, isolado, permitisse 1 minuto. Sem isso, "now" fica
   * espicada em 1min do lado de uma baseline lisa em 1h, o que é confuso de
   * comparar visualmente mesmo depois de renormalizada (Throughput).
   *
   * Com resolução manual, o piso de "now" não se aplica — a escolha do usuário pra
   * "now" é sempre atendível (ela não olha tão longe no passado quanto a
   * baseline), então é respeitada como está.
   */
  export function pickPairedResolutions(
    timeframe?: Timeframe,
    manualResolution?: string,
    maxShiftDays = 21,
  ): { now: string; baseline: string } {
    const baseline = pickBaselineResolution(timeframe, manualResolution, maxShiftDays);
    let now = pickResolution(0, timeframe, manualResolution);

    if (!manualResolution || manualResolution === 'auto') {
      const floor = oneStepFiner(baseline);
      if (resolutionToMs(now) < resolutionToMs(floor)) {
        now = floor;
      }
    }

    return { now, baseline };
  }

  /**
   * Filtra RESOLUTION_OPTIONS pras opções que realmente retornam dado no timeframe
   * selecionado — esconde qualquer resolução mais fina que
   * {@link dataAvailabilityFloor}, que sempre estouraria vazia pelo menos na
   * baseline. "Auto" nunca é escondida.
   */
  export function availableResolutionOptions(timeframe?: Timeframe, maxShiftDays = 21): Option[] {
    const floorMs = resolutionToMs(dataAvailabilityFloor(timeframe, maxShiftDays));
    return RESOLUTION_OPTIONS.filter((o) => o.value === 'auto' || resolutionToMs(o.value) >= floorMs);
  }