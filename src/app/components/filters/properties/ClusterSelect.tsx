import React, {
  useEffect,
  useState,
  forwardRef,
  ForwardedRef,
} from 'react';

import { Option, SelectComponent } from '../../form/Select';
import { getClusters } from 'src/app/services/k8s/kubernetsService';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';

interface ClusterSelectionProps {
  timeFrame? : TimeframeV2
  onChange?: (value: string | string[] | null) => void;
}

// Usando forwardRef
const ClusterSelection = React.forwardRef<HTMLDivElement, ClusterSelectionProps>(
  ({ onChange, timeFrame }, ref: ForwardedRef<HTMLDivElement>) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [option, setOption] = useState<Array<Option>>([
      new Option('All', 'all'),
    ]);

    const initialParams = new URLSearchParams(window.location.search);


    useEffect(() => {
      const fetchData = async () => {
        try {
            const response = await getClusters(timeFrame);
            const clusterOptions = response.map((item: any) => {
            const label = item['k8s.cluster.name'];
            const value = item['k8s.cluster.name'];
            return new Option(label, value);
          });
          setOption([new Option('All', 'all'), ...clusterOptions]);
        } catch (err: any) {
          console.error('Erro ao buscar métricas:', err);
          setError(err.message || 'Erro desconhecido');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [timeFrame]);

    return (
      <div ref={ref}>
        <SelectComponent
          defaultValue={initialParams.get('cluster')   ?? 'all'}
          options={option}
          loading={loading}
          clearable={false}
          onChange={onChange}
        />
      </div>
    );
  }
);

// @ts-expect-error pede displayname e depois nao reconhece
// Nome do componente para debug
ClusterSelection.displayName = 'ClusterSelection';


export { ClusterSelection };

