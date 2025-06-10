import React, { useEffect, useState } from 'react';
import { FiltersK8s } from  '../../components/filters/FilterK8s'
import { WorkloadResponseTime } from 'src/app/components/widget/WorkloadResponseTime';
import { Dashboard } from 'src/app/components/dashboard/DashBoard';
import { NodeCpuOverload } from 'src/app/components/widget/NodeCpuOverload';
import Spacings from '@dynatrace/strato-design-tokens/spacings';
import { Container, Flex } from '@dynatrace/strato-components/layouts';
import { WorkloadCpuUsage } from 'src/app/components/widget/WorkloadCpuUsage';
import { WorkloadMemoryUsage } from 'src/app/components/widget/WorkloadMemoryUsage';
import { WorkloadThroughput } from 'src/app/components/widget/WorkloadThroughput';
import { OutOfMemory } from 'src/app/components/widget/OutOfMemory';
import { SharedChartInteractions } from '@dynatrace/strato-components-preview/charts';
import { Problems } from 'src/app/components/widget/Problems';
import { Services } from 'src/app/components/widget/services/Services';
import { CallServices } from 'src/app/components/widget/services/CallsServices';
import { NodeMemoryUsage } from 'src/app/components/widget/NodeMemoryUsage';



const Dashboards = () => {
    return( 
        <Dashboard>
            <Dashboard.Filter>
                <FiltersK8s />
            </Dashboard.Filter>
            <SharedChartInteractions>
                <Flex flexDirection="row" width="100%">
                    <Flex flexItem width="65%">
                        <WorkloadResponseTime title="Response Time - Workload"  />
                    </Flex>
                    <Flex flexItem width="35%">
                        <WorkloadThroughput title='Throughput' />
                    </Flex>
                </Flex>
                <Flex flexDirection="row" width="100%">
                    <Flex flexItem width="60%">
                        <WorkloadCpuUsage title='CPU Usage'  />
                    </Flex>
                    <Flex flexItem width="40%">
                        <NodeCpuOverload title='CPU Overload By Host' />
                    </Flex>
                </Flex>
                <Flex flexDirection="row" width="100%">
                    <Flex flexItem width="60%">
                        <WorkloadMemoryUsage title="Memory Usage"></WorkloadMemoryUsage>
                    </Flex>
                    <Flex flexItem width="40%">
                        <NodeMemoryUsage title="Memory Usage By Host"></NodeMemoryUsage>
                    </Flex>
                </Flex>
                <CallServices title='Called Services outside of the namespace'></CallServices>
                <Services title='Services'></Services>
                <Problems title='Problems'></Problems>
                <div>
                    <li>Finalizar problems apos resolução do chamado</li>
                    <li>Data Base relacionados e problemas possiveis</li>
                    <li>Adicionar dash com memory by hosting</li>
                    <li>Colocar a memoria disponivel para o workload selecionado</li>
                    <li>colocar o OOM kill como event dentro do timeserieschart</li>
                    <li>gerar OOM restart 24h</li>
                    <li>adicionar OOM restart 24h</li>
                    <li>adicionar times de network com e sem SSL</li>
                </div>
            </SharedChartInteractions>
        </Dashboard>
    )
};


export default Dashboards