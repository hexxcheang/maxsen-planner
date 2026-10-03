import { FileText, Upload } from 'lucide-react';
import type { Level, Plan, SourceFile, SourcePage } from '@maxsen/domain';
import { useRef } from 'react';
import { Badge, Button, SectionTitle } from '@/components/ui';
import { useUpload } from './useUpload';
import { fileUrl } from '@/lib/files';
import { PLAN_LABELS } from './labels';

interface SourcePanelProps {
  projectId: string;
  files: SourceFile[];
  pages: SourcePage[];
  plans: Plan[];
  levels: Level[];
}

export function SourcePanel({ projectId, files, pages, plans, levels }: SourcePanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, progress } = useUpload(projectId);
  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  return (
    <section aria-label="Drawings" className="flex min-h-0 flex-col">
      <SectionTitle
        className="mb-3"
        actions={
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              multiple
              hidden
              aria-label="Upload drawings"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              icon={<Upload className="size-3.5" />}
              loading={progress !== null}
              onClick={() => input.current?.click()}
            >
              Upload
            </Button>
          </>
        }
      >
        Drawings
      </SectionTitle>
      <p className="mb-4 text-meta text-ink-2">
        PDFs and JPG or PNG images. Every page becomes a thumbnail.
      </p>
      {progress && (
        <p role="status" className="mb-3 text-meta text-brass-2">
          {progress}
        </p>
      )}
      {files.length === 0 ? (
        <p className="border-t border-rule pt-4 text-control text-ink-2">
          No drawings uploaded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-5 border-t border-rule pt-4">
          {files.map((f) => {
            const filePages = pages
              .filter((p) => p.sourceFileId === f.id)
              .sort((a, b) => a.pageIndex - b.pageIndex);
            return (
              <li key={f.id}>
                <p className="flex items-center gap-1.5 text-control font-medium text-ink">
                  <FileText aria-hidden className="size-4 shrink-0 text-ink-2" />
                  <span className="truncate">{f.name}</span>
                </p>
                <p className="mb-2 pl-5.5 text-meta text-ink-3">
                  {f.pageCount} {f.pageCount === 1 ? 'page' : 'pages'}
                </p>
                <ul className="grid grid-cols-2 gap-2 max-[1180px]:grid-cols-1">
                  {filePages.map((p) => {
                    const uses = plans.filter((pl) => pl.background.sourcePageId === p.id);
                    return (
                      <li key={p.id} className="flex flex-col gap-1">
                        <span className="flex aspect-[7/5] items-center justify-center overflow-hidden rounded-chip border border-rule bg-surface">
                          <img
                            src={fileUrl(p.thumbnailFileId)}
                            alt={`Page ${p.pageIndex + 1}`}
                            className="size-full object-contain p-1"
                          />
                        </span>
                        <span className="text-caption text-ink-2">Page {p.pageIndex + 1}</span>
                        {uses.map((u) => (
                          <Badge key={u.id} tone="brass" className="w-fit max-w-full truncate">
                            {levelName.get(u.levelId)}, {PLAN_LABELS[u.type].replace(' Plan', '')}
                          </Badge>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
