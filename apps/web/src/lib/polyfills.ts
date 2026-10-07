/**
 * Newer JavaScript the PDF reader (pdf.js 5) relies on, for browsers that don't have it yet
 * (older Chrome on Android tablets, Safari on iPads): without it, PDF pages can't be drawn.
 */
interface Keyed {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): unknown;
}

for (const proto of [Map.prototype, WeakMap.prototype] as unknown as Keyed[]) {
  if (!('getOrInsert' in proto))
    Object.defineProperty(proto, 'getOrInsert', {
      configurable: true,
      writable: true,
      value(this: Keyed, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      },
    });
  if (!('getOrInsertComputed' in proto))
    Object.defineProperty(proto, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value(this: Keyed, key: unknown, make: (key: unknown) => unknown) {
        if (!this.has(key)) this.set(key, make(key));
        return this.get(key);
      },
    });
}
