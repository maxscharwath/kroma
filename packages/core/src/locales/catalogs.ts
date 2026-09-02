import aboutEn from './en/about.json';
import accountEn from './en/account.json';
import addProfileEn from './en/addProfile.json';
import appearanceEn from './en/appearance.json';
import artworkQualityEn from './en/artworkQuality.json';
import authEn from './en/auth.json';
import browseEn from './en/browse.json';
import castEn from './en/cast.json';
import commonEn from './en/common.json';
import compatEn from './en/compat.json';
import connectEn from './en/connect.json';
import connectionEn from './en/connection.json';
import contentEn from './en/content.json';
import crashEn from './en/crash.json';
import deviceSettingsEn from './en/deviceSettings.json';
import discoverEn from './en/discover.json';
import errorEn from './en/error.json';
import fieldEn from './en/field.json';
import formEn from './en/form.json';
import formatEn from './en/format.json';
import genreEn from './en/genre.json';
import genresEn from './en/genres.json';
import handoffEn from './en/handoff.json';
import indexersEn from './en/indexers.json';
import keyboardLayoutEn from './en/keyboardLayout.json';
import langEn from './en/lang.json';
import mediaInfoEn from './en/mediaInfo.json';
import modulesEn from './en/modules.json';
import navEn from './en/nav.json';
import notificationsEn from './en/notifications.json';
import offlineEn from './en/offline.json';
import optEn from './en/opt.json';
import passkeyEn from './en/passkey.json';
import personEn from './en/person.json';
import pinEn from './en/pin.json';
import pipelineEn from './en/pipeline.json';
import playbackEngineEn from './en/playbackEngine.json';
import playerEn from './en/player.json';
import profileMenuEn from './en/profileMenu.json';
import profilesEn from './en/profiles.json';
import pushEn from './en/push.json';
import rematchEn from './en/rematch.json';
import reportEn from './en/report.json';
import reportsEn from './en/reports.json';
import requestsEn from './en/requests.json';
import searchEn from './en/search.json';
import settingsEn from './en/settings.json';
import statsEn from './en/stats.json';
import subtitleEn from './en/subtitle.json';
import timeEn from './en/time.json';
import vpnEn from './en/vpn.json';
import aboutFr from './fr/about.json';
import accountFr from './fr/account.json';
import addProfileFr from './fr/addProfile.json';
import appearanceFr from './fr/appearance.json';
import artworkQualityFr from './fr/artworkQuality.json';
import authFr from './fr/auth.json';
import browseFr from './fr/browse.json';
import castFr from './fr/cast.json';
import commonFr from './fr/common.json';
import compatFr from './fr/compat.json';
import connectFr from './fr/connect.json';
import connectionFr from './fr/connection.json';
import contentFr from './fr/content.json';
import crashFr from './fr/crash.json';
import deviceSettingsFr from './fr/deviceSettings.json';
import discoverFr from './fr/discover.json';
import errorFr from './fr/error.json';
import fieldFr from './fr/field.json';
import formFr from './fr/form.json';
import formatFr from './fr/format.json';
import genreFr from './fr/genre.json';
import genresFr from './fr/genres.json';
import handoffFr from './fr/handoff.json';
import indexersFr from './fr/indexers.json';
import keyboardLayoutFr from './fr/keyboardLayout.json';
import langFr from './fr/lang.json';
import mediaInfoFr from './fr/mediaInfo.json';
import modulesFr from './fr/modules.json';
import navFr from './fr/nav.json';
import notificationsFr from './fr/notifications.json';
import offlineFr from './fr/offline.json';
import optFr from './fr/opt.json';
import passkeyFr from './fr/passkey.json';
import personFr from './fr/person.json';
import pinFr from './fr/pin.json';
import pipelineFr from './fr/pipeline.json';
import playbackEngineFr from './fr/playbackEngine.json';
import playerFr from './fr/player.json';
import profileMenuFr from './fr/profileMenu.json';
import profilesFr from './fr/profiles.json';
import pushFr from './fr/push.json';
import rematchFr from './fr/rematch.json';
import reportFr from './fr/report.json';
import reportsFr from './fr/reports.json';
import requestsFr from './fr/requests.json';
import searchFr from './fr/search.json';
import settingsFr from './fr/settings.json';
import statsFr from './fr/stats.json';
import subtitleFr from './fr/subtitle.json';
import timeFr from './fr/time.json';
import vpnFr from './fr/vpn.json';

async function part<E extends Record<string, string>, F extends Record<string, string>>(
  en: Promise<{ default: E }>,
  fr: Promise<{ default: F }>,
): Promise<{ en: E; fr: F }> {
  const [loadedEn, loadedFr] = await Promise.all([en, fr]);
  return { en: loadedEn.default, fr: loadedFr.default };
}

export const catalogs = {
  en: {
    ...aboutEn,
    ...accountEn,
    ...addProfileEn,
    ...appearanceEn,
    ...artworkQualityEn,
    ...authEn,
    ...browseEn,
    ...castEn,
    ...commonEn,
    ...compatEn,
    ...connectEn,
    ...connectionEn,
    ...contentEn,
    ...crashEn,
    ...deviceSettingsEn,
    ...discoverEn,
    ...errorEn,
    ...fieldEn,
    ...formEn,
    ...formatEn,
    ...genreEn,
    ...genresEn,
    ...handoffEn,
    ...indexersEn,
    ...keyboardLayoutEn,
    ...langEn,
    ...mediaInfoEn,
    ...modulesEn,
    ...navEn,
    ...notificationsEn,
    ...offlineEn,
    ...optEn,
    ...passkeyEn,
    ...personEn,
    ...pinEn,
    ...pipelineEn,
    ...playbackEngineEn,
    ...playerEn,
    ...profileMenuEn,
    ...profilesEn,
    ...pushEn,
    ...rematchEn,
    ...reportEn,
    ...reportsEn,
    ...requestsEn,
    ...searchEn,
    ...settingsEn,
    ...statsEn,
    ...subtitleEn,
    ...timeEn,
    ...vpnEn,
  },
  fr: {
    ...aboutFr,
    ...accountFr,
    ...addProfileFr,
    ...appearanceFr,
    ...artworkQualityFr,
    ...authFr,
    ...browseFr,
    ...castFr,
    ...commonFr,
    ...compatFr,
    ...connectFr,
    ...connectionFr,
    ...contentFr,
    ...crashFr,
    ...deviceSettingsFr,
    ...discoverFr,
    ...errorFr,
    ...fieldFr,
    ...formFr,
    ...formatFr,
    ...genreFr,
    ...genresFr,
    ...handoffFr,
    ...indexersFr,
    ...keyboardLayoutFr,
    ...langFr,
    ...mediaInfoFr,
    ...modulesFr,
    ...navFr,
    ...notificationsFr,
    ...offlineFr,
    ...optFr,
    ...passkeyFr,
    ...personFr,
    ...pinFr,
    ...pipelineFr,
    ...playbackEngineFr,
    ...playerFr,
    ...profileMenuFr,
    ...profilesFr,
    ...pushFr,
    ...rematchFr,
    ...reportFr,
    ...reportsFr,
    ...requestsFr,
    ...searchFr,
    ...settingsFr,
    ...statsFr,
    ...subtitleFr,
    ...timeFr,
    ...vpnFr,
  },
};

export const lazy = {
  admin: () => part(import('./en/admin.json'), import('./fr/admin.json')),
  jobs: () => part(import('./en/jobs.json'), import('./fr/jobs.json')),
  logs: () => part(import('./en/logs.json'), import('./fr/logs.json')),
};
