import React, { useEffect, useState } from 'react';
import { useFrontendsSelected, useLastRefreshedAt } from '../../context/FilterK8sContext';
import { ReponseTimeByFront } from './ReponseTimeByFront';
import { Container, Divider, Flex } from '@dynatrace/strato-components/layouts';
import Colors from '@dynatrace/strato-design-tokens/colors';
import Borders from '@dynatrace/strato-design-tokens/borders';

import './KubetrixKpi.css';
import { P90ByFront } from './P90ByFront';
import { ThroughputByFront } from './ThroughputByFront';
import { FailureCountByFrontKPI } from './FailureCountByFrontKPI';


const MultiplesKpis = () => {

    const selecteds = useFrontendsSelected()
    const kpis = ['responseTime']

    useEffect(() => {
        selecteds.forEach(element => {
            console.log(element)
        });
    },[selecteds]);



    return (
    <div>
        {selecteds
        .filter(f => f && f != 'all')
        .map(frontend => (
            <div key={frontend} style={{
                marginBottom: '0.5em'
            }}>
                <Flex padding={8} className="kdt-container">
                    <Flex className="kdt-row kdt-row--tall">
                        <Flex className="kdt-badge">
                            <h4 className="kdt-badge__title">{frontend}</h4>
                        </Flex>
                        <Flex className="kdt-content">
                            <ReponseTimeByFront front={frontend} />
                        </Flex>
                        <Flex className="kdt-content">
                            <ThroughputByFront front={frontend} />
                        </Flex>
                        <Flex className="kdt-content">
                            <FailureCountByFrontKPI front={frontend} />
                        </Flex>
                        <Flex className="kdt-content">
                            <P90ByFront front={frontend} />
                        </Flex>
                    </Flex>
                </Flex>
            </div>
        ))}

        {/* estado vazio */}
        {selecteds.filter(f => f && f !== 'all').length === 0 && (
        <div style={{ opacity: 0.7 }}>Nenhum frontend selecionado.</div>
        )}
  </div>
);
};


export default MultiplesKpis