import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { useFrontKpisSelected } from '../../context/FilterK8sContext';


interface KpisFrontSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
}

export const KpisPostgresDbSelection = forwardRef<HTMLDivElement, KpisFrontSelectionProps>( 
  ({ onChange },ref: ForwardedRef<HTMLDivElement> ) => {
    
    const options : Array<Option> = [
      new Option("Sessions (Count)","sessions-count"),
      new Option("Session Time","session-time"),
      new Option("Activity","activity"),
      new Option("Conflicts","conflict"),
    ];

    const kpis = useFrontKpisSelected()


    return( 
        <div ref={ref}>
            <SelectComponent
                defaultValue={kpis}
                options={options}
                clearable={true}
                multiple={true}
                onChange={onChange} />
        </div>
    )
})

// @ts-expect-error pede displayname e depois nao reconhece
KpisPostgresDbSelection.displayName = 'KpisPostgresDbSelection';