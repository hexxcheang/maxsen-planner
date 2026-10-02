/**
 * Draws a domain `Scene` onto a 2D canvas for exports. It mirrors the Konva editor layer (same
 * scene, same geometry) so the PDF shows what the planner showed.
 */
import {
  badgePlacement,
  badgeTextColor,
  iconPath,
  isPathShape,
  type CategoryStyle,
  type Scene,
} from '@maxsen/domain';
import { loadImage } from '@/lib/images';

const FONT = 'Helvetica, Arial, sans-serif';
const INK = '#1F1D1A';

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  opts: { bold?: boolean; color?: string; align?: CanvasTextAlign; bg?: string; pad?: number } = {},
) {
  ctx.font = `${opts.bold ? '600 ' : ''}${size}px ${FONT}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'top';
  const lines = text.split('\n');
  if (opts.bg) {
    const pad = opts.pad ?? size * 0.25;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const left = opts.align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = opts.bg;
    ctx.fillRect(left - pad, y - pad, w + pad * 2, lines.length * size * 1.2 + pad * 2);
  }
  ctx.fillStyle = opts.color ?? INK;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.2));
}

/** Renders the plan (background + scene) at `pxWidth` pixels wide and returns a JPEG data URL. */
export async function renderPlanImage(
  scene: Scene,
  backgroundUrl: string,
  pxWidth = 2400,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const k = pxWidth / scene.width;
  const canvas = document.createElement('canvas');
  canvas.width = pxWidth;
  canvas.height = Math.round(scene.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    ctx.drawImage(await loadImage(backgroundUrl), 0, 0, canvas.width, canvas.height);
  } catch {
    // A missing background still exports the markings on white.
  }

  for (const item of scene.items) {
    if (item.type === 'marker') {
      ctx.save();
      ctx.translate(item.x * k, item.y * k);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.save();
      ctx.scale(item.size * k, item.size * k);
      const shape = new Path2D(item.pathD);
      const filled = item.badgeStyle === 'filled';
      ctx.fillStyle = filled ? item.color : '#FFFFFF';
      ctx.fill(shape, 'evenodd');
      if (!filled) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 0.08;
        ctx.stroke(shape);
      }
      ctx.restore();
      if (item.badge.text) {
        ctx.font = `600 ${item.badge.fontSize * k}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.badge.color;
        ctx.fillText(item.badge.text, item.badge.dx * k, item.badge.dy * k);
      }
      ctx.restore();
      if (item.label)
        drawText(
          ctx,
          item.label.text,
          item.label.x * k,
          item.label.y * k,
          item.label.fontSize * k,
          { align: 'center' },
        );
    } else if (item.type === 'path') {
      ctx.save();
      ctx.scale(k, k);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = item.kind === 'track' && item.shape !== 'magnetic' ? 'square' : 'round';
      ctx.globalAlpha = item.kind === 'led-strip' ? 0.9 : 1;
      if (item.dash) ctx.setLineDash(item.dash);
      ctx.stroke(new Path2D(item.d));
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      for (const h of item.heads) {
        ctx.fillStyle = item.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = h.size * 0.12;
        if (item.shape === 'magnetic') {
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate((h.angle * Math.PI) / 180);
          ctx.fillRect(-h.size / 2, -h.size / 2, h.size, h.size);
          ctx.strokeRect(-h.size / 2, -h.size / 2, h.size, h.size);
          ctx.restore();
        }
      }
      ctx.restore();
      if (item.label) {
        drawText(
          ctx,
          item.label.text,
          item.label.x * k,
          (item.label.y - item.label.fontSize * 0.6) * k,
          item.label.fontSize * k,
          {
            align: 'center',
            bg: 'rgba(255,255,255,0.88)',
            // Curtain names take the curtain's colour, so they read with the dotted line.
            ...(item.kind === 'curtain' ? { color: item.color, bold: true } : {}),
          },
        );
      }
    } else {
      drawText(ctx, item.text, item.x * k, item.y * k, item.fontSize * k, {
        bold: item.bold,
        color: item.color,
        bg: item.highlight ?? undefined,
        pad: item.highlight ? item.fontSize * 0.3 * k : 0,
      });
    }
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

/** A small PNG of a category's glyph, for PDF legends. */
export function glyphImage(style: CategoryStyle, px = 64): string {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(px / 2, px / 2);
  if (isPathShape(style.shape)) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = px * (style.shape === 'strip' ? 0.16 : 0.1);
    ctx.lineCap = style.shape === 'track' ? 'square' : 'round';
    // Curtains are a dotted line.
    if (style.shape === 'curtain') ctx.setLineDash([0.001, px * 0.19]);
    ctx.beginPath();
    ctx.moveTo(-px * 0.42, 0);
    ctx.lineTo(px * 0.42, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    if (style.shape !== 'strip' && style.shape !== 'curtain') {
      ctx.fillStyle = style.color;
      for (const x of [-0.19, 0.19]) {
        if (style.shape === 'magnetic') {
          ctx.beginPath();
          ctx.arc(x * px, 0, px * 0.1, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(x * px - px * 0.09, -px * 0.09, px * 0.18, px * 0.18);
      }
    }
    return canvas.toDataURL('image/png');
  }
  const s = px * 0.9;
  ctx.save();
  ctx.scale(s, s);
  const shape = new Path2D(iconPath(style.shape));
  const filled = style.badgeStyle === 'filled';
  ctx.fillStyle = filled ? style.color : '#FFFFFF';
  ctx.fill(shape, 'evenodd');
  if (!filled) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 0.08;
    ctx.stroke(shape);
  }
  ctx.restore();
  const p = badgePlacement(style.shape);
  ctx.font = `600 ${s * 0.42 * p.scale * (style.badge.length > 2 ? 0.78 : 1)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = filled ? badgeTextColor(style.color) : style.color;
  ctx.fillText(style.badge, p.x * s, p.y * s);
  return canvas.toDataURL('image/png');
}
