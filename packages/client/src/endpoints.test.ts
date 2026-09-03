import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InviteToken, PasskeyId, SessionId, UserId } from './api/accounts';
import { JobKey, JobRunId } from './api/jobs';
import { ItemId, LibraryId, ShowId } from './api/media';
import { ModuleId } from './api/modules';
import { NotificationId } from './api/notifications';
import { PlaybackSessionId } from './api/playback';
import { ReportId } from './api/reports';
import { RequestId } from './api/requests';
import { GenerationId, SubtitleId } from './api/subtitles';
import { DeviceId } from './core/ids';
import type { KromaClient } from './kroma-client';
import { recordingClient, recordRequest } from './kroma-client.fixture';

const item = ItemId.parse('i 1');
const show = ShowId.parse('s1');
const user = UserId.parse('u1');
const library = LibraryId.parse('lib1');
const request = RequestId.parse('r1');
const report = ReportId.parse('rep1');
const receiver = DeviceId.parse('tv-salon-01');
const job = JobKey.parse('library.scan');

interface Endpoint {
  readonly name: string;
  readonly call: (client: KromaClient) => unknown;
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
}

const ENDPOINTS: readonly Endpoint[] = [
  {
    name: 'accounts.login',
    call: (c) => c.accounts.login('max', 'pw'),
    method: 'POST',
    path: '/auth/login',
    body: { email: 'max', password: 'pw' },
  },
  { name: 'accounts.me', call: (c) => c.accounts.me(), method: 'GET', path: '/auth/me' },
  {
    name: 'accounts.config',
    call: (c) => c.accounts.config(),
    method: 'GET',
    path: '/auth/config',
  },
  { name: 'accounts.users', call: (c) => c.accounts.users(), method: 'GET', path: '/users' },
  {
    name: 'accounts.updateLanguage',
    call: (c) => c.accounts.updateLanguage(null),
    method: 'PATCH',
    path: '/auth/me',
    body: { language: null },
  },
  {
    name: 'accounts.sessions',
    call: (c) => c.accounts.sessions(),
    method: 'GET',
    path: '/auth/me/sessions',
  },
  {
    name: 'accounts.revokeSession',
    call: (c) => c.accounts.revokeSession(SessionId.parse('d 1')),
    method: 'DELETE',
    path: '/auth/me/sessions/d%201',
  },
  {
    name: 'accounts.checkInvite',
    call: (c) => c.accounts.checkInvite(InviteToken.parse('t/1')),
    method: 'GET',
    path: '/invites/t%2F1',
  },
  {
    name: 'accounts.passkeys.list',
    call: (c) => c.accounts.passkeys.list(),
    method: 'GET',
    path: '/auth/me/passkeys',
  },
  {
    name: 'accounts.passkeys.delete',
    call: (c) => c.accounts.passkeys.delete(PasskeyId.parse('p 1')),
    method: 'DELETE',
    path: '/auth/me/passkeys/p%201',
  },
  {
    name: 'accounts.quickConnect.initiate',
    call: (c) => c.accounts.quickConnect.initiate(),
    method: 'POST',
    path: '/auth/quickconnect/initiate',
  },
  {
    name: 'accounts.quickConnect.authorize',
    call: (c) => c.accounts.quickConnect.authorize('123456'),
    method: 'POST',
    path: '/auth/quickconnect/authorize',
    body: { code: '123456' },
  },

  { name: 'media.health', call: (c) => c.media.health(), method: 'GET', path: '/health' },
  { name: 'media.items', call: (c) => c.media.items(), method: 'GET', path: '/items' },
  {
    name: 'media.items scoped',
    call: (c) => c.media.items(library),
    method: 'GET',
    path: '/items?library=lib1',
  },
  {
    name: 'media.movies',
    call: (c) => c.media.movies(library),
    method: 'GET',
    path: '/movies?library=lib1',
  },
  { name: 'media.shows', call: (c) => c.media.shows(), method: 'GET', path: '/shows' },
  { name: 'media.show', call: (c) => c.media.show(show), method: 'GET', path: '/shows/s1' },
  { name: 'media.item', call: (c) => c.media.item(item), method: 'GET', path: '/items/i%201' },
  {
    name: 'media.similar',
    call: (c) => c.media.similar(item),
    method: 'GET',
    path: '/items/i%201/similar',
  },
  {
    name: 'media.themed',
    call: (c) => c.media.themed('christmas & co'),
    method: 'GET',
    path: '/themed?q=christmas+%26+co',
  },
  { name: 'media.home', call: (c) => c.media.home(), method: 'GET', path: '/home' },
  {
    name: 'media.featured',
    call: (c) => c.media.featured(),
    method: 'GET',
    path: '/home/featured',
  },
  {
    name: 'media.aiSuggest',
    call: (c) => c.media.aiSuggest(item),
    method: 'GET',
    path: '/items/i%201/ai-suggest',
  },
  {
    name: 'media.search',
    call: (c) => c.media.search('dune', { limit: 20 }),
    method: 'GET',
    path: '/search?q=dune&limit=20',
  },
  {
    name: 'media.people',
    call: (c) => c.media.people('Denis V', { library }),
    method: 'GET',
    path: '/people?name=Denis+V&library=lib1',
  },
  {
    name: 'media.person',
    call: (c) => c.media.person('Denis V'),
    method: 'GET',
    path: '/people/details?name=Denis+V',
  },
  { name: 'media.libraries', call: (c) => c.media.libraries(), method: 'GET', path: '/libraries' },
  { name: 'media.scan', call: (c) => c.media.scan(), method: 'POST', path: '/scan' },
  {
    name: 'media.rematch.candidates',
    call: (c) => c.media.rematch.candidates('movie', item),
    method: 'GET',
    path: '/rematch/movie/i%201/candidates',
  },
  {
    name: 'media.rematch.candidates with a typed query',
    call: (c) => c.media.rematch.candidates('show', show, ' the wire & co '),
    method: 'GET',
    path: '/rematch/show/s1/candidates?q=the+wire+%26+co',
  },
  {
    name: 'media.rematch.set',
    call: (c) => c.media.rematch.set('movie', item, 603),
    method: 'POST',
    path: '/rematch/movie/i%201',
    body: { tmdbId: 603 },
  },

  {
    name: 'playback.progress',
    call: (c) => c.playback.progress(),
    method: 'GET',
    path: '/progress',
  },
  {
    name: 'playback.itemProgress',
    call: (c) => c.playback.itemProgress(item),
    method: 'GET',
    path: '/progress/i%201',
  },
  {
    name: 'playback.save',
    call: (c) => c.playback.save(item, 1234.6),
    method: 'PUT',
    path: '/progress/i%201',
    body: { positionMs: 1235, durationMs: null },
  },
  {
    name: 'playback.forget',
    call: (c) => c.playback.forget(item),
    method: 'DELETE',
    path: '/progress/i%201',
  },
  {
    name: 'playback.continueWatching',
    call: (c) => c.playback.continueWatching(),
    method: 'GET',
    path: '/continue',
  },
  {
    name: 'playback.upNext',
    call: (c) => c.playback.upNext(show),
    method: 'GET',
    path: '/shows/s1/up-next',
  },
  {
    name: 'playback.nextEpisode',
    call: (c) => c.playback.nextEpisode(item),
    method: 'GET',
    path: '/items/i%201/next',
  },
  {
    name: 'playback.following',
    call: (c) => c.playback.following(item),
    method: 'GET',
    path: '/items/i%201/following',
  },
  { name: 'playback.forYou', call: (c) => c.playback.forYou(), method: 'GET', path: '/for-you' },
  { name: 'playback.watched', call: (c) => c.playback.watched(), method: 'GET', path: '/watched' },
  {
    name: 'playback.markWatched',
    call: (c) => c.playback.markWatched(item),
    method: 'PUT',
    path: '/watched/i%201',
  },
  {
    name: 'playback.unmarkWatched',
    call: (c) => c.playback.unmarkWatched(item),
    method: 'DELETE',
    path: '/watched/i%201',
  },
  { name: 'playback.myList', call: (c) => c.playback.myList(), method: 'GET', path: '/my-list' },
  {
    name: 'playback.addToList',
    call: (c) => c.playback.addToList(show),
    method: 'PUT',
    path: '/my-list/s1',
  },
  {
    name: 'playback.stop',
    call: (c) => c.playback.stop(PlaybackSessionId.parse('sess1')),
    method: 'POST',
    path: '/playback/stop',
    body: { sessionId: 'sess1' },
  },

  {
    name: 'cast.receivers',
    call: (c) => c.cast.receivers(),
    method: 'GET',
    path: '/cast/receivers',
  },
  {
    name: 'cast.unregister',
    call: (c) => c.cast.unregister(receiver),
    method: 'DELETE',
    path: '/cast/receivers/tv-salon-01',
  },
  {
    name: 'cast.command',
    call: (c) => c.cast.command(receiver, { type: 'pause' }),
    method: 'POST',
    path: '/cast/receivers/tv-salon-01/command',
    body: { type: 'pause' },
  },
  {
    name: 'cast.announce',
    call: (c) =>
      c.cast.announce({
        receiverId: receiver,
        name: 'Salon',
        platform: 'tizen',
        lastAppliedSeq: 3,
      }),
    method: 'POST',
    path: '/cast/announce',
  },

  {
    name: 'discovery.search',
    call: (c) => c.discovery.search('dune', { type: 'movie', page: 2 }),
    method: 'GET',
    path: '/discover/search?q=dune&type=movie&page=2',
  },
  {
    name: 'discovery.search drops the all filter and page one',
    call: (c) => c.discovery.search('dune', { type: 'all', page: 1 }),
    method: 'GET',
    path: '/discover/search?q=dune',
  },
  {
    name: 'discovery.trending',
    call: (c) => c.discovery.trending(),
    method: 'GET',
    path: '/discover/trending',
  },
  {
    name: 'discovery.detail',
    call: (c) => c.discovery.detail('tv', 1399),
    method: 'GET',
    path: '/discover/tv/1399',
  },

  { name: 'requests.list', call: (c) => c.requests.list(), method: 'GET', path: '/requests' },
  {
    name: 'requests.list mine',
    call: (c) => c.requests.list({ mine: true }),
    method: 'GET',
    path: '/requests?mine=true',
  },
  {
    name: 'requests.calendar',
    call: (c) => c.requests.calendar(),
    method: 'GET',
    path: '/requests/calendar',
  },
  {
    name: 'requests.missing',
    call: (c) => c.requests.missing({ mine: true }),
    method: 'GET',
    path: '/requests/missing?mine=true',
  },
  {
    name: 'requests.approve',
    call: (c) => c.requests.approve(request),
    method: 'POST',
    path: '/requests/r1/approve',
  },
  {
    name: 'requests.deny with a note',
    call: (c) => c.requests.deny(request, 'nope'),
    method: 'POST',
    path: '/requests/r1/deny',
    body: { note: 'nope' },
  },
  {
    name: 'requests.deny without one',
    call: (c) => c.requests.deny(request),
    method: 'POST',
    path: '/requests/r1/deny',
    body: {},
  },
  {
    name: 'requests.delete',
    call: (c) => c.requests.delete(request),
    method: 'DELETE',
    path: '/requests/r1',
  },
  {
    name: 'requests.wanted',
    call: (c) => c.requests.wanted(request),
    method: 'GET',
    path: '/requests/r1/wanted',
  },
  {
    name: 'requests.ledger',
    call: (c) => c.requests.ledger(request),
    method: 'GET',
    path: '/requests/r1/ledger',
  },
  {
    name: 'requests.seasonLedger',
    call: (c) => c.requests.seasonLedger(request, 2),
    method: 'GET',
    path: '/requests/r1/ledger/2',
  },
  {
    name: 'requests.searchReleases',
    call: (c) => c.requests.searchReleases(request),
    method: 'GET',
    path: '/requests/r1/search?scope=all',
  },
  {
    name: 'requests.searchReleases narrowed',
    call: (c) => c.requests.searchReleases(request, { scope: 'episode', season: 3, episode: 7 }),
    method: 'GET',
    path: '/requests/r1/search?scope=episode&season=3&episode=7',
  },
  {
    name: 'requests.searchAllMissing',
    call: (c) => c.requests.searchAllMissing(),
    method: 'POST',
    path: '/requests/search-missing',
  },

  {
    name: 'reports.create',
    call: (c) => c.reports.create({ subjectKind: 'movie', subjectId: 'i1', category: 'audio' }),
    method: 'POST',
    path: '/reports',
  },
  { name: 'reports.mine', call: (c) => c.reports.mine(), method: 'GET', path: '/reports/mine' },
  {
    name: 'reports.list',
    call: (c) => c.reports.list({ status: 'open' }),
    method: 'GET',
    path: '/admin/reports?status=open',
  },
  {
    name: 'reports.resolve',
    call: (c) => c.reports.resolve(report),
    method: 'POST',
    path: '/admin/reports/rep1/resolve',
  },
  {
    name: 'reports.delete',
    call: (c) => c.reports.delete(report),
    method: 'DELETE',
    path: '/admin/reports/rep1',
  },

  {
    name: 'notifications.list',
    call: (c) => c.notifications.list(),
    method: 'GET',
    path: '/notifications',
  },
  {
    name: 'notifications.markRead',
    call: (c) => c.notifications.markRead([NotificationId.parse('n1')]),
    method: 'POST',
    path: '/notifications/read',
    body: { ids: ['n1'] },
  },
  {
    name: 'notifications.markAllRead',
    call: (c) => c.notifications.markAllRead(),
    method: 'POST',
    path: '/notifications/read',
    body: {},
  },
  {
    name: 'notifications.delete',
    call: (c) => c.notifications.delete(NotificationId.parse('n 1')),
    method: 'DELETE',
    path: '/notifications/n%201',
  },
  {
    name: 'notifications.prefs',
    call: (c) => c.notifications.prefs(),
    method: 'GET',
    path: '/notifications/prefs',
  },
  {
    name: 'notifications.push.key',
    call: (c) => c.notifications.push.key(),
    method: 'GET',
    path: '/push/key',
  },
  {
    name: 'notifications.push.test',
    call: (c) => c.notifications.push.test(),
    method: 'POST',
    path: '/push/test',
  },
  {
    name: 'notifications.push.unsubscribe',
    call: (c) => c.notifications.push.unsubscribe('https://push/x'),
    method: 'DELETE',
    path: '/push/subscribe',
    body: { endpoint: 'https://push/x' },
  },

  {
    name: 'handoff.announce',
    call: (c) => c.handoff.announce({ deviceId: receiver, name: 'Salon', platform: 'tizen' }),
    method: 'POST',
    path: '/handoff/announce',
  },
  {
    name: 'handoff.devices',
    call: (c) => c.handoff.devices(),
    method: 'GET',
    path: '/handoff/devices',
  },
  {
    name: 'handoff.leave',
    call: (c) => c.handoff.leave('sec'),
    method: 'POST',
    path: '/handoff/leave',
    body: { secret: 'sec' },
  },

  { name: 'library.list', call: (c) => c.library.list(), method: 'GET', path: '/admin/libraries' },
  {
    name: 'library.update',
    call: (c) => c.library.update(library, { name: 'Films' }),
    method: 'PATCH',
    path: '/admin/libraries/lib1',
    body: { name: 'Films' },
  },
  {
    name: 'library.scan',
    call: (c) => c.library.scan(library),
    method: 'POST',
    path: '/admin/libraries/lib1/scan',
  },
  {
    name: 'library.browse',
    call: (c) => c.library.browse('/mnt/media'),
    method: 'GET',
    path: '/admin/libraries/browse?path=%2Fmnt%2Fmedia',
  },

  { name: 'admin.server', call: (c) => c.admin.server(), method: 'GET', path: '/admin/server' },
  { name: 'admin.status', call: (c) => c.admin.status(), method: 'GET', path: '/status' },
  {
    name: 'admin.sessions',
    call: (c) => c.admin.sessions(),
    method: 'GET',
    path: '/admin/sessions',
  },
  {
    name: 'admin.terminateSession',
    call: (c) => c.admin.terminateSession(PlaybackSessionId.parse('s 1')),
    method: 'POST',
    path: '/admin/sessions/s%201/stop',
    body: { message: '' },
  },
  {
    name: 'admin.metrics',
    call: (c) => c.admin.metrics('7d'),
    method: 'GET',
    path: '/admin/metrics?range=7d',
  },
  {
    name: 'admin.metrics defaults to the live window',
    call: (c) => c.admin.metrics(),
    method: 'GET',
    path: '/admin/metrics?range=live',
  },
  {
    name: 'admin.transcodes',
    call: (c) => c.admin.transcodes(),
    method: 'GET',
    path: '/admin/transcodes',
  },
  { name: 'admin.storage', call: (c) => c.admin.storage(), method: 'GET', path: '/admin/storage' },
  { name: 'admin.users', call: (c) => c.admin.users(), method: 'GET', path: '/admin/users' },
  {
    name: 'admin.deleteUser',
    call: (c) => c.admin.deleteUser(user),
    method: 'DELETE',
    path: '/admin/users/u1',
  },
  {
    name: 'admin.resetUser',
    call: (c) => c.admin.resetUser(user),
    method: 'POST',
    path: '/admin/users/u1/reset',
  },
  {
    name: 'admin.settings',
    call: (c) => c.admin.settings('general'),
    method: 'GET',
    path: '/admin/settings?view=general',
  },
  {
    name: 'admin.updateSettings',
    call: (c) => c.admin.updateSettings({ serverName: 'NAS' }),
    method: 'PUT',
    path: '/admin/settings',
    body: { serverName: 'NAS' },
  },
  {
    name: 'admin.overview',
    call: (c) => c.admin.overview(),
    method: 'GET',
    path: '/admin/stats/overview',
  },
  {
    name: 'admin.topUsers',
    call: (c) => c.admin.topUsers(),
    method: 'GET',
    path: '/admin/stats/top-users?days=7',
  },
  {
    name: 'admin.history from a bare day count',
    call: (c) => c.admin.history(14),
    method: 'GET',
    path: '/admin/stats/history?days=14',
  },
  {
    name: 'admin.mostWatched',
    call: (c) => c.admin.mostWatched({ user }),
    method: 'GET',
    path: '/admin/stats/most-watched?days=30&user=u1',
  },
  {
    name: 'admin.plays',
    call: (c) => c.admin.plays({ limit: 50 }),
    method: 'GET',
    path: '/admin/stats/plays?limit=50&days=30',
  },
  {
    name: 'admin.logs',
    call: (c) => c.admin.logs({ level: 'warn' }),
    method: 'GET',
    path: '/admin/logs?level=warn',
  },
  {
    name: 'admin.notifications.samples',
    call: (c) => c.admin.notifications.samples(),
    method: 'GET',
    path: '/admin/notifications/samples',
  },
  {
    name: 'admin.notifications.send',
    call: (c) => c.admin.notifications.send({ title: 'Hello' }),
    method: 'POST',
    path: '/admin/notifications',
    body: { target: 'me', title: 'Hello' },
  },
  {
    name: 'admin.backup.export',
    call: (c) => c.admin.backup.export(),
    method: 'GET',
    path: '/admin/backup/export',
  },

  { name: 'jobs.list', call: (c) => c.jobs.list(), method: 'GET', path: '/admin/jobs' },
  {
    name: 'jobs.detail',
    call: (c) => c.jobs.detail(job),
    method: 'GET',
    path: '/admin/jobs/library.scan',
  },
  {
    name: 'jobs.run',
    call: (c) => c.jobs.run(job),
    method: 'POST',
    path: '/admin/jobs/library.scan/run',
  },
  {
    name: 'jobs.update',
    call: (c) => c.jobs.update(job, { enabled: false }),
    method: 'PATCH',
    path: '/admin/jobs/library.scan',
    body: { enabled: false },
  },
  {
    name: 'jobs.runLogs',
    call: (c) => c.jobs.runLogs(JobRunId.parse('run 1')),
    method: 'GET',
    path: '/admin/job-runs/run%201/logs',
  },

  {
    name: 'pipeline.overview',
    call: (c) => c.pipeline.overview(),
    method: 'GET',
    path: '/admin/pipeline',
  },
  {
    name: 'pipeline.failed',
    call: (c) => c.pipeline.failed('probe'),
    method: 'GET',
    path: '/admin/pipeline/probe/failed',
  },
  {
    name: 'pipeline.pause',
    call: (c) => c.pipeline.pause(true),
    method: 'POST',
    path: '/admin/pipeline/pause',
    body: { paused: true },
  },
  {
    name: 'pipeline.retryTask',
    call: (c) => c.pipeline.retryTask('probe', item),
    method: 'POST',
    path: '/admin/pipeline/probe/task/retry',
    body: { subjectId: 'i 1' },
  },
  {
    name: 'pipeline.elements',
    call: (c) => c.pipeline.elements({ status: 'failed', page: 2 }),
    method: 'GET',
    path: '/admin/pipeline/elements?status=failed&page=2',
  },
  {
    name: 'pipeline.item',
    call: (c) => c.pipeline.item(item),
    method: 'GET',
    path: '/admin/pipeline/item/i%201',
  },
  {
    name: 'pipeline.reprocessSubject',
    call: (c) => c.pipeline.reprocessSubject('show', show),
    method: 'POST',
    path: '/admin/pipeline/subject/reprocess',
    body: { kind: 'show', id: 's1' },
  },

  { name: 'llm.config', call: (c) => c.llm.config(), method: 'GET', path: '/admin/llm' },
  {
    name: 'llm.test',
    call: (c) => c.llm.test({ model: 'gpt' }),
    method: 'POST',
    path: '/admin/llm/test',
    body: { model: 'gpt' },
  },

  { name: 'modules.list', call: (c) => c.modules.list(), method: 'GET', path: '/modules' },

  {
    name: 'subtitles.capabilities',
    call: (c) => c.subtitles.capabilities(item),
    method: 'GET',
    path: '/items/i%201/subtitles/capabilities',
  },
  {
    name: 'subtitles.downloaded',
    call: (c) => c.subtitles.downloaded(item),
    method: 'GET',
    path: '/items/i%201/subtitles/downloaded',
  },
  {
    name: 'subtitles.delete',
    call: (c) => c.subtitles.delete(item, SubtitleId.parse('sub 1')),
    method: 'DELETE',
    path: '/items/i%201/subtitles/downloaded/sub%201',
  },
  {
    name: 'subtitles.generate',
    call: (c) => c.subtitles.generate(item, { mode: 'transcribe', lang: 'fr' }),
    method: 'POST',
    path: '/items/i%201/subtitles/generate',
    body: { mode: 'transcribe', lang: 'fr' },
  },
  {
    name: 'subtitles.generations',
    call: (c) => c.subtitles.generations(item),
    method: 'GET',
    path: '/items/i%201/subtitles/generations',
  },
  {
    name: 'subtitles.cancel',
    call: (c) => c.subtitles.cancel(item, GenerationId.parse('g 1')),
    method: 'DELETE',
    path: '/items/i%201/subtitles/generations/g%201',
  },

  {
    name: 'diagnostics.crash',
    call: (c) =>
      c.diagnostics.crash({
        message: 'boom',
        stack: '',
        platform: 'web',
        capturedAt: 1,
        build: { version: '1', commit: null },
        device: null,
      }),
    method: 'POST',
    path: '/diagnostics/crash',
  },
];

