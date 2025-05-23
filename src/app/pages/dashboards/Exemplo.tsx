import React, { useEffect, useState } from 'react';
import { FiltersK8s } from  '../../components/filters/FilterK8s'
import { WorkloadResponseTime } from 'src/app/components/widget/WorkloadResponseTime';
import { Dashboard } from 'src/app/components/dashboard/DashBoard';
import { NodeCpuOverload } from 'src/app/components/widget/NodeCpuOverload';
import Spacings from '@dynatrace/strato-design-tokens/spacings';
import { Container, Flex } from '@dynatrace/strato-components/layouts';
import { WorkloadCpuMemoryUsage } from 'src/app/components/widget/WorkloadCpuMemoryUsage';



const Dashboards = () => {
    return( 
        <Dashboard>
            <Dashboard.Filter>
                <FiltersK8s />
            </Dashboard.Filter>
            
            <WorkloadResponseTime title="Response Time"  />
            <Flex flexDirection="row" width="100%" title='windson'>
                <Flex flexItem flexGrow={1}>
                    <WorkloadCpuMemoryUsage title='CPU and Memory Usage'  />
                </Flex>
                <Flex flexItem flexGrow={2}>
                    <NodeCpuOverload title='CPU Overload' />
                </Flex>
            </Flex>
            <div>
                <li>Throughput</li>
                <li>Data Base relacionados e problemas possiveis</li>
                <li>Uso de memoria e cpu</li>
            </div>
        </Dashboard>
    )
};


export default Dashboards