import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Copy, Download, ImagePlus, KeyRound, RefreshCw, Sparkles } from 'lucide-react';
import {
  CATEGORIES,
  categoryById,
  productShotPrompt,
  SHOT_LIGHT,
  SHOT_ROOMS,
  SHOT_STYLES,
  type CategoryId,
  type ShotLight,
  type ShotRoom,
  type ShotStyle,
} from '@maxsen/domain';
import { Button, Field, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { Page } from '@/components/Page';
import { useCatalogue } from '@/lib/data/hooks';
import { loadImage } from '@/lib/images';
import { copyText } from '@/lib/clipboard';

/** A photo ready to send: resized, as JPEG. */
interface Photo {
  url: string;
  base64: string;
}

interface Shot {
  url: string;
  at: string;
}

const LONG_EDGE = 1536;

/** The photo resized (long edge 1536 px) as a JPEG, which image models take best. */
async function preparePhoto(file: File): Promise<Photo> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const k = Math.min(1, LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    return { url, base64: url.split(',')[1]! };
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Any picture as a JPEG data URL (the models return PNG). */
async function asJpeg(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

const save = (url: string, name: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
};

/**
 * Product sample: a photo of a product becomes a premium picture of it installed in a home. Say
 * what it is (category, and the product from the catalogue) and the room and look; an image model
 * on the server makes the picture. Without one set up, the instructions can be copied into the
 * Gemini app with the photo.
 */
export function ProductSampleScreen() {
  const { data: catalogue } = useCatalogue();
  const { toast } = useToast();
  const [status, setStatus] = useState<{ configured: boolean; provider: string | null } | null>(
    null,
  );
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [categoryId, setCategoryId] = useState<CategoryId>('smart-switches');
  const [variantId, setVariantId] = useState('');
  const [room, setRoom] = useState<ShotRoom>('living');
  const [style, setStyle] = useState<ShotStyle>('warm-luxury');
  const [light, setLight] = useState<ShotLight>('golden');
  const [notes, setNotes] = useState('');
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [current, setCurrent] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/product-sample/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { configured: boolean; provider: string | null } | null) =>
        setStatus(s ?? { configured: false, provider: null }),
      )
      .catch(() => setStatus({ configured: false, provider: null }));
  }, []);

  // The catalogue's products in the chosen category, to say exactly which one it is.
  const products = useMemo(() => {
    const byId = new Map(catalogue.products.map((p) => [p.id, p]));
    return catalogue.variants
      .flatMap((v) => {
        const p = byId.get(v.productId);
        return p && p.categoryId === categoryId && !p.hidden && !v.hidden ? [{ v, p }] : [];
      })
      .map(({ v, p }) => ({
        value: v.id,
        label: `${p.name}, ${v.name}`,
        product: p.name,
        variant: v.name,
      }));
  }, [catalogue, categoryId]);
  const picked = products.find((p) => p.value === variantId);

  const prompt = productShotPrompt({
    categoryId,
    productName: picked?.product,
    variantName: picked?.variant,
    room,
    style,
    light,
    notes,
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await preparePhoto(file));
      setError(null);
    } catch {
      toast({ title: 'That photo couldn’t be opened', body: 'Use a JPG or PNG.', tone: 'danger' });
    }
  };

  const generate = async () => {
    if (!photo) return;
    setMaking(true);
    setError(null);
    try {
      const res = await fetch('/api/product-sample/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: photo.base64, mediaType: 'image/jpeg', prompt }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        image?: string;
        mediaType?: string;
        message?: string;
      };
      if (!res.ok || !body.image) {
        setError(body.message ?? 'The picture couldn’t be made. Try again.');
        return;
      }
      const url = await asJpeg(`data:${body.mediaType ?? 'image/png'};base64,${body.image}`);
      setShots((s) => [{ url, at: new Date().toISOString() }, ...s].slice(0, 8));
      setCurrent(0);
    } catch {
      setError('The app’s server isn’t reachable. Make sure `pnpm dev` is still running.');
    } finally {
      setMaking(false);
    }
  };

  const name = (picked?.label ?? categoryById(categoryId).name).replace(/[\\/:*?"<>|]/g, '');
  const shot = shots[current];

  return (
    <Page wide>
      <PageHeader
        title="Product sample"
        description="Turn a photo of a product into a premium picture of it installed in a home. Say what it is and the room and look you want; the product is kept as photographed."
      />
      <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,7fr)] gap-8 max-[1000px]:grid-cols-1">
        <section aria-label="Product and scene" className="flex flex-col gap-4">
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              aria-label="Product photo"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onFile(e.dataTransfer.files[0]);
              }}
              className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-control border border-dashed border-rule-2 bg-surface text-ink-2 hover:border-ink-3"
            >
              {photo ? (
                <img
                  src={photo.url}
                  alt="Your product photo"
                  className="size-full object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-2 p-6 text-center text-control">
                  <Camera aria-hidden className="size-7 text-ink-3" />
                  Choose or drop a photo of the product
                  <span className="text-meta text-ink-3">
                    Plain background, good light, the whole product in frame.
                  </span>
                </span>
              )}
            </button>
            {photo && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                icon={<ImagePlus className="size-4" />}
                onClick={() => fileInput.current?.click()}
              >
                Use another photo
              </Button>
            )}
          </div>
          <Field label="Category" hint="Where and how it's shown depends on what it is.">
            <Select
              value={categoryId}
              options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => {
                setCategoryId(v as CategoryId);
                setVariantId('');
              }}
            />
          </Field>
          <Field label="Product (optional)" hint="Pick it from the catalogue for its exact name.">
            <Select
              value={variantId}
              options={[{ value: '', label: 'Any product in this category' }, ...products]}
              onChange={setVariantId}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room">
              <Select
                value={room}
                options={SHOT_ROOMS.map((r) => ({ value: r.id, label: r.label }))}
                onChange={(v) => setRoom(v as ShotRoom)}
              />
            </Field>
            <Field label="Light">
              <Select
                value={light}
                options={SHOT_LIGHT.map((l) => ({ value: l.id, label: l.label }))}
                onChange={(v) => setLight(v as ShotLight)}
              />
            </Field>
          </div>
          <Field label="Interior style">
            <Select
              value={style}
              options={SHOT_STYLES.map((s) => ({ value: s.id, label: s.label }))}
              onChange={(v) => setStyle(v as ShotStyle)}
            />
          </Field>
          <Field
            label="Anything else (optional)"
            hint="E.g. “white walls”, “beside a marble TV feature wall”."
          >
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {status?.configured ? (
            <Button
              variant="primary"
              icon={<Sparkles className="size-4" />}
              loading={making}
              disabledReason={photo ? undefined : 'Add a photo of the product first.'}
              onClick={() => void generate()}
            >
              {shots.length ? 'Make another' : 'Make picture'}
            </Button>
          ) : (
            status && (
              <div className="flex flex-col gap-2 border-l-[3px] border-brass bg-brass-tint px-3 py-2.5 text-control text-ink">
                <p className="flex items-center gap-2 font-semibold">
                  <KeyRound aria-hidden className="size-4" />
                  Set up picture making
                </p>
                <ol className="list-decimal pl-4 text-meta text-ink-2">
                  <li>
                    Get a free Gemini API key at aistudio.google.com/apikey (pictures cost about
                    S$0.05 each).
                  </li>
                  <li>
                    Add <code>GEMINI_API_KEY=your-key</code> to the <code>.env</code> file in the
                    maxsen-planner folder.
                  </li>
                  <li>Restart the app (Control + C, then pnpm dev).</li>
                </ol>
                <p className="text-meta text-ink-2">
                  Meanwhile: copy the instructions below and give them, with your photo, to the
                  Gemini app.
                </p>
              </div>
            )
          )}
        </section>

        <section aria-label="Picture" className="flex min-w-0 flex-col gap-3">
          <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-control border border-rule bg-desk">
            {shot ? (
              <img src={shot.url} alt="Product sample" className="size-full object-contain" />
            ) : (
              <p className="max-w-xs p-6 text-center text-control text-ink-3">
                {making
                  ? 'Making the picture… this takes about 10–30 seconds.'
                  : 'The picture of your product in a home appears here.'}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-control text-danger">
              {error}
            </p>
          )}
          {shot && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<Download className="size-4" />}
                onClick={() =>
                  save(shot.url, `${name} - ${SHOT_ROOMS.find((r) => r.id === room)!.label}.jpg`)
                }
              >
                Download JPG
              </Button>
              <Button
                icon={<RefreshCw className="size-4" />}
                loading={making}
                onClick={() => void generate()}
              >
                Try again
              </Button>
            </div>
          )}
          {shots.length > 1 && (
            <ul aria-label="Pictures made" className="flex gap-2 overflow-x-auto">
              {shots.map((s, i) => (
                <li key={s.at}>
                  <button
                    type="button"
                    aria-label={`Picture ${shots.length - i}`}
                    aria-pressed={i === current}
                    onClick={() => setCurrent(i)}
                    className={`block h-16 w-20 overflow-hidden rounded-chip border-2 ${i === current ? 'border-brass' : 'border-transparent'}`}
                  >
                    <img src={s.url} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <details className="rounded-control border border-rule bg-surface px-3 py-2">
            <summary className="cursor-pointer text-control font-medium text-ink">
              Instructions for the image model
            </summary>
            <pre className="mt-2 text-meta whitespace-pre-wrap text-ink-2">{prompt}</pre>
            <Button
              size="sm"
              className="mt-2"
              icon={<Copy className="size-4" />}
              onClick={async () => {
                try {
                  await copyText(prompt);
                  toast({
                    title: 'Instructions copied',
                    body: 'Paste them into Gemini with your photo.',
                  });
                } catch {
                  toast({ title: 'Couldn’t copy', tone: 'danger' });
                }
              }}
            >
              Copy instructions
            </Button>
          </details>
        </section>
      </div>
    </Page>
  );
}
