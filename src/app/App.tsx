import React, { useState } from "react";
import { Header } from "./layout/Header";

import { Page,TitleBar,} from '@dynatrace/strato-components-preview/layouts';

import { SideBar } from "./layout/SideBar";
import { Routes } from "./layout/Routes";


import { DetailView } from "./layout/DetailView";



export const App = () => {
  const [isDetailViewDismissed, setIsDetailViewDismissed] = useState<boolean>(true);
  const [isSidebarDismissed, setIsSidebarDismissed] = useState<boolean>(false);

  return (
    <Page>
      <Page.Header>
        <Header onToggleSetting={() => setIsDetailViewDismissed(prev => !prev)} />
      </Page.Header>
      <SideBar isDismissed={isSidebarDismissed} />
      <Page.Main>
        <TitleBar>
          <TitleBar.Prefix>
            <Page.PanelControlButton
              onClick={() => setIsSidebarDismissed(!isSidebarDismissed)}
            />
          </TitleBar.Prefix>
          <TitleBar.Title>Main</TitleBar.Title>
          
          {/* <TitleBar.Action>
            
          </TitleBar.Action> */}
        </TitleBar>
        <br></br>
          <Routes />
      </Page.Main>
      <DetailView isDismissed={isDetailViewDismissed}/>
    </Page>
  );
};
