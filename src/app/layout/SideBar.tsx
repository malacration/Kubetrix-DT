import React from 'react';
import { Page, TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { Link, useLocation } from 'react-router-dom';

const exemplos = [
  { label: 'Generic', path: '/dashboards/Generic' },
  { label: "Frontend's", path: '/dashboards/Frontends' },
  { label: 'Capacity Optimization', path: '/dashboards/Optimization' },
];

export const SideBar = ({ isDismissed, onDismiss }:{
  isDismissed: boolean; onDismiss: () => void;
}) => {
  const location = useLocation();

  return (
    <Page.Sidebar dismissed={isDismissed}>
      <TitleBar><TitleBar.Title>Dashboards</TitleBar.Title></TitleBar>
      <br />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exemplos.map((exemplo, idx) => (
          <Button
            key={idx}
            as={Link}
            onClick={onDismiss}
            to={{ pathname: exemplo.path, search: location.search }}
          >
            {exemplo.label}
          </Button>
        ))}
      </div>
    </Page.Sidebar>
  );
};
