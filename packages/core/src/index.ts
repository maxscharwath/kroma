// Shared domain logic. Re-exports the core of @kroma/client - the client, the
// transport, the session - so app code reaches those from `@kroma/core`; a
// domain's schemas come from `@kroma/client/<domain>`.
export * from '@kroma/client';
export * from './airdate';
export * from './browse';
export * from './compat';
export * from './discover';
export * from './format';
export * from './genre';
export * from './genre-art';
export * from './handoff';
export * from './hevc';
export * from './i18n';
export * from './intl';
export * from './lang';
export * from './match';
export * from './notification-labels';
export * from './people';
export * from './permissions';
export * from './person-facts';
export * from './platform';
export * from './playback-buffer';
export * from './playback-stall';
export * from './player';
export * from './push-labels';
export * from './remote';
export * from './slug';
export * from './subtitles';
