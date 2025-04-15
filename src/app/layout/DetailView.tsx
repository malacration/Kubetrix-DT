import React, { useState } from 'react';

import {
  Page,
  TitleBar,
} from '@dynatrace/strato-components-preview/layouts';
import { Button } from '@dynatrace/strato-components';
import { XmarkIcon } from '@dynatrace/strato-icons';
import { FormField, Label, NumberInput } from '@dynatrace/strato-components-preview';
import { config } from 'process';
import { Link } from 'react-router-dom';
import { Details } from '@dynatrace/strato-components-preview/content/empty-state/slot-components/Details';

type Props = {
    isDismissed: boolean
}

const exemplos = [
    { label: 'Annotations Chart', path: '/exemplos/annotations-chart' },
    { label: 'Bar Chart Categorical', path: '/exemplos/CategoricalBarChart' },
    { label: 'Bar Chart Thresholds', path: '/exemplos/CategoricalBarChartThresholds' },
    { label: 'Loading Chart', path: '/exemplos/LoadingChart' },
    { label: 'Donut Chart', path: '/exemplos/DonutChart' },
    { label: 'Gauge Chart', path: '/exemplos/GaugeChart' },
    { label: 'Histogram Chart', path: '/exemplos/HistogramChart' },
    { label: 'Honeycomb Chart', path: '/exemplos/HoneycombChart' },
    { label: 'MeterBar Chart', path: '/exemplos/MeterBarChart' },
    { label: 'Pie Chart', path: '/exemplos/PieChart' },
    { label: 'Sparkline', path: '/exemplos/Sparkline' },
    { label: 'TimeseriesChart', path: '/exemplos/TimeseriesChart' },
    
  ];


export const DetailView = ({ isDismissed }: Props) => {  
    return (
        <Page.DetailView
            dismissed={isDismissed}
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            <TitleBar>
                <TitleBar.Title>Exemplos</TitleBar.Title> 
            </TitleBar>
            <br></br>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {exemplos.map((exemplo, idx) => (
                    <Button
                    key={idx}
                    as={Link}
                    to={exemplo.path}
                    // variant="ghost"
                    >
                    {exemplo.label}
                    </Button>
                ))}
            </div>
            
        </Page.DetailView>
    );
};