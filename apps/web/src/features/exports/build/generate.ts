/**
 * Builds the three exports in the browser (product spec §11–§14). The libraries are loaded on
 * demand so they never weigh down the planner.
 */
import type { jsPDF as JsPdf } from 'jspdf';
import {
  buildScene,
  categoryById,
  resolveCategoryStyle,
  type CategoryId,
  type Level,
  type Plan,
  type Project,
  type ReviewLine,
  type Settings,
  type VariantResolver,
  type Variant,
} from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { formatDate, formatQuantity } from '@/lib/format';
import { imageToArtwork, imageToPngDataUrl } from '@/lib/images';
import { floorPlanPages, productSections, quantitySections } from './content';
import { monogramUrl } from './monogram';
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
// A quiet, premium palette: warm charcoal and ivory with a brushed-brass accent.
const CHARCOAL: Rgb = [27, 26, 24];
const INK: Rgb = [31, 29, 26];
const INK_2: Rgb = [92, 88, 81];
const MUTED: Rgb = [138, 132, 122];
const RULE: Rgb = [222, 216, 205];
const IVORY: Rgb = [248, 245, 239];
const BRASS: Rgb = [168, 135, 58];
const BRASS_LIGHT: Rgb = [214, 186, 121];
const WHITE: Rgb = [255, 255, 255];
const ON_DARK: Rgb = [214, 209, 199];
const PAPER = { A4: [210, 297], A3: [297, 420] } as const;
/** Size of the monogram on the page: 2400 px across ≈ 190 mm, so one repeat is about 12 mm. */
const MONOGRAM_MM_PER_PX = 0.08;

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

type GStateCtor = new (p: { opacity: number }) => unknown;

async function newPdf(format: readonly [number, number], landscape: boolean): Promise<JsPdf> {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({
    unit: 'mm',
    format: [...format],
    orientation: landscape ? 'landscape' : 'portrait',
    compress: true,
  });
}

/** Runs `draw` at the given opacity. */
function withOpacity(doc: JsPdf, opacity: number, draw: () => void) {
  doc.saveGraphicsState();
  // jsPDF's typings miss that GState is a constructor on the document.
  const GState = (doc as unknown as { GState: GStateCtor }).GState;
  doc.setGState(new GState({ opacity }));
  draw();
  doc.restoreGraphicsState();
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
  /** Maxsen's monogram canvas, for dark panels (and the covers when nothing is uploaded). */
  monogram: Picture;
}

async function loadAssets(settings: Settings): Promise<Assets> {
  const [l, art, monogram] = await Promise.all([
    logo(settings),
    artwork(settings),
    imageToArtwork(monogramUrl()).catch(() => null),
  ]);
  return { logo: l, art, monogram };
}

function drawLogo(doc: JsPdf, img: Picture, x: number, y: number, h: number, alignRight = false) {
  if (!img) return;
  const w = (img.width / img.height) * h;
  doc.addImage(img.dataUrl, 'PNG', alignRight ? x - w : x, y, w, h);
}

/**
 * A dark panel. `full` panels (covers, the contact page) show the uploaded background under a
 * charcoal veil so text on them stays legible; without one, and on the smaller panels inside the
 * documents, they carry the monogram canvas at its natural scale.
 */
