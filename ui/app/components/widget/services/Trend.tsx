import React from 'react';
import { ArrowSmallUpIcon, ArrowSmallDownIcon } from '@dynatrace/strato-icons';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';

const COLORS = {
  better: 'var(--dt-colors-charts-status-ideal-default)',
  worse: 'var(--dt-colors-charts-status-critical-default)',
  neutral: 'var(--dt-colors-theme-neutral-80)',
};

type TrendProps = {
  curr: number;
  base: number;
  lowerIsBetter?: boolean;
  tolPct?: number;
  label?: string;
  separatorChar?: string;
};

export function Trend({
  curr, base, lowerIsBetter = true, tolPct = 50, label,
  separatorChar = '•',
}: TrendProps) {
  if (!isFinite(curr) || !isFinite(base) || base <= 0) return <span>—</span>;

  const delta = ((curr - base) / base) * 100;
  const abs = Math.abs(delta).toFixed(1);

  const isUp = delta >= tolPct;
  const isDown = delta <= -tolPct;
  const better = lowerIsBetter ? isDown : isUp;
  const worse  = lowerIsBetter ? isUp   : isDown;

  const color = better ? COLORS.better : worse ? COLORS.worse : COLORS.neutral;
  const Arrow = isDown ? ArrowSmallDownIcon : ArrowSmallUpIcon;

  const trendHint = lowerIsBetter ? 'Lower is better' : 'Higher is better';
  const labelArrow = `trend ${isDown ? 'down' : 'up'} ${abs}% vs base (${trendHint})`;

  // const ColoredPart = (
  //   <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color }}>
  //     <Arrow size="small" aria-label={labelArrow} />
  //     {/* Tooltip nativo com title (mais simples, sem dependências) */}
  //     <span title={trendHint}>{abs}%</span>
  //   </span>
  // );

  // Se quiser usar o Tooltip do Strato, descomente o import e use useStratoTooltip={true}
  const ColoredPart = (
    <Tooltip text={trendHint}>
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color }}>
        <Arrow size="small" aria-label={labelArrow} />
        <span>{abs}%</span>
      </span>
    </Tooltip>
  )

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {ColoredPart}

      {label && (
        <>
          {/* separador visual neutro */}
          <span
            role="separator"
            aria-hidden="true"
            style={{ color: 'var(--dt-colors-theme-neutral-60)' }}
          >
            {separatorChar}
          </span>

          {/* label em cor neutra (não “herda” o verde/vermelho) */}
          <span style={{ color: 'var(--dt-colors-theme-neutral-90)' }}>
            {label}
          </span>
        </>
      )}
    </span>
  );
}
