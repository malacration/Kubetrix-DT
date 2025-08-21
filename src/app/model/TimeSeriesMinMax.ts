import type { Timeseries } from '@dynatrace/strato-components-preview/charts';

type BoundsMode = 'range' | 'relative';

interface MinMaxOptions {
  /** Fração de padding (0.10 = 10%) */
  padding: number;
  /** Se true, não deixa o min passar de 0 (útil para métricas sempre positivas) */
  clampZero: boolean;
  /** 'range' = 10% do (max-min) | 'relative' = 10% de min/max */
  mode: BoundsMode;
}

type DP = Timeseries['datapoints'][number];

function dpValue(dp: DP): number | undefined {
  if (dp == null) return undefined;
  if (Array.isArray(dp)) {
    const v = dp[1];
    return Number.isFinite(v) ? v : undefined;
  }
  const any = dp as any;
  if (Number.isFinite(any.value)) return any.value as number;
  if (Number.isFinite(any.y)) return any.y as number;
  return undefined;
}

export class TimeSeriesMinMax {
    
  private _min = 0;
  private _max = 1;
  private opts: MinMaxOptions;

  constructor(series: Timeseries[], opts?: Partial<MinMaxOptions>) {
    this.opts = { padding: 0.10, clampZero: true, mode: 'range', ...opts };
    this.recompute(series);
  }

  /** Atualiza com novas séries (opcional) */
  recompute(series: Timeseries[]) {
    const values: number[] = [];
    for (const s of series ?? []) {
      for (const dp of s.datapoints ?? []) {
        const v = dpValue(dp);
        if (Number.isFinite(v)) values.push(v!);
      }
    }

    if (values.length === 0) {
      this._min = 0;
      this._max = 1;
      return;
    }

    this._min = Math.min(...values);
    this._max = Math.max(...values);

    // Evita limites idênticos (série “plana”)
    if (this._min === this._max) {
      const bump = Math.max(Math.abs(this._max) * 1e-6, Number.EPSILON);
      this._min -= bump;
      this._max += bump;
    }
  }

  get rawMin() { return this._min; }
  get rawMax() { return this._max; }
  get range() { return this._max - this._min; }

  /** Limites com padding conforme opções */
  get padded() {
    const { padding, clampZero, mode } = this.opts;

    if (mode === 'relative') {
      const minPad = Math.abs(this._min) * padding;
      const maxPad = Math.abs(this._max) * padding;
      const min = clampZero ? Math.max(0, this._min - minPad) : this._min - minPad;
      const max = this._max + maxPad;
      return { min, max };
    }

    // mode === 'range'
    const padAbs = Math.max(this.range, Number.EPSILON) * padding;
    const min = clampZero ? Math.max(0, this._min - padAbs) : this._min - padAbs;
    const max = this._max + padAbs;
    return { min, max };
  }

  /** Atalho para usar no <TimeseriesChart.YAxis /> */
  forYAxis() {
    const { min, max } = this.padded;
    return { min, max };
  }
}
