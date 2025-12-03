import React, { useEffect, useState } from 'react';
import { Dashboard } from 'app/components/dashboard/DashBoard';
import { FilterFrontend } from 'app/components/filters/FilterFrontend';
import { CallServices } from 'app/components/widget/services/CallsServices';



const Teste = () => {
    return( 
        <div>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FilterFrontend />
                </Dashboard.Filter>
                <CallServices allowAll={true} ></CallServices>
            </Dashboard>
        </div>
    )
};


export default Teste