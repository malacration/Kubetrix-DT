import { useEffect, useMemo, useState } from 'react';
import { ChartProps } from 'app/components/filters/BarChartProps';
import { getServices, getCallServices } from 'app/services/services';
import { extractDbCandidates, DbCandidate } from './dbEntityResolver';

const normalizeRecord = (r: any) => ({
  name: r['entity.name'] ?? r?.name,
  ...r,
});

export type DetectedDatabases = {
  loadingList: boolean;
  dbCandidates: DbCandidate[];
  oracleCandidates: DbCandidate[];
  postgresCandidates: DbCandidate[];
};

// Hook compartilhado entre os widgets "Database KPIs" e "Database Metrics Charts" — ambos
// precisam da mesma detecção (a partir de Services + Called Services outside of the namespace)
// de quais entidades são bancos de dados suportados. Extraído aqui para os dois widgets ficarem
// independentes (ocultar/maximizar cada um separadamente) sem duplicar a consulta de detecção.
export function useDetectedDatabases(filters: ChartProps['filters']): DetectedDatabases {
  const cluster = filters?.cluster?.value;
  const namespace = filters?.namespace?.value;
  const workload = filters?.workload?.value;
  const timeframe = filters?.timeframe?.value;

  const [loadingList, setLoadingList] = useState(false);
  const [dbCandidates, setDbCandidates] = useState<DbCandidate[]>([]);

  useEffect(() => {
    if (!((workload && workload !== 'all') || (namespace && namespace !== 'all'))) {
      setDbCandidates([]);
      return;
    }

    setLoadingList(true);

    Promise.all([
      getServices(cluster, namespace, workload, timeframe),
      getCallServices(cluster, namespace, workload, timeframe),
    ])
      .then(([servicesResult, callServicesResult]) => {
        const records = [
          ...((servicesResult as any)?.records ?? []),
          ...((callServicesResult as any)?.records ?? []),
        ].map(normalizeRecord);

        setDbCandidates(extractDbCandidates(records));
      })
      .finally(() => setLoadingList(false));
  }, [cluster, namespace, workload, timeframe]);

  const oracleCandidates = useMemo(
    () => dbCandidates.filter((c) => c.technology === 'Oracle'),
    [dbCandidates],
  );
  const postgresCandidates = useMemo(
    () => dbCandidates.filter((c) => c.technology === 'PostgreSQL'),
    [dbCandidates],
  );

  return { loadingList, dbCandidates, oracleCandidates, postgresCandidates };
}
