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
import { Button } from '@dynatrace/strato-components/buttons';
import { ViewIcon, ViewOffIcon } from '@dynatrace/strato-icons';
import { FilterItemValues } from '@dynatrace/strato-components-preview/filters';
import { useAutoRefreshMs, useLastRefreshedAt, useSetLastRefreshedAt, useSetSidebarDismissed } from '../context/FilterK8sContext';
import type { ChartProps } from '../filters/BarChartProps';
import { dashboardWidgetHeaderButtonStyle } from './DashboardWidgetHeaderActions';

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
  onToggleMaximize: () => void;
  onHide: () => void;
  children: React.ReactNode;
}

const DashboardWidgetWrapper: React.FC<DashboardWidgetWrapperProps> = ({
  title,
  isMaximized,
  onToggleMaximize,
  onHide,
  children,
}) => {
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const handleHeaderActionsChange = useCallback((actions: React.ReactNode) => {
    setHeaderActions(actions);
  }, []);

  const containerStyle: CSSProperties = {
    width: isMaximized ? '100%' : undefined,
    boxSizing: 'border-box',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: title ? 'space-between' : 'flex-end',
    marginBottom: title ? '8px' : 0,
    gap: '8px',
    flexWrap: 'wrap',
  };

  const widget = React.isValidElement(children)
    ? cloneElement(children as ReactElement<ChartProps>, {
        onHeaderActionsChange: handleHeaderActionsChange,
      })
    : children;

  return (
    <Container style={containerStyle}>
      <div style={headerStyle}>
        {title && <Heading level={4} style={{ margin: 0 }}>{title}</Heading>}
        <Flex flexDirection="row" flexWrap="wrap" gap={8} alignItems="center">
          {headerActions}
          <Button
            size="condensed"
            color="primary"
            style={dashboardWidgetHeaderButtonStyle(false)}
            onClick={onHide}
            aria-label="Ocultar widget"
          >
            <Button.Prefix><ViewOffIcon /></Button.Prefix>
            Ocultar
          </Button>
          <Button
            size="condensed"
            color="primary"
            variant={isMaximized ? 'emphasized' : 'default'}
            style={dashboardWidgetHeaderButtonStyle(isMaximized)}
            onClick={onToggleMaximize}
            aria-label={isMaximized ? 'Reduzir widget' : 'Maximizar widget'}
          >
            {isMaximized ? 'Reduzir' : 'Maximizar'}
          </Button>
        </Flex>
      </div>
      {title && (
        <Divider variant="accent" style={{ marginBottom: Spacings.Size16 }} />
      )}
      {widget}
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

export interface HiddenWidget {
  id: string;
  title?: string;
}

interface InjectResult {
  node: React.ReactNode;
  /** Se o widget maximizado está em algum lugar dentro deste nó. */
  containsMaximized: boolean;
  /** Widgets ocultos encontrados dentro deste nó (para a barra de restauração). */
  hiddenWidgets: HiddenWidget[];
}

/**
 * Percorre a árvore de baixo para cima: cada nó só decide seus próprios
 * props depois de saber se algum filho contém um widget maximizado. Isso
 * permite que a linha (Flex) que contém um widget maximizado quebre e o
 * widget ocupe 100% da largura, empurrando os irmãos daquela linha para
 * baixo — sem esconder nada e sem overlay. Como vários widgets podem estar
 * maximizados ao mesmo tempo, cada linha reage independentemente. Widgets
 * ocultos simplesmente não são renderizados (viram null), mas são
 * coletados em `hiddenWidgets` para o Dashboard exibir uma barra de
 * restauração no topo.
 */
function injectPropsRecursively(
  node: React.ReactNode,
  filterProps: { filters: FilterItemValues; lastRefreshedAt: Date },
  filterBarProps: FilterBarProps,
  maximizedWidgetIds: Set<string>,
  hiddenWidgetIds: Set<string>,
  toggleWidget: (widgetId: string) => void,
  hideWidget: (widgetId: string) => void,
  path = 'root',
): InjectResult {

  if (Array.isArray(node)) {
    const results = React.Children
      .toArray(node)
      .map((child, index) => injectPropsRecursively(
        child,
        filterProps,
        filterBarProps,
        maximizedWidgetIds,
        hiddenWidgetIds,
        toggleWidget,
        hideWidget,
        `${path}.${index}`,
      ));
    return {
      node: results.map((r) => r.node),
      containsMaximized: results.some((r) => r.containsMaximized),
      hiddenWidgets: results.flatMap((r) => r.hiddenWidgets),
    };
  }

  if (!React.isValidElement(node)){
    return { node, containsMaximized: false, hiddenWidgets: [] };
  }

  if ((node.type as any).displayName === 'DashboardFilter') {
    return { node: cloneElement(node, filterBarProps), containsMaximized: false, hiddenWidgets: [] };
  }

  const nextPath = node.key != null ? `${path}.${node.key}` : path;

  // 2) É um widget marcado? injeta filters + refreshToken
  if ((node.type as any).dashboardWidget) {
    const widgetId = deriveWidgetId(node, nextPath);
    const { title } = node.props as { title?: string };

    if (hiddenWidgetIds.has(widgetId)) {
      return { node: null, containsMaximized: false, hiddenWidgets: [{ id: widgetId, title }] };
    }

    const isMaximized = maximizedWidgetIds.has(widgetId);
    return {
      node: (
        <DashboardWidgetWrapper
          key={widgetId}
          title={title}
          isMaximized={isMaximized}
          onToggleMaximize={() => toggleWidget(widgetId)}
          onHide={() => hideWidget(widgetId)}
        >
          {cloneElement(node, filterProps)}
        </DashboardWidgetWrapper>
      ),
      containsMaximized: isMaximized,
      hiddenWidgets: [],
    };
  }

  // 3) É wrapper genérico? desce recursivamente pelos filhos
  if (node.props?.children) {
    const results = React.Children.toArray(node.props.children).map(
      (child, index) => injectPropsRecursively(
        child,
        filterProps,
        filterBarProps,
        maximizedWidgetIds,
        hiddenWidgetIds,
        toggleWidget,
        hideWidget,
        `${nextPath}.${index}`,
      ),
    );
    const containsMaximized = results.some((r) => r.containsMaximized);

    // Se este wrapper é a linha (Flex row) ou a coluna percentual que contém
    // o widget maximizado, força ele a ocupar 100% e a quebrar a linha —
    // isso empurra os irmãos daquela linha para baixo em vez de escondê-los.
    const extraProps: Record<string, unknown> = {};
    const nodeProps = node.props as { flexDirection?: string; width?: unknown };
    if (containsMaximized && nodeProps.flexDirection === 'row') {
      extraProps.flexWrap = 'wrap';
    }
    if (containsMaximized && typeof nodeProps.width === 'string' && nodeProps.width !== '100%') {
      extraProps.width = '100%';
    }

    return {
      node: React.cloneElement(node, extraProps, results.map((r) => r.node)),
      containsMaximized,
      hiddenWidgets: results.flatMap((r) => r.hiddenWidgets),
    };
  }

  // 4) Qualquer outro nó sem children
  return { node, containsMaximized: false, hiddenWidgets: [] };
}

const Dashboard: React.FC<DashboardProps> & { Filter: typeof DashboardFilter } = ({
  children,
}) => {
  const [filters, setFilters] = useState<FilterItemValues>({});
  const [maximizedWidgetIds, setMaximizedWidgetIds] = useState<Set<string>>(new Set());
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<string>>(new Set());

  const autoRefresh = useAutoRefreshMs()
  const setContextLastRefreshedAt = useSetLastRefreshedAt()
  const contextLastRefreshedAt = useLastRefreshedAt()
  const setSidebarDismissed = useSetSidebarDismissed()

  // Cada widget é independente: maximizar um não afeta os outros que já
  // estiverem maximizados.
  const handleToggleWidget = useCallback((widgetId: string) => {
    setMaximizedWidgetIds(prev => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      return next;
    });
  }, []);

  const handleHideWidget = useCallback((widgetId: string) => {
    setHiddenWidgetIds(prev => new Set(prev).add(widgetId));
    // um widget oculto não faz sentido continuar maximizado
    setMaximizedWidgetIds(prev => {
      if (!prev.has(widgetId)) return prev;
      const next = new Set(prev);
      next.delete(widgetId);
      return next;
    });
  }, []);

  const handleRestoreWidget = useCallback((widgetId: string) => {
    setHiddenWidgetIds(prev => {
      const next = new Set(prev);
      next.delete(widgetId);
      return next;
    });
  }, []);

  const injectResult = useMemo(() => {
    return injectPropsRecursively(
      children,
      { filters: filters, lastRefreshedAt: contextLastRefreshedAt },
      { onFiltersChange: setFilters, },
      maximizedWidgetIds,
      hiddenWidgetIds,
      handleToggleWidget,
      handleHideWidget,
    )
  },[children, filters, contextLastRefreshedAt, maximizedWidgetIds, hiddenWidgetIds, handleToggleWidget, handleHideWidget]);

  const enhancedChildren = injectResult.node;
  const hiddenWidgets = injectResult.hiddenWidgets;

  useEffect(() => {
    if (!autoRefresh || autoRefresh <= 0) return;

    const id = setInterval(() => {
      const data = new Date()
      setContextLastRefreshedAt(data);
    }, autoRefresh);

    return () => clearInterval(id);
  }, [autoRefresh, setContextLastRefreshedAt]);

  // Recolhe o menu lateral enquanto pelo menos um widget estiver maximizado,
  // para dar mais espaço às linhas expandidas; reabre quando nenhum estiver.
  useEffect(() => {
    setSidebarDismissed(maximizedWidgetIds.size > 0);
  }, [maximizedWidgetIds, setSidebarDismissed]);

  return (
    <Flex flexDirection="column">
      {hiddenWidgets.length > 0 && (
        <Container>
          <Flex flexDirection="row" flexWrap="wrap" gap={8} alignItems="center">
            <span style={{ fontSize: '0.875rem' }}>Ocultos:</span>
            {hiddenWidgets.map((w) => (
              <Button
                key={w.id}
                size="condensed"
                variant="emphasized"
                color="primary"
                style={dashboardWidgetHeaderButtonStyle(true)}
                onClick={() => handleRestoreWidget(w.id)}
                aria-label={`Restaurar ${w.title ?? w.id}`}
              >
                <Button.Prefix><ViewIcon /></Button.Prefix>
                {w.title ?? w.id}
              </Button>
            ))}
          </Flex>
        </Container>
      )}
      {enhancedChildren}
    </Flex>
  );
};

Dashboard.Filter = DashboardFilter;
export { Dashboard };
