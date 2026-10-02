/**
 * Builds the three exports in the browser (product spec §11–§14). The libraries are loaded on
 * demand so they never weigh down the planner.
 */
import type { jsPDF as JsPdf } from 'jspdf';
import {
  buildScene,
  resolveCategoryStyle,
  type Level,
  type Plan,
  type Project,
  type ReviewLine,
  type Settings,
  type VariantResolver,
  type Variant,
} from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { formatDate } from '@/lib/format';
import { imageToPngDataUrl } from '@/lib/images';
import { floorPlanPages, productSections, quantitySections } from './content';
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

const INK: [number, number, number] = [31, 29, 26];
const INK_2: [number, number, number] = [94, 90, 83];
const RULE: [number, number, number] = [203, 198, 188];
const BRASS: [number, number, number] = [168, 135, 58];
const PAPER = { A4: [210, 297], A3: [297, 420] } as const;
const MARGIN = 10;

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

async function logo(settings: Settings) {
  if (!settings.branding.logoFileId) return null;
  try {
    return await imageToPngDataUrl(fileUrl(settings.branding.logoFileId), 900);
  } catch {
    return null;
  }
}

type Logo = Awaited<ReturnType<typeof logo>>;

function drawLogo(doc: JsPdf, img: Logo, x: number, y: number, h: number, alignRight = false) {
  if (!img) return;
  const w = (img.width / img.height) * h;
  doc.addImage(img.dataUrl, 'PNG', alignRight ? x - w : x, y, w, h);
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

function cover(
  doc: JsPdf,
  img: Logo,
  kind: string,
  project: Project,
  customer: string[],
  settings: Settings,
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  drawLogo(doc, img, 20, 22, 12);
  doc.setDrawColor(...BRASS);
  doc.setLineWidth(0.6);
  doc.line(20, H * 0.42 - 14, 60, H * 0.42 - 14);
  doc.setTextColor(...INK_2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(kind, 20, H * 0.42 - 4);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(doc.splitTextToSize(project.title, W - 40) as string[], 20, H * 0.42 + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK_2);
  customer.forEach((line, i) => doc.text(line, 20, H * 0.42 + 26 + i * 7));
  doc.setFontSize(9);
  doc.text(`Prepared ${formatDate(new Date().toISOString())}`, 20, H - 26);
  const contact = [
    settings.branding.website,
    settings.branding.whatsapp && `WhatsApp ${settings.branding.whatsapp}`,
  ]
    .filter(Boolean)
    .join('    ');
  doc.text(`Maxsen Smart Solutions    ${contact}`, 20, H - 20);
}

// --- marked floor plan ---------------------------------------------------------------------------

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
  const img = await logo(settings);
  cover(doc, img, 'Marked Floor Plan', project, customerLines(project, fp), settings);

  for (const { level, plan } of pages) {
    doc.addPage([...size(level)], landscape(level) ? 'landscape' : 'portrait');
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const planLabel = plan.type === 'smart-home' ? 'Smart Home Plan' : 'Lighting Plan';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(`${level.name}, ${planLabel}`, MARGIN, MARGIN + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK_2);
    doc.text(project.title, MARGIN, MARGIN + 10);
    drawLogo(doc, img, W - MARGIN, MARGIN, 7, true);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, MARGIN + 13, W - MARGIN, MARGIN + 13);

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
    const legendH = fp.showLegend && scene.legend.length > 0 ? 16 : 0;
    const area = { x: MARGIN, y: MARGIN + 16, w: W - MARGIN * 2, h: H - MARGIN * 2 - 16 - legendH };
    const k = Math.min(area.w / sheet.width, area.h / sheet.height);
    const w = sheet.width * k;
    const h = sheet.height * k;
    const image = await renderPlanImage(
      scene,
      fileUrl(plan.background.fileId),
      Math.min(3200, Math.round(w * 12)),
    );
    doc.addImage(image.dataUrl, 'JPEG', area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);

    if (legendH) {
      const y = H - MARGIN - legendH + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...INK);
      doc.text('Legend', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      let x = MARGIN;
      let row = 0;
      for (const e of scene.legend) {
        const label = e.name;
        const wItem = 6 + doc.getTextWidth(label) + 6;
        if (x + wItem > W - MARGIN) {
          x = MARGIN;
          row++;
        }
        const yy = y + 3 + row * 5;
        doc.addImage(
          glyphImage(resolveCategoryStyle(e.categoryId, settings)),
          'PNG',
          x,
          yy - 1,
          4,
          4,
        );
        doc.text(label, x + 5, yy + 2);
        x += wItem;
      }
    }
  }
  if (pages.length === 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text('No plan pages are selected for this export.', MARGIN * 2, MARGIN * 3);
  }
  return doc.output('blob');
}

