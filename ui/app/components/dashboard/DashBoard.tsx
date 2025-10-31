// Dashboard.tsx
import React, {
  useState, useMemo, cloneElement, ReactElement, useEffect, useCallback,
} from 'react';
import type { CSSProperties } from 'react';
import {
  Flex, Container, Divider,
} from '@dynatrace/strato-components/layouts';
import Spacings from '@dynatrace/strato-design-tokens/spacings';
import { Heading } from '@dynatrace/strato-components/typography';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { useAutoRefreshMs, useLastRefreshedAt, useSetLastRefreshedAt } from '../context/FilterK8sContext';

interface DashboardProps {
  children: React.ReactNode;
  defaultRefreshIntervalMs?: number;
}

export interface FilterBarProps {
  onFiltersChange?: (f: FilterItemValues) => void;
}

function DashboardFilter(
  { children, ...injected }: React.PropsWithChildren<FilterBarProps>,
) {
  return cloneElement(children as ReactElement, injected);
}
DashboardFilter.displayName = 'DashboardFilter';

interface DashboardWidgetWrapperProps {
  title?: string;
  isMaximized: boolean;
  onToggle: () => void;
  shouldHide: boolean;
  children: React.ReactNode;
}

const DashboardWidgetWrapper: React.FC<DashboardWidgetWrapperProps> = ({
  title,
  isMaximized,
  onToggle,
  shouldHide,
  children,
}) => {
  const containerStyle: CSSProperties = {
    display: shouldHide ? 'none' : undefined,
    position: isMaximized ? 'fixed' : 'relative',
    top: isMaximized ? 0 : undefined,
    left: isMaximized ? 0 : undefined,
    right: isMaximized ? 0 : undefined,
    bottom: isMaximized ? 0 : undefined,
    width: isMaximized ? '100vw' : undefined,
    height: isMaximized ? '100vh' : undefined,
    zIndex: isMaximized ? 1000 : undefined,
    overflow: isMaximized ? 'auto' : undefined,
    padding: isMaximized ? Spacings.Size16 : undefined,
    boxSizing: isMaximized ? 'border-box' : undefined,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: title ? 'space-between' : 'flex-end',
    marginBottom: title ? '8px' : 0,
    gap: '8px',
  };

  const toggleButtonStyle: CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#00539f',
    padding: 0,
  };

  return (
    <Container style={containerStyle}>
      <div style={headerStyle}>
        {title && <Heading level={4} style={{ margin: 0 }}>{title}</Heading>}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isMaximized ? 'Reduzir widget' : 'Maximizar widget'}
          style={toggleButtonStyle}
        >
          {isMaximized ? 'Reduzir' : 'Maximizar'}
        </button>
      </div>
      {title && (
        <Divider variant="accent" style={{ marginBottom: Spacings.Size16 }} />
      )}
      {children}
    </Container>
  );
};

function deriveWidgetId(node: React.ReactElement, fallback: string): string {
  const props = node.props as { id?: string; title?: string };
  if (props?.id) {
    return `id-${props.id}`;
  }
  if (props?.title) {
    return `${fallback}-${String(props.title)}`;
  }
  return fallback;
}

function injectPropsRecursively(
  node: React.ReactNode,
  filterProps: { filters: FilterItemValues; lastRefreshedAt: Date },
  filterBarProps: FilterBarProps,
  maximizedWidgetId: string | null,
  toggleWidget: (widgetId: string) => void,
  path = 'root',
): React.ReactNode {

  if (Array.isArray(node)) {
    return React.Children
      .toArray(node)
      .map((child, index) => injectPropsRecursively(
        child,
        filterProps,
        filterBarProps,
        maximizedWidgetId,
        toggleWidget,
        `${path}.${index}`,
      ));
  }

  if (!React.isValidElement(node)){
    return node;
  }

  if ((node.type as any).displayName === 'DashboardFilter') {
    return cloneElement(node, filterBarProps);
  }

  const nextPath = node.key != null ? `${path}.${node.key}` : path;

  // 2) É um widget marcado? injeta filters + refreshToken
  if ((node.type as any).dashboardWidget) {
    const widgetId = deriveWidgetId(node, nextPath);
    const isMaximized = maximizedWidgetId === widgetId;
    const shouldHide = Boolean(
      maximizedWidgetId && maximizedWidgetId !== widgetId,
    );
    const { title } = node.props as { title?: string };
    return (
      <DashboardWidgetWrapper
        key={widgetId}
        title={title}
        isMaximized={isMaximized}
        onToggle={() => toggleWidget(widgetId)}
        shouldHide={shouldHide}
      >
        {cloneElement(node, filterProps)}
      </DashboardWidgetWrapper>);
  }

  // 3) É wrapper genérico? desce recursivamente pelos filhos
  if (node.props?.children) {
    const mappedChildren = React.Children.map(
      node.props.children,
      (child, index) => injectPropsRecursively(
        child,
        filterProps,
        filterBarProps,
        maximizedWidgetId,
        toggleWidget,
        `${nextPath}.${index}`,
      ),
    );
    return React.cloneElement(node, {}, mappedChildren);
  }

  // 4) Qualquer outro nó sem children
  return node;
}

const Dashboard: React.FC<DashboardProps> & { Filter: typeof DashboardFilter } = ({
  children,
}) => {
  const [filters, setFilters] = useState<FilterItemValues>({});
  const [maximizedWidgetId, setMaximizedWidgetId] = useState<string | null>(null);

  const autoRefresh = useAutoRefreshMs()
  const setContextLastRefreshedAt = useSetLastRefreshedAt()
  const contextLastRefreshedAt = useLastRefreshedAt()

  const handleToggleWidget = useCallback((widgetId: string) => {
    setMaximizedWidgetId(prev => (prev === widgetId ? null : widgetId));
  }, []);

  const enhancedChildren = useMemo(() => {
    return injectPropsRecursively(
      children,
      { filters: filters, lastRefreshedAt: contextLastRefreshedAt },
      { onFiltersChange: setFilters, },
      maximizedWidgetId,
      handleToggleWidget,
    )
  },[children, filters, contextLastRefreshedAt, maximizedWidgetId, handleToggleWidget]);

  useEffect(() => {
    if (!autoRefresh || autoRefresh <= 0) return;

    const id = setInterval(() => {
      const data = new Date()
      setContextLastRefreshedAt(data);
    }, autoRefresh);

    return () => clearInterval(id);
  }, [autoRefresh, setContextLastRefreshedAt]);

  useEffect(() => {
    if (!maximizedWidgetId) {
      return undefined;
    }

    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [maximizedWidgetId]);

  return (
    <Flex flexDirection="column">
      {enhancedChildren}
    </Flex>
  );
};

Dashboard.Filter = DashboardFilter;
export { Dashboard };
