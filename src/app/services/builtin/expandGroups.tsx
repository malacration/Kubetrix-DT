const IGNORE_GROUP_AFTER = new Set<string>([
  'rollup', 'fold', 'splitBy', 'timeshift', 'default',
  // adicione aqui se precisar: 'limit', 'sort', 'filter', ...
]);


export function expandGroups(input: string): string[] {
  if (!input.includes('(')) return [input];

  let results: string[] = [''];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (ch !== '(') {
      // Copia literal até o próximo '(' (ou fim)
      const next = input.indexOf('(', i);
      const literal = input.slice(i, next === -1 ? n : next);
      results = results.map(prefix => prefix + literal);
      i = next === -1 ? n : next;
      continue;
    }

    // Encontrar o parêntese que fecha, suportando aninhamento
    let j = i + 1;
    let depth = 1;
    while (j < n && depth > 0) {
      const c = input[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      j++;
    }
    if (depth !== 0) {
      throw new Error('Parênteses desbalanceados na string de entrada.');
    }

    // Conteúdo interno (sem os parênteses)
    const inside = input.slice(i + 1, j - 1);

    // Detecta token imediatamente antes do '(' (ex.: "rollup" em ":rollup(any)")
    let t = i - 1;
    while (t >= 0 && /\s/.test(input[t])) t--;
    let start = t;
    while (start >= 0 && /[A-Za-z0-9_]/.test(input[start])) start--;
    const prevToken = input.slice(start + 1, t + 1).toLowerCase();

    if (prevToken && IGNORE_GROUP_AFTER.has(prevToken)) {
      const literalParens = `(${inside})`;
      results = results.map(prefix => prefix + literalParens);
      i = j; // segue após ')'
      continue;
    }

    // Divide por vírgulas de nível superior (respeitando aninhamentos)
    const choices: string[] = [];
    {
      let buf = '';
      let d = 0;
      for (let k = 0; k < inside.length; k++) {
        const c = inside[k];
        if (c === '(') { d++; buf += c; }
        else if (c === ')') { d--; buf += c; }
        else if (c === ',' && d === 0) { choices.push(buf.trim()); buf = ''; }
        else { buf += c; }
      }
      choices.push(buf.trim());
    }

    // Produto cartesiano entre os prefixos atuais e as escolhas do grupo
    const nextResults: string[] = [];
    for (const prefix of results) {
      for (const choice of choices) {
        nextResults.push(prefix + choice);
      }
    }
    results = nextResults;
    i = j; // continua após ')'
  }

  return results;
}
