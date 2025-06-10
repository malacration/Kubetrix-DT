import React, { useEffect, useState } from 'react';
import { Dashboard } from 'src/app/components/dashboard/DashBoard';
import { SharedChartInteractions } from '@dynatrace/strato-components-preview/charts';
import { FilterFrontend } from 'src/app/components/filters/FilterFrontend';
import { ServicesByFrontEnd } from 'src/app/components/widget/services/ServicesByFrontEnd';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';



const FrontEnds = () => {
    return( 
        <div>
            <TitleBar>
                <TitleBar.Title>Main</TitleBar.Title>
            </TitleBar>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FilterFrontend />
                </Dashboard.Filter>
                <SharedChartInteractions>
                    <ServicesByFrontEnd title='Called Services' />
                </SharedChartInteractions>
            </Dashboard>
        </div>
    )
};


export default FrontEnds