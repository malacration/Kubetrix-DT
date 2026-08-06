import { useEffect, useState } from 'react';
import { useTimeFrame } from 'app/components/context/FilterK8sContext';
import { resolvePostgresDatabase, ResolvedPostgresDatabase } from './postgresEntityResolver';

// Hook compartilhado por PostgresDatabaseKpis e PostgresDatabaseMetricsCharts: resolve o
// database real (ver postgresEntityResolver.tsx) uma vez e reaproveita o resultado — evita
// repetir a mesma consulta de resolução em cada bloco.
//
// Retorna:
//   undefined -> ainda resolvendo
//   null      -> nenhuma instância monitorada pela extensão bate com os candidatos
//   { entityName, database } -> ambos os identificadores reais, prontos para uso
export function useResolvedPostgresDatabase(candidateNames: string[]): ResolvedPostgresDatabase | null | undefined {
  const timeframe = useTimeFrame();
  const [resolved, setResolved] = useState<ResolvedPostgresDatabase | null | undefined>(undefined);

  useEffect(() => {
    setResolved(undefined);
    resolvePostgresDatabase(candidateNames, timeframe).then(setResolved);
  }, [candidateNames, timeframe]);

  return resolved;
}
