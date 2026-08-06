import React from 'react';
import { Page, TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { Link, useLocation } from 'react-router-dom';

const exemplos = [
  { label: 'Generic', path: '/dashboards/Generic' },
  { label: "Frontend's (KPI)", path: '/dashboards/Frontends' },
  { label: "Postgres DBs (KPI)", path: '/dashboards/Postgres' },
  { label: 'Capacity Optimization', path: '/dashboards/Optimization' },
  { label: 'OneAgent Deployments', path: '/dashboards/OneAgent' },
  { label: 'Problemas (Davis)', path: '/dashboards/Problems' },
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

        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--dt-colors-border-neutral-default, #d0d3da)', margin: '8px 0' }} />

        <Button
          as={Link}
          onClick={onDismiss}
          to={{ pathname: '/dashboards/Docs', search: location.search }}
        >
          Documentação
        </Button>
      </div>
    </Page.Sidebar>
  );
};
