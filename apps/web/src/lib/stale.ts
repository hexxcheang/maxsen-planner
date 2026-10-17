/**
 * After an update on the server, a copy of the app already open (or kept on the device) can ask
 * for a piece of the old version that's gone, such as the PDF reader. Then the app reloads itself
 * once, to the new version, rather than failing.
 */
const KEY = 'maxsen.reloadedForUpdate';

/** Whether an error is a piece of the app that couldn't be loaded. */
export const isStaleApp = (e: unknown) =>
  e instanceof Error &&
  /dynamically imported module|importing a module script failed|unable to preload|failed to load module/i.test(
    e.message,
  );

/** Reloads to the new version, at most once a minute (so a real outage doesn't loop). */
export function reloadForUpdate(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Without storage, still reload once.
  }
  window.location.reload();
  return true;
}
