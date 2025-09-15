import React, { useEffect, useState } from 'react';
import { useFrontendsSelected, useFrontKpisSelected, useLastRefreshedAt } from '../../context/FilterK8sContext';
import { ReponseTimeByFront } from './kpis/ReponseTimeByFront';
import { Container, Divider, Flex } from '@dynatrace/strato-components/layouts';
import Colors from '@dynatrace/strato-design-tokens/colors';
import Borders from '@dynatrace/strato-design-tokens/borders';

import './KubetrixKpi.css';
import { P90ByFront } from './kpis/P90ByFront';
import { ThroughputByFront } from './kpis/ThroughputByFront';
import { FailureCountByFrontKPI } from './kpis/FailureCountByFrontKPI';
import { UserActionTime } from './kpis/UserActionTime';
import { ApdexKpi } from './kpis/ApdexKPI';


async function getRumSamplingPercent(applicationId: string) {
  const url = `https://zey48022.apps.dynatrace.com/api/v2/settings/objects` +
    `?schemaIds=builtin:rum.web.enablement&scopes=${encodeURIComponent(applicationId)}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.items?.[0]?.value?.rum?.costAndTrafficControl ?? null; // inteiro 0..100
}



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
                            kpis.findIndex(it => it == "duration") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <UserActionTime front={frontend} />
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