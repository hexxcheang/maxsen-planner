import { defaultExportSettings } from '../plan-document.ts';
import type { Template } from '../types.ts';
import { buildSnapshot, SAMPLE_PLANS } from './projects.ts';

const tanSmartHome = SAMPLE_PLANS.find((p) => p.id === 'plan_tan_1_sh');
const tanLighting = SAMPLE_PLANS.find((p) => p.id === 'plan_tan_1_lt');
if (!tanSmartHome || !tanLighting) throw new Error('Sample template source plans missing');

/** One approved template: the standard 4-room HDB layout, saved from the Tan project. */
export const SAMPLE_TEMPLATES: Template[] = [
  {
    id: 'tpl_hdb_4room',
    name: 'HDB 4-room standard',
    description:
      'Typical 4-room layout: Nova+ Pro switches throughout, S8 panel at the entrance, cove lighting in living and master.',
    sourceProjectId: 'proj_sample_tan',
    structure: {
      levels: [
        {
          name: 'Level 1',
          sortOrder: 1,
          paperSize: 'A3',
          orientation: 'landscape',
          plans: [
            { type: 'smart-home', document: tanSmartHome.document },
            { type: 'lighting', document: tanLighting.document },
          ],
        },
      ],
      exportSettings: defaultExportSettings(['1']),
      catalogueSnapshot: buildSnapshot(
        [tanSmartHome.document, tanLighting.document],
        '2026-09-20T02:00:00.000Z',
      ),
    },
    createdAt: '2026-09-20T02:00:00.000Z',
    updatedAt: '2026-09-20T02:00:00.000Z',
  },
];
