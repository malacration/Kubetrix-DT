export function tfToQuery(tf: TimeframeV2) {
    return `${tf.from}-${tf.to}`;          // ex.: 1627683600-1627690800
  }
  
  export function tfFromQuery(s?: string | null): TimeframeV2 | undefined {
    if (!s) return undefined;
    const [from, to] = s.split('-').map(Number);
    if (Number.isNaN(from) || Number.isNaN(to)) return undefined;
    return { from, to } as TimeframeV2;
  }
  