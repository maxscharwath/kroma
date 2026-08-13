// The admin module page (`/admin/modules/:id`): identity, versions, dependency
// graph, add-ons, declared settings and the install / update / enable /
// restart / uninstall actions, for an installed module and a catalog-only
// entry alike. A page rather than a drawer, so a module survives a reload and
// can be linked to.

import { useT } from '@kroma/ui';
import { Box, Button, EmptyState, Row, Skeleton, Surface, Text } from '@kroma/ui/kit';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { message, UninstallConflictError, uninstallModule } from '#web/features/admin/module-api';
import { useModuleData, useModuleToggle } from '#web/features/admin/module-data';
import { ModuleActions, UninstallConfirm } from '#web/features/admin/module-detail-actions';
import {
  Addons,
  DepsSection,
  HeaderIcon,
  Meta,
  ModuleSettings,
  OpProgress,
  RestartCallout,
} from '#web/features/admin/module-detail-sections';
import { InstallModal } from '#web/features/admin/module-install';
import { ModuleLogs } from '#web/features/admin/module-logs';
import { useModuleRestart, useStoreOps } from '#web/features/admin/module-ops';
import { Pill } from '#web/features/admin/pill';
import { Denied, PageHeader, useCap } from '#web/features/admin/shell';

export function ModuleDetailPage({ id }: Readonly<{ id: string }>) {
  if (!useCap('settings.manage')) return <Denied />;
  return <ModuleDetailInner id={id} />;
}

