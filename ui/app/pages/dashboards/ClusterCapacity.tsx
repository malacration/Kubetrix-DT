import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { SharedChartInteractions } from '@dynatrace/strato-components-preview/charts';

import { Dashboard } from 'app/components/dashboard/DashBoard';
import { FiltersK8s } from 'app/components/filters/FilterK8s';
import { ClusterCpuCapacity } from 'app/components/widget/cluster/ClusterCpuCapacity';
import { ClusterMemoryCapacity } from 'app/components/widget/cluster/ClusterMemoryCapacity';
import { useClusterSelected } from 'app/components/context/FilterK8sContext';

/**
 * Capacidade agregada de CPU e memória no nível do CLUSTER (ou de toda a frota
 * monitorada, sem cluster selecionado): quanto é usado, reservado e disponível, e
 * como essa proporção evolui ao longo do tempo — normalizada pela capacidade total
 * disponível a cada momento, não por um snapshot fixo.
 */
const ClusterCapacity = () => {
  const cluster = useClusterSelected();

  return (
    <Dashboard>
      <Dashboard.Filter>
        <FiltersK8s />
      </Dashboard.Filter>

      <Flex flexDirection="column" gap={4} padding={8}>
        <Heading level={4}>
          {cluster && cluster !== 'all' ? `Cluster: ${cluster}` : 'Todos os clusters'}
        </Heading>
        <Text>
          Capacidade agregada por CPU e memória. Namespace e Workload do filtro acima
          não afetam esta página — a agregação é sempre no nível do cluster.
        </Text>
      </Flex>

      <SharedChartInteractions>
        <ClusterCpuCapacity title="Capacidade de CPU do Cluster" />
        <ClusterMemoryCapacity title="Capacidade de Memória do Cluster" />
      </SharedChartInteractions>
    </Dashboard>
  );
};

export default ClusterCapacity;