function darkPanel(
  doc: JsPdf,
  assets: Assets,
  x: number,
  y: number,
  w: number,
  h: number,
  full = false,
) {
  doc.setFillColor(...CHARCOAL);
  doc.rect(x, y, w, h, 'F');
  const art = full && assets.art ? assets.art : assets.monogram;
  if (!art) return;
  doc.saveGraphicsState();
  doc.rect(x, y, w, h, null);
  doc.clip();
  doc.discardPath();
  if (art === assets.art) {
    // Cropped to fill the panel.
    const k = Math.max(w / art.width, h / art.height);
    doc.addImage(
      art.dataUrl,
      'JPEG',
      x + (w - art.width * k) / 2,
      y + (h - art.height * k) / 2,
      art.width * k,
      art.height * k,
    );
  } else {
    // The monogram keeps one size everywhere, anchored to the page, so its repeat lines up.
    const k = MONOGRAM_MM_PER_PX;
    for (let ty = 0; ty < y + h; ty += art.height * k) {
      for (let tx = 0; tx < x + w; tx += art.width * k) {
        if (tx + art.width * k < x || ty + art.height * k < y) continue;
        doc.addImage(art.dataUrl, 'JPEG', tx, ty, art.width * k, art.height * k, 'monogram');
      }
    }
  }
  doc.restoreGraphicsState();
  if (art === assets.art) {
    withOpacity(doc, 0.66, () => {
      doc.setFillColor(...CHARCOAL);
      doc.rect(x, y, w, h, 'F');
    });
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

function cover(
  doc: JsPdf,
  assets: Assets,
  kind: string,
  project: Project,
  customer: string[],
  settings: Settings,
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = Math.round(W * 0.075);
  const band = Math.max(30, H * 0.13);

  // Ivory band with the logo, then the artwork under a dark veil.
  doc.setFillColor(...IVORY);
  doc.rect(0, 0, W, band, 'F');
  drawLogo(doc, assets.logo, M, band / 2 - 6, 12);
  if (!assets.logo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...CHARCOAL);
    doc.text('MAXSEN', M, band / 2 + 2, { charSpace: 2.4 });
  }
  eyebrow(doc, 'Smart home proposal', W - M, band / 2 + 1.5, INK_2, 7.5, true);
  darkPanel(doc, assets, 0, band, W, H - band, true);
  doc.setFillColor(...BRASS);
  doc.rect(0, band, W, 1.1, 'F');

  // Title.
  const top = band + (H - band) * 0.3;
  eyebrow(doc, kind, M, top, BRASS_LIGHT, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...WHITE);
  const title = doc.splitTextToSize(project.title, W - M * 2) as string[];
  doc.text(title, M, top + 15, { lineHeightFactor: 1.12 });
  const afterTitle = top + 15 + (title.length - 1) * 13.5;
  doc.setDrawColor(...BRASS);
  doc.setLineWidth(0.8);
  doc.line(M, afterTitle + 9, M + 28, afterTitle + 9);

  // Details along the foot.
  const foot = H - M - 22;
  doc.setDrawColor(...ON_DARK);
  doc.setLineWidth(0.15);
  withOpacity(doc, 0.5, () => doc.line(M, foot - 9, W - M, foot - 9));
  const col = (W - M * 2) / 3;
  const block = (i: number, label: string, lines: string[]) => {
    const x = M + col * i;
    eyebrow(doc, label, x, foot - 2, BRASS_LIGHT, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    lines.forEach((line, j) => {
      doc.setTextColor(...(j === 0 ? WHITE : ON_DARK));
      doc.text(doc.splitTextToSize(line, col - 6) as string[], x, foot + 5 + j * 5.2);
    });
  };
  block(0, 'Prepared for', customer.length ? customer : [project.title]);
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
  eyebrow(doc, label, M, M + 3, BRASS);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...CHARCOAL);
  doc.text(title, M, M + 11);
  drawLogo(doc, assets.logo, W - M, M, 9, true);
  doc.setDrawColor(...CHARCOAL);
  doc.setLineWidth(0.25);
  doc.line(M, M + 16, W - M, M + 16);
  doc.setFillColor(...BRASS);
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
  cover(doc, assets, 'Marked Floor Plan', project, customer, settings);

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
      eyebrow(doc, 'Legend', legendBox.x, legendBox.y + 3, BRASS);
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
        doc.setTextColor(...CHARCOAL);
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
    darkPanel(doc, assets, tb.x, tb.y, tb.w, tb.h);
    doc.setFillColor(...BRASS);
    doc.rect(tb.x, tb.y, tb.w, 0.9, 'F');
    eyebrow(doc, 'Project', tb.x + 5, tb.y + 8, BRASS_LIGHT, 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    const name = (doc.splitTextToSize(project.title, tb.w - 10) as string[]).slice(0, 2);
    doc.text(name, tb.x + 5, tb.y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...ON_DARK);
    customer.slice(0, 3).forEach((line, i) => {
      doc.text(
        (doc.splitTextToSize(line, tb.w - 10) as string[])[0] ?? '',
        tb.x + 5,
        tb.y + 15 + name.length * 4.6 + i * 4,
      );
    });
    eyebrow(doc, 'Sheet', tb.x + 5, tb.y + tb.h - 9, BRASS_LIGHT, 6.5);
    eyebrow(doc, 'Date', tb.x + tb.w / 2, tb.y + tb.h - 9, BRASS_LIGHT, 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...WHITE);
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
  cover(doc, assets, 'Product Description', project, customerLines(project, pd), settings);
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
      darkPanel(doc, assets, M, y, W - M * 2, 9);
      eyebrow(doc, section.title, M + 4, y + 5.8, BRASS_LIGHT, 7.5);
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
        doc.setTextColor(...CHARCOAL);
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
      doc.setTextColor(...CHARCOAL);
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
        doc.setTextColor(...CHARCOAL);
        doc.text(item.productName, textX, y + 5);
        eyebrow(doc, item.variantName, textX, y + 10.5, BRASS, 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...INK_2);
        doc.text(desc, textX, y + 17, { lineHeightFactor: 1.35 });
        // Quantity in a charcoal pill.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const pillW = Math.max(18, doc.getTextWidth(item.quantity) + 9);
        doc.setFillColor(...CHARCOAL);
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

  // Contact page: the artwork again, under the same veil as the cover.
  doc.addPage();
  darkPanel(doc, assets, 0, 0, W, H, true);
  const b = settings.branding;
  let cy = H * 0.3;
  eyebrow(doc, 'Get in touch', M, cy, BRASS_LIGHT, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text('Contact us', M, cy + 14);
  doc.setDrawColor(...BRASS);
  doc.setLineWidth(0.8);
  doc.line(M, cy + 22, M + 28, cy + 22);
  cy += 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...ON_DARK);
  const wording = doc.splitTextToSize(b.contactWording, W - M * 2) as string[];
  doc.text(wording, M, cy, { lineHeightFactor: 1.45 });
  cy += wording.length * 6 + 10;
  const row = (label: string, value: string) => {
    eyebrow(doc, label, M, cy, BRASS_LIGHT, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(value, M + 32, cy);
    cy += 9;
  };
  if (b.whatsapp) row('WhatsApp', b.whatsapp);
  if (b.website) row('Website', b.website);
  cy += 6;
  for (const room of b.showrooms) {
    eyebrow(doc, 'Showroom', M, cy, BRASS_LIGHT, 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(room.name, M + 32, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...ON_DARK);
    doc.text(doc.splitTextToSize(room.address, W - M * 2 - 32) as string[], M + 32, cy + 5.5);
    cy += 16;
  }
  footers(doc, settings, () => M, new Set([1, doc.getNumberOfPages()]));
  return doc.output('blob');
}
