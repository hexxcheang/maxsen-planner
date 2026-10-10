/**
 * Builds the three exports in the browser (product spec §11–§14). The libraries are loaded on
 * demand so they never weigh down the planner.
 */
import type { jsPDF as JsPdf } from 'jspdf';
import {
  buildScene,
  categoryById,
  resolveCategoryStyle,
  STAGE_LABEL,
  type CategoryId,
  type Invoice,
  type PricingSettings,
  type Level,
  type Plan,
  type Project,
  type ReviewLine,
  type Settings,
  type StageAmounts,
  type VariantResolver,
  type Variant,
} from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { imageToArtwork, imageToPngDataUrl } from '@/lib/images';
import { floorPlanPages, productSections, quantitySections } from './content';
import { monogramUrl, type PatternKind } from './monogram';
import { glyphImage, renderPlanImage } from './render-scene';

export interface ExportContext {
  project: Project;
  levels: Level[];
  plans: Plan[];
  settings: Settings;
  lines: ReviewLine[];
  resolve: VariantResolver;
  /** The live catalogue, for prices on the invoice. */
  variants: Variant[];
}

type Rgb = [number, number, number];
// Champagne, after the Maxsen brand artwork: white fading to warm sand, fine rose-gold lines, and
// deep bronze-brown type so everything stays easy to read.
const DEEP: Rgb = [58, 44, 30];
const INK: Rgb = [45, 38, 31];
const INK_2: Rgb = [99, 84, 68];
const MUTED: Rgb = [150, 135, 117];
const RULE: Rgb = [229, 216, 196];
const DISCOUNT: Rgb = [178, 34, 34];
const IVORY: Rgb = [251, 247, 241];
const ROSE: Rgb = [197, 138, 98];
const BRONZE: Rgb = [126, 86, 49];
const WHITE: Rgb = [255, 255, 255];
const SAND: Rgb = [239, 225, 203];
const PAPER = { A4: [210, 297], A3: [297, 420] } as const;
/** The monogram canvas is drawn at this many pixels per millimetre… */
const PATTERN_PX_PER_MM = 6;
/** …with one repeat (a hexagon and a sparkle) this wide, on every page and panel alike. */
const PATTERN_TILE_MM = 24;

// --- Excel ---------------------------------------------------------------------------------------

