import type { ReactNode } from 'react';
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Map as MapIcon,
} from 'lucide-react';
import { exportFilename, type ExportKind } from '@maxsen/domain';
import { Button, buttonClass, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useExports, type ExportState } from './useExports';
import { Page } from '@/components/Page';
import { useLevels, usePlans, useSettings } from '@/lib/data/hooks';
import { useCurrentProject } from '@/features/project/useProjectContext';
import { FloorPlanOptions } from './FloorPlanOptions';
import { ProductPdfOptions } from './ProductPdfOptions';

function ExportPanel({
  title,
  icon,
  filename,
  summary,
  children,
  state,
  onGenerate,
}: {
  title: string;
  icon: ReactNode;
  filename: string;
  summary: string;
  children?: ReactNode;
  state: ExportState;
  onGenerate: () => void;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col border-t-2 border-ink pt-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-ink-2 [&_svg]:size-5">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-section text-ink">{title}</h2>
          <p className="text-meta text-ink-2">{summary}</p>
        </div>
      </div>
      <p
        className="mt-3 truncate rounded-chip border border-rule bg-surface px-2 py-1.5 text-meta text-ink"
        title={filename}
      >
        {filename}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Button
          variant="secondary"
          className="w-full"
          loading={state.status === 'working'}
          onClick={onGenerate}
        >
          {state.status === 'ready' ? 'Generate again' : 'Generate'}
        </Button>
        {state.status === 'ready' && (
          <div
            role="status"
            className="flex items-center gap-2 border-l-[3px] border-ok bg-surface px-3 py-2"
          >
            <CircleCheck aria-hidden className="size-4 shrink-0 text-ok" />
            <span className="min-w-0 flex-1 text-meta text-ink-2">
              Ready, {formatDateTime(state.generatedAt)}
            </span>
            <a href={state.url} download={state.filename} className={buttonClass('primary', 'sm')}>
              <Download aria-hidden className="size-3.5" />
              Download
            </a>
          </div>
        )}
        {state.status === 'error' && (
          <p role="alert" className="flex items-center gap-2 text-meta text-danger">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {state.message}
          </p>
        )}
      </div>
      {children && <div className="mt-6 border-t border-rule pt-5">{children}</div>}
    </section>
  );
}

export function ExportsScreen() {
  const project = useCurrentProject();
  const { data: levels } = useLevels(project.id);
  const { data: plans } = usePlans(project.id);
  const { data: settings } = useSettings();
  const exp = useExports(project);
  const panel = (kind: ExportKind) => ({
    filename: exportFilename(project.title, kind),
    state: exp.state[kind],
    onGenerate: () => void exp.generate(kind),
  });

  return (
    <Page wide>
      <PageHeader
        title="Exports"
        description="Each export is generated fresh from the current plans and review totals. Options are saved with the project."
        actions={
          <Button variant="primary" loading={exp.busy} onClick={() => void exp.generateAll()}>
            Generate all exports
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-8 max-[1180px]:grid-cols-2">
        <ExportPanel
          title="Marked floor plan"
          icon={<MapIcon />}
          summary="Cover page, then each selected plan with its legend, at the level’s paper size."
          {...panel('floor-plan')}
        >
          <FloorPlanOptions project={project} levels={levels} plans={plans} settings={settings} />
        </ExportPanel>
        <ExportPanel
          title="Product description"
          icon={<FileText />}
          summary="Customer-facing products with images, descriptions and quantities, then your contact page."
          {...panel('product-description')}
        >
          <ProductPdfOptions project={project} settings={settings} />
        </ExportPanel>
        <ExportPanel
          title="Quantity list"
          icon={<FileSpreadsheet />}
          summary="One sheet: category, product, variant and export quantity, with the customer’s contact number. Drivers included."
          {...panel('quantity')}
        >
          <p className="text-meta text-ink-2">
            No options. Quantities come from Review totals, including any adjustments.
          </p>
        </ExportPanel>
      </div>
    </Page>
  );
}
