// Sending a notification from the console: write one, or start from a sample.
//
// The screen is a COMPOSER, not a test button. Two jobs share it because they
// are one act: checking that a request notification still looks right, and
// telling the household the server reboots at nine. The samples are the core's
// own events, rendered BY THE SERVER in your language from the very payload Send
// delivers - click one and it fills the form; edit anything and what you see is
// what goes out, as a `custom` notification carrying your words.
//
// Nothing here is a preview. Send goes through the same pipeline a producer's
// notification does - category preferences, per-recipient rendering, the stored
// row, the live bell, the push fan-out - so the count is people reached.

import { C, Card, Field, OptionSelect, Section, TextInput, useAsyncAction } from '@kroma/admin-kit';
import type { MessageKey, Notification } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Button } from '@kroma/ui/kit';
import { IconBell, IconPhoto } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { kromaClient } from '#web/shared/lib/api';

type Target = 'me' | 'admins' | 'everyone';
type Category = Notification['category'];

const TARGETS: { value: Target; label: MessageKey }[] = [
  { value: 'me', label: 'admin.notifTargetMe' },
  { value: 'admins', label: 'admin.notifTargetAdmins' },
  { value: 'everyone', label: 'admin.notifTargetEveryone' },
];

/** The five preference buckets, named as a reader sees them in their settings. */
const CATEGORY_LABEL: Record<Category, MessageKey> = {
  requests: 'notifications.category.requests',
  media: 'notifications.category.media',
  reports: 'notifications.category.reports',
  downloads: 'notifications.category.downloads',
  system: 'notifications.category.system',
};

/** What the form holds. `event` is set only while an UNTOUCHED sample is loaded:
 * the moment a field changes this becomes a written notification instead, which
 * is what keeps "what you see is what is sent" true. */
interface Draft {
  event: string | null;
  title: string;
  body: string;
  category: Category;
  link: string;
  imageUrl: string;
}

const EMPTY: Draft = {
  event: null,
  title: '',
  body: '',
  category: 'system',
  link: '',
  imageUrl: '',
};

