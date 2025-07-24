import React, { useEffect, useState } from 'react';
import { Dashboard } from 'src/app/components/dashboard/DashBoard';
import { SharedChartInteractions } from '@dynatrace/strato-components-preview/charts';
import { FilterFrontend } from 'src/app/components/filters/FilterFrontend';
import { ServicesByFrontEnd } from 'src/app/components/widget/services/ServicesByFrontEnd';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { FiltersK8s } from 'src/app/components/filters/FilterK8s';
import { CpuOptimization } from 'src/app/components/widget/optimization/CpuOptimization';



const FrontEnds = () => {
    return( 
        <div>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FiltersK8s />
                </Dashboard.Filter>
                <CpuOptimization/>
                Optimization
            </Dashboard>
        </div>
    )
};


export default FrontEnds