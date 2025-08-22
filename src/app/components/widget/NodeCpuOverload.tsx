import { ChartSeriesAction, HoneycombChart, HoneycombTileNumericData, Timeseries, TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { LastHostMetric } from 'src/app/services/k8s/NodeServices';
import { percentOverloadColorScheme } from './style/Palette';
import { ChartProps } from '../filters/BarChartProps';
import { converterToHoneycomb } from 'src/app/services/core/GrailConverter';
import { QueryResult } from '@dynatrace-sdk/client-query';
import { ExternalLinkIcon } from '@dynatrace/strato-icons';


function NodeCpuOverload({ filters, lastRefreshedAt }: ChartProps, showLabels = true) {
  const [metric, setMetric] = useState<HoneycombTileNumericData[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    const cluster = filters?.cluster?.value;
    const namespace = filters?.namespace?.value;
    const workload = filters?.workload?.value;
    const timeframe = filters?.timeframe?.value;
  
    if (!cluster || !namespace || !workload || !timeframe) return;
  
    setLoading(true);
    LastHostMetric("dt.host.cpu.usage",cluster, namespace, workload, timeframe).then((it) => {
      setMetric(converterToHoneycomb(it));
      setLoading(false);
    });
  }, [
    filters?.cluster?.value,
    filters?.namespace?.value,
    filters?.workload?.value,
    filters?.timeframe?.value,
    lastRefreshedAt
  ]);

  const openEntity = (entity) => {
    const found = metric.find(it => it.name == entity.name)
    if(found?.id){
      const url = `https://zey48022.apps.dynatrace.com/ui/apps/dynatrace.classic.hosts/ui/entity/${found?.id}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div>
        <HoneycombChart loading={loading}
            data={metric?.sort((a, b) => b.value - a.value)}
            showLabels={showLabels}
            colorScheme={percentOverloadColorScheme}
            unit={"percentage"}
            seriesActions={(s) => (
              <ChartSeriesAction>
                <ChartSeriesAction.Item
                  key={s?.name}
                  onSelect={() => {
                    openEntity(s);
                  }}
                >
                  <ChartSeriesAction.ItemIcon>
                    <ExternalLinkIcon />
                  </ChartSeriesAction.ItemIcon>
                  Open Entity
                </ChartSeriesAction.Item>
              </ChartSeriesAction>
            )}
        >
          <HoneycombChart.Legend position="bottom"/>
        </HoneycombChart>
    </div>
  );
}

(NodeCpuOverload as any).dashboardWidget = true;

export { NodeCpuOverload };
