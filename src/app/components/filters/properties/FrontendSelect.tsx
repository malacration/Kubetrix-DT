import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';
import { getFrontends } from 'src/app/services/frontendService';


interface FrontendSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
  timeFrame?: TimeframeV2
}

export const FrontendSelection = forwardRef<HTMLDivElement, FrontendSelectionProps>( 
  ({ onChange, timeFrame },ref: ForwardedRef<HTMLDivElement> ) => {
    const [loading, setLoading] = useState(true);
    const [option, setOption] = useState<Array<Option>>([new Option("All","all")]);

    useEffect(() => {
      setLoading(true)
      getFrontends(timeFrame).then(it => {
        setOption(it.records.map(it => new Option(it["entity.name"],it["id"])))
        setLoading(false)
      });
    }, [timeFrame]);

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
FrontendSelection.displayName = 'WorkloadsSelection';