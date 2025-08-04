import React, { useEffect, useState } from 'react';
import { Dashboard } from 'src/app/components/dashboard/DashBoard';
import { FiltersK8s } from 'src/app/components/filters/FilterK8s';
import { Optimization } from 'src/app/components/widget/optimization/Optimization';




const FrontEnds = () => {
    return( 
        <div>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FiltersK8s />
                </Dashboard.Filter>
                <Optimization/>
            </Dashboard>
        </div>
    )
};


export default FrontEnds