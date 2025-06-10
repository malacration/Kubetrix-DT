import { differenceInCalendarDays, differenceInHours } from 'date-fns';
import type { TimeframeV2 } from '@dynatrace/strato-components-preview/core';



export function resolutionForDays(days: number): string {
    if (days <= 14) return '1m';       // ≤ 14 dias → 1 min
    if (days <= 28) return '5m';       // ≤ 28 dias → 5 min
    if (days <= 400) return '1h';      // ≤ 400 dias → 1 h
    return '1d';                       // > 400 dias → 1 dia
  }
    

  export function pickResolution(
    extraDays: number,
    timeframe?: TimeframeV2,
  ): string {
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

    if (daysSpan < 14)
      return '1m';
    if (daysSpan < 28 && diffDias < 1)
      return '5m';
    
    if (daysSpan < 28 && diffHour > 10 && diffDias < 2)
      return '10m';
    
    if (daysSpan < 28 && diffDias >= 2)
      return '30m';

    if (daysSpan < 400)
      return '1h';
    return '1d';
  }
  