import React, { ForwardedRef, forwardRef, useEffect, useState } from 'react';
import { Option, SelectComponent } from '../../form/Select';
import { useFrontKpisSelected } from '../../context/FilterK8sContext';


interface KpisFrontSelectionProps {
  onChange?: (value: string | string[] | undefined) => void;
}

export const KpisFrontSelection = forwardRef<HTMLDivElement, KpisFrontSelectionProps>( 
  ({ onChange },ref: ForwardedRef<HTMLDivElement> ) => {
    
    const options : Array<Option> = [
      new Option("Action Duration","duration"),
      new Option("Throughput","throughput"),
      new Option("Failure Count","failure-Count"),
      new Option("Apdex","apdex"),
    ];

    const kpis = useFrontKpisSelected()


    return( 
        <div ref={ref}>
            <SelectComponent
                defaultValue={kpis}
                options={options}
                clearable={false}
                multiple={true}
                onChange={onChange} />
        </div>
    )

})

// @ts-expect-error pede displayname e depois nao reconhece
KpisFrontSelection.displayName = 'kpisFrontSelection';