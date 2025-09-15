/**
 * Expande grupos entre parênteses, ex.: "a.(b,c).d" -> ["a.b.d", "a.c.d"]
 * Se não houver parênteses, retorna [input].
 */
export function expandGroups(input: string): string[] {
  // Resultado parcial enquanto percorremos a string
  let results: string[] = [''];
  let i = 0;

  const n = input.length;
  while (i < n) {
    const ch = input[i];

    if (ch !== '(') {
      // Anexa trecho literal até o próximo '(' (ou fim)
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
      if (input[j] === '(') depth++;
      else if (input[j] === ')') depth--;
      j++;
    }
    if (depth !== 0) {
      throw new Error('Parênteses desbalanceados na string de entrada.');
    }

    // Conteúdo interno sem os parênteses
    const inside = input.slice(i + 1, j - 1);

    // Divide por vírgulas de nível superior (respeitando possíveis aninhamentos)
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
