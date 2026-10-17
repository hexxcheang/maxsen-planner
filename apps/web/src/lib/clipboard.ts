/**
 * Copies text. The Clipboard API only works on secure pages (https, or localhost); opened from a
 * tablet at the Mac's network address the page is plain http, so fall back to copying a hidden
 * text box's selection.
 */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  box.setSelectionRange(0, text.length);
  const ok = document.execCommand('copy');
  box.remove();
  if (!ok) throw new Error('Copy was blocked');
}
