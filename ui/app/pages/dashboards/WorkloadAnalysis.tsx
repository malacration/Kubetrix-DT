import React, { useEffect } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { SharedChartInteractions } from '@dynatrace/strato-components-preview/charts';

import { Dashboard } from 'app/components/dashboard/DashBoard';
import { FiltersK8s } from 'app/components/filters/FilterK8s';
import { WorkloadCpuUsage } from 'app/components/widget/WorkloadCpuUsage';
import { WorkloadMemoryUsage } from 'app/components/widget/WorkloadMemoryUsage';
import { WorkloadThroughput } from 'app/components/widget/WorkloadThroughput';
import { WorkloadResponseTime } from 'app/components/widget/WorkloadResponseTime';
import { WorkloadNodeResourceUsage } from 'app/components/widget/workload/WorkloadNodeResourceUsage';
import { WorkloadNodeCapacity } from 'app/components/widget/workload/WorkloadNodeCapacity';
import { NodeProcessesCpuUsage } from 'app/components/widget/workload/NodeProcessesCpuUsage';
import { Optimization } from 'app/components/widget/optimization/Optimization';
import {
  useAutoRefreshMs,
  useSetAutoRefreshMs,
  useWorkloadSelected,
  useNamespaceSelected,
  useClusterSelected,
} from 'app/components/context/FilterK8sContext';

/**
 * Análise dedicada de UM workload: os gráficos de uso que já existem, mais o contexto
 * de node que faltava (onde os pods rodaram e quão cheios estão esses nodes).
 *
 * Alcançada por drill-down a partir do Capacity Optimization. Cluster, namespace e
 * workload vêm da URL (params `cluster`, `ns`, `wl` do FilterK8sContext), então o link
 * é compartilhável e sobrevive a reload.
 */
const WorkloadAnalysis = () => {
  const autoRefreshMs = useAutoRefreshMs();
  const setAutoRefreshMs = useSetAutoRefreshMs();
  const cluster = useClusterSelected();
  const namespace = useNamespaceSelected();
  const workload = useWorkloadSelected();

  // Auto-refresh desligado: análise de capacidade se faz sobre janelas longas, e
  // recarregar sozinho só queima consulta sem mudar a conclusão. Mesmo critério da
  // tela de Capacity Optimization.
  useEffect(() => {
    // O setter do contexto é um adaptador e pode mudar de identidade entre
    // renders. Sem esta guarda, o efeito reescrevia `ar=0` na URL repetidamente,
    // remontando widgets e interrompendo hover/seleção dos gráficos.
    if (autoRefreshMs !== 0) {
      setAutoRefreshMs(0);
    }
  }, [autoRefreshMs, setAutoRefreshMs]);

  const semWorkload = !workload || workload === 'all';

  return (
    <Dashboard>
      <Dashboard.Filter>
        <FiltersK8s showAutoRefresh={false} />
      </Dashboard.Filter>

      {semWorkload ? (
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={4}>Selecione um workload</Heading>
          <Text>
            Esta página analisa um workload por vez. Escolha um no filtro acima, ou chegue
            aqui clicando no nome de um workload na tela de Capacity Optimization.
          </Text>
        </Flex>
      ) : (
        <>
          <Flex flexDirection="column" gap={4} padding={8}>
            <Heading level={4}>{workload}</Heading>
            <Text>{cluster} / {namespace}</Text>
          </Flex>

          <Optimization compact />

          <WorkloadNodeCapacity title="Ocupação dos nodes (clique no node para recortar)" />

          {/* Somente gráficos temporais participam do hover/recorte sincronizado.
              A tabela de capacidade tem ciclo de vida próprio e fica fora. */}
          <SharedChartInteractions>
            <Flex flexDirection="row" width="100%">
              <Flex flexItem width="50%">
                <WorkloadCpuUsage title="Uso de CPU" />
              </Flex>
              <Flex flexItem width="50%">
                <WorkloadMemoryUsage title="Uso de Memória" />
              </Flex>
            </Flex>

            <WorkloadNodeResourceUsage title="Uso de CPU e memória dos nodes ao longo do tempo" />

            <NodeProcessesCpuUsage title="Uso de CPU dos processos do node ao longo do tempo" />

            <Flex flexDirection="row" width="100%">
              <Flex flexItem width="65%">
                <WorkloadResponseTime title="Tempo de Resposta" />
              </Flex>
              <Flex flexItem width="35%">
                <WorkloadThroughput title="Throughput" />
              </Flex>
            </Flex>
          </SharedChartInteractions>
        </>
      )}
    </Dashboard>
  );
};

export default WorkloadAnalysis;
