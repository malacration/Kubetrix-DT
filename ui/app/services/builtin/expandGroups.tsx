const IGNORE_GROUP_AFTER = new Set<string>([
  'rollup', 'fold', 'splitBy', 'timeshift', 'default',
  // adicione aqui se precisar: 'limit', 'sort', 'filter', ...
]);

function hasTopLevelComma(s: string): boolean {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') d++;
    else if (c === ')') d--;
    else if (c === ',' && d === 0) return true;
  }
  return false;
}

function splitTopLevelByComma(s: string): string[] {
  const out: string[] = [];
  let buf = '';
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') { d++; buf += c; }
    else if (c === ')') { d--; buf += c; }
    else if (c === ',' && d === 0) { out.push(buf.trim()); buf = ''; }
    else { buf += c; }
  }
  out.push(buf.trim());
  return out;
}

function cartProd(prefixes: string[], parts: string[]): string[] {
  const out: string[] = [];
  for (const p of prefixes) for (const s of parts) out.push(p + s);
  return out;
}

export function expandGroups(input: string): string[] {
  if (!input.includes('(')) return [input];

  let results: string[] = [''];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (ch !== '(') {
      const next = input.indexOf('(', i);
      const literal = input.slice(i, next === -1 ? n : next);
      results = results.map(prefix => prefix + literal);
      i = next === -1 ? n : next;
      continue;
    }

    // achar o ')', suportando aninhamento
    let j = i + 1, depth = 1;
    while (j < n && depth > 0) {
      const c = input[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      j++;
    }
    if (depth !== 0) throw new Error('Parênteses desbalanceados na string de entrada.');

    const inside = input.slice(i + 1, j - 1);

    // token imediatamente antes do '('
    let t = i - 1;
    while (t >= 0 && /\s/.test(input[t])) t--;
    let start = t;
    while (start >= 0 && /[A-Za-z0-9_]/.test(input[start])) start--;
    const prevToken = input.slice(start + 1, t + 1).toLowerCase();

    // Expande o "inside" recursivamente, para não perder grupos internos
    const insideExpanded = expandGroups(inside);

    // 1) Se é um "parêntese de função" (fold, splitBy, ...), mantenha os parênteses
    if (prevToken && IGNORE_GROUP_AFTER.has(prevToken)) {
      const withParens = insideExpanded.map(s => `(${s})`);
      results = cartProd(results, withParens);
      i = j;
      continue;
    }

    // 2) Se NÃO há vírgula de nível superior, é parêntese de precedência -> preserva
    if (!hasTopLevelComma(inside)) {
      const withParens = insideExpanded.map(s => `(${s})`);
      results = cartProd(results, withParens);
      i = j;
      continue;
    }

    // 3) Caso contrário, é um grupo expansível "(a,b,...)"
    const choices = splitTopLevelByComma(inside);
    let nextResults: string[] = [];
    for (const choice of choices) {
      // cada choice também pode conter grupos
      const expandedChoice = expandGroups(choice);
      nextResults = nextResults.concat(cartProd(results, expandedChoice));
    }
    results = nextResults;
    i = j;
  }

  return results;
}
