import React, { useEffect, useState } from 'react';
import { Dashboard } from 'app/components/dashboard/DashBoard';
import { FiltersK8s } from 'app/components/filters/FilterK8s';
import { Optimization } from 'app/components/widget/optimization/Optimization';
import { WorkloadCpuUsage } from 'app/components/widget/WorkloadCpuUsage';
import { WorkloadMemoryUsage } from 'app/components/widget/WorkloadMemoryUsage';
import { useSetAutoRefreshMs } from 'app/components/context/FilterK8sContext';




const FrontEnds = () => {
    const setAutoRefreshMs = useSetAutoRefreshMs()

    // Auto-refresh desligado por padrão nesta tela: são 11 métricas por consulta,
    // divididas por workload+namespace+cluster, e a análise de capacidade é feita
    // sobre janelas longas — recarregar sozinho a cada 5 min só queima consulta sem
    // mudar a conclusão. O usuário ainda pode religar pelo seletor.
    useEffect(() => {
        setAutoRefreshMs(0)
    }, [])

    return(
        <div>
            <br></br>
            <Dashboard>
                <Dashboard.Filter>
                    <FiltersK8s />
                </Dashboard.Filter>
                <Optimization/>
                <WorkloadCpuUsage title='CPU Usage' desejado={true}></WorkloadCpuUsage>
                <WorkloadMemoryUsage title="Memory Usage"></WorkloadMemoryUsage>
            </Dashboard>
            <ul>
                <li>Usar p95 ou p99 para limites de cpu</li>
                <li>Mostre um “risco de throttle” se throttle_ratio maior que 5%.</li>
            </ul>
        </div>
    )
};


export default FrontEnds