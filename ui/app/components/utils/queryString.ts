import { Timeframe } from "@dynatrace/strato-components-preview";

export function tfToQuery(tf: Timeframe) {
    return `${tf.from}-${tf.to}`;          // ex.: 1627683600-1627690800
  }
  
  export function tfFromQuery(s?: string | null): Timeframe | undefined {
    if (!s) return undefined;
    const [from, to] = s.split('-').map(Number);
    if (Number.isNaN(from) || Number.isNaN(to)) return undefined;
    return { from, to } as Timeframe;
  }
  