import { FilterItemValues } from "@dynatrace/strato-components-preview/filters";


export interface ChartProps {
  filters?: FilterItemValues; // será injetado pelo Dashboard
  lastRefreshedAt?: Date,
  title?: string;
}