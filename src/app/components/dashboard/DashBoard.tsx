// Dashboard.tsx
import React, {
  useState, useMemo, cloneElement, ReactElement, useEffect,
} from 'react';
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
  lastRefreshedAt : Date
}

function DashboardFilter(
  { children, ...injected }: React.PropsWithChildren<FilterBarProps>,
) {
  return cloneElement(children as ReactElement, injected);
}
DashboardFilter.displayName = 'DashboardFilter';

function injectPropsRecursively(
  node: React.ReactNode,
  filterProps: { filters: FilterItemValues; lastRefreshedAt: Date },
  filterBarProps: FilterBarProps,
): React.ReactNode {

  if (Array.isArray(node)) {
    return React.Children.map(
      node,
      child => injectPropsRecursively(child, filterProps, filterBarProps),
    );
  }

  if (!React.isValidElement(node)){
    return node;
  }

  if ((node.type as any).displayName === 'DashboardFilter') {
    return cloneElement(node, filterBarProps);
  }

  // 2) É um widget marcado? injeta filters + refreshToken
  if ((node.type as any).dashboardWidget) {
    const { title } = node.props as { title?: string };
    return (
      <Container>
        {title && (
          <>
            <Heading level={4}>{title}</Heading>
            <Divider variant="accent" style={{ marginBottom: Spacings.Size16 }} />
          </>
        )}
        {cloneElement(node, filterProps)}
      </Container>);
  }

  // 3) É wrapper genérico? desce recursivamente pelos filhos
  if (node.props?.children) {
    const mappedChildren = React.Children.map(
      node.props.children,
      child => injectPropsRecursively(child, filterProps, filterBarProps),
    );
    return React.cloneElement(node, {}, mappedChildren);
  }

  // 4) Qualquer outro nó sem children
  return node;
}

const Dashboard: React.FC<DashboardProps> & { Filter: typeof DashboardFilter } = ({
  children, defaultRefreshIntervalMs = 60000,
}) => {
  const [filters, setFilters] = useState<FilterItemValues>({});

  const autoRefresh = useAutoRefreshMs()
  const setContextLastRefreshedAt = useSetLastRefreshedAt()
  const contextLastRefreshedAt = useLastRefreshedAt()

  const enhancedChildren = useMemo(() => {
    console.log(contextLastRefreshedAt)
    return injectPropsRecursively(children,{ filters: filters, lastRefreshedAt: contextLastRefreshedAt },
    { onFiltersChange: setFilters, lastRefreshedAt: contextLastRefreshedAt },)
  },[children, filters, contextLastRefreshedAt]);

  useEffect(() => {
    if (!autoRefresh || autoRefresh <= 0) return;

    const id = setInterval(() => {
      const data = new Date()
      console.log(data)
      setContextLastRefreshedAt(data);
    }, autoRefresh);

    return () => clearInterval(id);
  }, [autoRefresh, setContextLastRefreshedAt]);

  return (
    <Flex flexDirection="column">
      {enhancedChildren}
    </Flex>
  );
};

Dashboard.Filter = DashboardFilter;
export { Dashboard };