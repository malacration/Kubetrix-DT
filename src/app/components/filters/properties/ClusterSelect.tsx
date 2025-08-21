import React, {
  useEffect,
  useState,
  forwardRef,
  ForwardedRef,
} from 'react';

import { Option, SelectComponent } from '../../form/Select';
import { getClusters } from 'src/app/services/k8s/kubernetsService';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { useClusterOptions, useClusterSelected, useSetClusterOptions, useSetClusterSelected, useTimeFrame } from '../../context/FilterK8sContext';

interface ClusterSelectionProps {
  timeFrame? : TimeframeV2
  onChange?: (value: string | string[] | null) => void;
}

// Usando forwardRef
const ClusterSelection = React.forwardRef<HTMLDivElement, ClusterSelectionProps>(
  ({ onChange }, ref: ForwardedRef<HTMLDivElement>) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const options = useClusterOptions();
    const setOptions = useSetClusterOptions();
  
    const selected = useClusterSelected();
    const setSelected = useSetClusterSelected();

    const timeFrame = useTimeFrame()

    useEffect(() => {
      setLoading(true)
      const fetchData = async () => {
        try {
          const response = await getClusters(timeFrame);
          const fetched = response.map((item: any) => {
            const label = item['k8s.cluster.name'];
            const value = item['k8s.cluster.name'];
            return new Option(label, value);
          });
          const nextOptions : Array<Option> = fetched == undefined ? [new Option('All', 'all')] : [new Option('All', 'all'), ...fetched];
          setOptions(nextOptions);
            const exists = nextOptions.some(o => o.value === selected);
            if (selected !== 'all' && !exists) {
              const url = new URL(window.location.href);
              url.searchParams.set('cluster', "all");
              window.history.replaceState({}, '', url);
              setSelected("all")
            }
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
          defaultValue={selected}
          options={options}
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

