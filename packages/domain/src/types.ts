/**
 * Entity and document types for the Maxsen Smart Home Planner (technical design §5).
 *
 * Coordinates: every plan has an isotropic "plan units" space in which the background's width is
 * exactly 1000 units and its height is 1000 × H / W. Positions, path points, icon sizes, stroke
 * widths and note font sizes are all expressed in plan units.
 */
import type { BadgeStyle, CategoryId, PlanType } from './categories.ts';
import type { RoomLayout } from './magic/room-layout.ts';
import type { PricingSettings } from './pricing/pricing.ts';

export type { BadgeStyle, CategoryId, PlanType };

export interface Pt {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------------------------
// Plan documents (stored as JSON on each plan)
// ---------------------------------------------------------------------------------------------

export interface PointMarker {
  kind: 'marker';
  id: string;
  /** Layer order; elements render in ascending z. */
  z: number;
  variantId: string;
  x: number;
  y: number;
  /** Degrees, clockwise, around the marker centre. */
  rotation: number;
  /** Optional short label; empty string when none. */
  label: string;
}

export interface LedStripPath {
  kind: 'led-strip';
  id: string;
  z: number;
  variantId: string;
  points: Pt[];
  /** Join the last point back to the first (loop). */
  closed: boolean;
  /** Draw a smooth curve through the points instead of straight segments. */
  smooth: boolean;
  /** Manually entered total length; null until the planner enters it. Never derived from scale. */
  metres: number | null;
  showLabel: boolean;
}

export interface TrackPath {
  kind: 'track';
  id: string;
  z: number;
  variantId: string;
  points: Pt[];
  /** Number of light heads / modules drawn along the track; ≥ 1. */
  headCount: number;
  showLabel: boolean;
}

/** A curtain or blind track, drawn as a dotted line along the window it covers. */
export interface CurtainPath {
  kind: 'curtain';
  id: string;
  z: number;
  variantId: string;
  points: Pt[];
}

export interface TextNote {
  kind: 'note';
  id: string;
  z: number;
  x: number;
  y: number;
  text: string;
  /** Plan units. */
  fontSize: number;
  bold: boolean;
  /** Hex colour. */
  color: string;
  /** Hex background highlight colour, or null for none. */
  highlight: string | null;
}

export type PlanElement = PointMarker | LedStripPath | TrackPath | CurtainPath | TextNote;
export type PlanElementKind = PlanElement['kind'];

/** Editor view state: saved with the plan but not part of undo history. */
export interface PlanViewState {
  hiddenCategories: CategoryId[];
  legendVisible: boolean;
}

export interface PlanDocument {
  schemaVersion: 1;
  elements: PlanElement[];
  view: PlanViewState;
}

// ---------------------------------------------------------------------------------------------
// Projects, levels, plans, uploads
// ---------------------------------------------------------------------------------------------

export type PaperSize = 'A4' | 'A3';
export type Orientation = 'portrait' | 'landscape';
export type PropertyType = 'HDB' | 'Condo' | 'Landed' | 'Commercial' | 'Other';
/** Where a project is, from first sketch to handover; in the order they usually happen. */
export const PROJECT_STATUSES = [
  'draft',
  'in-progress',
  'quoted',
  'deposit-paid',
  'installing',
  'completed',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** The product/variant facts a project keeps from the moment it first used a variant. */
export interface VariantSnapshot {
  variantId: string;
  productId: string;
  categoryId: CategoryId;
  productName: string;
  variantName: string;
  description: string;
  imageFileId: string | null;
  /** ISO timestamp. */
  capturedAt: string;
}

export interface QuantityAdjustment {
  /** The export quantity the planner chose. */
  quantity: number;
  /** The calculated quantity at the moment of adjustment; a later difference raises a warning. */
  calculatedAtAdjustment: number;
  /** ISO timestamp. */
  adjustedAt: string;
}

export interface FloorPlanExportSettings {
  showCustomerName: boolean;
  showCustomerContact: boolean;
  showPropertyAddress: boolean;
  /** Which plan pages to include, per level. Levels missing from the map are included by default. */
  levels: Record<string, { smartHome: boolean; lighting: boolean }>;
  hiddenCategories: CategoryId[];
  showLabels: boolean;
  showLedLengths: boolean;
  showTrackLabels: boolean;
  showNotes: boolean;
  showLegend: boolean;
}

export interface ProductPdfExportSettings {
  showCustomerName: boolean;
  showCustomerContact: boolean;
  showPropertyAddress: boolean;
  excludedCategories: CategoryId[];
}

export interface ExportSettings {
  floorPlan: FloorPlanExportSettings;
  productDescription: ProductPdfExportSettings;
  /** Invoice number for this project's (deposit) invoice; generated when absent. */
  invoiceNumber?: string;
  /** Which payment the next invoice asks for, and what earlier invoices asked for. */
  billing?: ProjectBilling;
  /** Hand-set unit prices and discounts on the invoice, by invoice row key. */
  priceEdits?: Record<string, { unitPrice?: number; discount?: string }>;
  /** Lines added to the invoice by hand (electrical works). */
  extraLines?: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    sourceId?: string;
  }[];
}

/** The three payments in Maxsen's terms: deposit, at the start of installation, and the balance. */
export type InvoiceStage = 'deposit' | 'second' | 'final';

export interface IssuedInvoice {
  number: string;
  /** Grand total and the amount asked for, when the invoice was generated. */
  total: number;
  due: number;
  date: string;
}

export interface ProjectBilling {
  stage: InvoiceStage;
  /** Invoice numbers for the 2nd and final invoices (the deposit uses `invoiceNumber`). */
  numbers?: Partial<Record<InvoiceStage, string>>;
  /** Already collected, as typed in; suggested from earlier invoices when absent. */
  paid?: Partial<Record<InvoiceStage, number>>;
  /** The last invoice generated at each stage. */
  issued?: Partial<Record<InvoiceStage, IssuedInvoice>>;
}

export interface ProjectDetails {
  title: string;
  customerName: string;
  customerContact: string;
  propertyAddress: string;
  propertyType: PropertyType | null;
  status: ProjectStatus;
}

export interface Project extends ProjectDetails {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastOpened: { levelId: string; planType: PlanType } | null;
  thumbnailFileId: string | null;
  catalogueSnapshot: Record<string, VariantSnapshot>;
  quantityAdjustments: Record<string, QuantityAdjustment>;
  exportSettings: ExportSettings;
  /** Most recently used variant ids, newest first, at most 12. */
  recentVariantIds: string[];
  /** Key dates on site, as YYYY-MM-DD. */
  schedule?: ProjectSchedule;
}

/** The on-site milestones, in the order they happen. */
export const SCHEDULE_STEPS = [
  'siteLiaison',
  'lightsDelivery',
  'installation',
  'integration',
] as const;
export type ScheduleStep = (typeof SCHEDULE_STEPS)[number];

export type ProjectSchedule = Partial<Record<ScheduleStep, string | null>> & {
  /** No lights are delivered for this project, so that step is skipped. */
  noLightsDelivery?: boolean;
};

export interface Level {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  paperSize: PaperSize;
  orientation: Orientation;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Crop rectangle as fractions (0–1) of the rotated source page. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanBackground {
  sourcePageId: string;
  rotation: Rotation;
  crop: CropRect;
  /** Derived, rotated-and-cropped image file. */
  fileId: string;
  /** Pixel size of the derived image; defines the plan-unit aspect ratio. */
  width: number;
  height: number;
}

export interface Plan {
  id: string;
  projectId: string;
  levelId: string;
  type: PlanType;
  background: PlanBackground;
  document: PlanDocument;
  /** Incremented on every saved document change; used for optimistic concurrency. */
  revision: number;
  updatedAt: string;
  /** Rooms outlined on the drawing for Magic Plan, kept so it can be run again. */
  magicLayout?: RoomLayout;
}

export interface SourceFile {
  id: string;
  projectId: string;
  fileId: string;
  name: string;
  kind: 'pdf' | 'image';
  pageCount: number;
  sortOrder: number;
  createdAt: string;
}

export interface SourcePage {
  id: string;
  projectId: string;
  sourceFileId: string;
  /** 0-based page index within the source file; images have a single page 0. */
  pageIndex: number;
  /** Rasterised page image. */
  fileId: string;
  thumbnailFileId: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------------------------
// Catalogue, settings, templates, files
// ---------------------------------------------------------------------------------------------

export interface Product {
  id: string;
  categoryId: CategoryId;
  name: string;
  hidden: boolean;
  /** System products (auto-added drivers) never appear in the library and cannot be hidden or deleted. */
  system: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  /** Customer-facing description used in the product description PDF. */
  description: string;
  imageFileId: string | null;
  hidden: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /**
   * Selling price in S$ per piece (per metre for LED strips), used only on the invoice; never shown
   * in the product description. Null or absent until set.
   */
  price?: number | null;
}

export interface CategoryStyleOverride {
  color?: string;
  badge?: string;
  badgeStyle?: BadgeStyle;
  size?: number;
}

export interface Showroom {
  name: string;
  address: string;
}

export interface Branding {
  logoFileId: string | null;
  /** Artwork behind the export covers and contact page (SVG, PNG or JPG); none for plain. */
  proposalBackgroundFileId?: string | null;
  whatsapp: string;
  website: string;
  showrooms: Showroom[];
  contactWording: string;
}

export interface Settings {
  branding: Branding;
  categoryStyles: Partial<Record<CategoryId, CategoryStyleOverride>>;
  favouriteVariantIds: string[];
  /** Categories whose every product was deleted on purpose, so sample products aren't re-added. */
  emptiedCategories?: CategoryId[];
  /** Sample variants added to an existing catalogue once, so deleting one keeps it gone. */
  offeredVariantIds?: string[];
  /** Packages, add-on rates and invoice details; defaults apply where absent. */
  pricing?: PricingSettings;
}

export interface TemplateLevel {
  name: string;
  sortOrder: number;
  paperSize: PaperSize;
  orientation: Orientation;
  plans: { type: PlanType; document: PlanDocument }[];
}

export interface TemplateStructure {
  levels: TemplateLevel[];
  /** Level entries are keyed by the template level's sortOrder as a string; re-keyed on instantiation. */
  exportSettings: ExportSettings;
  /** Fallback only: new projects re-snapshot from the live catalogue. */
  catalogueSnapshot: Record<string, VariantSnapshot>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  sourceProjectId: string | null;
  structure: TemplateStructure;
  createdAt: string;
  updatedAt: string;
}

export type FileKind =
  'source' | 'page' | 'thumbnail' | 'background' | 'project-thumbnail' | 'product-image' | 'logo';

export interface FileRecord {
  id: string;
  kind: FileKind;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: number;
  originalName: string | null;
  createdAt: string;
}
