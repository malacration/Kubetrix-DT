import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { getWorkloads } from 'src/app/services/k8s/WorkloadService';
import { useClusterSelected, useNamespaceSelected, useSetWorkloadSelected, useTimeFrame, useWorkloadSelected } from '../../context/FilterK8sContext';

interface WorkloadSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
}

export const WorkloadsSelection = forwardRef<HTMLDivElement, WorkloadSelectionProps>(
  ({ onChange }, ref: ForwardedRef<HTMLDivElement>) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [options, setOptions] = useState<Array<Option>>([new Option('All', 'all')]);
    
    const selected = useWorkloadSelected()
    const setSelected = useSetWorkloadSelected()

    const namespace = useNamespaceSelected()
    const cluster = useClusterSelected()
    const timeFrame = useTimeFrame()

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      const fetchData = async () => {
        try {
          const response = await getWorkloads(cluster, namespace, timeFrame);
          const fetched = response.map((item: string) => new Option(item, item));
          const nextOptions = [new Option('All', 'all'), ...fetched];
          if (!cancelled) {
            const exists = nextOptions.some(o => o.value === selected);
            if (selected !== 'all' && !exists) {
              setSelected("all")
              const url = new URL(window.location.href);
              url.searchParams.set('workload', "all");
              window.history.replaceState({}, '', url);
              onChange("all")
            }

            setOptions(nextOptions);
          }
        } catch (err: any) {
          console.error('Erro ao buscar workloads:', err);
          if (!cancelled) setError(err.message || 'Erro desconhecido');
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      fetchData();
      return () => { cancelled = true; };
    }, [cluster, namespace, timeFrame]);

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
WorkloadsSelection.displayName = 'WorkloadsSelection';
