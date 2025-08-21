import React, { useState } from "react";
import { Header } from "./layout/Header";

import { Page,TitleBar,} from '@dynatrace/strato-components-preview/layouts';

import { SideBar } from "./layout/SideBar";
import { Routes } from "./layout/Routes";


import { DetailView } from "./layout/DetailView";
import { FilterK8sContextProvider } from "./components/context/FilterK8sContext";
import { NuqsAdapter } from "nuqs/dist/_tsup-dts-rollup";



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
          <Routes />
      </Page.Main>
      <DetailView isDismissed={isDetailViewDismissed}/>
    </Page>
  );
};
