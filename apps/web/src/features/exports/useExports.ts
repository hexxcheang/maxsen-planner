import { useEffect, useRef, useState } from 'react';
import { applyAdjustments, exportFilename, type ExportKind } from '@maxsen/domain';
import { useToast } from '@/components/ui';
import {
  useActions,
  useCatalogue,
  useLevels,
  usePlans,
  useProjectTotals,
  useResolver,
  useSettings,
} from '@/lib/data/hooks';
import type { Project } from '@maxsen/domain';
import {
  buildFloorPlanPdf,
  buildProductPdf,
  buildQuantityXlsx,
  type ExportContext,
} from './build/generate';
import { buildProjectInvoice, buildProjectInvoicePdf, projectPayment } from './build/invoice';

export type ExportState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'ready'; url: string; filename: string; generatedAt: string }
  | { status: 'error'; message: string };

const BUILDERS: Record<ExportKind, (ctx: ExportContext) => Promise<Blob>> = {
  'floor-plan': buildFloorPlanPdf,
  'product-description': buildProductPdf,
  quantity: buildQuantityXlsx,
  invoice: buildProjectInvoice,
  'invoice-pdf': buildProjectInvoicePdf,
};

export const EXPORT_KINDS: ExportKind[] = [
  'floor-plan',
  'product-description',
  'quantity',
  'invoice',
  'invoice-pdf',
];

/** Generates exports fresh from the current plans and review totals; files are not stored. */
export function useExports(project: Project) {
  const { data: levels } = useLevels(project.id);
  const { data: plans } = usePlans(project.id);
  const { data: settings } = useSettings();
  const { data: totals } = useProjectTotals(project.id);
  const { data: resolve } = useResolver(project.id);
  const { data: catalogue } = useCatalogue();
  const { toast } = useToast();
  const actions = useActions();
  const [state, setState] = useState<Record<ExportKind, ExportState>>({
    'floor-plan': { status: 'idle' },
    'product-description': { status: 'idle' },
    quantity: { status: 'idle' },
    invoice: { status: 'idle' },
    'invoice-pdf': { status: 'idle' },
  });
  // A file made for another payment stage isn't offered under this stage's name.
  const stage = project.exportSettings.billing?.stage ?? 'deposit';
  useEffect(
    () =>
      setState((s) => ({ ...s, invoice: { status: 'idle' }, 'invoice-pdf': { status: 'idle' } })),
    [stage],
  );
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const generate = async (kind: ExportKind) => {
    setState((s) => ({ ...s, [kind]: { status: 'working' } }));
    try {
      const ctx: ExportContext = {
        project,
        levels,
        plans,
        settings,
        lines: applyAdjustments(totals, project.quantityAdjustments),
        resolve,
        variants: catalogue.variants,
      };
      const blob = await BUILDERS[kind](ctx);
      if (kind === 'invoice') {
        // Remember what this invoice asked for, so the next payment's invoice can suggest it as paid.
        const { amounts, invoice, number } = projectPayment(ctx);
        actions.updateExportSettings(project.id, (s) => {
          s.billing ??= { stage: amounts.stage };
          s.billing.issued = {
            ...s.billing.issued,
            [amounts.stage]: {
              number,
              total: invoice.total,
              due: amounts.due,
              date: new Date().toISOString(),
            },
          };
        });
      }
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setState((s) => ({
        ...s,
        [kind]: {
          status: 'ready',
          url,
          filename: exportFilename(project.title, kind, project.exportSettings.billing?.stage),
          generatedAt: new Date().toISOString(),
        },
      }));
      return true;
    } catch (e) {
      console.error(e);
      setState((s) => ({
        ...s,
        [kind]: {
          status: 'error',
          message: 'Something went wrong while building this file. Try again.',
        },
      }));
      return false;
    }
  };

  const generateAll = async () => {
    let ok = 0;
    for (const kind of EXPORT_KINDS) if (await generate(kind)) ok++;
    toast({
      title:
        ok === EXPORT_KINDS.length
          ? 'All exports are ready'
          : `${ok} of ${EXPORT_KINDS.length} exports are ready`,
      body: 'Download each file below.',
      tone: ok === EXPORT_KINDS.length ? 'ok' : 'danger',
    });
  };

  return {
    state,
    generate,
    generateAll,
    busy: Object.values(state).some((s) => s.status === 'working'),
  };
}
