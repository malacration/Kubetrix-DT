import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../form/Select';
import { getNamesSpaces } from 'src/app/services/k8s/NameSpaceService';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';


interface NameSpaceSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
  timeFrame? : TimeframeV2
  k8sName : string
}

export const NameSpaceSelection = forwardRef<HTMLDivElement, NameSpaceSelectionProps>(
  ({ k8sName, onChange, timeFrame }, ref: ForwardedRef<HTMLDivElement>) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [option, setOption] = useState<Array<Option>>([new Option("All","all")]);

    useEffect(() => {
      setLoading(true)
      const fetchData = async () => {
        try {
          const response = await getNamesSpaces(k8sName,timeFrame);
          const clusterOptions = response.data.records.map((item: any) => {
              const label = item["name"];
              const value = item["name"];
              return new Option(label, value);
            });
          setOption(clusterOptions);

        } catch (err: any) {
          console.error("Erro ao buscar métricas:", err);
          setError(err.message || "Erro desconhecido");
        } finally {
          setLoading(false);
        }
      };
    
        fetchData();
      }, [k8sName,timeFrame]);

    return( 
        <div ref={ref}>
            <SelectComponent 
                defaultValue="all"
                options={option}
                loading={loading}
                clearable={false}
                onChange={onChange} />
        </div>
    )

})

// @ts-expect-error pede displayname e depois nao reconhece
NameSpaceSelection.displayName = 'NameSpaceSelection';
