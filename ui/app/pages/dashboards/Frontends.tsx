import React, { useEffect, useState } from 'react';
import { Dashboard } from 'app/components/dashboard/DashBoard';
import { FilterFrontend } from 'app/components/filters/FilterFrontend';
import MultiplesKpis from 'app/components/widget/_front/mutiplesKpis';



const FrontEnds = () => {
    return( 
        <div>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FilterFrontend />
                </Dashboard.Filter>
                <MultiplesKpis></MultiplesKpis>
            </Dashboard>
        </div>
    )
};


export default FrontEnds