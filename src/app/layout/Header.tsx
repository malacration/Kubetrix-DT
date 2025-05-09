import React from "react";
import { Link, NavLink, Link as RouterLink } from "react-router-dom";
import { AppHeader, HelpMenu } from "@dynatrace/strato-components-preview/layouts";
import { PlusIcon, SettingIcon } from "@dynatrace/strato-icons";
import { Button } from '@dynatrace/strato-components/buttons';

import { TimeFrame } from '../components/timeframe/Timeframe'

type Props = {
  onToggleSetting: () => void;
};
export const Header = ({ onToggleSetting }: Props) => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/" />
        
        <AppHeader.NavItem as={Link} to="/data">
          Explore Data
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/all">
          All
        </AppHeader.NavItem>

        <AppHeader.NavItem as={Link} to="/hostList">
          Host List
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/hostListDrill">
          Host List Drill
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/history">
          Status history
        </AppHeader.NavItem>
      </AppHeader.NavItems>

      <AppHeader.Navigation>
        <AppHeader.Logo as={NavLink} to="/" />
      </AppHeader.Navigation>


      <AppHeader.ActionItems>        
        <AppHeader.ActionItemGroup>
          
        </AppHeader.ActionItemGroup>
        <AppHeader.ActionItemGroup>
          <AppHeader.ActionButton>
            <div></div>
          </AppHeader.ActionButton>
        </AppHeader.ActionItemGroup>
      </AppHeader.ActionItems>

      <AppHeader.Menus>
        
        <Button onClick={onToggleSetting}>
          <Button.Prefix>
            <SettingIcon />
          </Button.Prefix>
        </Button>

        <HelpMenu
          entries={{
            documentation: [
              {
                label: 'Dynatrace Hub',
                href: 'link/to/hub',
                target: '_blank',
                onSelect: () => undefined,
              },
              {
                label: 'Onboarding wizard',
                onSelect: () => undefined,
              },
            ],
            keyboardShortcuts: 'default',
            about: 'default',
          }}
        />
      </AppHeader.Menus>
    </AppHeader>
  );
};

