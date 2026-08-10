import { kromaSite } from '@kroma/bundler/site';

export default kromaSite(import.meta.url, {
  sheet: { env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '' } },
});
