// Form + modal primitives for the admin console (selects, inputs, modal scaffold,
// labelled fields, modal action footer). Split out of `ui.tsx`; the display
// primitives there re-export these so call sites keep importing everything from
// `#web/features/admin/ui`.
import { IconChevronDown } from '@tabler/icons-react';
import type { ReactNode } from 'react';

/** Styled native select rendered as the design's value chip. */
export function Select({
  value,
  options,
  onChange,
}: Readonly<{
  value: string;
  options: string[];
  onChange?: (v: string) => void;
}>) {
  const opts = options.length || options.includes(value) ? options : [value];
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="cursor-pointer appearance-none rounded-[9px] border border-border-strong bg-surface-2 py-2.25 pl-3.25 pr-9 text-[13.5px] font-semibold text-text outline-none"
      >
        {(opts.includes(value) ? opts : [value, ...opts]).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3" size={13} stroke={2.5} />
    </span>
  );
}

export function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  className = '',
  type = 'text',
}: Readonly<{
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  /** Input type, e.g. `password` for secrets. Defaults to `text`. */
  type?: string;
}>) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      className={`min-w-50 rounded-[9px] border border-border-strong bg-[#0F0F13] px-3.5 py-2.25 text-[13.5px] font-semibold text-text outline-none focus:border-accent/60 ${className}`}
    />
  );
}

/** Centered modal overlay (click-outside to close). */
export function Modal({
  title,
  children,
  onClose,
}: Readonly<{
  title: string;
  children: ReactNode;
  onClose: () => void;
}>) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-115 rounded-2xl border border-border bg-surface-1 p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 font-display text-[20px] font-bold">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** A labelled form field (uppercase caption + control + optional hint below). */
export function Field({
  label,
  hint,
  children,
}: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[.12em] text-dim">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{hint}</p> : null}
    </div>
  );
}

/** The standard modal footer: a right-aligned cancel + primary pair, with an
 * optional destructive action pinned left (e.g. "Delete account"). The caller
 * passes the already-resolved `confirmLabel` (so it can swap to "Saving…"). */
export function ModalActions({
  onCancel,
  cancelLabel,
  onConfirm,
  confirmLabel,
  busy,
  disabled,
  destructive,
}: Readonly<{
  onCancel: () => void;
  cancelLabel: string;
  onConfirm: () => void;
  confirmLabel: string;
  busy?: boolean;
  disabled?: boolean;
  destructive?: { label: string; onClick: () => void; disabled?: boolean; title?: string };
}>) {
  return (
    <div
      className={`mt-5 flex items-center gap-3 ${destructive ? 'justify-between' : 'justify-end'}`}
    >
      {destructive ? (
        <button
          type="button"
          onClick={destructive.onClick}
          disabled={busy || destructive.disabled}
          title={destructive.title}
          className="text-[13px] font-semibold text-[#E8536A] disabled:opacity-40"
        >
          {destructive.label}
        </button>
      ) : null}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2.5 text-[14px] font-semibold text-muted"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || disabled}
          className="rounded-md bg-accent px-5 py-2.5 text-[14px] font-bold text-accent-ink disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
