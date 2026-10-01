import { sample } from '@maxsen/domain';

/** URL for a stored file. Phase A serves sample assets; Phase B serves `/files/:id` from the API. */
export function fileUrl(fileId: string): string {
  try {
    return sample.sampleFileUrl(fileId);
  } catch {
    return `/files/${fileId}`;
  }
}
