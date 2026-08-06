// Resolve o nome "cru" de um SERVICE do tipo DATABASE_SERVICE (ex: "db_modulogabinete.tjro.net")
// para o(s) identificador(es) reais usados pelas extensões de monitoramento de banco
// (Oracle: nome da PDB / container.name | PostgreSQL: nome do database).
//
// Isso é necessário porque o SERVICE (visão client-side, criada pelo OneAgent a partir da
// chamada de rede) tem um nome sintético, enquanto a extensão de banco (Grail/Classic)
// identifica a instância pelo nome real do database/PDB, que nem sempre é igual.
//
// Confirmado contra o tenant real (agosto/2026):
//   Oracle:      db_modulogabinete.tjro.net  -> PDB "MODULOGABINETE"
//                db_drsaudiencias            -> PDB "DRSAUDIENCIAS"
//                pdb_transcricao.tjro.net    -> PDB "PDB_TRANSCRICAO" (aqui o prefixo é parte do nome real)
//   PostgreSQL:  entity.name já costuma ser igual ao nome do database (ex: "pjesg", "db_n8n").
//
// Como não há garantia de que o prefixo "db_"/"pdb_" deve ou não ser removido em todos os
// casos, geramos uma LISTA de candidatos e deixamos a query (Oracle via Grail `in(...)`,
// Postgres tentando o candidato mais provável primeiro) decidir qual bate com dados reais.

export type DbTechnology = 'Oracle' | 'PostgreSQL' | 'MySQL' | 'SQL Server' | 'MongoDB';

export const SUPPORTED_DB_TECHNOLOGIES: DbTechnology[] = ['Oracle', 'PostgreSQL'];

export type DbCandidate = {
  id: string;
  name: string;
  technology: DbTechnology;
  candidateNames: string[];
};

function stripQuotes(name: string): string {
  return (name ?? '').replace(/^['"]+|['"]+$/g, '').trim();
}

function withoutDomainSuffix(name: string): string {
  return name.split('.')[0];
}

function buildOracleCandidates(rawName: string): string[] {
  const name = stripQuotes(rawName);
  const withoutDomain = withoutDomainSuffix(name);
  const withoutDbPrefix = withoutDomain.replace(/^db_/i, '');

  const candidates = new Set<string>();
  candidates.add(withoutDbPrefix.toUpperCase());
  candidates.add(withoutDomain.toUpperCase());
  candidates.add(name.toUpperCase());
  return Array.from(candidates).filter(Boolean);
}

function buildPostgresCandidates(rawName: string): string[] {
  const name = stripQuotes(rawName);
  const withoutDomain = withoutDomainSuffix(name);
  const withoutDbPrefix = withoutDomain.replace(/^db_/i, '');

  const candidates = new Set<string>();
  candidates.add(name);
  candidates.add(withoutDomain);
  candidates.add(withoutDbPrefix);
  candidates.add(withoutDomain.toLowerCase());
  return Array.from(candidates).filter(Boolean);
}

export function isSupportedDbTechnology(technology?: string): technology is DbTechnology {
  return !!technology && (SUPPORTED_DB_TECHNOLOGIES as string[]).includes(technology);
}

export function buildCandidateNames(technology: DbTechnology, rawServiceName: string): string[] {
  switch (technology) {
    case 'Oracle':
      return buildOracleCandidates(rawServiceName);
    case 'PostgreSQL':
      return buildPostgresCandidates(rawServiceName);
    default:
      return [stripQuotes(rawServiceName)];
  }
}

/**
 * Recebe os registros já normalizados vindos de getServices()/getCallServices()
 * (cada um com pelo menos { id ou lookupId, name, serviceTechnologyTypes })
 * e retorna a lista deduplicada de instâncias de banco de dados suportadas.
 */
export function extractDbCandidates(records: any[]): DbCandidate[] {
  const byKey = new Map<string, DbCandidate>();

  (records ?? []).forEach((r) => {
    const technology: string | undefined = r?.serviceTechnologyTypes?.[0];
    if (!isSupportedDbTechnology(technology)) return;

    const rawName: string = r?.name ?? r?.['entity.name'] ?? '';
    const id: string = r?.id ?? r?.lookupId ?? rawName;
    if (!rawName) return;

    const key = `${technology}::${stripQuotes(rawName).toUpperCase()}`;
    if (byKey.has(key)) return;

    byKey.set(key, {
      id,
      name: stripQuotes(rawName),
      technology,
      candidateNames: buildCandidateNames(technology, rawName),
    });
  });

  return Array.from(byKey.values());
}
