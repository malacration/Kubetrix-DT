import React, { useState } from 'react';

import {
  Page,
  TitleBar,
} from '@dynatrace/strato-components-preview/layouts';
import { Button } from '@dynatrace/strato-components';
import { Link } from 'react-router-dom';


const exemplos = [
  { label: 'Exemplo', path: '/dashboards/Exemplo' },
];

export const SideBar = ({ isDismissed }: { isDismissed: boolean }) => {
  
  return (
    <Page.Sidebar dismissed={isDismissed}>
      <TitleBar>
        <TitleBar.Title>Dashboards</TitleBar.Title>
        {/* <TitleBar.Subtitle>e.g. for navigation</TitleBar.Subtitle> */}
      </TitleBar>
      <br></br>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {exemplos.map((exemplo, idx) => (
                    <Button
                    key={idx}
                    as={Link}
                    to={exemplo.path}
                    // variant="ghost"
                    >
                    {exemplo.label}
                    </Button>
                ))}
            </div>
  </Page.Sidebar>
  );
};