import { useEffect, useRef, useState } from 'react';
import { applyAdjustments, exportFilename, type ExportKind } from '@maxsen/domain';
import { useToast } from '@/components/ui';
import { useLevels, usePlans, useProjectTotals, useResolver, useSettings } from '@/lib/data/hooks';
import type { Project } from '@maxsen/domain';
import {
  buildFloorPlanPdf,
  buildProductPdf,
  buildQuantityXlsx,
  type ExportContext,
} from './build/generate';

export type ExportState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'ready'; url: string; filename: string; generatedAt: string }
  | { status: 'error'; message: string };

const BUILDERS: Record<ExportKind, (ctx: ExportContext) => Promise<Blob>> = {
  'floor-plan': buildFloorPlanPdf,
  'product-description': buildProductPdf,
  quantity: buildQuantityXlsx,
};

export const EXPORT_KINDS: ExportKind[] = ['floor-plan', 'product-description', 'quantity'];

/** Generates exports fresh from the current plans and review totals; files are not stored. */
export function useExports(project: Project) {
  const { data: levels } = useLevels(project.id);
  const { data: plans } = usePlans(project.id);
  const { data: settings } = useSettings();
  const { data: totals } = useProjectTotals(project.id);
  const { data: resolve } = useResolver(project.id);
  const { toast } = useToast();
  const [state, setState] = useState<Record<ExportKind, ExportState>>({
    'floor-plan': { status: 'idle' },
    'product-description': { status: 'idle' },
    quantity: { status: 'idle' },
  });
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
      };
      const blob = await BUILDERS[kind](ctx);
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setState((s) => ({
        ...s,
        [kind]: {
          status: 'ready',
          url,
          filename: exportFilename(project.title, kind),
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
