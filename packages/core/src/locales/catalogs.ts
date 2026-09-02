import aboutEn from './about/en.json';
import aboutFr from './about/fr.json';
import accountEn from './account/en.json';
import accountFr from './account/fr.json';
import addProfileEn from './addProfile/en.json';
import addProfileFr from './addProfile/fr.json';
import appearanceEn from './appearance/en.json';
import appearanceFr from './appearance/fr.json';
import artworkQualityEn from './artworkQuality/en.json';
import artworkQualityFr from './artworkQuality/fr.json';
import authEn from './auth/en.json';
import authFr from './auth/fr.json';
import browseEn from './browse/en.json';
import browseFr from './browse/fr.json';
import castEn from './cast/en.json';
import castFr from './cast/fr.json';
import commonEn from './common/en.json';
import commonFr from './common/fr.json';
import compatEn from './compat/en.json';
import compatFr from './compat/fr.json';
import connectEn from './connect/en.json';
import connectFr from './connect/fr.json';
import connectionEn from './connection/en.json';
import connectionFr from './connection/fr.json';
import contentEn from './content/en.json';
import contentFr from './content/fr.json';
import crashEn from './crash/en.json';
import crashFr from './crash/fr.json';
import deviceSettingsEn from './deviceSettings/en.json';
import deviceSettingsFr from './deviceSettings/fr.json';
import discoverEn from './discover/en.json';
import discoverFr from './discover/fr.json';
import errorEn from './error/en.json';
import errorFr from './error/fr.json';
import fieldEn from './field/en.json';
import fieldFr from './field/fr.json';
import formEn from './form/en.json';
import formFr from './form/fr.json';
import formatEn from './format/en.json';
import formatFr from './format/fr.json';
import genreEn from './genre/en.json';
import genreFr from './genre/fr.json';
import genresEn from './genres/en.json';
import genresFr from './genres/fr.json';
import handoffEn from './handoff/en.json';
import handoffFr from './handoff/fr.json';
import indexersEn from './indexers/en.json';
import indexersFr from './indexers/fr.json';
import keyboardLayoutEn from './keyboardLayout/en.json';
import keyboardLayoutFr from './keyboardLayout/fr.json';
import langEn from './lang/en.json';
import langFr from './lang/fr.json';
import mediaInfoEn from './mediaInfo/en.json';
import mediaInfoFr from './mediaInfo/fr.json';
import modulesEn from './modules/en.json';
import modulesFr from './modules/fr.json';
import navEn from './nav/en.json';
import navFr from './nav/fr.json';
import notificationsEn from './notifications/en.json';
import notificationsFr from './notifications/fr.json';
import offlineEn from './offline/en.json';
import offlineFr from './offline/fr.json';
import optEn from './opt/en.json';
import optFr from './opt/fr.json';
import passkeyEn from './passkey/en.json';
import passkeyFr from './passkey/fr.json';
import personEn from './person/en.json';
import personFr from './person/fr.json';
import pinEn from './pin/en.json';
import pinFr from './pin/fr.json';
import pipelineEn from './pipeline/en.json';
import pipelineFr from './pipeline/fr.json';
import playbackEngineEn from './playbackEngine/en.json';
import playbackEngineFr from './playbackEngine/fr.json';
import playerEn from './player/en.json';
import playerFr from './player/fr.json';
import profileMenuEn from './profileMenu/en.json';
import profileMenuFr from './profileMenu/fr.json';
import profilesEn from './profiles/en.json';
import profilesFr from './profiles/fr.json';
import pushEn from './push/en.json';
import pushFr from './push/fr.json';
import rematchEn from './rematch/en.json';
import rematchFr from './rematch/fr.json';
import reportEn from './report/en.json';
import reportFr from './report/fr.json';
import reportsEn from './reports/en.json';
import reportsFr from './reports/fr.json';
import requestsEn from './requests/en.json';
import requestsFr from './requests/fr.json';
import searchEn from './search/en.json';
import searchFr from './search/fr.json';
import settingsEn from './settings/en.json';
import settingsFr from './settings/fr.json';
import statsEn from './stats/en.json';
import statsFr from './stats/fr.json';
import subtitleEn from './subtitle/en.json';
import subtitleFr from './subtitle/fr.json';
import timeEn from './time/en.json';
import timeFr from './time/fr.json';
import vpnEn from './vpn/en.json';
import vpnFr from './vpn/fr.json';

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
  admin: () => part(import('./admin/en.json'), import('./admin/fr.json')),
  jobs: () => part(import('./jobs/en.json'), import('./jobs/fr.json')),
  logs: () => part(import('./logs/en.json'), import('./logs/fr.json')),
};
