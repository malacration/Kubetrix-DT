import React, { useEffect, useState } from 'react';
import { useFrontendsSelected, useFrontKpisSelected as useKpisSelected, useLastRefreshedAt } from './../../context/FilterK8sContext';

import './../style/KubetrixKpi.css';
import { SessionsCountKPI } from './kpis/SessionsCountKPI';
import { Flex } from '@dynatrace/strato-components/layouts';
import { SessionsTimeKPI } from './kpis/SessionsTimeKPI';
import { ActiveConKPI } from './kpis/ActivityConKPI';
import { removeParenthesesContent } from 'app/components/utils/abreviaNomes';
import { ConflictsKPI } from './kpis/ConflictsKPI';
import { KpiGeneric } from '../KpiGeneric';


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
                        }
                        {
                            kpis.findIndex(it => it == "session-time") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <SessionsTimeKPI front={kpi}/>
                            </Flex>
                            : <></>
                        }
                        
                        {
                            kpis.findIndex(it => it == "activity") > -1 ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ActiveConKPI front={kpi}/>
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "idle-conn") > -1  ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Idle Conn'
                                    metric='postgres.activity.idle'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }


                        {
                            kpis.findIndex(it => it == "idle-trans") > -1  ? 
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Idle Transaction'
                                    metric='postgres.activity.idle_in_transaction'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "idle-abort") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Idle Trans. Aborted'
                                    metric='postgres.activity.idle_in_transaction_aborted'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }




                        {
                            kpis.findIndex(it => it == "conflict") > -1 ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <ConflictsKPI front={kpi}/>
                            </Flex>
                            : <></>
                        }
                        {
                            kpis.findIndex(it => it == "commits") > -1 ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Commits'
                                    metric='postgres.xact_commit.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "rollback") > -1 ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Rollback'
                                    metric='postgres.xact_rollback.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "dead") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='DeadLocks'
                                    metric='postgres.deadlocks.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "fetch") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Fetched (index)'
                                    metric='postgres.tup_fetched.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "fetch-total") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Fetched (total)'
                                    metric='postgres.tup_returned.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "insert") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Inserted'
                                    metric='postgres.tup_inserted.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "update") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Updated'
                                    metric='postgres.tup_updated.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "delete") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Deleted'
                                    metric='postgres.tup_deleted.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "session") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Session'
                                    metric='postgres.sessions.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "session-aban") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Session Aban.'
                                    metric='postgres.sessions_abandoned.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
                            </Flex>
                            : <></>
                        }

                        {
                            kpis.findIndex(it => it == "session-fatal") > -1  ?
                            <Flex padding={0} margin={0} className="kdt-content">
                                <KpiGeneric 
                                    label='Session Fatal'
                                    metric='postgres.sessions_fatal.count'
                                    type='sql:postgres_database' 
                                    application={kpi}
                                />
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