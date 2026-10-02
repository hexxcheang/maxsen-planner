import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { settingsSchema, type Branding } from '@maxsen/domain';
import { Button, Field, IconButton, Input, Textarea, useToast } from '@/components/ui';
import { fileUrl } from '@/lib/files';
import { ImagePicker } from '@/components/ImagePicker';
import { useActions, useSettings } from '@/lib/data/hooks';

export function BrandingSection() {
  const { data: settings } = useSettings();
  const actions = useActions();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Branding>(settings.branding);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = settingsSchema.shape.branding.safeParse(draft);
    if (!result.success) {
      setError('Some details are too long. Shorten them and try again.');
      return;
    }
    setError(null);
    actions.updateSettings((s) => {
      s.branding = result.data;
    });
    toast({ title: 'Branding saved', body: 'New exports use these details.' });
  };

  return (
    <form
      onSubmit={submit}
      className="grid max-w-[880px] grid-cols-[200px_minmax(0,1fr)] gap-x-10 gap-y-8 max-[1180px]:grid-cols-1"
    >
      <div>
        <h3 className="text-control font-semibold text-ink">Logo</h3>
        <p className="mt-1 text-meta text-ink-2">Used on every export cover and page header.</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-48 items-center justify-center border border-rule bg-surface px-4">
          {draft.logoFileId ? (
            <img src={fileUrl(draft.logoFileId)} alt="Current logo" className="max-h-10 w-auto" />
          ) : (
            <span className="text-meta text-ink-3">No logo</span>
          )}
        </span>
        <ImagePicker
          label={draft.logoFileId ? 'Replace logo' : 'Upload logo'}
          onPicked={(id) => set('logoFileId', id)}
        />
      </div>

      <div>
        <h3 className="text-control font-semibold text-ink">Proposal background</h3>
        <p className="mt-1 text-meta text-ink-2">
          Artwork behind the export covers and the contact page (SVG, PNG or JPG). It sits under a
          dark veil so the text on it stays easy to read.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="relative flex h-24 w-40 items-center justify-center overflow-hidden border border-rule bg-[#1B1A18]">
          {draft.proposalBackgroundFileId ? (
            <>
              <img
                src={fileUrl(draft.proposalBackgroundFileId)}
                alt="Current proposal background"
                className="absolute inset-0 size-full object-cover"
              />
              <span className="absolute inset-0 bg-[#1B1A18]/65" />
              <span className="relative text-meta font-semibold tracking-wide text-white">
                Proposal
              </span>
            </>
          ) : (
            <span className="text-meta text-white/60">Plain charcoal</span>
          )}
        </span>
        <div className="flex flex-col items-start gap-2">
          <ImagePicker
            label={draft.proposalBackgroundFileId ? 'Replace background' : 'Upload background'}
            onPicked={(id) => set('proposalBackgroundFileId', id)}
          />
          {draft.proposalBackgroundFileId && (
            <Button size="sm" variant="ghost" onClick={() => set('proposalBackgroundFileId', null)}>
              Remove background
            </Button>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-control font-semibold text-ink">Contact details</h3>
        <p className="mt-1 text-meta text-ink-2">
          Printed on the product description’s contact page.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        <Field label="WhatsApp number">
          <Input
            type="tel"
            value={draft.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
          />
        </Field>
        <Field label="Website">
          <Input value={draft.website} onChange={(e) => set('website', e.target.value)} />
        </Field>
        <Field label="Contact page wording" className="col-span-2 max-[700px]:col-span-1">
          <Textarea
            rows={3}
            value={draft.contactWording}
            onChange={(e) => set('contactWording', e.target.value)}
          />
        </Field>
      </div>

      <div>
        <h3 className="text-control font-semibold text-ink">Showrooms</h3>
        <p className="mt-1 text-meta text-ink-2">Listed in order on the contact page.</p>
      </div>
      <div className="flex flex-col gap-3">
        {draft.showrooms.map((room, i) => (
          <div
            key={i}
            className="grid grid-cols-[180px_minmax(0,1fr)_auto] items-end gap-3 max-[700px]:grid-cols-1"
          >
            <Field label="Showroom name">
              <Input
                value={room.name}
                onChange={(e) =>
                  set(
                    'showrooms',
                    draft.showrooms.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
            </Field>
            <Field label="Address">
              <Input
                value={room.address}
                onChange={(e) =>
                  set(
                    'showrooms',
                    draft.showrooms.map((r, j) =>
                      j === i ? { ...r, address: e.target.value } : r,
                    ),
                  )
                }
              />
            </Field>
            <IconButton
              label={`Remove ${room.name || 'showroom'}`}
              icon={<Trash2 />}
              onClick={() =>
                set(
                  'showrooms',
                  draft.showrooms.filter((_, j) => j !== i),
                )
              }
            />
          </div>
        ))}
        <Button
          className="w-fit"
          icon={<Plus className="size-4" />}
          onClick={() => set('showrooms', [...draft.showrooms, { name: '', address: '' }])}
        >
          Add showroom
        </Button>
      </div>

      <div className="col-start-2 flex items-center gap-3 max-[1180px]:col-start-1">
        <Button type="submit" variant="primary">
          Save branding
        </Button>
        {error && <p className="text-meta text-danger">{error}</p>}
      </div>
    </form>
  );
}
