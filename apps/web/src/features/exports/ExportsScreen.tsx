import type { ReactNode } from 'react';
import { FileSpreadsheet, FileText, Map as MapIcon } from 'lucide-react';
import { exportFilename } from '@maxsen/domain';
import { Button, LATER_PHASE, PageHeader } from '@/components/ui';
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
}: {
  title: string;
  icon: ReactNode;
  filename: string;
  summary: string;
  children?: ReactNode;
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
      <div className="mt-3">
        <Button variant="secondary" disabledReason={LATER_PHASE} className="w-full">
          Generate
        </Button>
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

  return (
    <Page wide>
      <PageHeader
        title="Exports"
        description="Each export is generated fresh from the current plans and review totals. Options are saved with the project."
        actions={
          <Button variant="primary" disabledReason={LATER_PHASE}>
            Generate all exports
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-8 max-[1180px]:grid-cols-2">
        <ExportPanel
          title="Marked floor plan"
          icon={<MapIcon />}
          summary="Cover page, then each selected plan with its legend, at the level’s paper size."
          filename={exportFilename(project.title, 'floor-plan')}
        >
          <FloorPlanOptions project={project} levels={levels} plans={plans} settings={settings} />
        </ExportPanel>
        <ExportPanel
          title="Product description"
          icon={<FileText />}
          summary="Customer-facing products with images, descriptions and quantities, then your contact page."
          filename={exportFilename(project.title, 'product-description')}
        >
          <ProductPdfOptions project={project} settings={settings} />
        </ExportPanel>
        <ExportPanel
          title="Quantity list"
          icon={<FileSpreadsheet />}
          summary="One sheet: category, product, variant and export quantity, with the customer’s contact number. Drivers included."
          filename={exportFilename(project.title, 'quantity')}
        >
          <p className="text-meta text-ink-2">
            No options. Quantities come from Review totals, including any adjustments.
          </p>
        </ExportPanel>
      </div>
    </Page>
  );
}
