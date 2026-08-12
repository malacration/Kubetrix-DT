import { FilterItemValues } from "@dynatrace/strato-components-preview/filters";
import type { ReactNode } from 'react';


export interface ChartProps {
  filters?: FilterItemValues; // será injetado pelo Dashboard
  title?: string;
  // Também injetado pelo Dashboard (DashBoard.tsx passa { filters, lastRefreshedAt }).
  // Faltava aqui, então todo widget que usava esse prop — a maioria — acusava erro de
  // tipo; declarar aqui zera esses erros de uma vez.
  lastRefreshedAt?: Date;
  /** Controles que o widget quer renderizar ao lado do título externo. */
  onHeaderActionsChange?: (actions: ReactNode) => void;
}
