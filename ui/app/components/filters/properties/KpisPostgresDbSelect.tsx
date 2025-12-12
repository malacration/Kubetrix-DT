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
      new Option("Activity Conn","activity"),
      new Option("Idle Conn","idle-conn"),
      new Option("Idle Transaction","idle-trans"),
      new Option("Idle Trans. Aborted","idle-abort"),
      new Option("Commits","commits"),
      new Option("Rollback","rollback"),
      new Option("DeadLocks","dead"),
      new Option("Fetched Index","fetch"),
      new Option("Fetched Total","fetch-total"),
      new Option("Inserted","insert"),
      new Option("Updated","update"),
      new Option("Deleted","delete"),
      new Option("Session","session"),
      new Option("Session Aban.","session-aban"),
      new Option("Session Fatal","session-fatal"),
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