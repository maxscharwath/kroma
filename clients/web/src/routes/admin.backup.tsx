import { useT } from '@luma/ui';
import { IconAlertTriangle, IconDownload, IconUpload } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Denied, PageHeader, useCap } from '#web/features/admin/shell';
import { C, Card, Section } from '#web/features/admin/ui';
import { useAuth } from '#web/shared/lib/auth';

export const Route = createFileRoute('/admin/backup')({
  component: BackupPage,
});

function BackupPage() {
  const t = useT();
  const { client } = useAuth();
  const canManage = useCap('settings.manage');
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (!canManage) return <Denied />;

  async function exportBackup() {
    setExporting(true);
    setNotice(null);
    try {
      const blob = await client.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `luma-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function importBackup(file: File) {
    setImporting(true);
    setNotice(null);
    try {
      const res = await client.importBackup(file);
      setNotice({
        kind: 'ok',
        text: t('admin.backupImported', { users: res.imported.users ?? 0 }),
      });
    } catch {
      setNotice({ kind: 'err', text: t('admin.backupImportFailed') });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <PageHeader title={t('admin.backupTitle')} subtitle={t('admin.backupSub')} />

      <Card className="mt-6 flex items-start gap-3 px-5 py-4">
        <IconAlertTriangle size={20} stroke={1.8} color={C.accent} className="mt-0.5 shrink-0" />
        <p className="text-[13.5px] font-medium text-text/70">{t('admin.backupWarning')}</p>
      </Card>

      <Section title={t('admin.backupExportTitle')}>
        <ActionRow
          desc={t('admin.backupExportDesc')}
          action={
            <PrimaryButton
              onClick={() => void exportBackup()}
              disabled={exporting}
              icon={IconDownload}
            >
              {exporting ? t('admin.backupExporting') : t('admin.backupExport')}
            </PrimaryButton>
          }
        />
      </Section>

      <Section title={t('admin.backupImportTitle')}>
        <ActionRow
          desc={t('admin.backupImportDesc')}
          action={
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBackup(file);
                }}
              />
              <PrimaryButton
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                icon={IconUpload}
              >
                {importing ? t('admin.backupImporting') : t('admin.backupImport')}
              </PrimaryButton>
            </>
          }
        />
        {notice ? (
          <p
            className="mt-3 text-[13px] font-semibold"
            style={{ color: notice.kind === 'ok' ? C.green : C.red }}
          >
            {notice.text}
          </p>
        ) : null}
      </Section>
    </>
  );
}

function ActionRow({ desc, action }: Readonly<{ desc: string; action: React.ReactNode }>) {
  return (
    <Card className="flex items-center justify-between gap-5 px-5.5 py-4.5">
      <p className="max-w-160 text-[13.5px] text-dim">{desc}</p>
      <div className="shrink-0">{action}</div>
    </Card>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  icon: Icon,
  children,
}: Readonly<{
  onClick: () => void;
  disabled?: boolean;
  icon: typeof IconDownload;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-[9px] border border-[#F4B642]/25 bg-[#F4B642]/12 px-3.75 py-2.25 text-[13px] font-semibold text-[#F4B642] disabled:opacity-50"
    >
      <Icon size={16} stroke={1.9} />
      {children}
    </button>
  );
}
