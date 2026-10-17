import type { ElectricalSymbol, SymbolShape } from '@maxsen/domain';

import { STROKE } from './symbol-canvas';

function arcPath(s: Extract<SymbolShape, { k: 'arc' }>) {
  const at = (deg: number) => [
    s.cx + s.r * Math.cos((deg * Math.PI) / 180),
    s.cy + s.r * Math.sin((deg * Math.PI) / 180),
  ];
  const [x0, y0] = at(s.start);
  const [x1, y1] = at(s.end);
  return `M${x0} ${y0} A${s.r} ${s.r} 0 ${s.end - s.start > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** A symbol's shapes as SVG, in its unit box; scale and place it with the parent's transform. */
export function SymbolShapes({
  symbol,
  color = 'currentColor',
}: {
  symbol: ElectricalSymbol;
  color?: string;
}) {
  return (
    <g stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {symbol.shapes.map((s, i) => {
        switch (s.k) {
          case 'circle':
            return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ? color : 'none'} />;
          case 'line':
            return <polyline key={i} points={s.pts.join(' ')} />;
          case 'poly':
            return <polygon key={i} points={s.pts.join(' ')} fill={s.fill ? color : 'none'} />;
          case 'arc':
            return <path key={i} d={arcPath(s)} />;
          case 'text':
            return (
              <text
                key={i}
                x={s.x}
                y={s.y}
                fontSize={s.size}
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                stroke="none"
                fill={color}
              >
                {s.text}
              </text>
            );
        }
      })}
    </g>
  );
}

/** A symbol as a small icon, for the palette and the legend. */
export function SymbolIcon({ symbol, size = 28 }: { symbol: ElectricalSymbol; size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="-1.5 -1.5 3 3"
      className="shrink-0 overflow-visible text-ink"
    >
      <SymbolShapes symbol={symbol} />
    </svg>
  );
}
