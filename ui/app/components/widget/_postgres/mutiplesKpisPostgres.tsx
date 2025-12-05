import React, { useEffect, useState } from 'react';
import { useFrontendsSelected, useFrontKpisSelected as useKpisSelected, useLastRefreshedAt } from './../../context/FilterK8sContext';

import './../style/KubetrixKpi.css';
import { SessionsCountKPI } from './kpis/SessionsCountKPI';
import { Flex } from '@dynatrace/strato-components/layouts';
import { SessionsTimeKPI } from './kpis/SessionsTimeKPI';
import { ActiveConKPI } from './kpis/ActivityConKPI';
import { removeParenthesesContent } from 'app/components/utils/abreviaNomes';
import { ConflictsKPI } from './kpis/ConflictsKPI';


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
        .map(kpi => (
            <div key={kpi} style={{
                marginBottom: '0.5em'
            }}>
                <Flex padding={0} margin={0} className="kdt-container">
                    <Flex padding={0} margin={0} className="kdt-row kdt-row--tall">
                        <Flex className="kdt-badge">
                            <h4 className="kdt-badge__title">{removeParenthesesContent(kpi)}</h4>
                        </Flex>
                        {
                            kpis.findIndex(it => it == "sessions-count") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <SessionsCountKPI front={kpi}/>
                            </Flex>
                            : <></>
                        },
                        {
                            kpis.findIndex(it => it == "session-time") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <SessionsTimeKPI front={kpi}/>
                            </Flex>
                            : <></>
                        },
                        {
                            kpis.findIndex(it => it == "activity") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ActiveConKPI front={kpi}/>
                            </Flex>
                            : <></>
                        },
                        {
                            kpis.findIndex(it => it == "conflict") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ConflictsKPI front={kpi}/>
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