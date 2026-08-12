import React from 'react';
import type { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { Button } from '@dynatrace/strato-components/buttons';
import {
  dashboardWidgetHeaderButtonStyle,
  DashboardWidgetHeaderActionGroup,
} from 'app/components/dashboard/DashboardWidgetHeaderActions';

export type ResourceScope = 'workload' | 'pod';

export interface ResourceScopeAvailability {
  enabled: boolean;
  reason: string;
}

function isSelected(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '' && value !== 'all';
}

export function podResourceScopeAvailability(
  filters?: FilterItemValues,
): ResourceScopeAvailability {
  const missing = [
    ['cluster', filters?.cluster?.value],
    ['namespace', filters?.namespace?.value],
    ['workload', filters?.workload?.value],
  ]
    .filter(([, value]) => !isSelected(value))
    .map(([label]) => label as string);

  const enabled = missing.length === 0;
  const last = missing.at(-1);
  const missingLabel = missing.length > 1
    ? `${missing.slice(0, -1).join(', ')} e ${last}`
    : last;

  return {
    enabled,
    reason: enabled
      ? ''
      : `Selecione ${missingLabel} para habilitar a visualização por pods.`,
  };
}

interface ResourceScopeActionProps {
  value: ResourceScope;
  onChange: (value: ResourceScope) => void;
  podAvailability: ResourceScopeAvailability;
}

/** Versão compacta usada nas ações ao lado do título do widget. */
export function ResourceScopeHeaderAction({
  value,
  onChange,
  podAvailability,
}: ResourceScopeActionProps) {
  const podButton = (
    <Button
      size="condensed"
      color="primary"
      variant={value === 'pod' ? 'emphasized' : 'default'}
      style={dashboardWidgetHeaderButtonStyle(value === 'pod')}
      disabled={!podAvailability.enabled}
      aria-pressed={value === 'pod'}
      onClick={() => onChange('pod')}
    >
      Pods
    </Button>
  );

  return (
    <DashboardWidgetHeaderActionGroup label="Exibir">
      <Button
        size="condensed"
        color="primary"
        variant={value === 'workload' ? 'emphasized' : 'default'}
        style={dashboardWidgetHeaderButtonStyle(value === 'workload')}
        aria-pressed={value === 'workload'}
        onClick={() => onChange('workload')}
      >
        Workload
      </Button>
      {podAvailability.enabled ? podButton : (
        <Tooltip text={podAvailability.reason} placement="top">
          <span style={{ display: 'inline-flex', cursor: 'help' }}>{podButton}</span>
        </Tooltip>
      )}
    </DashboardWidgetHeaderActionGroup>
  );
}
