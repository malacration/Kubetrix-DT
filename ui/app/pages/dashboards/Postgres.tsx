import React from 'react';
import { Dashboard } from 'app/components/dashboard/DashBoard';
import { FilterPostgres } from 'app/components/filters/FilterPostgres';
import MutiplesKpisPostgres from 'app/components/widget/_postgres/mutiplesKpisPostgres';



const FrontEnds = () => {
    return( 
        <div>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FilterPostgres />
                </Dashboard.Filter>
                <MutiplesKpisPostgres></MutiplesKpisPostgres>
            </Dashboard>
        </div>
    )
};


export default FrontEnds