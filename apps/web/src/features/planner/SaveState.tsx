/** Save status; static "Saved" until autosave arrives in Phase E. */
export function SaveState() {
  return (
    <span role="status" className="flex items-center gap-1.5 text-meta text-ink-2">
      <span aria-hidden className="size-1.5 rounded-full bg-ok" />
      Saved
    </span>
  );
}
