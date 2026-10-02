/**
 * Generates the sample floor-plan drawings, product art and logo used by the Phase A prototype.
 * Run with: tsx apps/web/scripts/generate-sample-drawings.ts
 * Output: apps/web/public/sample/*.svg (committed; regenerate when the data below changes).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  condo2bed,
  hdb4room,
  landedAttic,
  landedL1,
  landedL2,
  type Door,
  type Drawing,
  type Furniture,
  type Room,
  type Win,
} from '../../../packages/domain/src/sample/drawings.ts';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/sample');

const WALL = 8;
const INK = '#1a1a1a';
const GREY = '#8a8a8a';
const LIGHT = '#c9c9c9';

const roomSvg = (r: Room): string => {
  const cx = r.lx ?? r.x + r.w / 2;
  const cy = r.ly ?? r.y + r.h / 2;
  const sub = r.sub
    ? `<text x="${cx}" y="${cy + 24}" font-size="18" fill="#a0a0a0" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${r.sub}</text>`
    : '';
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${INK}" stroke-width="${WALL}" stroke-linejoin="miter"/>
<text x="${cx}" y="${cy + (r.sub ? 0 : 8)}" font-size="26" fill="${GREY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" letter-spacing="1">${r.label}</text>${sub}`;
};

const doorSvg = (d: Door): string => {
  const endX = d.x + d.ax * d.size;
  const endY = d.y + d.ay * d.size;
  const tipX = d.x + d.px * d.size;
  const tipY = d.y + d.py * d.size;
  // white gap in the wall
  const gapW = Math.abs(d.ax) * d.size + Math.abs(d.px) * (WALL + 4);
  const gapH = Math.abs(d.ay) * d.size + Math.abs(d.py) * (WALL + 4);
  const gapX = Math.min(d.x, endX) - (d.ax === 0 ? (WALL + 4) / 2 : 0);
  const gapY = Math.min(d.y, endY) - (d.ay === 0 ? (WALL + 4) / 2 : 0);
  // quarter-circle swing as a polyline
  const pts: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * (Math.PI / 2);
    const x = d.x + (d.ax * Math.cos(t) + d.px * Math.sin(t)) * d.size;
    const y = d.y + (d.ay * Math.cos(t) + d.py * Math.sin(t)) * d.size;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `<rect x="${gapX}" y="${gapY}" width="${gapW}" height="${gapH}" fill="#fff"/>
<line x1="${d.x}" y1="${d.y}" x2="${tipX}" y2="${tipY}" stroke="${GREY}" stroke-width="3"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="${GREY}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
};

const windowSvg = (w: Win): string => {
  const horizontal = w.y1 === w.y2;
  const o = 3;
  const cover = horizontal
    ? `<rect x="${Math.min(w.x1, w.x2)}" y="${w.y1 - WALL / 2 - 1}" width="${Math.abs(w.x2 - w.x1)}" height="${WALL + 2}" fill="#fff"/>`
    : `<rect x="${w.x1 - WALL / 2 - 1}" y="${Math.min(w.y1, w.y2)}" width="${WALL + 2}" height="${Math.abs(w.y2 - w.y1)}" fill="#fff"/>`;
  const l1 = horizontal
    ? `<line x1="${w.x1}" y1="${w.y1 - o}" x2="${w.x2}" y2="${w.y2 - o}" stroke="${INK}" stroke-width="2"/><line x1="${w.x1}" y1="${w.y1 + o}" x2="${w.x2}" y2="${w.y2 + o}" stroke="${INK}" stroke-width="2"/>`
    : `<line x1="${w.x1 - o}" y1="${w.y1}" x2="${w.x2 - o}" y2="${w.y2}" stroke="${INK}" stroke-width="2"/><line x1="${w.x1 + o}" y1="${w.y1}" x2="${w.x2 + o}" y2="${w.y2}" stroke="${INK}" stroke-width="2"/>`;
  return cover + l1;
};

const furnitureSvg = (f: Furniture): string =>
  `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r ?? 2}" fill="none" stroke="${LIGHT}" stroke-width="2"/>`;

const titleBlock = (d: Drawing): string => `
<g font-family="Helvetica, Arial, sans-serif">
<rect x="960" y="918" width="340" height="66" fill="none" stroke="${INK}" stroke-width="2"/>
<line x1="960" y1="950" x2="1300" y2="950" stroke="${INK}" stroke-width="1"/>
<text x="972" y="940" font-size="15" fill="${INK}" font-weight="700">${d.title}</text>
<text x="972" y="972" font-size="12" fill="${GREY}">SAMPLE DRAWING — NOT TO SCALE</text>
<text x="1288" y="972" font-size="12" fill="${GREY}" text-anchor="end">${d.sheet}</text>
</g>
<g transform="translate(1250 60)" stroke="${INK}" fill="none" stroke-width="2">
<circle r="22"/><path d="M0 -18 L8 10 L0 4 L-8 10 Z" fill="${INK}" stroke="none"/>
<text y="-30" font-size="12" text-anchor="middle" fill="${INK}" stroke="none" font-family="Helvetica, Arial, sans-serif">N</text>
</g>`;

const render = (
  d: Drawing,
): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1000" width="1400" height="1000">
<rect width="1400" height="1000" fill="#ffffff"/>
${(d.furniture ?? []).map(furnitureSvg).join('\n')}
${d.rooms.map(roomSvg).join('\n')}
${d.windows.map(windowSvg).join('\n')}
${d.doors.map(doorSvg).join('\n')}
${titleBlock(d)}
</svg>
`;

// --- drawings ---------------------------------------------------------------------------------

// --- product art ------------------------------------------------------------------------------

const BRASS = '#A8873A';
const CHAR = '#2B2824';
const IVORY = '#F6F5F2';

const art = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"><rect width="240" height="240" fill="${IVORY}"/>${body}</svg>\n`;

const switchPlate = (gangs: number, tone = CHAR): string => {
  const rockers: string[] = [];
  const w = 120 / gangs;
  for (let i = 0; i < gangs; i++) {
    rockers.push(
      `<rect x="${60 + i * w + 8}" y="78" width="${w - 16}" height="84" rx="6" fill="${IVORY}" opacity="0.92"/><circle cx="${60 + i * w + w / 2}" cy="140" r="4" fill="${BRASS}"/>`,
    );
  }
  return art(
    `<rect x="48" y="62" width="144" height="116" rx="10" fill="${tone}"/>${rockers.join('')}`,
  );
};

const products: Record<string, string> = {
  'product-switch-1gang.svg': switchPlate(1),
  'product-switch-2gang.svg': switchPlate(2),
  'product-switch-3gang.svg': switchPlate(3),
  'product-switch-4gang.svg': switchPlate(4),
  'product-switch-prestige.svg': switchPlate(2, BRASS),
  'product-panel.svg': art(
    `<rect x="36" y="64" width="168" height="112" rx="12" fill="${CHAR}"/><rect x="48" y="76" width="144" height="88" rx="6" fill="#3a3632"/><rect x="60" y="92" width="52" height="28" rx="4" fill="${BRASS}"/><rect x="128" y="92" width="52" height="28" rx="4" fill="#5a554f"/><rect x="60" y="128" width="120" height="20" rx="4" fill="#5a554f"/>`,
  ),
  'product-curtain.svg': art(
    `<rect x="30" y="60" width="180" height="10" rx="5" fill="${CHAR}"/><path d="M50 70 q10 60 0 110 M80 70 q10 60 0 110 M110 70 q10 60 0 110 M140 70 q10 60 0 110 M170 70 q10 60 0 110" stroke="${BRASS}" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="186" y="58" width="24" height="14" rx="4" fill="${BRASS}"/>`,
  ),
  'product-aircon.svg': art(
    `<rect x="52" y="70" width="136" height="100" rx="14" fill="${CHAR}"/><rect x="68" y="86" width="104" height="36" rx="6" fill="#3a3632"/><text x="120" y="112" font-size="22" fill="${BRASS}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700">24°</text><rect x="68" y="134" width="30" height="18" rx="4" fill="${BRASS}"/><rect x="106" y="134" width="30" height="18" rx="4" fill="#5a554f"/><rect x="144" y="134" width="28" height="18" rx="4" fill="#5a554f"/>`,
  ),
  'product-gateway.svg': art(
    `<rect x="52" y="90" width="136" height="70" rx="12" fill="${CHAR}"/><circle cx="80" cy="125" r="6" fill="${BRASS}"/><circle cx="100" cy="125" r="6" fill="#5a554f"/><path d="M120 70 a40 40 0 0 1 56 0 M132 82 a24 24 0 0 1 32 0" stroke="${BRASS}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  ),
  'product-sensor.svg': art(
    `<circle cx="120" cy="120" r="56" fill="${CHAR}"/><circle cx="120" cy="120" r="34" fill="none" stroke="${BRASS}" stroke-width="6"/><circle cx="120" cy="120" r="12" fill="${BRASS}"/>`,
  ),
  'product-camera.svg': art(
    `<path d="M60 130 a60 60 0 0 1 120 0 Z" fill="${CHAR}"/><rect x="50" y="130" width="140" height="18" rx="6" fill="${CHAR}"/><circle cx="120" cy="104" r="18" fill="${BRASS}"/><circle cx="120" cy="104" r="7" fill="${CHAR}"/>`,
  ),
  'product-router.svg': art(
    `<rect x="48" y="110" width="144" height="56" rx="10" fill="${CHAR}"/><rect x="70" y="60" width="8" height="50" rx="4" fill="${CHAR}"/><rect x="162" y="60" width="8" height="50" rx="4" fill="${CHAR}"/><circle cx="76" cy="138" r="5" fill="${BRASS}"/><circle cx="96" cy="138" r="5" fill="${BRASS}"/><circle cx="116" cy="138" r="5" fill="#5a554f"/>`,
  ),
  'product-lock.svg': art(
    `<rect x="72" y="52" width="96" height="136" rx="18" fill="${CHAR}"/><circle cx="120" cy="100" r="22" fill="none" stroke="${BRASS}" stroke-width="6"/><rect x="104" y="138" width="32" height="10" rx="5" fill="${BRASS}"/><rect x="104" y="156" width="32" height="10" rx="5" fill="#5a554f"/>`,
  ),
  'product-downlight.svg': art(
    `<circle cx="120" cy="120" r="64" fill="${CHAR}"/><circle cx="120" cy="120" r="44" fill="${IVORY}"/><circle cx="120" cy="120" r="30" fill="${BRASS}" opacity="0.9"/>`,
  ),
  'product-surface.svg': art(
    `<rect x="56" y="56" width="128" height="128" rx="24" fill="${CHAR}"/><rect x="76" y="76" width="88" height="88" rx="16" fill="${IVORY}"/><rect x="92" y="92" width="56" height="56" rx="10" fill="${BRASS}" opacity="0.9"/>`,
  ),
  'product-track.svg': art(
    `<rect x="30" y="112" width="180" height="16" rx="4" fill="${CHAR}"/><g fill="${CHAR}"><rect x="56" y="128" width="26" height="40" rx="6"/><rect x="107" y="128" width="26" height="40" rx="6"/><rect x="158" y="128" width="26" height="40" rx="6"/></g><g fill="${BRASS}"><rect x="60" y="164" width="18" height="6" rx="3"/><rect x="111" y="164" width="18" height="6" rx="3"/><rect x="162" y="164" width="18" height="6" rx="3"/></g>`,
  ),
  'product-magnetic.svg': art(
    `<rect x="30" y="112" width="180" height="16" rx="2" fill="${CHAR}"/><g fill="${CHAR}"><circle cx="70" cy="146" r="16"/><circle cx="120" cy="146" r="16"/><circle cx="170" cy="146" r="16"/></g><g fill="${BRASS}"><circle cx="70" cy="146" r="6"/><circle cx="120" cy="146" r="6"/><circle cx="170" cy="146" r="6"/></g>`,
  ),
  'product-strip.svg': art(
    `<path d="M40 150 H200 M40 150 V90 H120" stroke="${CHAR}" stroke-width="18" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M40 150 H200 M40 150 V90 H120" stroke="${BRASS}" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="2 12"/>`,
  ),
  'product-pendant.svg': art(
    `<line x1="120" y1="40" x2="120" y2="110" stroke="${CHAR}" stroke-width="4"/><path d="M60 170 a60 60 0 0 1 120 0 Z" fill="${CHAR}"/><rect x="60" y="168" width="120" height="8" fill="${BRASS}"/>`,
  ),
  'product-spotlight.svg': art(
    `<rect x="100" y="40" width="40" height="30" rx="6" fill="${CHAR}"/><path d="M90 70 L150 70 L170 170 L70 170 Z" fill="${CHAR}"/><ellipse cx="120" cy="170" rx="50" ry="14" fill="${BRASS}"/>`,
  ),
  'product-driver.svg': art(
    `<rect x="40" y="90" width="160" height="60" rx="8" fill="${CHAR}"/><line x1="20" y1="120" x2="40" y2="120" stroke="${BRASS}" stroke-width="6"/><line x1="200" y1="120" x2="220" y2="120" stroke="${BRASS}" stroke-width="6"/><text x="120" y="126" font-size="16" fill="${IVORY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">DRIVER</text>`,
  ),
  'product-plug.svg': art(
    `<rect x="60" y="60" width="120" height="120" rx="20" fill="${CHAR}"/><rect x="92" y="92" width="14" height="36" rx="4" fill="${IVORY}"/><rect x="134" y="92" width="14" height="36" rx="4" fill="${IVORY}"/><rect x="108" y="140" width="24" height="14" rx="4" fill="${BRASS}"/>`,
  ),
  'product-dimmer.svg': art(
    `<rect x="48" y="62" width="144" height="116" rx="10" fill="${CHAR}"/><circle cx="120" cy="120" r="34" fill="${IVORY}"/><line x1="120" y1="120" x2="140" y2="100" stroke="${BRASS}" stroke-width="6" stroke-linecap="round"/>`,
  ),
};

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 96" width="360" height="96">
<text x="0" y="62" font-family="Instrument Sans, Helvetica, Arial, sans-serif" font-size="56" font-weight="700" letter-spacing="6" fill="${CHAR}">MAXSEN</text>
<rect x="2" y="74" width="236" height="2" fill="${BRASS}"/>
<text x="2" y="93" font-family="Instrument Sans, Helvetica, Arial, sans-serif" font-size="12" letter-spacing="3.2" fill="${BRASS}">SMART SOLUTIONS</text>
</svg>
`;

mkdirSync(path.join(OUT, 'product'), { recursive: true });
for (const d of [hdb4room, condo2bed, landedL1, landedL2, landedAttic]) {
  writeFileSync(path.join(OUT, d.file), render(d));
}
for (const [name, svg] of Object.entries(products)) {
  writeFileSync(path.join(OUT, 'product', name), svg);
}
writeFileSync(path.join(OUT, 'maxsen-logo.svg'), logo);
console.log(`wrote ${5 + Object.keys(products).length + 1} files to ${OUT}`);
