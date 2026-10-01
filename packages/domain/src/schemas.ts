/**
 * Runtime validation for everything that crosses a trust boundary: plan documents loaded from the
 * database or the network, settings edited by admins, export settings and project details forms.
 * Each schema is checked against its TypeScript type with `satisfies` so the two cannot drift.
 */
import { z } from 'zod';
import { CATEGORIES, type CategoryId } from './categories.ts';
import type {
  CategoryStyleOverride,
  ExportSettings,
  PlanDocument,
  PlanElement,
  ProjectDetails,
  Settings,
} from './types.ts';

const categoryIds = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export const categoryIdSchema = z.enum(categoryIds);
export const planTypeSchema = z.enum(['smart-home', 'lighting']);
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #A8873A');

const coord = z.number().finite();
const ptSchema = z.object({ x: coord, y: coord });
const pathPoints = z.array(ptSchema).min(2);
const elementBase = { id: z.string().min(1), z: z.number().int() };

export const pointMarkerSchema = z.object({
  kind: z.literal('marker'),
  ...elementBase,
  variantId: z.string().min(1),
  x: coord,
  y: coord,
  rotation: coord,
  label: z.string().max(200),
});

export const ledStripPathSchema = z.object({
  kind: z.literal('led-strip'),
  ...elementBase,
  variantId: z.string().min(1),
  points: pathPoints,
  closed: z.boolean(),
  smooth: z.boolean(),
  metres: z.number().finite().nonnegative().nullable(),
  showLabel: z.boolean(),
});

export const trackPathSchema = z.object({
  kind: z.literal('track'),
  ...elementBase,
  variantId: z.string().min(1),
  points: pathPoints,
  headCount: z.number().int().min(1),
  showLabel: z.boolean(),
});

export const textNoteSchema = z.object({
  kind: z.literal('note'),
  ...elementBase,
  x: coord,
  y: coord,
  text: z.string().max(2000),
  fontSize: z.number().finite().positive(),
  bold: z.boolean(),
  color: hexColorSchema,
  highlight: hexColorSchema.nullable(),
});

export const planElementSchema = z.discriminatedUnion('kind', [
  pointMarkerSchema,
  ledStripPathSchema,
  trackPathSchema,
  textNoteSchema,
]) satisfies z.ZodType<PlanElement>;

export const planDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  elements: z.array(planElementSchema),
  view: z.object({
    hiddenCategories: z.array(categoryIdSchema),
    legendVisible: z.boolean(),
  }),
}) satisfies z.ZodType<PlanDocument>;

const customerToggles = {
  showCustomerName: z.boolean(),
  showCustomerContact: z.boolean(),
  showPropertyAddress: z.boolean(),
};

export const exportSettingsSchema = z.object({
  floorPlan: z.object({
    ...customerToggles,
    levels: z.record(z.string(), z.object({ smartHome: z.boolean(), lighting: z.boolean() })),
    hiddenCategories: z.array(categoryIdSchema),
    showLabels: z.boolean(),
    showLedLengths: z.boolean(),
    showTrackLabels: z.boolean(),
    showNotes: z.boolean(),
    showLegend: z.boolean(),
  }),
  productDescription: z.object({
    ...customerToggles,
    excludedCategories: z.array(categoryIdSchema),
  }),
}) satisfies z.ZodType<ExportSettings>;

/** Icon sizes are plan units; the admin presets run 12–34, the field allows a little either side. */
export const ICON_SIZE_MIN = 6;
export const ICON_SIZE_MAX = 80;

export const categoryStyleOverrideSchema = z.object({
  color: hexColorSchema.optional(),
  badge: z.string().trim().min(1).max(3).optional(),
  badgeStyle: z.enum(['filled', 'outline']).optional(),
  size: z.number().finite().min(ICON_SIZE_MIN).max(ICON_SIZE_MAX).optional(),
}) satisfies z.ZodType<CategoryStyleOverride>;

export const settingsSchema = z.object({
  branding: z.object({
    logoFileId: z.string().nullable(),
    whatsapp: z.string().max(40),
    website: z.string().max(200),
    showrooms: z.array(z.object({ name: z.string().max(80), address: z.string().max(200) })),
    contactWording: z.string().max(1000),
  }),
  categoryStyles: z.partialRecord(categoryIdSchema, categoryStyleOverrideSchema),
  favouriteVariantIds: z.array(z.string()),
}) satisfies z.ZodType<Settings>;

const optionalText = z.string().trim().max(200);

export const projectDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a project title')
    .max(120, 'Keep the title under 120 characters'),
  customerName: optionalText,
  customerContact: optionalText,
  propertyAddress: optionalText,
  propertyType: z.enum(['HDB', 'Condo', 'Landed', 'Commercial', 'Other']).nullable(),
  status: z.enum(['draft', 'in-progress', 'completed']),
}) satisfies z.ZodType<ProjectDetails>;
