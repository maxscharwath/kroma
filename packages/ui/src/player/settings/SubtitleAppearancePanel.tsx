import { forwardRef, type ReactNode, useImperativeHandle } from 'react';
import { useT } from '../../i18n';
import type { PanelHandle } from '../nav';
import {
  SUB_COLORS,
  type SubEdge,
  type SubFont,
  type SubSize,
  type SubtitleAppearance,
  subtitleCss,
} from '../subtitle-appearance';
import { useListFocus } from '../useListFocus';
import { rowCx, valueLabel, valueRow, valueRowOff, valueRowOn } from './panelStyle';

interface SubtitleAppearancePanelProps {
  appearance: SubtitleAppearance;
  onAppearance: (patch: Partial<SubtitleAppearance>) => void;
  onBack: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Move `dir` steps through `options` from `current`, clamped (no wrap). */
function step<V>(options: readonly V[], current: V, dir: -1 | 1): V {
  const i = options.indexOf(current);
  return options[clamp((i < 0 ? 0 : i) + dir, 0, options.length - 1)] ?? current;
}

const SIZES: SubSize[] = ['sm', 'md', 'lg', 'xl'];
const EDGES: SubEdge[] = ['shadow', 'box', 'outline', 'none'];
const FONTS: SubFont[] = ['sans', 'serif', 'mono'];

interface AppRow {
  key: string;
  label: string;
  nudge: (dir: -1 | 1) => void;
  control: ReactNode;
}

/**
 * Subtitle appearance (§8): a live preview above value rows for size, colour,
 * edge, font and opacity (plus box background opacity when the edge is a box).
 * ▲▼ move between rows, ◀▶ change the focused row's value.
 */
export const SubtitleAppearancePanel = forwardRef<PanelHandle, SubtitleAppearancePanelProps>(
  function SubtitleAppearancePanel({ appearance, onAppearance, onBack }, ref) {
    const t = useT();
    const set = (patch: Partial<SubtitleAppearance>) => onAppearance(patch);

    const rows: AppRow[] = [
      {
        key: 'size',
        label: t('player.subSize'),
        nudge: (d) => set({ size: step(SIZES, appearance.size, d) }),
        control: (
          <Seg<SubSize>
            value={appearance.size}
            options={[
              { v: 'sm', label: 'S' },
              { v: 'md', label: 'M' },
              { v: 'lg', label: 'L' },
              { v: 'xl', label: 'XL' },
            ]}
            onPick={(v) => set({ size: v })}
          />
        ),
      },
      {
        key: 'color',
        label: t('player.subColor'),
        nudge: (d) => set({ color: step(SUB_COLORS, appearance.color, d) }),
        control: <Swatches value={appearance.color} onPick={(c) => set({ color: c })} />,
      },
      {
        key: 'edge',
        label: t('player.subEdge'),
        nudge: (d) => set({ edge: step(EDGES, appearance.edge, d) }),
        control: (
          <Seg<SubEdge>
            value={appearance.edge}
            options={[
              { v: 'shadow', label: t('subtitle.shadow') },
              { v: 'box', label: t('subtitle.box') },
              { v: 'outline', label: t('subtitle.outline') },
              { v: 'none', label: t('subtitle.none') },
            ]}
            onPick={(v) => set({ edge: v })}
          />
        ),
      },
      {
        key: 'font',
        label: t('player.subFont'),
        nudge: (d) => set({ font: step(FONTS, appearance.font, d) }),
        control: (
          <Seg<SubFont>
            value={appearance.font}
            options={[
              { v: 'sans', label: t('player.subFontSans') },
              { v: 'serif', label: t('player.subFontSerif') },
              { v: 'mono', label: t('player.subFontMono') },
            ]}
            onPick={(v) => set({ font: v })}
          />
        ),
      },
      {
        key: 'opacity',
        label: t('player.subOpacity'),
        nudge: (d) => set({ opacity: clamp(appearance.opacity + d * 10, 20, 100) }),
        control: <Meter value={appearance.opacity} />,
      },
    ];
    if (appearance.edge === 'box') {
      rows.push({
        key: 'bgOpacity',
        label: t('player.subBgOpacity'),
        nudge: (d) => set({ bgOpacity: clamp(appearance.bgOpacity + d * 5, 0, 100) }),
        control: <Meter value={appearance.bgOpacity} />,
      });
    }

    const focus = useListFocus({
      count: rows.length,
      onHorizontal: (i, d) => rows[i]?.nudge(d),
      onBack,
    });
    useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

    return (
      <div>
        <div className="mb-[18px] flex min-h-[92px] items-center justify-center rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(135deg,#1c1c24,#0d0d11)] px-5 py-4 text-center">
          <span style={subtitleCss(appearance)}>{t('player.subPreview')}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <AppearanceRow
              key={r.key}
              label={r.label}
              focused={focus.index === i}
              onFocus={focus.hover(i)}
              onDec={() => r.nudge(-1)}
              onInc={() => r.nudge(1)}
            >
              {r.control}
            </AppearanceRow>
          ))}
        </div>
      </div>
    );
  },
);

/** A value row: a label + ◀▶ header, then the control beneath it. */
function AppearanceRow({
  label,
  focused,
  onFocus,
  onDec,
  onInc,
  children,
}: Readonly<{
  label: string;
  focused: boolean;
  onFocus: () => void;
  onDec: () => void;
  onInc: () => void;
  children: ReactNode;
}>) {
  const arrow = `flex-none cursor-pointer border-none bg-transparent px-1 text-[17px] leading-none text-accent ${
    focused ? 'opacity-100' : 'opacity-40'
  }`;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: onMouseEnter only moves D-pad focus onto the row (hover cue, §15); the controls are the ◀ ▶ + segment/swatch/meter buttons inside.
    <div onMouseEnter={onFocus} className={rowCx(valueRow, valueRowOn, valueRowOff, focused)}>
      <div className="mb-[11px] flex items-center justify-between">
        <span className={valueLabel}>{label}</span>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="prev" onClick={onDec} className={arrow}>
            ◀
          </button>
          <button type="button" aria-label="next" onClick={onInc} className={arrow}>
            ▶
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Full-width segmented control (size / edge / font). */
function Seg<V extends string>({
  value,
  options,
  onPick,
}: Readonly<{ value: V; options: { v: V; label: string }[]; onPick: (v: V) => void }>) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onPick(o.v)}
          className={`flex-1 rounded-[9px] py-[9px] text-center font-sans font-bold text-[13px] border-none outline-none cursor-pointer transition-[background] duration-150 ease-out ${
            o.v === value
              ? 'bg-accent text-accent-ink'
              : 'bg-[rgba(255,255,255,0.06)] text-[rgba(244,243,240,0.7)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Row of 32px colour swatches (subtitle colour). */
function Swatches({ value, onPick }: Readonly<{ value: string; onPick: (color: string) => void }>) {
  return (
    <div className="flex gap-3.5">
      {SUB_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onPick(c)}
          style={{ background: c }}
          className={`h-8 w-8 rounded-full border-none cursor-pointer outline-none ${
            c === value ? 'shadow-[0_0_0_2px_#F4B642]' : 'shadow-[0_0_0_1px_rgba(255,255,255,0.2)]'
          }`}
        />
      ))}
    </div>
  );
}

/** A read-only amber meter with a trailing percent (opacity rows). */
function Meter({ value }: Readonly<{ value: number }>) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.14)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#F4B642,#FFD262)]"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="min-w-[52px] text-right font-sans font-bold text-[14px] tabular-nums text-text">
        {value}%
      </span>
    </div>
  );
}
