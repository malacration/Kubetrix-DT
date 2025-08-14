import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { getWorkloads } from 'src/app/services/k8s/WorkloadService';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';

interface WorkloadSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
  timeFrame?: TimeframeV2;
  nameSpace: string;
  k8sName: string;
  selected?: string;
}

export const WorkloadsSelection = forwardRef<HTMLDivElement, WorkloadSelectionProps>(
  ({ nameSpace, k8sName, onChange, timeFrame, selected = 'all' }, ref: ForwardedRef<HTMLDivElement>) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [options, setOptions] = useState<Array<Option>>([new Option('All', 'all')]);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);

      const fetchData = async () => {
        try {
          const response = await getWorkloads(k8sName, nameSpace, timeFrame);
          const fetched = response.map((item: string) => new Option(item, item));
          const nextOptions = [new Option('All', 'all'), ...fetched];

          if (!cancelled) {
            setOptions(nextOptions);

            // Se o valor atual não existir no novo namespace, reseta para 'all'
            const exists = nextOptions.some(o => o.value === selected);
            if (selected !== 'all' && !exists) {
              onChange?.('all'); // avisa o FilterBar/pai
            }
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
    }, [k8sName, nameSpace, timeFrame, selected, onChange]);

    return (
      <div ref={ref}>
        <SelectComponent
          value={selected ?? 'all'}   // <-- CONTROLADO
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
