import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Text } from '@dynatrace/strato-components/typography';
import Colors from '@dynatrace/strato-design-tokens/colors';

const actionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 6,
};

const groupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: 3,
  border: `1px solid ${Colors.Border.Neutral.Default}`,
  borderRadius: 7,
  background: Colors.Background.Container.Neutral.Emphasized,
};

interface DashboardWidgetHeaderActionsProps {
  children: ReactNode;
}

/** Linha de ações que o widget registra no cabeçalho externo do Dashboard. */
export function DashboardWidgetHeaderActions({ children }: DashboardWidgetHeaderActionsProps) {
  return <div style={actionsStyle}>{children}</div>;
}

/** Aparência persistente de botão; não depende do hover para revelar a área clicável. */
export function dashboardWidgetHeaderButtonStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? Colors.Border.Primary.Accent : Colors.Border.Neutral.Default}`,
    borderRadius: 5,
    background: active
      ? Colors.Background.Container.Primary.Emphasized
      : Colors.Background.Surface.Default,
  };
}

interface DashboardWidgetHeaderActionGroupProps {
  label?: string;
  children: ReactNode;
}

/** Superfície persistente que delimita um grupo de controles relacionados. */
export function DashboardWidgetHeaderActionGroup({
  label,
  children,
}: DashboardWidgetHeaderActionGroupProps) {
  return (
    <Flex alignItems="center" gap={4} style={groupStyle}>
      {label && (
        <Text style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0 3px' }}>
          {label}
        </Text>
      )}
      {children}
    </Flex>
  );
}
