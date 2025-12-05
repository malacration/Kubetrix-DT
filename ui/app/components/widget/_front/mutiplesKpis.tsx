import React, { useEffect, useState } from 'react';
import { useFrontendsSelected, useFrontKpisSelected, useLastRefreshedAt } from './../../context/FilterK8sContext';
import { Flex } from '@dynatrace/strato-components/layouts';

import './../style/KubetrixKpi.css';
import { ThroughputByFront } from './kpis/ThroughputByFront';
import { FailureCountByFrontKPI } from './kpis/FailureCountByFrontKPI';
import { UserActionTime } from './kpis/UserActionTime';
import { ApdexKpi } from './kpis/ApdexKPI';
import { NetworkTime } from './kpis/NetworkTime';
import { ServerTime } from './kpis/ServerTime';


const MultiplesKpis = () => {

    const selecteds = useFrontendsSelected()

    const kpis = useFrontKpisSelected()

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
                                <UserActionTime front={frontend} agreggation='median' />
                            </Flex>
                            : <></>
                        }
                        
                        {
                            kpis.findIndex(it => it == "duration") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <UserActionTime front={frontend} agreggation='avg' />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "duration90") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <UserActionTime front={frontend} agreggation='percentile(90)' />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "duration99") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <UserActionTime front={frontend} agreggation='percentile(99)' />
                            </Flex>
                            : <></>
                        }

                        { 
                            kpis.findIndex(it => it == "net-contri") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <NetworkTime front={frontend} agreggation='avg' />
                            </Flex>
                            : <></>
                        }

                        { 
                            kpis.findIndex(it => it == "server-contri") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ServerTime front={frontend} agreggation='avg' />
                            </Flex>
                            : <></>
                        }
                        
                        { 
                            kpis.findIndex(it => it == "throughput") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ThroughputByFront front={frontend} />
                            </Flex>
                            : <></>
                        }

                        { 
                            kpis.findIndex(it => it == "failure-Count") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <FailureCountByFrontKPI front={frontend} />
                            </Flex>
                            : <></>
                        }

                        { 
                            kpis.findIndex(it => it == "apdex") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ApdexKpi front={frontend} />
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

export default MultiplesKpis