import React, { useEffect, useState } from 'react';
import { FiltersK8s } from  '../../components/filters/FilterK8s'
import { WorkloadResponseTime } from 'src/app/components/visualizations/WorkloadResponseTime';
import { Dashboard } from 'src/app/components/dashboard/DashBoard';
import { NodeCpuOverload } from 'src/app/components/visualizations/NodeCpuOverload';



const Dashboards = () => {

    return( 
        <>
            <div>
                <Dashboard>
                    <Dashboard.Filter>
                        <FiltersK8s />
                    </Dashboard.Filter>
                    <WorkloadResponseTime />
                    <NodeCpuOverload />
                </Dashboard>
            </div>
        </>
    )
};


export default Dashboards