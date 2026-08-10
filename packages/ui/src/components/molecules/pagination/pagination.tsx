import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Box, type BoxProps, Row } from '#ui/components/atoms/box';
import { Focusable } from '#ui/components/atoms/focusable';
import { Icon, type IconName, type IconProps } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { type StyleDecl, svFor } from '#ui/core';
import { bySize, CONTROL, type ControlSize, entryDefaultSize } from '#ui/lib/field-shell';
import { FocusRegion } from '#ui/lib/focus-scope';

const WEB = Platform.OS === 'web';

const ARIA_CURRENT = { 'aria-current': 'page' } as unknown as BoxProps;

/** A place in the row: a page to go to, or the run of pages the window hides. */
type PageSlot = number | 'gap';

const paginationVariants = svFor<{
  root: StyleDecl;
  label: StyleDecl;
  icon: Pick<IconProps, 'color' | 'size'>;
}>()({
  slots: {
    root: { center: true, bg: 'transparent', _hover: { bg: 'tint/10' }, _press: { bg: 'tint/18' } },
    label: { font: 'ui', fontWeight: '600', color: 'text/75', _disabled: { color: 'text/25' } },
    icon: { color: 'text/75', _disabled: { color: 'text/25' } },
  },
  variants: {
    size: bySize((m) => ({
      root: { minW: m.height, minH: m.height, px: m.gap, radius: m.radius },
      label: { fontSize: m.fontSize, lineHeight: m.line },
      icon: { size: Math.round(m.fontSize * 1.3) },
    })),
    current: {
      true: {
        root: { bg: 'accent', _hover: { bg: 'accentHover' }, _press: { bg: 'accentPress' } },
        label: { color: 'accentInk', fontWeight: '700' },
      },
    },
  },
  defaults: { size: 'md', current: false },
});

function clamp(page: number, pageCount: number): number {
  return Math.min(Math.max(Math.trunc(page) || 1, 1), pageCount);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let at = from; at <= to; at += 1) out.push(at);
  return out;
}

/**
 * The pages the row shows for `page`, first and last always among them, with a
 * `'gap'` where a run is hidden. Always the same length for a given
 * `pageCount`, so the row never reflows as it is paged; a gap that would stand
 * for a single page renders that page instead.
 */
function pageWindow(page: number, pageCount: number, siblings = 1): PageSlot[] {
  const total = Math.max(1, Math.trunc(pageCount) || 1);
  const at = clamp(page, total);
  const side = Math.max(0, Math.trunc(siblings) || 0);
  const width = side * 2 + 5;
  if (total <= width) return range(1, total);

  const left = Math.max(at - side, 1);
  const right = Math.min(at + side, total);
  if (left <= 2) return [...range(1, side * 2 + 3), 'gap', total];
  if (right >= total - 1) return [1, 'gap', ...range(total - side * 2 - 2, total)];
  return [
    1,
    left === 3 ? 2 : 'gap',
    ...range(left, right),
    right === total - 2 ? total - 1 : 'gap',
    total,
  ];
}

interface PaginationContext {
  page: number;
  pageCount: number;
  siblings: number;
  size: ControlSize;
  gap: number;
  go: (next: number) => void;
  pageLabel: (page: number) => string;
}

const Context = createContext<PaginationContext | null>(null);

function usePagination(part: string): PaginationContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error(`<Pagination.${part}> must be used inside <Pagination.Root>`);
  return ctx;
}

function numberedPage(page: number): string {
  return `Page ${page}`;
}

function pageOfCount(page: number, pageCount: number): string {
  return `Page ${page} of ${pageCount}`;
}

