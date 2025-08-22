import React from "react";
import {
  Dispatch,
  ReactElement,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { Option } from "../form/Select";
import { TimeframeV2 } from "@dynatrace/strato-components-preview/core";
import { getDefaultTimeframe } from "../timeframe/DefaultTimeframe";

/** Props do Provider */
interface FilterK8sContextProps {
  children: ReactElement;
}

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
  // NEW
  setWorkloadOptions?: Dispatch<SetStateAction<Array<Option>>>;

  // time
  timeFrame: TimeframeV2;
  setTimeFrame: Dispatch<SetStateAction<TimeframeV2>>;

  // refresh
  autoRefreshMs: number;
  setAutoRefreshMs: Dispatch<SetStateAction<number>>;

  lastRefreshedAt: Date;
  setLastRefreshedAt: Dispatch<SetStateAction<Date>>;
}

const FilterK8sContext = createContext<FilterK8sContextData>(
  {} as FilterK8sContextData
);

/** Helper para ISO sem ms: "YYYY-MM-DDTHH:mmZ" */
function toIsoNoMs(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function FilterK8sContextProvider({ children }: FilterK8sContextProps) {
  // OPTIONS
  const [clusterOptions, setClusterOptions] = useState<Array<Option>>([
    new Option("All", "all"),
  ]);
  const [namespaceOptions, setNamespaceOptions] = useState<Array<Option>>([
    new Option("All", "all"),
  ]);
  const [workloadOptions, setWorkloadOptions] = useState<Array<Option>>([
    new Option("All", "all"),
  ]);

  // SELECTED sincronizados na URL (nuqs)
  const [clusterSelectedRaw, setClusterSelectedRaw] = useQueryState(
    "cluster",
    parseAsString.withDefault("all")
  );
  const [namespaceSelectedRaw, setNamespaceSelectedRaw] = useQueryState(
    "ns",
    parseAsString.withDefault("all")
  );
  const [workloadSelectedRaw, setWorkloadSelectedRaw] = useQueryState(
    "wl",
    parseAsString.withDefault("all")
  );

  const [autoRefreshMsRaw, setAutoRefreshMsRaw] = useQueryState<number>(
    "ar",
    parseAsInteger.withDefault(20000)
  );

  // Adaptadores para manter a assinatura Dispatch<SetStateAction<string>>
  const setClusterSelected: Dispatch<SetStateAction<string>> = (upd) => {
    const next =
      typeof upd === "function"
        ? (upd as (prev: string) => string)(clusterSelectedRaw)
        : upd;
    setClusterSelectedRaw(next ?? "all");
  };
  const setNamespaceSelected: Dispatch<SetStateAction<string>> = (upd) => {
    const next =
      typeof upd === "function"
        ? (upd as (prev: string) => string)(namespaceSelectedRaw)
        : upd;
    setNamespaceSelectedRaw(next ?? "all");
  };

  const setWorkloadSelected: Dispatch<SetStateAction<string>> = (upd) => {
    const next =
      typeof upd === "function"
        ? (upd as (prev: string) => string)(workloadSelectedRaw)
        : upd;
    setWorkloadSelectedRaw(next ?? "all");
  };

  const setAutoRefreshMs: Dispatch<SetStateAction<number>> = (upd) => {
    const next =
      typeof upd === "function"
        ? (upd as (prev: number) => number)(autoRefreshMsRaw)
        : upd;
        setAutoRefreshMsRaw(next ?? "20000");
  };

  // TIMEFRAME (state local; se quiser, dá pra serializar em query depois)
  const [timeFrame, setTimeFrame] = useState<TimeframeV2>(getDefaultTimeframe());
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(
    new Date()
  );

  const value = useMemo<FilterK8sContextData>(
    () => ({
      // cluster
      clusterOptions,
      clusterSelected: clusterSelectedRaw,
      setClusterSelected,
      setClusterOptions, // << NEW

      // namespace
      namespaceOptions,
      namespaceSelected: namespaceSelectedRaw,
      setNamespaceSelected,
      setNamespaceOptions, // << NEW

      // workload
      workloadOptions,
      workloadSelected: workloadSelectedRaw,
      setWorkloadSelected,
      setWorkloadOptions, // << NEW

      // time
      timeFrame,
      setTimeFrame,

      // refresh
      autoRefreshMs: autoRefreshMsRaw,
      setAutoRefreshMs,
      lastRefreshedAt,
      setLastRefreshedAt
    }),
    [
      clusterOptions,
      clusterSelectedRaw,
      namespaceOptions,
      namespaceSelectedRaw,
      workloadOptions,
      workloadSelectedRaw,
      timeFrame,
      autoRefreshMsRaw,
      lastRefreshedAt,
    ]
  );

  return (
    <FilterK8sContext.Provider value={value}>
      {children}
    </FilterK8sContext.Provider>
  );
}

/** Selectors (use-context-selector) */
export const useClusterSelected = () =>
  useContextSelector(FilterK8sContext, (v) => v.clusterSelected);
export const useSetClusterSelected = () =>
  useContextSelector(FilterK8sContext, (v) => v.setClusterSelected);

export const useNamespaceSelected = () =>
  useContextSelector(FilterK8sContext, (v) => v.namespaceSelected);
export const useSetNamespaceSelected = () =>
  useContextSelector(FilterK8sContext, (v) => v.setNamespaceSelected);

export const useWorkloadSelected = () =>
  useContextSelector(FilterK8sContext, (v) => v.workloadSelected);
export const useSetWorkloadSelected = () =>
  useContextSelector(FilterK8sContext, (v) => v.setWorkloadSelected);

export const useTimeFrame = () =>
  useContextSelector(FilterK8sContext, (v) => v.timeFrame);
export const useSetTimeFrame = () =>
  useContextSelector(FilterK8sContext, (v) => v.setTimeFrame);

export const useAutoRefreshMs = () =>
  useContextSelector(FilterK8sContext, (v) => v.autoRefreshMs);

export const useSetAutoRefreshMs = () =>
  useContextSelector(FilterK8sContext, (v) => v.setAutoRefreshMs);

export const useLastRefreshedAt = () =>
  useContextSelector(FilterK8sContext, (v) => v.lastRefreshedAt);

export const useSetLastRefreshedAt = () =>
  useContextSelector(FilterK8sContext, (v) => v.setLastRefreshedAt);

// NEW: selectors para options
export const useClusterOptions = () =>
  useContextSelector(FilterK8sContext, (v) => v.clusterOptions);

export const useSetClusterOptions = () =>
  useContextSelector(FilterK8sContext, (v) => v.setClusterOptions);

export const useNamespaceOptions = () =>
  useContextSelector(FilterK8sContext, (v) => v.namespaceOptions);
export const useSetNamespaceOptions = () =>
  useContextSelector(FilterK8sContext, (v) => v.setNamespaceOptions);

export const useWorkloadOptions = () =>
  useContextSelector(FilterK8sContext, (v) => v.workloadOptions);

export const useSetWorkloadOptions = () =>
  useContextSelector(FilterK8sContext, (v) => v.setWorkloadOptions);