function ModuleDetailInner({ id }: Readonly<{ id: string }>) {
  const t = useT();
  const navigate = useNavigate();
  const { modules, catalog, reload, refreshAll } = useModuleData();
  const { activeByModule } = useStoreOps();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dependents, setDependents] = useState<string[] | null>(null);

  // The list reads the same query keys, so a change here is already on screen
  // when the user goes back.
  const refresh = () => void refreshAll();
  const toggler = useModuleToggle(id, refresh);
  const restart = useModuleRestart(id, refresh);
  const back = () => void navigate({ to: '/admin/modules' });

  const all = modules ?? [];
  const installed = all.find((m) => m.id === id);
  const entry = catalog?.modules.find((m) => m.id === id);
  const op = activeByModule.get(id);
  const update = !!entry && entry.updateAvailable && entry.compatible;
  // Exactly the modules that HAVE a process: a library module is co-linked into
  // another sidecar and has nothing of its own to restart.
  const restartable = installed?.enabled && installed.hasSidecar ? installed : null;

  const install = async () => {
    if (await InstallModal.call({ id })) refresh();
  };

  const doUninstall = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await uninstallModule(id, force);
      await refreshAll();
      back();
    } catch (e) {
      if (e instanceof UninstallConflictError) {
        setDependents(e.dependents);
      } else {
        setError(message(e));
        setRemoving(false);
        setDependents(null);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!installed && !entry) {
    if (!modules || !catalog) return <DetailSkeleton />;
    return <Gone onBack={back} />;
  }

  const name = installed?.name ?? entry?.name ?? id;
  const version = installed?.version ?? entry?.version;
  const description = installed?.description ?? entry?.description ?? '';
  const metaRows: [string, ReactNode][] = [
    [
      t('admin.modulesVersion'),
      update ? (
        <>
          v{installed?.version} <Text color="accentText">→ v{entry?.version}</Text>
        </>
      ) : (
        `v${version ?? '?'}`
      ),
    ],
  ];
  if (entry?.source) metaRows.push([t('admin.modulesSource'), entry.source]);
  const minServer = entry?.minServer ?? installed?.minServer;
  if (minServer) metaRows.push([t('admin.modulesMinServer'), minServer]);
  if (entry?.target) metaRows.push([t('admin.modulesPlatform'), entry.target]);

  return (
    <>
      <PageHeader.Root>
        <PageHeader.Back label={t('admin.modulesTitle')} onPress={back} />
        <PageHeader.Title>{name}</PageHeader.Title>
        <PageHeader.Subtitle>{id}</PageHeader.Subtitle>
        <PageHeader.Actions>
          {op ? null : (
            <ModuleActions
              installed={installed}
              entry={entry}
              name={name}
              update={update}
              toggler={toggler}
              onUninstall={() => setRemoving(true)}
              onInstall={() => void install()}
            />
          )}
        </PageHeader.Actions>
      </PageHeader.Root>

      {op ? (
        <Box mb={16}>
          <OpProgress op={op} />
        </Box>
      ) : null}

      {removing && !op ? (
        <Box mb={16}>
          <UninstallConfirm
            name={name}
            dependents={dependents}
            busy={busy}
            onCancel={() => {
              setRemoving(false);
              setDependents(null);
            }}
            onConfirm={(force) => void doUninstall(force)}
          />
        </Box>
      ) : null}

      <Box row={{ base: false, lg: true }} gap={16} align="flex-start">
        <Box w={{ base: '100%', lg: 320 }} shrink={0} gap={16}>
          <Surface elevated radius="xl" pad="lg" gap={16}>
            <HeaderIcon id={id} installed={!!installed} icon={entry?.icon} />
            <Row wrap gap={6}>
              {entry?.library && (
                <Pill ink="textMuted" bg="tint/6" variant="overline">
                  {t('admin.modulesLibraryChip')}
                </Pill>
              )}
              {installed && (
                <Pill
                  ink={installed.enabled ? 'success' : 'textDim'}
                  bg={installed.enabled ? 'success/14' : 'tint/6'}
                  variant="overline"
                >
                  {installed.enabled ? t('admin.modulesEnabled') : t('admin.modulesDisabled')}
                </Pill>
              )}
              {update && (
                <Pill ink="accentText" bg="accentSoft" variant="overline">
                  {t('admin.modulesUpdateChip', { version: entry.version })}
                </Pill>
              )}
            </Row>
            {description ? (
              <Text variant="meta" color="textMuted">
                {description}
              </Text>
            ) : null}
          </Surface>
        </Box>

        <Box flex minW={0} w={{ base: '100%', lg: 'auto' }}>
          <Surface elevated radius="xl" pad="lg" gap={24}>
            {(error ?? toggler.error) ? (
              <Text variant="meta" color="danger">
                {error ?? toggler.error}
              </Text>
            ) : null}
            {entry && !entry.compatible && entry.reason ? (
              <Text variant="meta" color="danger">
                {entry.reason}
              </Text>
            ) : null}
            <Meta rows={metaRows} />
            {restartable ? <RestartCallout module={restartable} restart={restart} /> : null}
            <DepsSection installed={installed} entry={entry} all={all} />
            <Addons id={id} catalog={catalog} />
            {installed ? <ModuleSettings module={installed} onSaved={reload} /> : null}
            {installed ? <ModuleLogs id={id} /> : null}
          </Surface>
        </Box>
      </Box>
    </>
  );
}

function Gone({ onBack }: Readonly<{ onBack: () => void }>) {
  const t = useT();
  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title>{t('admin.modulesTitle')}</PageHeader.Title>
      </PageHeader.Root>
      <EmptyState.Root icon="apps">
        <EmptyState.Title>{t('error.notFoundTitle')}</EmptyState.Title>
        <EmptyState.Actions>
          <Button
            variant="glass"
            size="sm"
            icon="chevron-left"
            label={t('common.back')}
            onPress={onBack}
          />
        </EmptyState.Actions>
      </EmptyState.Root>
    </>
  );
}

function DetailSkeleton() {
  return (
    <Box gap={16} aria-busy>
      <Skeleton w={280} h={28} radius="sm" />
      <Box row={{ base: false, lg: true }} gap={16} align="flex-start">
        <Box w={{ base: '100%', lg: 320 }} shrink={0}>
          <Skeleton w="100%" h={200} radius="xl" />
        </Box>
        <Box flex minW={0}>
          <Skeleton w="100%" h={320} radius="xl" />
        </Box>
      </Box>
    </Box>
  );
}
