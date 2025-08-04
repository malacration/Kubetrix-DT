import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { getWorkloads } from 'src/app/services/k8s/WorkloadService';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';


interface WorkloadSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
  timeFrame?: TimeframeV2
  nameSpace : string;
  k8sName : string;
}

export const WorkloadsSelection = forwardRef<HTMLDivElement, WorkloadSelectionProps>( 
  ({ nameSpace, k8sName, onChange, timeFrame },ref: ForwardedRef<HTMLDivElement> ) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [option, setOption] = useState<Array<Option>>([new Option("All","all")]);
    
    const initialParams = new URLSearchParams(window.location.search);

    useEffect(() => {
      setLoading(true)
      const fetchData = async () => {
        try {
          const response = await getWorkloads(k8sName,nameSpace,timeFrame);
          const options = response.map((item: string) => {
              return new Option(item, item);
          });
          setOption([new Option('All', 'all'), ...options]);
        } catch (err: any) {
          console.error("Erro ao buscar métricas:", err);
          setError(err.message || "Erro desconhecido");
        } finally {
          setLoading(false);
        }
      };
        fetchData();
      }, [k8sName,nameSpace,timeFrame]);

    return( 
        <div ref={ref}>
            <SelectComponent
                defaultValue={initialParams.get('workload')   ?? 'all'}
                options={option}
                loading={loading}
                clearable={false}
                onChange={onChange} />
        </div>
    )

})

// @ts-expect-error pede displayname e depois nao reconhece
WorkloadsSelection.displayName = 'WorkloadsSelection';