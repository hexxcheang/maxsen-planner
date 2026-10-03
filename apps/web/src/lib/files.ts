import { sample } from '@maxsen/domain';
import { storedFileUrl } from './storage/file-store';

/** URL for a stored file. Uploaded files come from browser storage, sample files from the bundled assets; Phase B serves `/files/:id` from the API. */
export function fileUrl(fileId: string): string {
  const stored = storedFileUrl(fileId);
  if (stored) return stored;
  try {
    return sample.sampleFileUrl(fileId);
  } catch {
    return `/files/${fileId}`;
  }
}
