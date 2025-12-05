import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { useFrontendsSelected, useTimeFrame } from '../../context/FilterK8sContext';
import { isQueryResult } from 'app/services/core/GrailConverter';
import { getPostgresDbs } from 'app/services/postgresDbsService';


interface FrontendSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
}

export const PostgresDBsSelection = forwardRef<HTMLDivElement, FrontendSelectionProps>( 
  ({ onChange },ref: ForwardedRef<HTMLDivElement> ) => {
    
    const [loading, setLoading] = useState(true);
    const [option, setOption] = useState<Array<Option>>([new Option("All","all")]);

    const timeframe = useTimeFrame()

    const frontends=useFrontendsSelected()

    useEffect(() => {
      setLoading(true)
      getPostgresDbs(timeframe).then(it => {
        if(isQueryResult(it))
          setOption(it.records.map(it => new Option(it!["database"],it!["database"])))
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
PostgresDBsSelection.displayName = 'PostgresDbsSelection';