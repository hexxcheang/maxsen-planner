import { useState } from 'react';
import { Link } from 'react-router';
import { Copy, Crop, ImagePlus, PencilRuler, Trash2 } from 'lucide-react';
import type { Level, Plan, PlanType, SourceFile, SourcePage } from '@maxsen/domain';
import { Button, buttonClass, ConfirmDialog } from '@/components/ui';
import { ChooseDrawingDialog } from './ChooseDrawingDialog';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/lib/files';
import { useActions } from '@/lib/data/hooks';
import { PLAN_LABELS } from './labels';

interface PlanAssignmentCardProps {
  projectId: string;
  level: Level;
  type: PlanType;
  plan: Plan | undefined;
  page: SourcePage | undefined;
  file: SourceFile | undefined;
  adjusting: boolean;
  onAdjust: () => void;
  files: SourceFile[];
  pages: SourcePage[];
  /** The level's other plan, whose drawing (turned and cropped the same) can be reused. */
  otherPlan?: Plan;
}

const isFullCrop = (c: Plan['background']['crop']) =>
  c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;

export function PlanAssignmentCard({
  projectId,
  level,
  type,
  plan,
  page,
  file,
  adjusting,
  onAdjust,
  files,
  pages,
  otherPlan,
}: PlanAssignmentCardProps) {
  const actions = useActions();
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const title = PLAN_LABELS[type];
  const titleId = `plan-card-${type}`;

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex flex-col border border-rule bg-surface', adjusting && 'border-brass/60')}
    >
      <header className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <h3 id={titleId} className="text-control font-semibold text-ink">
          {title}
        </h3>
        {plan && (
          <span className="tnum text-meta text-ink-2">
            {plan.document.elements.length} {plan.document.elements.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </header>
      {plan ? (
        <>
          <div className="bg-desk p-3">
            <img
              src={fileUrl(plan.background.fileId)}
              alt={`${level.name} ${title} drawing`}
              className="mx-auto aspect-[7/5] w-full border border-rule-2 bg-surface object-contain"
            />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-4 pt-3 text-meta">
            <dt className="text-ink-3">Drawing</dt>
            <dd className="truncate text-ink-2">
              {file ? `${file.name}, page ${(page?.pageIndex ?? 0) + 1}` : 'Unknown page'}
            </dd>
            <dt className="text-ink-3">Rotation</dt>
            <dd className="tnum text-ink-2">{plan.background.rotation}°</dd>
            <dt className="text-ink-3">Crop</dt>
            <dd className="text-ink-2">
              {isFullCrop(plan.background.crop) ? 'Full page' : 'Cropped'}
            </dd>
          </dl>
          <p className="px-4 pt-2 text-meta text-ink-3">
            The drawing is locked. To replace it, delete the plan and add it again.
          </p>
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-4">
            <Link
              to={`/projects/${projectId}/plan?level=${level.id}&type=${type}`}
              className={buttonClass('primary', 'sm')}
            >
              <PencilRuler aria-hidden className="size-3.5" />
              Open in planner
            </Link>
            <Button
              size="sm"
              icon={<Crop className="size-3.5" />}
              onClick={onAdjust}
              aria-pressed={adjusting}
            >
              View crop and rotation
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="size-3.5" />}
              className="ml-auto"
              onClick={() => setConfirming(true)}
            >
              Delete plan
            </Button>
          </div>
          <ConfirmDialog
            open={confirming}
            title={`Delete the ${title} for ${level.name}?`}
            body="Its drawing and everything placed on it are removed, and totals update. You can add the plan again later with a new drawing."
            confirmLabel="Delete plan"
            destructive
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              actions.deletePlan(plan.id);
            }}
          />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-start gap-3 px-4 py-6">
          <span className="flex aspect-[7/5] w-full items-center justify-center border border-dashed border-rule-2 bg-paper text-ink-3">
            <ImagePlus aria-hidden className="size-6" />
          </span>
          <div>
            <p className="text-control font-medium text-ink">Not set up yet</p>
            <p className="text-meta text-ink-2">
              Choose one of the uploaded pages as this plan’s drawing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {otherPlan && (
              <Button
                size="sm"
                variant="primary"
                icon={<Copy className="size-3.5" />}
                onClick={() => {
                  const { sourcePageId, rotation, crop, fileId, width, height } =
                    otherPlan.background;
                  actions.assignPlan(projectId, level.id, type, {
                    sourcePageId,
                    rotation,
                    crop,
                    fileId,
                    width,
                    height,
                  });
                }}
              >
                Use the {PLAN_LABELS[otherPlan.type]}’s drawing
              </Button>
            )}
            <Button
              size="sm"
              variant={otherPlan ? 'secondary' : 'primary'}
              onClick={() => setChoosing(true)}
            >
              Choose a drawing
            </Button>
          </div>
          {otherPlan && (
            <p className="text-meta text-ink-2">
              Same page, turned and cropped the same, so both plans line up exactly.
            </p>
          )}
          <ChooseDrawingDialog
            open={choosing}
            onOpenChange={setChoosing}
            projectId={projectId}
            level={level}
            type={type}
            files={files}
            pages={pages}
          />
        </div>
      )}
    </section>
  );
}
