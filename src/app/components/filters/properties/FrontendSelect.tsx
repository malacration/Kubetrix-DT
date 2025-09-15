import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { getFrontends } from 'src/app/services/frontendService';
import { useFrontendsSelected, useTimeFrame } from '../../context/FilterK8sContext';


interface FrontendSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
}

export const FrontendSelection = forwardRef<HTMLDivElement, FrontendSelectionProps>( 
  ({ onChange },ref: ForwardedRef<HTMLDivElement> ) => {
    
    const [loading, setLoading] = useState(true);
    const [option, setOption] = useState<Array<Option>>([new Option("All","all")]);

    const timeframe = useTimeFrame()

    const frontends=useFrontendsSelected()

    useEffect(() => {
      setLoading(true)
      getFrontends(timeframe).then(it => {
        setOption(it.records.map(it => new Option(it["entity.name"],it["entity.name"])))
        setLoading(false)
      });
    }, [timeframe]);

    return( 
        <div ref={ref}>
            <SelectComponent
                defaultValue={frontends}
                options={option}
                loading={loading}
                clearable={false}
                multiple={true}
                onChange={onChange} />
        </div>
    )

})
// @ts-expect-error pede displayname e depois nao reconhece
FrontendSelection.displayName = 'WorkloadsSelection';