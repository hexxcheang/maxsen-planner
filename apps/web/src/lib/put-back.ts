const tried = new Set<string>();

/**
 * When the server says it has none of something the team had (it started without its disk, or
 * the disk was replaced), this device sends back its last copy. The server takes it only while it
 * still has none, so a copy can never replace the team's current data. Tried once per app open.
 * True when the copy was taken, so the caller fetches again.
 */
export async function putBack(url: string, copy: unknown): Promise<boolean> {
  if (tried.has(url)) return false;
  tried.add(url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(copy),
    });
    return res.ok && ((await res.json()) as { restored?: boolean }).restored === true;
  } catch {
    return false;
  }
}
