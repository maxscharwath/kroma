// The modal panel (confirmations, PIN entry, track pickers), on all four targets.
// On a TV it locks the navigator behind it and mounts its own, so the remote
// cannot reach — or fire OK on — anything under the panel.

import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useId,
  useRef,
} from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, type View } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Txt } from '#ui/components/atoms/text';
import { styles } from '#ui/core';
import { useFocusNav } from '#ui/lib/focus-nav';
import { useInsideFocusScope } from '#ui/lib/focus-presence';
import { FocusRegion, FocusScope, useLockFocusBehind } from '#ui/lib/focus-scope';
import { useModalPortalRepair } from '#ui/lib/modal-portal';
import { useOverlay, useOverlayHost } from '#ui/lib/overlay-host';
import { useScrollLock } from '#ui/lib/scroll-lock';
import { useTDefault } from '#ui/services/i18n';

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Panel padding. 0 hands the surface to content that owns its own layout
   *  (a routed detail sheet); such a dialog names itself via `title` even
   *  though nothing visible renders it. */
  pad?: number;
  /** Keep `title` as the accessible name only; the visible header is the
   *  content's own. */
  titleHidden?: boolean;
}

function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 720,
  pad = 40,
  titleHidden = false,
}: Readonly<DialogProps>) {
  // react-native-web's Modal loses its portal container under StrictMode, and a
  // dialog that never appears is the symptom. See lib/modal-portal.web.
  useModalPortalRepair(open);
  useScrollLock(open);
  // Called here, not in the panel: the lock has to reach the navigator the
  // dialog was opened FROM.
  useLockFocusBehind(open);
  const navigated = useInsideFocusScope();
  // A <Modal> renders in a view controller of its own, where the screen's remote
  // bridge can go quiet; inside the overlay host it does not. See <FocusScope>.
  const hosted = useOverlayHost();
  const surface = open ? (
    <DialogSurface
      onClose={onClose}
      width={width}
      pad={pad}
      titleHidden={titleHidden}
      title={title}
      description={description}
      footer={footer}
      trapped={navigated}
      bridge={!hosted}
    >
      {children}
    </DialogSurface>
  ) : null;
  // A TV mounts an <OverlayHost> and renders the panel there: a <Modal>'s view
  // controller never receives a press, because this app's focus is virtual and
  // the system focus engine has no reason to move into it.
  useOverlay(surface);
  if (!open || hosted) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      {surface}
    </Modal>
  );
}