describe('every endpoint reaches the route it claims', () => {
  it.each(ENDPOINTS)('$name', async ({ call, method, path, body }) => {
    const recorded = await recordRequest(call);

    expect(recorded.method).toBe(method);
    expect(recorded.path).toBe(path);
    if (body !== undefined) expect(recorded.body).toEqual(body);
  });
});

describe('URL builders, which make no request', () => {
  const { client } = recordingClient();

  it.each([
    ['streamUrl', client.media.streamUrl(item), '/items/i%201/stream'],
    ['subtitleUrl', client.media.subtitleUrl(item, 3), '/items/i%201/subtitles/3.vtt'],
    ['storyboardUrl', client.media.storyboardUrl(item), '/items/i%201/storyboard'],
    ['posterUrl', client.media.artwork.posterUrl(item), '/items/i%201/poster'],
    ['showPosterUrl', client.media.artwork.showPosterUrl(show), '/shows/s1/poster'],
    ['logsUrl', client.media.logsUrl(), '/logs?tail=200'],
    ['downloadUrl', client.media.downloadUrl(item), '/items/i%201/download'],
    [
      'downloadUrl keeps "copy nothing" distinct from "no preference"',
      client.media.downloadUrl(item, [], []),
      '/items/i%201/download?copy=&video=',
    ],
    [
      'downloadUrl with a codec set',
      client.media.downloadUrl(item, ['aac', 'ac3']),
      '/items/i%201/download?copy=aac%2Cac3',
    ],
  ])('%s', (_name, url, path) => {
    expect(url).toBe(`http://kroma.test/api${path}`);
  });
});

describe('the module admin API', () => {
  const Clients = z.array(z.object({ id: z.string() }));

  it('mounts a module under its own encoded id', async () => {
    const { client, calls } = recordingClient(() => ({ json: [] }));
    const api = client.modules.api(ModuleId.parse('tv.kroma.torrents'));

    await api.get('/clients', Clients);
    await api.post('/clients', { url: 'http://qb' });
    await api.delete('/clients/1');

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /admin/m/tv.kroma.torrents/clients',
      'POST /admin/m/tv.kroma.torrents/clients',
      'DELETE /admin/m/tv.kroma.torrents/clients/1',
    ]);
  });

  it('parses what a module answers with the schema the module passed in', async () => {
    const { client } = recordingClient(() => ({ json: [{ id: 'qb' }] }));
    const api = client.modules.api(ModuleId.parse('tv.kroma.torrents'));

    await expect(api.get('/clients', Clients)).resolves.toEqual([{ id: 'qb' }]);
    await expect(api.get('/clients', z.array(z.object({ id: z.number() })))).rejects.toThrow();
  });
});