export async function buildQuantityXlsx({ project, lines }: ExportContext): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Maxsen Smart Home Planner';
  const ws = wb.addWorksheet('Quantities');
  ws.columns = [{ width: 34 }, { width: 32 }, { width: 28 }, { width: 12 }];
  ws.addRow([`Customer contact number: ${project.customerContact || ''}`]).font = { bold: true };
  const header = ws.addRow(['Category', 'Product', 'Variant', 'Quantity']);
  header.font = { bold: true };
  header.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } };
  });
  for (const section of quantitySections(lines)) {
    const title = ws.addRow([section.title]);
    title.font = { bold: true };
    for (const r of section.rows) {
      const row = ws.addRow([r.category, r.product, r.variant, r.quantity]);
      const q = row.getCell(4);
      q.numFmt = r.unit === 'm' ? '0.0 "m"' : '0';
      q.alignment = { horizontal: 'right' };
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// --- shared PDF parts ----------------------------------------------------------------------------

async function newPdf(format: readonly [number, number], landscape: boolean): Promise<JsPdf> {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({
    unit: 'mm',
    format: [...format],
    orientation: landscape ? 'landscape' : 'portrait',
    compress: true,
  });
}

type Picture = { dataUrl: string; width: number; height: number } | null;

async function logo(settings: Settings): Promise<Picture> {
  if (!settings.branding.logoFileId) return null;
  try {
    return await imageToPngDataUrl(fileUrl(settings.branding.logoFileId), 900);
  } catch {
    return null;
  }
}

async function artwork(settings: Settings): Promise<Picture> {
  const id = settings.branding.proposalBackgroundFileId;
  if (!id) return null;
  try {
    return await imageToArtwork(fileUrl(id));
  } catch {
    return null;
  }
}

interface Assets {
  logo: Picture;
  /** The uploaded proposal background, if any. */
  art: Picture;
  /** The monogram canvas drawn to fill a box of `w` × `h` mm. */
  pattern: (w: number, h: number, kind: PatternKind) => Promise<Picture>;
}

async function loadAssets(settings: Settings): Promise<Assets> {
  const [l, art] = await Promise.all([logo(settings), artwork(settings)]);
  const made = new Map<string, Promise<Picture>>();
  const pattern = (w: number, h: number, kind: PatternKind) => {
    const px = Math.round(w * PATTERN_PX_PER_MM);
    const py = Math.round(h * PATTERN_PX_PER_MM);
    const key = `${kind}:${px}x${py}`;
    let pic = made.get(key);
    if (!pic) {
      const url = monogramUrl(px, py, PATTERN_TILE_MM * PATTERN_PX_PER_MM, kind);
      pic = imageToArtwork(url, Math.max(px, py)).catch(() => null);
      made.set(key, pic);
    }
    return pic;
  };
  return { logo: l, art, pattern };
}

/** The logo, `h` mm tall but no wider than `maxW`, its top edge at `y` (centred on that height). */
function drawLogo(
  doc: JsPdf,
  img: Picture,
  x: number,
  y: number,
  h: number,
  alignRight = false,
  maxW = Infinity,
) {
  if (!img) return;
  const k = Math.min(h / img.height, maxW / img.width);
  const w = img.width * k;
  const lh = img.height * k;
  doc.addImage(img.dataUrl, 'PNG', alignRight ? x - w : x, y + (h - lh) / 2, w, lh);
}

/**
 * A champagne panel carrying the monogram canvas, drawn to the panel's own size so the repeat is
 * centred in it with matching edges. A `page` panel (covers, the contact page) fades from white to
 * sand, or shows the background uploaded in Admin › Branding; a `panel` is an even sand.
 */
async function champagne(
  doc: JsPdf,
  assets: Assets,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: PatternKind,
) {
  const art = kind === 'page' ? assets.art : null;
  if (art) {
    // The uploaded background, cropped to fill the page.
    const k = Math.max(w / art.width, h / art.height);
    doc.saveGraphicsState();
    doc.rect(x, y, w, h, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(
      art.dataUrl,
      'JPEG',
      x + (w - art.width * k) / 2,
      y + (h - art.height * k) / 2,
      art.width * k,
      art.height * k,
    );
    doc.restoreGraphicsState();
    return;
  }
  const pic = await assets.pattern(w, h, kind);
  if (pic) doc.addImage(pic.dataUrl, 'JPEG', x, y, w, h);
  else {
    doc.setFillColor(...IVORY);
    doc.rect(x, y, w, h, 'F');
  }
}

/** Small capitals, spaced out: the label above a heading. `x` is the right edge when `right`. */
function eyebrow(
  doc: JsPdf,
  text: string,
  x: number,
  y: number,
  color: Rgb,
  size = 7.5,
  right = false,
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const caps = text.toUpperCase();
  const charSpace = size * 0.16;
  // jsPDF leaves letter spacing out of its own right alignment, so measure it here.
  const width = doc.getTextWidth(caps) + charSpace * (caps.length - 1);
  doc.text(caps, right ? x - width : x, y, { charSpace });
}

function customerLines(
  project: Project,
  show: { showCustomerName: boolean; showCustomerContact: boolean; showPropertyAddress: boolean },
) {
  return [
    show.showCustomerName && project.customerName,
    show.showCustomerContact && project.customerContact,
    show.showPropertyAddress && project.propertyAddress,
  ].filter((x): x is string => Boolean(x));
}

function contactLine(settings: Settings) {
  const b = settings.branding;
  return ['Maxsen Smart Solutions', b.website, b.whatsapp && `WhatsApp ${b.whatsapp}`]
    .filter(Boolean)
    .join('   ·   ');
}

async function cover(
  doc: JsPdf,
  assets: Assets,
  kind: string,
  title: string,
  customer: string[],
  settings: Settings,
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = Math.round(W * 0.075);
  await champagne(doc, assets, 0, 0, W, H, 'page');

  // Logo and the proposal mark, over a fine rose-gold rule.
  const head = M * 0.9;
  drawLogo(doc, assets.logo, M, head - 4, 8, false, 58);
  if (!assets.logo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...DEEP);
    doc.text('MAXSEN', M, head + 2, { charSpace: 2.4 });
  }
  eyebrow(doc, 'Smart home proposal', W - M, head + 1.5, BRONZE, 7.5, true);
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.3);
  doc.line(M, head + 12, W - M, head + 12);

  // Title.
  const top = H * 0.36;
  eyebrow(doc, kind, M, top, BRONZE, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...DEEP);
  const titleLines = doc.splitTextToSize(title, W - M * 2) as string[];
  doc.text(titleLines, M, top + 15, { lineHeightFactor: 1.12 });
  const afterTitle = top + 15 + (titleLines.length - 1) * 13.5;
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.8);
  doc.line(M, afterTitle + 9, M + 28, afterTitle + 9);

  // Details along the foot.
  const foot = H - M - 22;
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.2);
  doc.line(M, foot - 9, W - M, foot - 9);
  const col = (W - M * 2) / 3;
  const block = (i: number, label: string, lines: string[]) => {
    const x = M + col * i;
    eyebrow(doc, label, x, foot - 2, BRONZE, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    lines.forEach((line, j) => {
      doc.setTextColor(...(j === 0 ? DEEP : INK_2));
      doc.text(doc.splitTextToSize(line, col - 6) as string[], x, foot + 5 + j * 5.2);
    });
  };
  block(0, 'Prepared for', customer.length ? customer : [title]);
  block(1, 'Date', [formatDate(new Date().toISOString())]);
  block(
    2,
    'Prepared by',
    ['Maxsen Smart Solutions', settings.branding.website, settings.branding.whatsapp].filter(
      (x): x is string => Boolean(x),
    ),
  );
}