// Split out so `useFocusNav` mounts WITH the panel: that arms the press guard
// and moves focus into the dialog exactly as a screen transition would.
function DialogSurface({
  onClose,
  width,
  pad,
  title,
  titleHidden,
  description,
  footer,
  trapped,
  bridge,
  children,
}: Readonly<
  Omit<DialogProps, 'open'> & { width: number; pad: number; trapped: boolean; bridge: boolean }
>) {
  useFocusNav({ onBack: onClose });
  const t = useTDefault();
  const backdrop = useRef<View>(null);
  const titleId = useId();
  const descriptionId = useId();
  const showsTitle = Boolean(title) && !titleHidden;
  // The parts a caller composed, lifted out of the children so each lands in
  // its own slot. Anything left over is the content. A caller can therefore mix
  // the `title` prop with a composed <Dialog.Footer> and still get a pinned
  // footer rather than one scrolled inside the content.
  const kids = Children.toArray(children);
  const part = (which: unknown) => kids.find((node) => isValidElement(node) && node.type === which);
  const headerPart = part(Header);
  const contentPart = part(Content);
  const footerPart = part(Footer);
  const loose = kids.filter(
    (node) => node !== headerPart && node !== contentPart && node !== footerPart,
  );
  const header =
    headerPart ??
    (showsTitle || description ? (
      <Header>
        {showsTitle ? (
          <Txt nativeID={titleId} variant="h2">
            {title}
          </Txt>
        ) : null}
        {description ? (
          <Txt nativeID={descriptionId} color="textMuted" variant="body">
            {description}
          </Txt>
        ) : null}
      </Header>
    ) : null);
  const foot = footerPart ?? (footer ? <FooterSlot>{footer}</FooterSlot> : null);
  const shell: Shell = { pad, hasHeader: Boolean(header), hasFooter: Boolean(foot) };
  // The panel names itself by reference only when it rendered the node that
  // carries the id: a composed <Dialog.Header> replaces the fallback, so
  // pointing at `titleId` there would name the dialog after nothing at all.
  const namesOwnTitle = !headerPart && showsTitle;
  const naming =
    Platform.OS === 'web'
      ? {
          'aria-labelledby': namesOwnTitle ? titleId : undefined,
          'aria-label': namesOwnTitle ? undefined : title,
          'aria-describedby': !headerPart && description ? descriptionId : undefined,
        }
      : { accessibilityLabel: title };
  const panel = (
    <Box flex center bg="overlay" p={64}>
      {/* Web only: on a TV, Back/Menu is the platform's way out and an extra
          Pressable is one more thing for the D-pad to land on. */}
      {onClose && Platform.OS === 'web' ? (
        <Pressable
          ref={backdrop}
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          // The backdrop must never hold the DOM focus: react-native-web 0.21's
          // Pressable ignores `focusable` and defaults to `tabindex="0"`, and
          // <Modal>'s focus trap focuses the first node inside it on open. A
          // browser TV shell then delivers the remote's OK as Enter on that
          // element, closing the dialog instead of choosing the ringed row.
          tabIndex={-1}
          onFocus={() => (backdrop.current as unknown as HTMLElement | null)?.blur()}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Box
        w={width}
        maxW="100%"
        maxH="100%"
        bg="surface2"
        radius="2xl"
        border="borderStrong"
        shadow="pop"
        overflow="hidden"
        dataSet={FOCUS_SCOPE}
        role="dialog"
        aria-modal
        {...naming}
      >
        <ShellContext.Provider value={shell}>
          {header}
          {contentPart ?? <Content>{loose}</Content>}
          {foot}
        </ShellContext.Provider>
      </Box>
    </Box>
  );
  return trapped ? (
    <FocusScope style={s.fill} bridge={bridge}>
      {panel}
    </FocusScope>
  ) : (
    panel
  );
}

const FOCUS_SCOPE = { focusScope: '' } as const;

// The panel's padding and who its neighbours are, so a part can space itself
// against them without the caller measuring anything.
interface Shell {
  pad: number;
  hasHeader: boolean;
  hasFooter: boolean;
}

const ShellContext = createContext<Shell>({ pad: 40, hasHeader: false, hasFooter: false });

const useShell = () => useContext(ShellContext);

// The rhythm between the pinned parts and the scrolling one.
const GAP = 24;

/**
 * The pinned top of the panel. Stays put while the content scrolls under it, so
 * a long form never scrolls its own title away.
 */
function Header({ children }: Readonly<{ children: ReactNode }>) {
  const { pad } = useShell();
  return (
    <Box shrink={0} gap={8} px={pad} pt={pad} pb={pad > 0 ? GAP : 0}>
      {children}
    </Box>
  );
}

/**
 * The scrolling middle. The ONLY part that scrolls: with the page locked behind
 * the overlay, a form taller than the viewport would otherwise clip with its
 * actions unreachable.
 */
function Content({ children }: Readonly<{ children: ReactNode }>) {
  const { pad, hasHeader, hasFooter } = useShell();
  const gap = pad > 0 ? GAP : 0;
  return (
    <ScrollView
      style={s.content}
      // No vertical padding against a pinned neighbour: that padding would
      // scroll away with the content, and the shelf has to stay. The header and
      // the footer hold it instead.
      contentContainerStyle={{
        paddingHorizontal: pad,
        paddingTop: hasHeader ? 0 : pad,
        paddingBottom: hasFooter ? 0 : pad,
        gap,
      }}
    >
      {children}
    </ScrollView>
  );
}

/** The pinned bottom, where the actions live. */
function Footer({ children }: Readonly<{ children: ReactNode }>) {
  const { pad } = useShell();
  return (
    <FocusRegion style={s.footerPinned}>
      <Box row justify="flex-end" gap={12} px={pad} pt={pad > 0 ? GAP : 0} pb={pad}>
        {children}
      </Box>
    </FocusRegion>
  );
}

// The `footer` prop's home. A plain padded shelf rather than <Dialog.Footer>,
// because what callers pass is already a <DialogFooter> or <DialogActions> and
// two nested focus regions is one too many.
function FooterSlot({ children }: Readonly<{ children: ReactNode }>) {
  const { pad } = useShell();
  return (
    <Box shrink={0} px={pad} pt={pad > 0 ? GAP : 0} pb={pad}>
      {children}
    </Box>
  );
}

const s = styles({
  fill: { flex: true },
  // Shrinks rather than grows: the panel is only as tall as it needs to be, and
  // when it hits the viewport this is the part that gives.
  content: { shrink: 1 },
  footerPinned: { shrink: 0 },
  footerRow: { row: true, justify: 'flex-end', gap: 12, mt: 8 },
  actionsSplit: { row: true, align: 'center', justify: 'space-between', gap: 12, mt: 8 },
  actionsEnd: { row: true, align: 'center', gap: 10 },
});

function DialogFooter({ children }: Readonly<{ children: ReactNode }>) {
  return <FocusRegion style={s.footerRow}>{children}</FocusRegion>;
}

interface DialogActionsProps {
  onCancel: () => void;
  cancelLabel: string;
  onConfirm: () => void;
  /** Already resolved by the caller, so it can swap to "Saving...". */
  confirmLabel: string;
  /** The confirm spins and both actions ignore presses while the work runs. */
  busy?: boolean;
  disabled?: boolean;
  /** A destructive third action pinned to the far edge ("Delete account"). */
  destructive?: { label: string; onPress: () => void; disabled?: boolean };
}

/** The standard dialog footer: a right-aligned cancel + primary pair, with an
 *  optional destructive action pinned left. */
function DialogActions({
  onCancel,
  cancelLabel,
  onConfirm,
  confirmLabel,
  busy = false,
  disabled = false,
  destructive,
}: Readonly<DialogActionsProps>) {
  return (
    <FocusRegion style={destructive ? s.actionsSplit : s.footerRow}>
      {destructive ? (
        <Button
          variant="dangerGhost"
          size="sm"
          label={destructive.label}
          onPress={destructive.onPress}
          disabled={busy || destructive.disabled}
        />
      ) : null}
      <Box row align="center" gap={10} style={destructive ? undefined : s.actionsEnd}>
        <Button variant="ghost" size="sm" label={cancelLabel} onPress={onCancel} disabled={busy} />
        <Button
          variant="primary"
          size="sm"
          label={confirmLabel}
          onPress={onConfirm}
          loading={busy}
          disabled={disabled}
        />
      </Box>
    </FocusRegion>
  );
}

interface ConfirmDialogProps extends Omit<DialogProps, 'footer' | 'children'> {
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}

function ConfirmDialog({
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  ...dialog
}: Readonly<ConfirmDialogProps>) {
  return (
    <Dialog
      {...dialog}
      footer={
        <DialogFooter>
          <Button variant="ghost" label={cancelLabel} onPress={dialog.onClose} />
          <Button
            variant={destructive ? 'danger' : 'primary'}
            label={confirmLabel}
            onPress={onConfirm}
            autoFocus
          />
        </DialogFooter>
      }
    />
  );
}

/**
 * The modal panel. Callable with `title` / `description` / `footer` for the
 * ordinary case, and composed through its parts when a panel needs its own
 * header or a footer that is not a row of buttons:
 *
 *   <Dialog open onClose={close}>
 *     <Dialog.Header>…</Dialog.Header>
 *     <Dialog.Content>…</Dialog.Content>
 *     <Dialog.Footer>…</Dialog.Footer>
 *   </Dialog>
 *
 * Either way only `Content` scrolls; the header and the footer stay put.
 */
const DialogParts = Object.assign(Dialog, {
  Root: Dialog,
  Header,
  Content,
  Footer,
});

export type { ConfirmDialogProps, DialogActionsProps, DialogProps };
export { ConfirmDialog, DialogActions, DialogFooter, DialogParts as Dialog };
