import type { jsPDF as JsPdf } from 'jspdf';
import {
  countSymbols,
  DEFAULT_SYMBOL_SIZE,
  ELECTRICAL_SYMBOLS,
  symbolById,
  type ElectricalPlan,
  type ElectricalSymbol,
  type PricingSettings,
} from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { loadImage } from '@/lib/images';
import { drawSymbol, STROKE } from './symbol-canvas';

/** Plotted symbols are blue, so they stand out from the black drawing. */
const BLUE: [number, number, number] = [26, 79, 214];

/**
 * The electrical layout for the ID and the electrician: an A3 landscape sheet with the floor plan
 * and every plotted point, and a legend of the symbols with how many of each.
 */
export async function buildElectricalPlanPdf(
  plan: ElectricalPlan,
  info: { client: string; address: string; number: string },
  company: PricingSettings['company'],
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape', compress: true });
  const W = 420;
  const H = 297;
  const M = 12;
  const legendW = 92;

  // The drawing with its points, as one picture.
  const img = await loadImage(fileUrl(plan.fileId));
  const k = Math.min(1, 3200 / Math.max(plan.width, plan.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(plan.width * k);
  canvas.height = Math.round(plan.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const size = (plan.symbolSize ?? DEFAULT_SYMBOL_SIZE) * Math.max(plan.width, plan.height) * k;
  for (const p of plan.points) {
    const s = symbolById(p.symbol);
    if (s) drawSymbol(ctx, s, p.x * k, p.y * k, size, p.rotation ?? 0, 'rgb(26, 79, 214)');
  }

  // Heading.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('ELECTRICAL LAYOUT', M, M + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const meta = [
    info.client && `Client: ${info.client}`,
    info.address && `Site: ${info.address}`,
    info.number && `Ref: ${info.number}`,
    new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
  ]
    .filter(Boolean)
    .join('    ');
  doc.text(meta, M, M + 11);
  doc.text(company.name, W - M, M + 5, { align: 'right' });
  const top = M + 16;

  // The drawing, as large as fits beside the legend.
  const areaW = W - 2 * M - legendW - 6;
  const areaH = H - top - M;
  const fit = Math.min(areaW / canvas.width, areaH / canvas.height);
  const dw = canvas.width * fit;
  const dh = canvas.height * fit;
  doc.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', M, top, dw, dh);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(M, top, dw, dh);

  // Legend.
  const lx = W - M - legendW;
  let y = top;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('LEGEND', lx, y + 4);
  doc.text('QTY', W - M, y + 4, { align: 'right' });
  y += 7;
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.3);
  doc.line(lx, y, W - M, y);
  const counts = countSymbols(plan.points);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const s of ELECTRICAL_SYMBOLS) {
    if (!counts[s.id]) continue;
    const row = 9;
    pdfSymbol(doc, s, lx + 5, y + row / 2, 2.6);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(s.name + (s.rateId ? '' : ' *'), lx + 12, y + row / 2 + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(String(counts[s.id]), W - M, y + row / 2 + 1, { align: 'right' });
    y += row;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(lx, y, W - M, y);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(
    doc.splitTextToSize(
      'Symbols to IEC 60617 / BS EN 60617 as used on Singapore electrical plans (SS 638). * Switches are shown for position; a lighting point’s rate includes its switch.',
      legendW,
    ) as string[],
    lx,
    y + 6,
  );

  return doc.output('blob');
}

/** A symbol drawn in the PDF as lines, centred at x, y, with half-width `s` mm. */
function pdfSymbol(doc: JsPdf, symbol: ElectricalSymbol, x: number, y: number, s: number) {
  doc.setDrawColor(...BLUE);
  doc.setFillColor(...BLUE);
  doc.setTextColor(...BLUE);
  doc.setLineWidth(STROKE * s);
  const P = (px: number, py: number) => [x + px * s, y + py * s] as const;
  const path = (pts: number[], closed: boolean, fill = false) => {
    const [x0, y0] = P(pts[0]!, pts[1]!);
    const deltas: [number, number][] = [];
    for (let i = 2; i < pts.length; i += 2)
      deltas.push([(pts[i]! - pts[i - 2]!) * s, (pts[i + 1]! - pts[i - 1]!) * s]);
    doc.lines(deltas, x0, y0, [1, 1], fill ? 'FD' : 'S', closed);
  };
  for (const sh of symbol.shapes) {
    if (sh.k === 'circle') {
      const [cx, cy] = P(sh.cx, sh.cy);
      doc.circle(cx, cy, sh.r * s, sh.fill ? 'FD' : 'S');
    } else if (sh.k === 'line') path(sh.pts, false);
    else if (sh.k === 'poly') path(sh.pts, true, sh.fill);
    else if (sh.k === 'arc') {
      const pts: number[] = [];
      for (let a = sh.start; a <= sh.end + 0.01; a += 10)
        pts.push(
          sh.cx + sh.r * Math.cos((a * Math.PI) / 180),
          sh.cy + sh.r * Math.sin((a * Math.PI) / 180),
        );
      path(pts, false);
    } else {
      const [tx, ty] = P(sh.x, sh.y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(sh.size * s * 2.835);
      doc.text(sh.text, tx, ty, { align: 'center', baseline: 'middle' });
    }
  }
}
