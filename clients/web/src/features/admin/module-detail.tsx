// The admin module page (`/admin/modules/:id`): identity, versions, dependency
// graph, add-ons, declared settings and the install / update / enable /
// restart / uninstall actions, for an installed module and a catalog-only
// entry alike. A page rather than a drawer, so a module survives a reload and
// can be linked to.

import type { MessageKey, StoreModule } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, Button, EmptyState, Row, Skeleton, Surface, Text } from '@kroma/ui/kit';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import type { AdminModule } from '#web/features/admin/module-api';
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
  const removal = useUninstall(id);

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

  if (!installed && !entry) {
    if (!modules || !catalog) return <DetailSkeleton />;
    return <Gone onBack={back} />;
  }

  const { name, version, description } = identityOf(id, installed, entry);
  const metaRows = metaRowsFor(t, installed, entry, update, version);

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
              onUninstall={removal.ask}
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

      {removal.asking && !op ? (
        <Box mb={16}>
          <UninstallConfirm
            name={name}
            dependents={removal.dependents}
            busy={removal.busy}
            onCancel={removal.cancel}
            onConfirm={(force) => void removal.confirm(force, refreshAll, back)}
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
            {(removal.error ?? toggler.error) ? (
              <Text variant="meta" color="danger">
                {removal.error ?? toggler.error}
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

// Uninstalling is a small state machine of its own: ask, then confirm, then a
// refusal that comes back with the dependents blocking it and re-asks with the
// force option. Kept out of the page so the page stays layout, and so the four
// pieces of state that only this flow touches are not four more the page holds.
function useUninstall(id: string) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dependents, setDependents] = useState<string[] | null>(null);

  const cancel = () => {
    setAsking(false);
    setDependents(null);
  };

  const confirm = async (force: boolean, refreshAll: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await uninstallModule(id, force);
      await refreshAll();
      done();
    } catch (e) {
      // A conflict is not a failure: it is the answer, and it names what is in
      // the way so the confirm can offer to force past it.
      if (e instanceof UninstallConflictError) {
        setDependents(e.dependents);
      } else {
        setError(message(e));
        cancel();
      }
    } finally {
      setBusy(false);
    }
  };

  return { asking, busy, error, dependents, ask: () => setAsking(true), cancel, confirm };
}

// What to call a module: whichever half knows, the installed copy first. A
// module can be installed but absent from the catalog, or listed but not yet
// installed, and every field falls back independently.
function identityOf(
  id: string,
  installed: AdminModule | undefined,
  entry: StoreModule | undefined,
) {
  return {
    name: installed?.name ?? entry?.name ?? id,
    version: installed?.version ?? entry?.version,
    description: installed?.description ?? entry?.description ?? '',
  };
}

// The facts table. Each row appears only when there is something to put in it,
// which is why this is built rather than declared.
function metaRowsFor(
  t: (key: MessageKey) => string,
  installed: AdminModule | undefined,
  entry: StoreModule | undefined,
  update: boolean,
  version: string | undefined,
): [string, ReactNode][] {
  const rows: [string, ReactNode][] = [
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
  if (entry?.source) rows.push([t('admin.modulesSource'), entry.source]);
  const minServer = entry?.minServer ?? installed?.minServer;
  if (minServer) rows.push([t('admin.modulesMinServer'), minServer]);
  if (entry?.target) rows.push([t('admin.modulesPlatform'), entry.target]);
  return rows;
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
