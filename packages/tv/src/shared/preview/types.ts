/** Action payload carried by a preview tile and handed back to us on launch. */
export interface DeepLink {
  type: 'movie' | 'show';
  id: string;
}
