// The notification centre on the phone: what happened while you were away.
//
// A row IS the action - tapping it marks it read and follows its link - with the
// notification's own buttons underneath, so a moderator can approve a request
// from the row instead of opening a console the phone does not have. The list is
// live: the server pushes each arrival down the socket the app already holds
// (see lib/notifications), so a notice raised while this screen is open slides
// in without a pull.
//
// Deliberately swipe-to-delete, matching Downloads: a phone list's destructive
// action belongs under the thumb, not behind a trailing "x" that steals a tap
// target from the row itself.

import type { Notification } from '@kroma/core';
import { Icon, IconButton } from '@kroma/ui/kit';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { FadeImage } from '#mobile/components/FadeImage';
import { PageHeader } from '#mobile/components/PageHeader';
import { EmptyState, Screen } from '#mobile/components/ui';
import { useT } from '#mobile/lib/i18n';
import { boxed } from '#mobile/lib/layout';
import { mobileRoute, useNotifications, useRefreshNotifications } from '#mobile/lib/notifications';
import { useClient } from '#mobile/lib/session';
import { colors, radius, spacing, type } from '#mobile/lib/theme';

export default function NotificationsScreen() {
  const t = useT();
  const client = useClient();
  const refresh = useRefreshNotifications();
  const { data, isPending, isRefetching, refetch } = useNotifications();
  const [busy, setBusy] = useState(false);

  const unread = data?.unread ?? 0;
  const rows = data?.notifications ?? [];

  async function markAll() {
    setBusy(true);
    try {
      await client.markAllNotificationsRead();
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padded={false}>
      <PageHeader
        title={t('notifications.title')}
        right={
          // A glyph, not the words: <PageHeader>'s trailing slot is one 40pt
          // square (it mirrors the back button), and "Mark all as read" was
          // being cut in half inside it.
          unread > 0 ? (
            <IconButton
              variant="ghost"
              size={40}
              glyph={22}
              hitSlop={10}
              disabled={busy}
              label={t('notifications.markAllRead')}
              onPress={() => void markAll()}
            >
              <Icon name="checks" size={22} stroke={2} color={colors.accent} />
            </IconButton>
          ) : null
        }
      />

      {rows.length === 0 && !isPending ? (
        <EmptyState
          icon={<Icon name="bell" size={34} stroke={1.4} color={colors.textDim} />}
          title={t('notifications.empty')}
          hint={t('notifications.emptyHint')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.list, boxed.style]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.textDim}
            />
          }
          renderItem={({ item }) => <NotificationRow row={item} />}
        />
      )}
    </Screen>
  );
}

function NotificationRow({ row }: Readonly<{ row: Notification }>) {
  const t = useT();
  const client = useClient();
  const router = useRouter();
  const refresh = useRefreshNotifications();
  const swipe = useRef<SwipeableMethods>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Through the client, not raw: art arrives as a server-relative path
  // (`/api/images/…`), which a phone cannot fetch without the server's origin.
  const poster = client.resolveArt(row.imageUrl, 96);
  const route = mobileRoute(row.link);
  // A button that goes nowhere is worse than no button: several notifications
  // link into the admin console, which this app does not have, so those are
  // dropped here rather than left to no-op under a thumb.
  const actions = row.actions.filter((a) => a.kind !== 'link' || mobileRoute(a.href) !== null);

  async function open() {
    if (!row.read) {
      await client.markNotificationsRead([row.id]);
      refresh();
    }
    if (route) router.push(route as never);
  }

  async function runAction(action: Notification['actions'][number]) {
    if (action.kind === 'link') {
      const target = mobileRoute(action.href);
      if (target) router.push(target as never);
      return;
    }
    setBusy(action.id);
    try {
      await client.runNotificationAction(action);
      // Show the decision on the row rather than making someone hunt for
      // whether it took.
      setDone(true);
      await client.markNotificationsRead([row.id]);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    await client.deleteNotification(row.id);
    refresh();
  }

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          style={styles.deleteAction}
          onPress={() => {
            swipe.current?.close();
            void remove();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Icon name="trash" size={20} stroke={2} color="#FFFFFF" />
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => void open()}
        disabled={done}
        style={({ pressed }) => [
          styles.row,
          !row.read && styles.rowUnread,
          pressed && { opacity: 0.75 },
        ]}
      >
        {poster ? (
          <FadeImage uri={poster} seed={row.id} radius={radius.sm} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artGlyph]}>
            <Icon name="bell" size={18} stroke={1.8} color={colors.textDim} />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            {!row.read ? <View style={styles.dot} /> : null}
            <Text numberOfLines={1} style={styles.title}>
              {row.title}
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.text}>
            {row.body}
          </Text>
          <Text style={styles.time}>{sinceLabel(t, row.createdAt)}</Text>

          {actions.length > 0 && !done ? (
            <View style={styles.actions}>
              {actions.map((action) => (
                <Pressable
                  key={action.id}
                  onPress={() => void runAction(action)}
                  disabled={busy !== null}
                  style={({ pressed }) => [
                    styles.action,
                    action.style === 'primary' && styles.actionPrimary,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      action.style === 'primary' && styles.actionLabelPrimary,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {done ? <Text style={styles.done}>{t('common.done')}</Text> : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** Coarse relative time - a notification list wants "5 min ago", never seconds.
 *
 * Spelled with catalog keys rather than `Intl.RelativeTimeFormat`, which the web
 * panel uses: Hermes ships without the full ICU data, so the constructor is
 * simply not there on a phone and the row threw where it stood. */
function sinceLabel(t: ReturnType<typeof useT>, createdAt: number): string {
  const mins = Math.max(0, Math.round((Date.now() - createdAt) / 60_000));
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  return t('time.daysAgo', { n: Math.round(hours / 24) });
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: colors.surfaceRaised },
  art: { width: 44, height: 62, borderRadius: radius.sm },
  artGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  title: { ...type.body, color: colors.text, fontWeight: '700', flexShrink: 1 },
  text: { ...type.caption, color: colors.textDim, lineHeight: 18 },
  time: { ...type.small, color: colors.textFaint, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.xs },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  actionPrimary: { backgroundColor: colors.accent },
  actionLabel: { ...type.small, color: colors.text, fontWeight: '700' },
  actionLabelPrimary: { color: colors.accentInk },
  done: { ...type.small, color: colors.success, fontWeight: '700', marginTop: spacing.xs },
  deleteAction: {
    width: 72,
    marginLeft: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
});