/** A page heading: a small label, the title, then a charcoal rule with a brass lead-in. */
function pageHeader(doc: JsPdf, assets: Assets, label: string, title: string, M: number): number {
  const W = doc.internal.pageSize.getWidth();
  eyebrow(doc, label, M, M + 3, BRONZE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...DEEP);
  doc.text(title, M, M + 11);
  drawLogo(doc, assets.logo, W - M, M + 1, 6, true, 40);
  doc.setDrawColor(...DEEP);
  doc.setLineWidth(0.25);
  doc.line(M, M + 16, W - M, M + 16);
  doc.setFillColor(...ROSE);
  doc.rect(M, M + 15.4, 22, 1.2, 'F');
  return M + 22;
}

/** Page footers (after the pages exist, so each knows the total), skipping `skip` pages. */
function footers(doc: JsPdf, settings: Settings, M: (W: number) => number, skip: Set<number>) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    if (skip.has(i)) continue;
    doc.setPage(i);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const m = M(W);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(m, H - m + 1, W - m, H - m + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(contactLine(settings), m, H - m + 5.5);
    doc.text(
      `${String(i).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
      W - m,
      H - m + 5.5,
      {
        align: 'right',
        charSpace: 0.6,
      },
    );
  }
}

/** How many of each category are drawn on a plan. */
function countsOf(scene: ReturnType<typeof buildScene>): Map<CategoryId, number> {
  const counts = new Map<CategoryId, number>();
  for (const item of scene.items) {
    if (item.type === 'note') continue;
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  }
  return counts;
}

// --- marked floor plan ---------------------------------------------------------------------------

const planMargin = (W: number) => (W > 380 ? 16 : 12);

export async function buildFloorPlanPdf({
  project,
  levels,
  plans,
  settings,
  resolve,
}: ExportContext): Promise<Blob> {
  const fp = project.exportSettings.floorPlan;
  const pages = floorPlanPages(levels, plans, fp);
  const first = pages[0]?.level ?? levels[0];
  const size = (l?: Level) => PAPER[l?.paperSize ?? 'A3'];
  const landscape = (l?: Level) => (l?.orientation ?? 'landscape') === 'landscape';
  const doc = await newPdf(size(first), landscape(first));
  const assets = await loadAssets(settings);
  const customer = customerLines(project, fp);
  await cover(doc, assets, 'Marked Floor Plan', project.title, customer, settings);

  for (const [index, { level, plan }] of pages.entries()) {
    doc.addPage([...size(level)], landscape(level) ? 'landscape' : 'portrait');
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = planMargin(W);
    const planLabel = plan.type === 'smart-home' ? 'Smart Home Plan' : 'Lighting Plan';
    const top = pageHeader(doc, assets, level.name, planLabel, M);

    const sheet = { width: 1000, height: (1000 * plan.background.height) / plan.background.width };
    const scene = buildScene(
      plan.document,
      { settings, resolve, width: sheet.width, height: sheet.height },
      {
        showLabels: fp.showLabels,
        showLedLengths: fp.showLedLengths,
        showTrackLabels: fp.showTrackLabels,
        showNotes: fp.showNotes,
        hiddenCategories: fp.hiddenCategories,
      },
    );

    // The plan takes the page; a side panel (or a band below, on portrait pages) carries the
    // legend and the title block.
    const wide = W > H;
    const bottom = H - M - 4;
    const side = wide ? Math.min(78, W * 0.2) : 0;
    const below = wide ? 0 : 58;
    const frame = { x: M, y: top, w: W - M * 2 - (side ? side + 8 : 0), h: bottom - top - below };
    doc.setFillColor(...IVORY);
    doc.rect(frame.x, frame.y, frame.w, frame.h, 'F');
    const pad = 7;
    const k = Math.min((frame.w - pad * 2) / sheet.width, (frame.h - pad * 2) / sheet.height);
    const w = sheet.width * k;
    const h = sheet.height * k;
    const image = await renderPlanImage(
      scene,
      fileUrl(plan.background.fileId),
      Math.min(3600, Math.round(w * 13)),
    );
    const ix = frame.x + (frame.w - w) / 2;
    const iy = frame.y + (frame.h - h) / 2;
    doc.addImage(image.dataUrl, 'JPEG', ix, iy, w, h);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.rect(ix, iy, w, h);

    const panel = wide
      ? { x: W - M - side, y: top, w: side, h: bottom - top }
      : { x: M, y: bottom - below + 8, w: W - M * 2, h: below - 8 };
    const blockH = 50;
    const blockW = wide ? panel.w : Math.min(84, panel.w * 0.42);
    const legendBox = wide
      ? { x: panel.x, y: panel.y, w: panel.w, h: panel.h - blockH - 6 }
      : { x: panel.x, y: panel.y, w: panel.w - blockW - 8, h: panel.h };

    if (fp.showLegend && scene.legend.length > 0) {
      const counts = countsOf(scene);
      eyebrow(doc, 'Legend', legendBox.x, legendBox.y + 3, BRONZE);
      const columns = wide ? 1 : 2;
      const colW = legendBox.w / columns;
      const rows = Math.ceil(scene.legend.length / columns);
      const rowH = Math.max(5.4, Math.min(8, (legendBox.h - 9) / rows));
      scene.legend.forEach((e, i) => {
        const c = Math.floor(i / rows);
        const r = i % rows;
        const x = legendBox.x + c * colW;
        const y = legendBox.y + 9 + r * rowH;
        doc.addImage(
          glyphImage(resolveCategoryStyle(e.categoryId, settings)),
          'PNG',
          x,
          y - 1,
          4.4,
          4.4,
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...INK);
        const name = e.categoryId === 'curtains-blinds' ? `${e.name} (S. Curtains)` : e.name;
        const fitted = doc.splitTextToSize(name, colW - 22) as string[];
        doc.text(fitted[0] ?? name, x + 7, y + 2.3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DEEP);
        const n = counts.get(e.categoryId) ?? 0;
        const unit = categoryById(e.categoryId).kind === 'led-strip' ? ' runs' : '';
        doc.text(`${n}${unit}`, x + colW - 4, y + 2.3, { align: 'right' });
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.15);
        doc.line(x, y + rowH - 2.2, x + colW - 4, y + rowH - 2.2);
      });
    }

    // Title block: the project, who it's for, and the sheet number.
    const tb = wide
      ? { x: panel.x, y: panel.y + panel.h - blockH, w: blockW, h: blockH }
      : { x: panel.x + panel.w - blockW, y: panel.y, w: blockW, h: panel.h };
    await champagne(doc, assets, tb.x, tb.y, tb.w, tb.h, 'panel');
    doc.setFillColor(...ROSE);
    doc.rect(tb.x, tb.y, tb.w, 0.9, 'F');
    eyebrow(doc, 'Project', tb.x + 5, tb.y + 8, BRONZE, 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DEEP);
    const name = (doc.splitTextToSize(project.title, tb.w - 10) as string[]).slice(0, 2);
    doc.text(name, tb.x + 5, tb.y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_2);
    customer.slice(0, 3).forEach((line, i) => {
      doc.text(
        (doc.splitTextToSize(line, tb.w - 10) as string[])[0] ?? '',
        tb.x + 5,
        tb.y + 15 + name.length * 4.6 + i * 4,
      );
    });
    eyebrow(doc, 'Sheet', tb.x + 5, tb.y + tb.h - 9, BRONZE, 6.5);
    eyebrow(doc, 'Date', tb.x + tb.w / 2, tb.y + tb.h - 9, BRONZE, 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DEEP);
    doc.text(
      `${String(index + 1).padStart(2, '0')} of ${String(pages.length).padStart(2, '0')}`,
      tb.x + 5,
      tb.y + tb.h - 4,
    );
    doc.text(formatDate(new Date().toISOString()), tb.x + tb.w / 2, tb.y + tb.h - 4);
  }
  if (pages.length === 0) {
    doc.addPage();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text('No plan pages are selected for this export.', 24, 36);
  }
  footers(doc, settings, planMargin, new Set([1]));
  return doc.output('blob');
}

// --- product description -------------------------------------------------------------------------

/** A category's total on the client's documents: pieces, or metres for LED strips. */
function categoryTotal(lines: ExportContext['lines'], categoryId: CategoryId): string {
  const mine = lines.filter((l) => l.categoryId === categoryId && !l.autoAdded);
  const total = mine.reduce((sum, l) => sum + l.exportQuantity, 0);
  return formatQuantity(Math.round(total * 10) / 10, mine[0]?.unit ?? 'pcs');
}

export async function buildProductPdf({
  project,
  settings,
  lines,
  resolve,
}: ExportContext): Promise<Blob> {
  const pd = project.exportSettings.productDescription;
  const doc = await newPdf(PAPER.A4, false);
  const assets = await loadAssets(settings);
  await cover(
    doc,
    assets,
    'Product Description',
    project.title,
    customerLines(project, pd),
    settings,
  );
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const sections = productSections(lines, pd.excludedCategories, resolve);
  let y = 0;
  const newPage = (label: string, title: string) => {
    doc.addPage();
    y = pageHeader(doc, assets, label, title, M) + 4;
  };
  const ensure = (needed: number, label: string, title: string) => {
    if (y + needed > H - M - 6) newPage(label, `${title} (continued)`);
  };

  // At a glance: every category and how many, before the detail.
  if (sections.length > 0) {
    newPage('Overview', 'Your home at a glance');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK_2);
    const intro = doc.splitTextToSize(
      `Everything planned for ${project.title}, by category. Each product is described on the pages that follow.`,
      W - M * 2,
    ) as string[];
    doc.text(intro, M, y + 2);
    y += intro.length * 5 + 8;
    for (const section of sections) {
      ensure(24, 'Overview', 'Your home at a glance');
      // A band too thin for whole motifs: plain sand with a rose-gold lead-in.
      doc.setFillColor(...SAND);
      doc.rect(M, y, W - M * 2, 9, 'F');
      doc.setFillColor(...ROSE);
      doc.rect(M, y, 1.2, 9, 'F');
      eyebrow(doc, section.title, M + 4, y + 5.8, BRONZE, 7.5);
      y += 13;
      for (const cat of section.categories) {
        ensure(9, 'Overview', 'Your home at a glance');
        doc.addImage(
          glyphImage(resolveCategoryStyle(cat.categoryId, settings)),
          'PNG',
          M + 2,
          y - 1.6,
          4.6,
          4.6,
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        doc.text(cat.name, M + 10, y + 2);
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        const products = `${cat.items.length} product${cat.items.length === 1 ? '' : 's'}`;
        doc.text(products, W - M - 40, y + 2, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...DEEP);
        doc.text(categoryTotal(lines, cat.categoryId), W - M - 2, y + 2, { align: 'right' });
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.15);
        doc.line(M, y + 5, W - M, y + 5);
        y += 9;
      }
      y += 5;
    }
  }

  const images = new Map<string, Picture>();
  const imageFor = async (fileId: string | null) => {
    if (!fileId) return null;
    if (!images.has(fileId))
      images.set(fileId, await imageToPngDataUrl(fileUrl(fileId), 480).catch(() => null));
    return images.get(fileId) ?? null;
  };

  for (const section of sections) {
    const label = section.title.replace(/ Products$/, '');
    newPage(label, section.title);
    for (const cat of section.categories) {
      ensure(52, label, section.title);
      doc.addImage(
        glyphImage(resolveCategoryStyle(cat.categoryId, settings)),
        'PNG',
        M,
        y - 3.6,
        5,
        5,
      );
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(...DEEP);
      doc.text(cat.name, M + 8, y);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.2);
      doc.line(M, y + 3, W - M, y + 3);
      y += 9;
      for (const item of cat.items) {
        const textX = M + 40;
        const textW = W - M - textX - 30;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const desc = doc.splitTextToSize(item.description, textW) as string[];
        const blockH = Math.max(34, 16 + desc.length * 4.2);
        ensure(blockH + 4, label, section.title);
        // Product picture on an ivory tile.
        doc.setFillColor(...IVORY);
        doc.roundedRect(M, y, 34, 34, 2, 2, 'F');
        const pic = await imageFor(item.imageFileId);
        if (pic) {
          const s = Math.min(28 / pic.width, 28 / pic.height);
          doc.addImage(
            pic.dataUrl,
            'PNG',
            M + (34 - pic.width * s) / 2,
            y + (34 - pic.height * s) / 2,
            pic.width * s,
            pic.height * s,
          );
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(...DEEP);
        doc.text(item.productName, textX, y + 5);
        eyebrow(doc, item.variantName, textX, y + 10.5, BRONZE, 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...INK_2);
        doc.text(desc, textX, y + 17, { lineHeightFactor: 1.35 });
        // Quantity in a charcoal pill.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const pillW = Math.max(18, doc.getTextWidth(item.quantity) + 9);
        doc.setFillColor(...DEEP);
        doc.roundedRect(W - M - pillW, y, pillW, 8, 4, 4, 'F');
        doc.setTextColor(...WHITE);
        doc.text(item.quantity, W - M - pillW / 2, y + 5.4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text('QUANTITY', W - M - pillW / 2, y + 12, { align: 'center', charSpace: 0.8 });
        y += blockH + 4;
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.12);
        doc.line(textX, y - 2, W - M, y - 2);
      }
      y += 5;
    }
  }

  // Contact page: the champagne canvas again, as on the cover.
  doc.addPage();
  await champagne(doc, assets, 0, 0, W, H, 'page');
  const b = settings.branding;
  let cy = H * 0.3;
  eyebrow(doc, 'Get in touch', M, cy, BRONZE, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...DEEP);
  doc.text('Contact us', M, cy + 14);
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.8);
  doc.line(M, cy + 22, M + 28, cy + 22);
  cy += 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK_2);
  const wording = doc.splitTextToSize(b.contactWording, W - M * 2) as string[];
  doc.text(wording, M, cy, { lineHeightFactor: 1.45 });
  cy += wording.length * 6 + 10;
  const row = (label: string, value: string) => {
    eyebrow(doc, label, M, cy, BRONZE, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...DEEP);
    doc.text(value, M + 32, cy);
    cy += 9;
  };
  if (b.whatsapp) row('WhatsApp', b.whatsapp);
  if (b.website) row('Website', b.website);
  cy += 6;
  for (const room of b.showrooms) {
    eyebrow(doc, 'Showroom', M, cy, BRONZE, 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DEEP);
    doc.text(room.name, M + 32, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK_2);
    doc.text(doc.splitTextToSize(room.address, W - M * 2 - 32) as string[], M + 32, cy + 5.5);
    cy += 16;
  }
  footers(doc, settings, () => M, new Set([1, doc.getNumberOfPages()]));
  return doc.output('blob');
}

// --- quotation ------------------------------------------------------------------------------------

/**
 * A quotation as a proposal-style PDF: the champagne cover, then the items priced as on the invoice
 * (packages highlighted, sections for lighting), the total and deposit, and the warranty, terms
 * and payment details from Admin › Pricing.
 */
export async function buildQuotationPdf({
  client,
  invoice,
  pricing,
  number,
  settings,
  payment,
  label = 'Quotation',
}: {
  client: { name: string; contact: string };
  invoice: Invoice;
  pricing: PricingSettings;
  number: string;
  settings: Settings;
  /** For a 2nd or final payment: what's been paid and what's due now, shown under the total. */
  payment?: StageAmounts;
  /** What the document is called on its cover and page headers. */
  label?: 'Quotation' | 'Invoice';
}): Promise<Blob> {
  const doc = await newPdf(PAPER.A4, false);
  const assets = await loadAssets(settings);
  const customer = [client.name, client.contact].filter(Boolean);
  await cover(
    doc,
    assets,
    `${label} ${number}`,
    client.name ? `Smart Home for ${client.name}` : 'Smart Home',
    customer,
    settings,
  );
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const money = (n: number) => `${n < 0 ? '-' : ''}S$${formatMoney(Math.abs(n))}`;
  // Columns: number, item, quantity, unit price, amount (right edges for the figures).
  const col = { no: M + 1, item: M + 13, qty: W - M - 62, unit: W - M - 32, amount: W - M };
  const itemW = col.qty - 10 - col.item;
  let y = 0;
  const head = () => {
    doc.setFillColor(...SAND);
    doc.rect(M, y, W - M * 2, 8, 'F');
    doc.setFillColor(...ROSE);
    doc.rect(M, y, 1.2, 8, 'F');
    eyebrow(doc, 'No.', col.no + 1.5, y + 5.2, BRONZE, 6.5);
    eyebrow(doc, 'Item', col.item, y + 5.2, BRONZE, 6.5);
    eyebrow(doc, 'Qty', col.qty, y + 5.2, BRONZE, 6.5, true);
    eyebrow(doc, 'Unit price', col.unit, y + 5.2, BRONZE, 6.5, true);
    eyebrow(doc, 'Amount', col.amount - 2, y + 5.2, BRONZE, 6.5, true);
    y += 12;
  };
  // The items and totals are headed "Invoice", the warranty and terms after them on their own page.
  let section = 'Invoice';
  const newPage = (continued: boolean, table = true) => {
    doc.addPage();
    y =
      pageHeader(
        doc,
        assets,
        `${label} ${number}`,
        continued ? `${section} (continued)` : section,
        M,
      ) + 4;
    if (table) head();
  };
  const ensure = (needed: number, table = true) => {
    if (y + needed > H - M - 8) newPage(true, table);
  };

  newPage(false);
  let n = 0;
  for (const row of invoice.rows) {
    if (row.kind === 'note') continue;
    if (row.kind === 'section') {
      ensure(14);
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...DEEP);
      doc.text(row.title, col.item, y);
      doc.setDrawColor(...ROSE);
      doc.setLineWidth(0.5);
      doc.line(col.item, y + 2, col.item + 14, y + 2);
      y += 8;
      continue;
    }
    if (row.discount) {
      // A discount sits under its item, in red, without a number of its own.
      ensure(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DISCOUNT);
      doc.text((doc.splitTextToSize(row.description, itemW) as string[])[0]!, col.item, y - 0.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(money(row.quantity * (row.unitPrice ?? 0)), col.amount - 2, y - 0.5, {
        align: 'right',
      });
      y += 5.5;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.15);
      doc.line(M, y - 3.5, W - M, y - 3.5);
      continue;
    }
    // The first line of an item is its name; the rest (a package's contents) is the detail.
    const [first = '', ...rest] = row.description.split('\n').filter((l) => l.trim());
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const nameLines = doc.splitTextToSize(first, itemW) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const detail = rest.flatMap((l) => doc.splitTextToSize(l.trim(), itemW) as string[]);
    const h = nameLines.length * 4.4 + detail.length * 3.7 + 5;
    ensure(h + 2);
    if (row.highlight) {
      doc.setFillColor(...IVORY);
      doc.rect(M, y - 3.5, W - M * 2, h, 'F');
      doc.setFillColor(...ROSE);
      doc.rect(M, y - 3.5, 0.8, h, 'F');
    }
    n++;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(String(n).padStart(2, '0'), col.no + 1.5, y + 0.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DEEP);
    doc.text(nameLines, col.item, y + 0.5, { lineHeightFactor: 1.3 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK_2);
    if (detail.length)
      doc.text(detail, col.item, y + nameLines.length * 4.4 + 0.5, { lineHeightFactor: 1.3 });
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(String(row.quantity), col.qty, y + 0.5, { align: 'right' });
    doc.text(row.unitPrice === null ? '—' : money(row.unitPrice), col.unit, y + 0.5, {
      align: 'right',
    });
    doc.setFont('helvetica', 'bold');
    doc.text(money(row.quantity * (row.unitPrice ?? 0)), col.amount - 2, y + 0.5, {
      align: 'right',
    });
    y += h;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.line(M, y - 3.5, W - M, y - 3.5);
  }

  // Total and deposit, set apart on the right.
  ensure(30, false);
  y += 4;
  const left = col.qty - 20;
  doc.setDrawColor(...DEEP);
  doc.setLineWidth(0.3);
  doc.line(left, y, W - M, y);
  doc.setFillColor(...ROSE);
  doc.rect(left, y - 0.6, 18, 1.2, 'F');
  y += 8;
  // The total, then the deposit asked for now, set larger: it's what the client pays first.
  eyebrow(doc, 'Total', left, y, BRONZE, 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK_2);
  doc.text(money(invoice.total), col.amount - 2, y, { align: 'right' });
  y += 9;
  const later = payment && payment.stage !== 'deposit';
  if (later && payment.stage !== 'full') {
    // What the client has paid so far: the deposit, or for the final payment the 2nd one too.
    const paidLabel = payment.stage === 'final' ? 'Deposit & 2nd payment paid' : 'Deposit paid';
    eyebrow(doc, paidLabel, left, y, BRONZE, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK_2);
    doc.text(money(-payment.paid), col.amount - 2, y, { align: 'right' });
    y += 9;
  }
  eyebrow(
    doc,
    later ? `${STAGE_LABEL[payment.stage]} due` : `Deposit (${pricing.depositPercent}%)`,
    left,
    y,
    BRONZE,
    7.5,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...DEEP);
  doc.text(money(later ? payment.due : invoice.deposit), col.amount - 2, y + 0.5, {
    align: 'right',
  });
  y += 12;

  // Warranty, terms and payment details.
  section = 'Terms and Conditions';
  newPage(false, false);
  const paragraph = (label: string, text: string) => {
    if (!text.trim()) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(text, W - M * 2) as string[];
    ensure(10 + lines.length * 3.9, false);
    eyebrow(doc, label, M, y, BRONZE, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_2);
    doc.text(lines, M, y + 5, { lineHeightFactor: 1.35 });
    y += 9 + lines.length * 3.9;
  };
  paragraph('Warranty', pricing.warranty);
  paragraph('Terms', pricing.terms);
  paragraph('Payment', pricing.bankDetails);

  footers(doc, settings, () => M, new Set([1]));
  return doc.output('blob');
}
