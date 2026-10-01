import { useEffect, useState } from 'react';
import {
  CATEGORIES,
  hexColorSchema,
  resolveCategoryStyle,
  type BadgeStyle,
  type CategoryId,
  type CategoryStyleOverride,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import {
  Button,
  ColorSwatch,
  Input,
  NumberField,
  SegmentedControl,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { useActions, useSettings } from '@/lib/data/hooks';

const PRESETS = [
  { label: 'XS', size: 12 },
  { label: 'S', size: 16 },
  { label: 'M', size: 20 },
  { label: 'L', size: 26 },
  { label: 'XL', size: 34 },
] as const;

function HexInput({
  value,
  label,
  onCommit,
}: {
  value: string;
  label: string;
  onCommit: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim().toUpperCase();
    if (hexColorSchema.safeParse(v).success) onCommit(v);
    else setText(value);
  };
  return (
    <Input
      compact
      aria-label={label}
      className="w-[92px] uppercase"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

export function IconStylesSection() {
  const { data: settings } = useSettings();
  const actions = useActions();
  const patch = (id: CategoryId, p: CategoryStyleOverride) =>
    actions.updateSettings((s) => {
      s.categoryStyles[id] = { ...s.categoryStyles[id], ...p };
    });
  const reset = (id: CategoryId) =>
    actions.updateSettings((s) => {
      delete s.categoryStyles[id];
    });

  return (
    <div>
      <p className="mb-4 max-w-[72ch] text-body text-ink-2">
        Applies to every project and every export. Shapes and category order are fixed. Sizes are
        relative to the drawing, so icons scale with the plan on screen and on paper.
      </p>
      <Table>
        <thead className="border-b border-rule-2">
          <tr>
            <Th className="w-14">Preview</Th>
            <Th>Category</Th>
            <Th>Colour</Th>
            <Th>Badge</Th>
            <Th>Badge style</Th>
            <Th>Size</Th>
            <Th className="w-16">
              <span className="sr-only">Reset</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((c) => {
            const style = resolveCategoryStyle(c.id, settings);
            const overridden = settings.categoryStyles[c.id] !== undefined;
            return (
              <tr key={c.id} aria-label={c.name} className="border-b border-rule">
                <Td>
                  <span className="flex size-12 items-center justify-center">
                    <CategoryGlyph
                      categoryId={c.id}
                      style={style}
                      size={Math.round(style.size * 1.3)}
                    />
                  </span>
                </Td>
                <Td>
                  <span className="text-control text-ink">{c.name}</span>
                  <span className="block text-meta text-ink-3">
                    {c.planType === 'smart-home' ? 'Smart Home' : 'Lighting'}
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-2">
                    <label className="relative">
                      <span className="sr-only">Pick {c.name} colour</span>
                      <ColorSwatch color={style.color} size={22} />
                      <input
                        type="color"
                        value={style.color}
                        onChange={(e) => patch(c.id, { color: e.target.value.toUpperCase() })}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                    <HexInput
                      value={style.color}
                      label={`${c.name} colour`}
                      onCommit={(color) => patch(c.id, { color })}
                    />
                  </span>
                </Td>
                <Td>
                  <Input
                    compact
                    aria-label={`${c.name} badge`}
                    className="w-16 uppercase"
                    maxLength={3}
                    value={style.badge}
                    onChange={(e) =>
                      e.target.value.trim() &&
                      patch(c.id, { badge: e.target.value.trim().toUpperCase() })
                    }
                  />
                </Td>
                <Td>
                  <SegmentedControl<BadgeStyle>
                    size="sm"
                    label={`${c.name} badge style`}
                    value={style.badgeStyle}
                    onChange={(badgeStyle) => patch(c.id, { badgeStyle })}
                    options={[
                      { value: 'filled', label: 'Filled' },
                      { value: 'outline', label: 'Outline' },
                    ]}
                  />
                </Td>
                <Td>
                  <span className="flex items-center gap-2">
                    <SegmentedControl<string>
                      size="sm"
                      label={`${c.name} size preset`}
                      value={String(PRESETS.find((p) => p.size === style.size)?.size ?? '')}
                      onChange={(v) => patch(c.id, { size: Number(v) })}
                      options={PRESETS.map((p) => ({ value: String(p.size), label: p.label }))}
                    />
                    <NumberField
                      compact
                      aria-label={`${c.name} size`}
                      className="w-16"
                      value={style.size}
                      min={6}
                      max={80}
                      onChange={(v) => v !== null && patch(c.id, { size: v })}
                    />
                  </span>
                </Td>
                <Td>
                  {overridden && (
                    <Button size="sm" variant="ghost" onClick={() => reset(c.id)}>
                      Reset
                    </Button>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
