import {
  badgePlacement,
  badgeTextColor,
  iconPath,
  isPathShape,
  resolveCategoryStyle,
  sample,
  type CategoryId,
  type CategoryStyle,
} from '@maxsen/domain';

interface CategoryGlyphProps {
  categoryId: CategoryId;
  /** Rendered size in CSS pixels. */
  size?: number;
  /** Resolved style (from settings); defaults to the category's built-in style. */
  style?: CategoryStyle;
  /** Draw the badge text; on by default when the glyph is large enough to read it. */
  showBadge?: boolean;
  className?: string;
  /** Accessible name. Without it the glyph is decorative, as it always sits next to visible text. */
  title?: string;
}

/** A category's fixed icon shape, coloured and badged per the admin's icon styles. */
export function CategoryGlyph({
  categoryId,
  size = 24,
  style,
  showBadge,
  className,
  title,
}: CategoryGlyphProps) {
  const s = style ?? resolveCategoryStyle(categoryId, sample.DEFAULT_SETTINGS);
  const d = iconPath(s.shape);
  const badge = showBadge ?? size >= 22;
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };

  if (isPathShape(s.shape)) {
    // Paths (LED strips, tracks) are shown as a short sample stroke with their head style.
    const heads =
      s.shape === 'track' ? (
        <>
          <rect x={-0.28} y={-0.09} width={0.18} height={0.18} fill={s.color} />
          <rect x={0.1} y={-0.09} width={0.18} height={0.18} fill={s.color} />
        </>
      ) : s.shape === 'magnetic' ? (
        <>
          <circle cx={-0.19} cy={0} r={0.1} fill={s.color} />
          <circle cx={0.19} cy={0} r={0.1} fill={s.color} />
        </>
      ) : null;
    return (
      <svg {...a11y} viewBox="-0.5 -0.5 1 1" width={size} height={size} className={className}>
        <path
          d="M-0.44 0 H0.44"
          stroke={s.color}
          strokeWidth={s.shape === 'strip' ? 0.14 : 0.1}
          strokeLinecap={s.shape === 'track' ? 'square' : 'round'}
          // Curtains are a dotted line.
          {...(s.shape === 'curtain' ? { strokeDasharray: '0.001 0.19' } : {})}
          fill="none"
        />
        {heads}
      </svg>
    );
  }

  const filled = s.badgeStyle === 'filled';
  const p = badgePlacement(s.shape);
  const fontSize = 0.42 * p.scale * (s.badge.length > 2 ? 0.78 : 1);
  return (
    <svg {...a11y} viewBox="-0.55 -0.55 1.1 1.1" width={size} height={size} className={className}>
      <path
        d={d}
        fill={filled ? s.color : '#FFFFFF'}
        fillRule="evenodd"
        stroke={s.color}
        strokeWidth={filled ? 0 : 0.07}
        strokeLinejoin="round"
      />
      {badge && (
        <text
          x={p.x}
          y={p.y}
          dy="0.36em"
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={600}
          fontFamily="var(--font-sans)"
          fill={filled ? badgeTextColor(s.color) : s.color}
        >
          {s.badge}
        </text>
      )}
    </svg>
  );
}
