/**
 * Product sample shots: a product photo and instructions go to an image model, which returns the
 * product pictured in a home. Claude reads images but doesn't make them, so this uses Google's
 * Gemini image model (GEMINI_API_KEY) or OpenAI's (OPENAI_API_KEY), whichever is set; Gemini first.
 */

export interface RenderRequest {
  /** Base64 product photo. */
  image: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  prompt: string;
}

export interface RenderResult {
  image: string;
  mediaType: string;
}

export interface Renderer {
  provider: 'gemini' | 'openai';
  render: (req: RenderRequest) => Promise<RenderResult>;
}

/** A failure to pass on to the app, with what to tell the user. */
export class RenderError extends Error {
  constructor(
    message: string,
    readonly code: 'auth' | 'busy' | 'refused' | 'upstream',
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

export function createRenderer(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: Fetch = fetch,
): Renderer | undefined {
  const gemini = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (gemini) {
    const model = env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    return { provider: 'gemini', render: (r) => renderGemini(r, gemini, model, fetcher) };
  }
  if (env.OPENAI_API_KEY) {
    const key = env.OPENAI_API_KEY;
    const model = env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    return { provider: 'openai', render: (r) => renderOpenAi(r, key, model, fetcher) };
  }
  return undefined;
}

async function failure(res: Response, service: string): Promise<never> {
  const detail = await res.text().catch(() => '');
  console.error(`${service} image request failed`, res.status, detail.slice(0, 500));
  if (res.status === 401 || res.status === 403)
    throw new RenderError(
      `The ${service} API key was rejected. Check it and restart the app.`,
      'auth',
    );
  if (res.status === 429)
    throw new RenderError('Too many requests right now. Wait a minute and try again.', 'busy');
  if (res.status === 400 && /safety|policy|blocked/i.test(detail))
    throw new RenderError(
      `${service} declined this picture. Try another photo or wording.`,
      'refused',
    );
  throw new RenderError(
    `The ${service} image service is unavailable. Try again shortly.`,
    'upstream',
  );
}

async function renderGemini(
  req: RenderRequest,
  key: string,
  model: string,
  fetcher: Fetch,
): Promise<RenderResult> {
  const res = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: req.mediaType, data: req.image } },
              { text: req.prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '4:3' },
        },
      }),
    },
  );
  if (!res.ok) return failure(res, 'Gemini');
  const body = (await res.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] };
    }[];
  };
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) {
    throw new RenderError(
      'Gemini didn’t return a picture this time. Try again, or change the photo or wording.',
      'refused',
    );
  }
  return { image: part.inlineData.data, mediaType: part.inlineData.mimeType };
}

async function renderOpenAi(
  req: RenderRequest,
  key: string,
  model: string,
  fetcher: Fetch,
): Promise<RenderResult> {
  const form = new FormData();
  form.set('model', model);
  form.set('prompt', req.prompt);
  form.set('size', '1536x1024');
  form.set('quality', 'high');
  const ext = req.mediaType.split('/')[1];
  form.set(
    'image',
    new Blob([Buffer.from(req.image, 'base64')], { type: req.mediaType }),
    `product.${ext}`,
  );
  const res = await fetcher('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return failure(res, 'OpenAI');
  const body = (await res.json()) as { data?: { b64_json?: string }[] };
  const image = body.data?.[0]?.b64_json;
  if (!image) throw new RenderError('OpenAI didn’t return a picture. Try again.', 'refused');
  return { image, mediaType: 'image/png' };
}
