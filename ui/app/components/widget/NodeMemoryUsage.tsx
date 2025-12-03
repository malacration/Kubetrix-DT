import { HoneycombChart, HoneycombTileNumericData, HoneycombTileCategoricalData, HoneycombTileData, ChartSeriesAction } from '@dynatrace/strato-components-preview/charts';
import React, { useEffect, useState } from 'react';
import { LastHostMetric } from 'app/services/k8s/NodeServices';
import { percentOverloadColorScheme } from './style/Palette';
import { ChartProps } from '../filters/BarChartProps';
import { converterToHoneycomb } from 'app/services/core/GrailConverter';
import { ExternalLinkIcon, MagnifyingGlassIcon } from '@dynatrace/strato-icons';


function NodeMemoryUsage({ filters, lastRefreshedAt }: ChartProps, showLabels = true) {
  const [metric, setMetric] = useState<HoneycombTileNumericData[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    const cluster = filters?.cluster?.value;
    const namespace = filters?.namespace?.value;
    const workload = filters?.workload?.value;
    const timeframe = filters?.timeframe?.value;
  
    if (!cluster || !namespace || !workload || !timeframe) return;
  
    setLoading(true);
    LastHostMetric("dt.host.memory.usage",cluster, namespace, workload, timeframe).then((it) => {
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
            unit={"%"}
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

(NodeMemoryUsage as any).dashboardWidget = true;

export { NodeMemoryUsage };
