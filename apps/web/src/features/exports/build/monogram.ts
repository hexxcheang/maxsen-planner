/**
 * Maxsen's own monogram canvas: a tone-on-tone repeat of an M roundel, a little house mark and a
 * dotted diamond in brass on charcoal, the way luxury leather goods carry their monogram. It's the
 * proposal background until one is uploaded in Admin › Branding, and dresses the dark panels
 * inside the exports.
 */

const TILE = 150;

/** One tile: the roundel and the house on one diagonal, diamonds on the other. */
function tile(ink: string): string {
  const roundel = `<g transform="translate(37.5 37.5)" fill="none" stroke="${ink}" stroke-width="2.2">
    <circle r="23"/><circle r="18.5" stroke-width="0.9"/>
    <path d="M-10 10 V-9 L0 3 L10 -9 V10" stroke-linejoin="miter" stroke-width="2.6"/></g>`;
  const house = `<g transform="translate(112.5 112.5)" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M-17 2 L0 -15 L17 2"/><path d="M-11 -3 V15 H11 V-3"/>
    <circle cx="0" cy="5" r="3.2" fill="${ink}" stroke="none"/></g>`;
  const diamond = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><path d="M0 -10 L10 0 L0 10 L-10 0 Z" fill="none" stroke="${ink}" stroke-width="1.6"/>
    <circle r="2.4" fill="${ink}"/></g>`;
  return roundel + house + diamond(112.5, 37.5) + diamond(37.5, 112.5);
}

/** The monogram canvas as SVG, `width` × `height`. */
export function monogramSvg(
  width = 2400,
  height = 1700,
  colours = { ground: '#1B1A18', ink: '#C9A45C', opacity: 0.17 },
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><pattern id="m" width="${TILE}" height="${TILE}" patternUnits="userSpaceOnUse">${tile(colours.ink)}</pattern></defs>
<rect width="100%" height="100%" fill="${colours.ground}"/>
<rect width="100%" height="100%" fill="url(#m)" opacity="${colours.opacity}"/>
</svg>`;
}

export const monogramUrl = (): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogramSvg())}`;
