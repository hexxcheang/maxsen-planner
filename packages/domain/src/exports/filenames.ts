export type ExportKind = 'floor-plan' | 'product-description' | 'quantity';

const MAX_LENGTH = 100;
const FALLBACK = 'Project';

// eslint-disable-next-line no-control-regex
const RESERVED = /[\\/:*?"<>|\u0000-\u001F\u007F]/g;

/** Makes a project title safe for use as a filename on Windows, macOS and Linux. */
export function sanitiseFilename(title: string): string {
  const cleaned = title
    .replace(/\s+/g, ' ')
    .replace(RESERVED, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
    .trim()
    .slice(0, MAX_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : FALLBACK;
}

const SUFFIX: Record<ExportKind, string> = {
  'floor-plan': ' - Marked Floor Plan.pdf',
  'product-description': ' - Product Description.pdf',
  quantity: ' - Quantity List.xlsx',
};

/** Export filenames per product spec §11. */
export function exportFilename(title: string, kind: ExportKind): string {
  return `${sanitiseFilename(title)}${SUFFIX[kind]}`;
}
