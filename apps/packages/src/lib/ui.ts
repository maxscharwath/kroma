/** The first and last eight hex characters, which is how a checksum is compared
 *  by eye. The full digest is what the copy control puts on the clipboard. */
export const shortHash = (hash: string) =>
  hash.length > 20 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