// --- product description -------------------------------------------------------------------------

export async function buildProductPdf({
  project,
  settings,
  lines,
  resolve,
}: ExportContext): Promise<Blob> {
  const pd = project.exportSettings.productDescription;
  const doc = await newPdf(PAPER.A4, false);
  const img = await logo(settings);
  cover(doc, img, 'Product Description', project, customerLines(project, pd), settings);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  let y = 0;
  const newPage = () => {
    doc.addPage();
    drawLogo(doc, img, W - M, 12, 6, true);
    y = 28;
  };
  const ensure = (needed: number) => {
    if (y + needed > H - 18) newPage();
  };

  const images = new Map<string, Awaited<ReturnType<typeof imageToPngDataUrl>> | null>();
  const imageFor = async (fileId: string | null) => {
    if (!fileId) return null;
    if (!images.has(fileId))
      images.set(fileId, await imageToPngDataUrl(fileUrl(fileId), 480).catch(() => null));
    return images.get(fileId) ?? null;
  };

  for (const section of productSections(lines, pd.excludedCategories, resolve)) {
    newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text(section.title, M, y);
    y += 12;
    for (const cat of section.categories) {
      ensure(48);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text(cat.name, M, y);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.2);
      doc.line(M, y + 2.5, W - M, y + 2.5);
      y += 9;
      for (const item of cat.items) {
        doc.setFontSize(9.5);
        const desc = doc.splitTextToSize(item.description, W - M * 2 - 40 - 24) as string[];
        const blockH = Math.max(30, 12 + desc.length * 4.4);
        ensure(blockH + 4);
        const pic = await imageFor(item.imageFileId);
        if (pic) {
          const s = Math.min(30 / pic.width, 30 / pic.height);
          doc.addImage(
            pic.dataUrl,
            'PNG',
            M + (30 - pic.width * s) / 2,
            y + (30 - pic.height * s) / 2,
            pic.width * s,
            pic.height * s,
          );
        } else {
          doc.setDrawColor(...RULE);
          doc.rect(M, y, 30, 30);
        }
        const tx = M + 38;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...INK);
        doc.text(item.productName, tx, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...INK_2);
        doc.text(item.variantName, tx, y + 10);
        doc.text(desc, tx, y + 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...INK);
        doc.text(item.quantity, W - M, y + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...INK_2);
        doc.text('Quantity', W - M, y + 9, { align: 'right' });
        y += blockH + 4;
      }
      y += 4;
    }
  }

  // Contact page.
  newPage();
  const b = settings.branding;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text('Contact us', M, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK_2);
  const wording = doc.splitTextToSize(b.contactWording, W - M * 2) as string[];
  doc.text(wording, M, y);
  y += wording.length * 5.5 + 6;
  doc.setTextColor(...INK);
  if (b.whatsapp) {
    doc.text(`WhatsApp  ${b.whatsapp}`, M, y);
    y += 6;
  }
  if (b.website) {
    doc.text(`Website  ${b.website}`, M, y);
    y += 6;
  }
  y += 6;
  for (const room of b.showrooms) {
    doc.setFont('helvetica', 'bold');
    doc.text(room.name, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK_2);
    doc.text(room.address, M, y + 5);
    doc.setTextColor(...INK);
    y += 13;
  }
  return doc.output('blob');
}