export function NotificationBench() {
  const t = useT();
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'notification-samples'],
    queryFn: () => kromaClient().notificationSamples(),
    staleTime: 5 * 60_000,
  });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [target, setTarget] = useState<Target>('me');
  const [sent, setSent] = useState<number | null>(null);
  const { busy, error, run } = useAsyncAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch, event: null }));
    setSent(null);
  };

  const loadSample = (row: Notification) => {
    setDraft({
      event: row.event,
      title: row.title,
      body: row.body,
      category: row.category,
      link: row.link ?? '',
      imageUrl: row.imageUrl ?? '',
    });
    setSent(null);
  };

  const send = () =>
    run(
      async () => {
        setSent(null);
        const { delivered } = await kromaClient().sendNotification(
          draft.event
            ? { event: draft.event, target }
            : {
                title: draft.title,
                body: draft.body,
                category: draft.category,
                link: draft.link || undefined,
                imageUrl: draft.imageUrl || undefined,
                target,
              },
        );
        setSent(delivered);
      },
      (e) => (e instanceof Error ? e.message : t('error.serverBody')),
    );

  const upload = (file: File) =>
    run(
      async () => {
        const { imageUrl } = await kromaClient().uploadNotificationImage(file);
        edit({ imageUrl });
      },
      (e) => (e instanceof Error ? e.message : t('error.serverBody')),
    );

  // Grouped in the server's order, so the sections read requests → media →
  // reports → downloads → system whatever the locale does to their names.
  const groups: { category: Category; rows: Notification[] }[] = [];
  for (const row of data?.events ?? []) {
    const last = groups.at(-1);
    if (last?.category === row.category) last.rows.push(row);
    else groups.push({ category: row.category, rows: [row] });
  }

  return (
    <>
      <Section title={t('admin.notifComposeTitle')}>
        <p className="-mt-2 mb-4 max-w-180 text-[13.5px] text-dim">{t('admin.notifComposeDesc')}</p>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="flex flex-col gap-3.5 px-5.5 py-5">
            <Field label={t('admin.notifFieldTitle')}>
              <TextInput
                value={draft.title}
                onChange={(v) => edit({ title: v })}
                placeholder={t('admin.notifTitlePlaceholder')}
              />
            </Field>

            <Field label={t('admin.notifFieldBody')}>
              <textarea
                value={draft.body}
                onChange={(e) => edit({ body: e.target.value })}
                rows={3}
                placeholder={t('admin.notifBodyPlaceholder')}
                className="w-full resize-y rounded-md border border-border-strong bg-surface-2 px-3.5 py-2.5 text-[14px] text-text outline-none transition-colors placeholder:text-dim focus:border-accent"
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <Field label={t('admin.notifFieldCategory')}>
                <OptionSelect
                  value={draft.category}
                  onChange={(v) => edit({ category: v as Category })}
                  className="min-w-48"
                  ariaLabel={t('admin.notifFieldCategory')}
                  options={(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({
                    value: c,
                    label: t(CATEGORY_LABEL[c]),
                  }))}
                />
              </Field>
              <Field label={t('admin.notifFieldLink')}>
                <TextInput
                  value={draft.link}
                  onChange={(v) => edit({ link: v })}
                  placeholder="/movie/…"
                />
              </Field>
            </div>

            <Field label={t('admin.notifFieldImage')}>
              {/* Upload OR paste: an admin announcing something has a file on
                  their desk, an admin reusing a poster already has its path. */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-56 flex-1">
                  <TextInput
                    value={draft.imageUrl}
                    onChange={(v) => edit({ imageUrl: v })}
                    placeholder="/api/images/… "
                  />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  icon="photo"
                  label={t('admin.notifUpload')}
                  disabled={busy}
                  onPress={() => fileRef.current?.click()}
                />
                {draft.imageUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    label={t('common.delete')}
                    onPress={() => edit({ imageUrl: '' })}
                  />
                ) : null}
              </div>
            </Field>
          </Card>

          <Card className="flex flex-col gap-3 px-5 py-4">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-dim">
              {t('admin.notifPreview')}
            </p>
            <PreviewRow draft={draft} empty={t('admin.notifTitlePlaceholder')} />
          </Card>
        </div>
      </Section>

      <Section title={t('admin.notifSamplesTitle')}>
        <p className="-mt-2 mb-4 max-w-180 text-[13.5px] text-dim">{t('admin.notifSamplesDesc')}</p>
        {isPending ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[86px] animate-pulse rounded-xl bg-white/4" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-2.5">
                <h3 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-dim">
                  {t(CATEGORY_LABEL[group.category])}
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {group.rows.map((row) => (
                    <SampleCard
                      key={row.id}
                      row={row}
                      picked={draft.event === row.event}
                      onPick={() => loadSample(row)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* The bar stays with you down a long page: what will be sent, to whom,
          and the one button that sends it. */}
      <Card className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-dim">
            {draft.event ? t('admin.notifSendingSample') : t('admin.notifSendingWritten')}
          </p>
          <p className="truncate text-[14px] font-semibold text-text">
            {draft.title || t('admin.notifTestNone')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-semibold text-dim">{t('admin.notifTestTarget')}</span>
          <fieldset className="flex rounded-lg border border-border-strong bg-surface-2 p-0.5">
            <legend className="sr-only">{t('admin.notifTestTarget')}</legend>
            {TARGETS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setTarget(o.value);
                  setSent(null);
                }}
                aria-pressed={target === o.value}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  target === o.value
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-white/4 hover:text-text'
                }`}
              >
                {t(o.label)}
              </button>
            ))}
          </fieldset>
          <Button
            variant="primary"
            size="sm"
            icon="send"
            label={busy ? t('common.loading') : t('admin.notifTestSend')}
            disabled={busy || !draft.title.trim()}
            onPress={() => void send()}
          />
        </div>

        <div className="w-full">
          {/* Said before the press: "everyone" writes a row into every account
              on this server, and there is no unsend. */}
          {target === 'everyone' ? (
            <p className="text-[13px] font-semibold" style={{ color: C.accent }}>
              {t('admin.notifTestEveryoneWarning')}
            </p>
          ) : null}
          {sent !== null ? (
            <p
              className={`text-[13px] font-semibold ${sent > 0 ? '' : 'text-dim'}`}
              style={sent > 0 ? { color: C.green } : undefined}
            >
              {sent > 0 ? t('admin.notifTestSent', { n: sent }) : t('admin.notifTestMuted')}
            </p>
          ) : null}
          {error ? (
            <p className="text-[13px] font-semibold" style={{ color: C.red }}>
              {error}
            </p>
          ) : null}
        </div>
      </Card>
    </>
  );
}

/** The draft as a bell row: the shape it takes when it lands. */
function PreviewRow({ draft, empty }: Readonly<{ draft: Draft; empty: string }>) {
  const art = draft.imageUrl ? kromaClient().resolveArt(draft.imageUrl) : null;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
      {art ? (
        <img src={art} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-white/5 text-muted">
          {draft.imageUrl ? <IconPhoto size={16} /> : <IconBell size={16} />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[14px] font-semibold ${draft.title ? 'text-text' : 'text-dim'}`}
        >
          {draft.title || empty}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-dim">{draft.body}</span>
        {draft.link ? (
          <span className="mt-1.5 block truncate text-[11.5px] text-muted">{draft.link}</span>
        ) : null}
      </span>
    </div>
  );
}

/** One of the core's own notifications, drawn the way the bell draws it. */
function SampleCard({
  row,
  picked,
  onPick,
}: Readonly<{ row: Notification; picked: boolean; onPick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
        picked
          ? 'border-accent bg-accent-soft/40'
          : 'border-border bg-surface-2 hover:border-border-strong hover:bg-white/4'
      }`}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted">
        <IconBell size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-text">{row.title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-dim">{row.body}</span>
        {row.actions.length > 0 ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {row.actions.map((a) => (
              <span
                key={a.id}
                className="rounded-md bg-white/6 px-2 py-1 text-[12px] font-semibold text-text/80"
              >
                {a.label}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}
