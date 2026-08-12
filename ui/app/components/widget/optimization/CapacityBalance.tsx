import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { DonutChart, SingleValue } from '@dynatrace/strato-components-preview/charts';
import { InformationOverlay } from '@dynatrace/strato-components-preview/overlays';
import { Text } from '@dynatrace/strato-components/typography';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { ConvertibleUnit, FormatOptions, Unit } from '@dynatrace-sdk/units';

const SLICE_COLORS = {
  /** Recurso que de fato volta pro cluster depois de cobrir as carências internas. */
  surplus: Colors.Charts.Threshold.Good.Default,
  /** Liberado que não sai do lugar: é reabsorvido pelos workloads que estão apertados. */
  reused: Colors.Charts.Threshold.Warning.Default,
  /** Carência que sobra depois de esgotar o liberado — tem que vir de capacidade nova. */
  fromCluster: Colors.Charts.Threshold.Bad.Default,
} as const;

export type CapacityBalanceProps = {
  /** Rótulo do recurso, ex.: "CPU" / "Memória". */
  resourceLabel: string;
  /** Soma das sobras de todos os workloads, na unidade base (Cores ou Bytes). */
  freed: number;
  /** Soma das carências de todos os workloads, positiva, na mesma unidade. */
  needed: number;
  formatter: FormatOptions<Unit, ConvertibleUnit>;
  loading?: boolean;
};

/**
 * Balanço de capacidade de um recurso: quanto sobra, quanto é reabsorvido
 * internamente e quanto ainda precisa vir do cluster.
 *
 * As três fatias NÃO se sobrepõem — cada unidade de recurso é contada uma vez só,
 * e a soma delas é `max(freed, needed)`. Ver o texto do InformationOverlay abaixo,
 * que é a explicação mostrada ao usuário.
 */
export function CapacityBalance({
  resourceLabel,
  freed,
  needed,
  formatter,
  loading = false,
}: CapacityBalanceProps) {
  const reused      = Math.min(freed, needed);
  const surplus     = Math.max(0, freed - needed);
  const fromCluster = Math.max(0, needed - freed);

  const net = freed - needed;
  const isDeficit = net < 0;

  // Slices zeradas são omitidas: o donut renderiza uma fatia de 0% como um traço
  // e polui a legenda sem informar nada.
  //
  // Rótulos curtos de propósito: a legenda fica ao lado de um donut pequeno, e nomes
  // longos ("Reaproveitado internamente") truncavam no meio, virando algo ilegível
  // como "Reapro...mente". O sentido completo de cada cor está no InformationOverlay.
  const slices = [
    { category: 'Sobra',       value: surplus,     color: SLICE_COLORS.surplus },
    { category: 'Reaproveit.', value: reused,      color: SLICE_COLORS.reused },
    { category: 'Novo',        value: fromCluster, color: SLICE_COLORS.fromCluster },
  ].filter(s => s.value > 0);

  const help = (
    <Flex flexDirection="column" gap={8}>
      <Text>
        Balanço de {resourceLabel} somando todos os workloads do filtro atual. Cada
        unidade aparece em uma fatia só, então o total do gráfico é o maior entre o
        que sobra e o que falta — não a soma dos dois.
      </Text>
      <Text>
        <b style={{ color: SLICE_COLORS.surplus }}>Verde — sobra pro cluster:</b> o que
        realmente volta a ficar disponível depois de cobrir as carências internas.
        Só existe quando o total liberado supera o total necessário.
      </Text>
      <Text>
        <b style={{ color: SLICE_COLORS.reused }}>Amarelo — reaproveitado internamente:</b> a
        parte do liberado que não vira ganho, porque é consumida pelos workloads que
        estão reservando menos do que precisam. Sai de um workload e entra em outro.
      </Text>
      <Text>
        <b style={{ color: SLICE_COLORS.fromCluster }}>Vermelho — novo do cluster:</b> a
        carência que ainda resta depois de esgotar tudo que foi liberado. Essa parte
        não sai de realocação: exige capacidade nova.
      </Text>
      <Text>
        Exemplo: liberando 10 e precisando de 11, o amarelo fica com 10 (todo o
        liberado é reabsorvido), o vermelho com 1 (o que falta de verdade) e o verde
        com 0 — total 11.
      </Text>
      <Text>
        O cálculo é sobre o <b>request</b>, que é o que reserva capacidade no nó. Reduzir
        apenas o <i>limit</i> não devolve nada ao scheduler.
      </Text>
    </Flex>
  );

  return (
    // O ícone é o PRIMEIRO filho, na borda esquerda do card, e não um irmão solto no
    // fim da linha: ali ele ficava espremido contra o item que tem flex:1 e, quando os
    // cards quebravam linha, aparecia longe do card a que pertence — dava a impressão
    // de estar duplicado e fora de lugar. O InformationOverlay.Trigger já renderiza seu
    // próprio ícone por padrão, então não passamos children de ícone aqui (evita o
    // ícone duplicado).
    <Flex alignItems="center" gap={8} style={{ minWidth: '30em', flex: '1 1 30em' }}>
      <InformationOverlay>
        <InformationOverlay.Trigger
          aria-label={`Como o balanço de ${resourceLabel} é calculado`}
        />
        <InformationOverlay.Content>{help}</InformationOverlay.Content>
      </InformationOverlay>
      {/* width/height do DonutChart definem a caixa INTEIRA (círculo + legenda), não só
          o círculo. Por isso a caixa é bem mais larga que alta: com a legenda à direita
          e ratio 0.45, sobram ~140px pro círculo (mais que os 86px originais) e ~115px
          pra legenda, que com os rótulos curtos cabe sem truncar. */}
      <div style={{ width: 260, height: 130, flexShrink: 0 }}>
        <DonutChart
          data={{ slices }}
          height={130}
          width={260}
          loading={loading}
        >
          <DonutChart.Legend position="right" ratio={0.45} />
        </DonutChart>
      </div>
      <div style={{ height: '7em', flex: 1, minWidth: '10em' }}>
        <SingleValue
          data={Math.abs(net)}
          label={`${resourceLabel} ${isDeficit ? 'necessária' : 'recuperável'}`}
          formatter={formatter}
          loading={loading}
        />
      </div>
    </Flex>
  );
}
