import { useEffect, useState } from 'react';
import type { CropRect, Level, PlanType, Rotation, SourceFile, SourcePage } from '@maxsen/domain';
import { Button, Dialog, SegmentedControl, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/lib/files';
import { previewForCrop, rotateImage } from '@/lib/images';
import { useActions } from '@/lib/data/hooks';
import { putFile } from '@/lib/storage/file-store';
import { CropBox } from './CropBox';
import { PLAN_LABELS } from './labels';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  level: Level;
  type: PlanType;
  files: SourceFile[];
  pages: SourcePage[];
}

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** Pick an uploaded page, turn it upright, and lock it in as the plan's background drawing. */
export function ChooseDrawingDialog({
  open,
  onOpenChange,
  projectId,
  level,
  type,
  files,
  pages,
}: Props) {
  const actions = useActions();
  const { toast } = useToast();
  const [pageId, setPageId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [busy, setBusy] = useState(false);
  const page = pages.find((p) => p.id === pageId);
  const [preview, setPreview] = useState<{
    key: string;
    url: string;
    aspect: number;
    suggested: CropRect;
  } | null>(null);
  const [crop, setCrop] = useState<CropRect>(FULL);
  const previewKey = page ? `${page.id}:${rotation}` : '';
  const ready = preview?.key === previewKey;

  // Turn the page and suggest a crop to just the floor plan whenever the page or rotation changes.
  useEffect(() => {
    if (!page) return;
    let live = true;
    void previewForCrop(fileUrl(page.fileId), rotation).then((p) => {
      if (!live) return;
      setPreview({ key: `${page.id}:${rotation}`, ...p });
      setCrop(p.suggested);
    });
    return () => {
      live = false;
    };
  }, [page, rotation]);

  const confirm = async () => {
    if (!page) return;
    setBusy(true);
    try {
      const rotated = await rotateImage(fileUrl(page.fileId), rotation, crop);
      const fileId = await putFile(rotated.blob);
      actions.assignPlan(projectId, level.id, type, {
        sourcePageId: page.id,
        rotation,
        crop,
        fileId,
        width: rotated.width,
        height: rotated.height,
      });
      toast({ title: `${PLAN_LABELS[type]} ready`, body: `${level.name} can now be planned.` });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'That drawing couldn’t be prepared', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={`Choose a drawing for the ${PLAN_LABELS[type]}`}
      description={`${level.name}. Once chosen, the drawing is locked for this plan.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!page || !ready}
            loading={busy}
            onClick={() => void confirm()}
          >
            Use this drawing
          </Button>
        </>
      }
    >
      {pages.length === 0 ? (
        <p className="text-body text-ink-2">
          Upload the customer’s drawings first, using Upload in the Drawings column.
        </p>
      ) : (
        <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-5 max-[700px]:grid-cols-1">
          <div
            role="radiogroup"
            aria-label="Pages"
            className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1"
          >
            {pages.map((p) => {
              const file = files.find((f) => f.id === p.sourceFileId);
              const selected = p.id === pageId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${file?.name ?? 'Upload'}, page ${p.pageIndex + 1}`}
                  onClick={() => setPageId(p.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-chip border p-1.5 text-left',
                    selected ? 'border-brass bg-brass-tint' : 'border-rule hover:border-rule-2',
                  )}
                >
                  <img
                    src={fileUrl(p.thumbnailFileId)}
                    alt=""
                    className="aspect-[7/5] w-full bg-surface object-contain"
                  />
                  <span className="truncate text-caption text-ink-2">
                    {file?.name}, page {p.pageIndex + 1}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex aspect-[7/5] items-center justify-center overflow-hidden bg-desk p-4">
              {!page ? (
                <span className="text-control text-ink-2">Select a page on the left.</span>
              ) : ready ? (
                <CropBox
                  imageUrl={preview.url}
                  aspect={preview.aspect}
                  crop={crop}
                  onChange={setCrop}
                />
              ) : (
                <span role="status" className="text-control text-ink-2">
                  Finding the floor plan…
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-control text-ink-2">Rotate</span>
              <SegmentedControl<string>
                label="Rotation"
                size="sm"
                value={String(rotation)}
                onChange={(v) => setRotation(Number(v) as Rotation)}
                options={[0, 90, 180, 270].map((r) => ({ value: String(r), label: `${r}°` }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-control text-ink-2">Crop</span>
              <Button
                size="sm"
                disabled={!ready}
                onClick={() => preview && setCrop(preview.suggested)}
              >
                Fit to floor plan
              </Button>
              <Button size="sm" disabled={!ready} onClick={() => setCrop(FULL)}>
                Whole page
              </Button>
              <span className="text-meta text-ink-2">
                Drag the box or its handles to trim borders, title blocks and notes.
              </span>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
