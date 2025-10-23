import { Dispatch, SetStateAction } from "react";
import { Option } from "../form/Select";
import { Timeframe } from "@dynatrace/strato-components-preview/core";

export interface FilterK8sContextData {
  // cluster
  clusterOptions: Array<Option>;
  clusterSelected: string;
  setClusterSelected: Dispatch<SetStateAction<string>>;
  // NEW: setters de options
  setClusterOptions?: Dispatch<SetStateAction<Array<Option>>>;

  // namespace
  namespaceOptions: Array<Option>;
  namespaceSelected: string;
  setNamespaceSelected: Dispatch<SetStateAction<string>>;
  // NEW
  setNamespaceOptions?: Dispatch<SetStateAction<Array<Option>>>;

  // workload
  workloadOptions: Array<Option>;
  workloadSelected: string;
  setWorkloadSelected: Dispatch<SetStateAction<string>>;
  setWorkloadOptions?: Dispatch<SetStateAction<Array<Option>>>;

  // frontends
  frontendsOptions: Array<Option>;
  setFrontendsOptions?: Dispatch<SetStateAction<Array<Option>>>;

  frontendsSelected: Array<string>;
  setFrontendsSelected: Dispatch<SetStateAction<Array<string>>>;

  frontKpisSelected: Array<string>;
  setFrontKpisSelected: Dispatch<SetStateAction<Array<string>>>;

  // time
  timeFrame: Timeframe;
  setTimeFrame: Dispatch<SetStateAction<Timeframe>>;

  // refresh
  autoRefreshMs: number;
  setAutoRefreshMs: Dispatch<SetStateAction<number>>;

  lastRefreshedAt: Date;
  setLastRefreshedAt: Dispatch<SetStateAction<Date>>;
}