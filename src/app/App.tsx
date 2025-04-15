import React, { useState } from "react";
import { Data } from "./pages/Data";
import { Header } from "./layout/Header";

import { Page,TitleBar } from '@dynatrace/strato-components-preview/layouts';

import { SideBar } from "./layout/SideBar";
import { Routes } from "./layout/Routes";

import { Borders, Colors, Spacings } from "@dynatrace/strato-design-tokens";

import { DetailView } from "./layout/DetailView";

const Placeholder = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      marginTop: Spacings.Size24,
      borderRadius: Borders.Radius.Container.Default,
      backgroundColor: Colors.Background.Container.Neutral.Default,
    }}
  />
);


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
          <TitleBar.Subtitle>
            <Routes />
          </TitleBar.Subtitle>
          {/* <TitleBar.Action>
            
          </TitleBar.Action> */}
        </TitleBar>
      </Page.Main>
      <DetailView isDismissed={isDetailViewDismissed}/>
    </Page>
  );
};
