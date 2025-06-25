import React, { useEffect, useState } from 'react';

import {
  Page,
  TitleBar,
} from '@dynatrace/strato-components-preview/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { Link } from 'react-router-dom';


const exemplos = [
  { label: 'Generic', path: '/dashboards/Generic' },
  { label: 'Frontend\'s', path: '/dashboards/Frontends' },
  { label: 'over-provisioning', path: '/dashboards/Generic' },
];

export const SideBar = ({ isDismissed, onDismiss }: { isDismissed: boolean, onDismiss: () => void;}) => {

  return (
    <Page.Sidebar dismissed={isDismissed} >
      <TitleBar>
        <TitleBar.Title>Dashboards</TitleBar.Title>
      </TitleBar>
      <br></br>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {exemplos.map((exemplo, idx) => (
                    <Button
                    onClick={onDismiss}
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