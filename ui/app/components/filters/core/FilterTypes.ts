// FilterTypes.ts
import type { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import type { Timeframe }        from '@dynatrace/strato-components-preview/core';
import React                      from 'react';

//TODO talvez remover essa interface

export interface FilterDefinition<Name extends string, Value> {
  name: Name;
  label: string;
  Component: React.ComponentType<FilterComponentProps<Value>>;
  parse: (values: FilterItemValues) => Value;
}

export interface FilterComponentProps<Value> {
  onChange: (value: Value) => void;
  timeFrame: Timeframe;
  context?: Record<string, unknown>;
}

export function createFilter<Name extends string,Value,>(def: FilterDefinition<Name, Value>) {
  return def;
}