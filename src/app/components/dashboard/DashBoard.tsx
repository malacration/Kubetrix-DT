
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import React, { useState, useMemo, ReactElement, cloneElement } from 'react';


interface DashboardProps {
  children: React.ReactNode;
}

function Dashboard({ children }: DashboardProps) {

  const [filters, setFilters] = useState<FilterItemValues>({});

  const enhancedChildren = useMemo(
    () =>
      React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;

        if ((child.type as any).displayName === 'DashboardFilter') {
          return cloneElement(child as ReactElement, { onFiltersChange: setFilters });
        }
        return cloneElement(child as ReactElement, { filters });
      }),
    [children, filters]
  );

  return <>{enhancedChildren}</>;
}


interface DashboardFilterProps {
  onFiltersChange?: (f: FilterItemValues) => void;
  children: React.ReactElement;
}

function DashboardFilter({ children, onFiltersChange }: DashboardFilterProps) {
  return cloneElement(children, { onFiltersChange });
}
DashboardFilter.displayName = 'DashboardFilter';
Dashboard.Filter = DashboardFilter;

export { Dashboard };
