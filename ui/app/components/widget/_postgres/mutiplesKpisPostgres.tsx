import React, { useEffect, useState } from 'react';
import { useFrontendsSelected, useFrontKpisSelected as useKpisSelected, useLastRefreshedAt } from './../../context/FilterK8sContext';

import './../style/KubetrixKpi.css';
import { SessionsKPI } from './kpis/SessionsKPI';
import { Flex } from '@dynatrace/strato-components/layouts';


const MutiplesKpisPostgres = () => {

    const selecteds = useFrontendsSelected()

    const kpis = useKpisSelected()

    useEffect(() => {
        selecteds.forEach(element => {
            console.log(element)
        });
    },[selecteds,kpis]);

    return (
    <div>
        {selecteds
        .filter(f => f && f != 'all')
        .map(frontend => (
            <div key={frontend} style={{
                marginBottom: '0.5em'
            }}>
                <Flex padding={0} margin={0} className="kdt-container">
                    <Flex padding={0} margin={0} className="kdt-row kdt-row--tall">
                        <Flex className="kdt-badge">
                            <h4 className="kdt-badge__title">{frontend}</h4>
                        </Flex>
                        {
                            kpis.findIndex(it => it == "duration50") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <SessionsKPI front={frontend}/>
                            </Flex>
                            : <></>
                        }
                        
                    </Flex>
                </Flex>
            </div>
        ))}
        {selecteds.filter(f => f && f !== 'all').length === 0 && (
        <div style={{ opacity: 0.7 }}>Nenhum frontend selecionado.</div>
        )}
  </div>
);
};

export default MutiplesKpisPostgres