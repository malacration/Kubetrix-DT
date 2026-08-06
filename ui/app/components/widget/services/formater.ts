import { format as uformat, units } from '@dynatrace-sdk/units';

export const timeFormatter = {
    input: units.time.microsecond,
    output: units.time.millisecond,
    abbreviate: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
}

export const countFormatter = {
    abbreviate: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
}


export function microToMileSeconds(valueInMicros){
    return uformat(valueInMicros, {
        input: units.time.microsecond,
        output: units.time.millisecond,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        abbreviate: false,
    })
}



export function countAbreviation(valueInMicros){
    return uformat(valueInMicros, {
        abbreviate: true,
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
    })
}

/** Formata uma fatia 0–1 (ex.: throughputShare, loadShare) como percentual. */
export function shareFormatter(value: number): string {
    if (value == null || Number.isNaN(value)) return '-';
    return `${(value * 100).toFixed(1)}%`;
}

/**
 * Formata o impacto marginal de latência (microssegundos, pode ser negativo)
 * com sinal explícito: "+" = puxa a média geral para cima, "−" = para baixo.
 */
export function latencyImpactFormatter(valueInMicros: number): string {
    if (valueInMicros == null || Number.isNaN(valueInMicros)) return '-';
    if (valueInMicros === 0) return microToMileSeconds(0);
    const sign = valueInMicros > 0 ? '+' : '−';
    return `${sign}${microToMileSeconds(Math.abs(valueInMicros))}`;
}