interface PaginationRootProps {
  /** The page being shown, one-based. Clamped into `pageCount`. */
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
  /** Names the navigation landmark: what is being paged through. */
  label: string;
  /** The control shell's size; see <TextField>. */
  size?: ControlSize;
  /** Pages either side of the current one. One is the default: a seven-slot
   *  row that is one D-pad sweep and never reflows. */
  siblings?: number;
  /** The accessible name of one page control. */
  pageLabel?: (page: number) => string;
  /** Write the row yourself. Omit it for `Previous`, `Pages`, `Next`. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Paging controls for a list that arrives one page at a time.
 *
 * ```tsx
 * <Pagination.Root page={page} pageCount={20} onPageChange={setPage} label="Releases" />
 * ```
 */
function Root({
  page,
  pageCount,
  onPageChange,
  label,
  size,
  siblings = 1,
  pageLabel = numberedPage,
  children,
  style,
}: Readonly<PaginationRootProps>) {
  const shell = size ?? entryDefaultSize();
  const gap = Math.round(CONTROL[shell].gap / 2);
  const total = Math.max(1, Math.trunc(pageCount) || 1);
  const at = clamp(page, total);

  const ctx = useMemo<PaginationContext>(
    () => ({
      page: at,
      pageCount: total,
      siblings,
      size: shell,
      gap,
      go: (next) => {
        const to = clamp(next, total);
        if (to !== at) onPageChange(to);
      },
      pageLabel,
    }),
    [at, total, siblings, shell, gap, onPageChange, pageLabel],
  );

  return (
    <Context.Provider value={ctx}>
      <FocusRegion>
        <Row role="navigation" accessibilityLabel={label} gap={gap} style={style}>
          {children ?? (
            <>
              <Previous />
              <Pages />
              <Next />
            </>
          )}
        </Row>
      </FocusRegion>
    </Context.Provider>
  );
}

function Step({
  icon,
  label,
  to,
  disabled,
}: Readonly<{ icon: IconName; label: string; to: number; disabled: boolean }>) {
  const { size, go } = usePagination('Step');
  return (
    <Focusable
      label={label}
      disabled={disabled}
      onPress={() => go(to)}
      sv={paginationVariants}
      vars={{ size, current: false }}
    >
      {(state) => <Icon name={icon} {...state.slots.icon} />}
    </Focusable>
  );
}

interface PaginationStepProps {
  label?: string;
}

/** The step back, disabled rather than hidden on the first page. */
function Previous({ label = 'Previous page' }: Readonly<PaginationStepProps>) {
  const { page } = usePagination('Previous');
  return <Step icon="chevron-left" label={label} to={page - 1} disabled={page <= 1} />;
}

/** The step forward, disabled rather than hidden on the last page. */
function Next({ label = 'Next page' }: Readonly<PaginationStepProps>) {
  const { page, pageCount } = usePagination('Next');
  return <Step icon="chevron-right" label={label} to={page + 1} disabled={page >= pageCount} />;
}

/** The windowed run of page controls. Rendered for you by <Root>; name it
 *  yourself only when the row puts something else between the arrows. */
function Pages() {
  const { page, pageCount, siblings, gap } = usePagination('Pages');
  const slots = useMemo(() => pageWindow(page, pageCount, siblings), [page, pageCount, siblings]);
  return (
    <Row gap={gap}>
      {slots.map((slot, at) =>
        slot === 'gap' ? (
          <Ellipsis key={at === 1 ? 'gap-start' : 'gap-end'} />
        ) : (
          <Item key={slot} page={slot} />
        ),
      )}
    </Row>
  );
}

interface PaginationItemProps {
  page: number;
}

/** One page control. The current one carries `aria-current="page"`. */
function Item({ page }: Readonly<PaginationItemProps>) {
  const { page: current, size, go, pageLabel } = usePagination('Item');
  const on = page === current;
  return (
    <Box {...(on && WEB ? ARIA_CURRENT : null)}>
      <Focusable
        label={pageLabel(page)}
        onPress={() => go(page)}
        sv={paginationVariants}
        vars={{ size, current: on }}
      >
        {(state) => <Txt style={state.slots.label}>{page}</Txt>}
      </Focusable>
    </Box>
  );
}

/** The marker for a hidden run of pages. Not a control: it takes no D-pad stop
 *  and is skipped by assistive tech. */
function Ellipsis() {
  const { size } = usePagination('Ellipsis');
  const metrics = CONTROL[size];
  return (
    <Box center minW={metrics.height} minH={metrics.height} aria-hidden>
      <Icon name="dots" size={Math.round(metrics.fontSize * 1.3)} color="textDim" />
    </Box>
  );
}

interface PaginationStatusProps {
  format?: (page: number, pageCount: number) => string;
}

/** Where you are in words, for a row that has room to say it. */
function Status({ format = pageOfCount }: Readonly<PaginationStatusProps>) {
  const { page, pageCount, size } = usePagination('Status');
  return (
    <Txt variant={size === 'tv' ? 'body' : 'meta'} color="textDim">
      {format(page, pageCount)}
    </Txt>
  );
}

const Pagination = { Root, Previous, Pages, Item, Ellipsis, Next, Status };

export type {
  PageSlot,
  PaginationItemProps,
  PaginationRootProps,
  PaginationStatusProps,
  PaginationStepProps,
};
export { Pagination, pageWindow, paginationVariants };
