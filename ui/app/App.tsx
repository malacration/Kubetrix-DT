import React, { useState } from "react";
import { Header } from "./layout/Header";

import { Page,TitleBar,} from '@dynatrace/strato-components-preview/layouts';

import { SideBar } from "./layout/SideBar";
import { MyRoutes } from "./layout/MyRoutes";


import { DetailView } from "./layout/DetailView";
import { FilterK8sContextProvider } from "./components/context/FilterK8sContext";
import { NuqsAdapter } from "nuqs/dist/_tsup-dts-rollup";



import { Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import FrontEnds from "./pages/dashboards/Frontends";


export const App = () => {
  const [isDetailViewDismissed, setIsDetailViewDismissed] = useState<boolean>(true);
  const [isSidebarDismissed, setIsSidebarDismissed] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsSidebarDismissed(prev => !prev);
  };

  return (
    <Page>
      <Page.Header>
        <Header onToggleSetting={() => setIsDetailViewDismissed(prev => !prev)} onToggleMenu={toggleSidebar} />
      </Page.Header>
      <SideBar isDismissed={isSidebarDismissed} onDismiss={() => setIsSidebarDismissed(true)}  />
      <Page.Main>
          <MyRoutes />
      </Page.Main>
      <DetailView isDismissed={isDetailViewDismissed}/>
    </Page>
  );
};