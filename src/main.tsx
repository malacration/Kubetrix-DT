import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@dynatrace/strato-components/core";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { FilterK8sContextProvider } from "./app/components/context/FilterK8sContext";
import { NuqsAdapter } from "nuqs/adapters/react";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <AppRoot>
    <NuqsAdapter>
      <BrowserRouter basename="ui">
        <FilterK8sContextProvider>
          <App />
        </FilterK8sContextProvider>
      </BrowserRouter>
    </NuqsAdapter>
  </AppRoot>
);
