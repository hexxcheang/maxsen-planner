import type { ElectricalSymbol } from '@maxsen/domain';

/** Stroke width in the symbol's unit box (it spans -1 to 1). */
export const STROKE = 0.1;

/** Draws a symbol on a canvas, centred at x, y, with half-width `size`, turned `rotation` degrees. */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: ElectricalSymbol,
  x: number,
  y: number,
  size: number,
  rotation = 0,
  color = '#000',
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(size, size);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of symbol.shapes) {
    ctx.beginPath();
    if (s.k === 'circle') {
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      if (s.fill) ctx.fill();
      ctx.stroke();
    } else if (s.k === 'line' || s.k === 'poly') {
      for (let i = 0; i < s.pts.length; i += 2)
        if (i === 0) ctx.moveTo(s.pts[i]!, s.pts[i + 1]!);
        else ctx.lineTo(s.pts[i]!, s.pts[i + 1]!);
      if (s.k === 'poly') {
        ctx.closePath();
        if (s.fill) ctx.fill();
      }
      ctx.stroke();
    } else if (s.k === 'arc') {
      ctx.arc(s.cx, s.cy, s.r, (s.start * Math.PI) / 180, (s.end * Math.PI) / 180);
      ctx.stroke();
    } else {
      ctx.font = `bold ${s.size}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.text, s.x, s.y);
    }
  }
  ctx.restore();
}
