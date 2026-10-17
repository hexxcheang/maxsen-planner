import { sample, type FloorAnalysis } from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { loadImage } from '@/lib/images';

export class MagicPlanError extends Error {
  override name = 'MagicPlanError';
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const VISION_LONG_EDGE = 1568;

/** The plan's background as a PNG sized for the vision model. */
async function backgroundAsPng(fileId: string): Promise<string> {
  const img = await loadImage(fileUrl(fileId));
  const k = Math.min(1, VISION_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').split(',')[1]!;
}

/**
 * Gets the floor analysis for a plan background: built in for the sample drawings, otherwise read
 * by the server's vision model.
 */
export async function analyseBackground(
  fileId: string,
  notes: string,
): Promise<{ analysis: FloorAnalysis; source: 'sample' | 'vision' }> {
  const builtIn = sample.sampleAnalysisFor(fileId);
  if (builtIn) return { analysis: builtIn, source: 'sample' };

  const image = await backgroundAsPng(fileId);
  let res: Response;
  try {
    res = await fetch('/api/magic-plan/analyse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, mediaType: 'image/png', notes: notes.trim() || undefined }),
    });
  } catch {
    throw new MagicPlanError(
      'The app’s server isn’t reachable. Make sure `pnpm dev` is still running.',
      'offline',
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    analysis?: FloorAnalysis;
    error?: string;
    message?: string;
  };
  if (!res.ok || !body.analysis) {
    throw new MagicPlanError(
      body.message ?? 'The drawing couldn’t be read. Try again.',
      body.error ?? 'failed',
    );
  }
  return { analysis: body.analysis, source: 'vision' };
}

export async function magicPlanConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/magic-plan/status');
    if (!res.ok) return false;
    return ((await res.json()) as { configured?: boolean }).configured === true;
  } catch {
    return false;
  }
}
