import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { getNamesSpaces } from 'app/services/k8s/NameSpaceService';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { useClusterSelected, useNamespaceSelected, useSetNamespaceSelected, useTimeFrame } from '../../context/FilterK8sContext';


interface NameSpaceSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
}

export const NameSpaceSelection = forwardRef<HTMLDivElement, NameSpaceSelectionProps>(
  ({ onChange }, ref: ForwardedRef<HTMLDivElement>) => {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [option, setOption] = useState<Array<Option>>([new Option("All","all")]);

    const selected = useNamespaceSelected()
    const setSelected = useSetNamespaceSelected()


    const cluster = useClusterSelected()
    const timeFrame = useTimeFrame()

    useEffect(() => {
      setLoading(true)
      const fetchData = async () => {
        try {
          const response = await getNamesSpaces(cluster,timeFrame);
          const fetched = response.records.map((item: any) => {
              const label = item["name"];
              const value = item["name"];
              return new Option(label, value);
            });
          const nextOptions = [new Option('All', 'all'), ...fetched];

          const exists = nextOptions.some(o => o.value == selected);
          if (selected !== 'all' && !exists) {
            setSelected("all")
            const url = new URL(window.location.href);
            url.searchParams.set('namespace', "all");
            window.history.replaceState({}, '', url);
            onChange("all")
          }
          setOption(nextOptions);
        } catch (err: any) {
          console.error("Erro ao buscar métricas:", err);
          setError(err.message || "Erro desconhecido");
        } finally {
          setLoading(false);
        }
      };
        fetchData();
      }, [cluster,timeFrame]);

    return( 
        <div ref={ref}>
            <SelectComponent 
                defaultValue={selected}
                options={option}
                loading={loading}
                clearable={false}
                onChange={onChange} />
        </div>
    )

})

// @ts-expect-error pede displayname e depois nao reconhece
NameSpaceSelection.displayName = 'NameSpaceSelection';