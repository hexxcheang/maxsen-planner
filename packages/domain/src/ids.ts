export type IdPrefix =
  | 'proj'
  | 'lvl'
  | 'plan'
  | 'el'
  | 'prod'
  | 'var'
  | 'file'
  | 'src'
  | 'page'
  | 'tpl';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 12;

/**
 * Prefixed random identifier, e.g. `proj_k3Jd9sLq2Xw1`.
 * Uses Web Crypto (available in browsers and Node ≥ 19) so the domain package stays dependency-free.
 */
interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

function randomSource(): RandomSource {
  const source = (globalThis as { crypto?: RandomSource }).crypto;
  if (!source) throw new Error('Web Crypto is not available in this environment');
  return source;
}

export function newId(prefix: IdPrefix): string {
  const bytes = new Uint8Array(ID_LENGTH);
  randomSource().getRandomValues(bytes);
  let suffix = '';
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${suffix}`;
}
