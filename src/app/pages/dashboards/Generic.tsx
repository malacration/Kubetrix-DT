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
                        <NodeCpuOverload title='CPU Overload' />
                    </Flex>
                </Flex>
                <Flex flexDirection="row" width="100%">
                    <Flex flexItem width="60%">
                        <WorkloadMemoryUsage title="Memory Usage"></WorkloadMemoryUsage>
                    </Flex>
                    <Flex flexItem width="40%">
                        <OutOfMemory title="Out Of Memory"></OutOfMemory>
                    </Flex>
                </Flex>
                <div>
                    <li>Throughput</li>
                    <li>Data Base relacionados e problemas possiveis</li>
                    <li>Uso de memoria e cpu</li>
                </div>
            </SharedChartInteractions>
        </Dashboard>
    )
};


export default Dashboards