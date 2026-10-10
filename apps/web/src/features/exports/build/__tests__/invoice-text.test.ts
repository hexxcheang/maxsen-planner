import { describe, expect, it } from 'vitest';
import { descriptionText } from '../invoice';

const colours = (text: string, pkg: boolean, discount = false) =>
  descriptionText(text, pkg, discount).richText.map((r) => [r.text.trim(), r.font.color.argb]);

describe('invoice description colours', () => {
  it('highlights only the package name; discounts red, installation and warranty blue', () => {
    expect(
      colours(
        'Ark Core Package\n10 x Ark Series Smart Switches\nInstallation & Integration\n1 Year Warranty\nPackage Discounted to $1390 from $1690',
        true,
      ),
    ).toEqual([
      ['Ark Core Package', 'FFFFC000'],
      ['10 x Ark Series Smart Switches', 'FF000000'],
      ['Installation & Integration', 'FF0043C1'],
      ['1 Year Warranty', 'FF0043C1'],
      ['Package Discounted to $1390 from $1690', 'FFFF0000'],
    ]);
  });

  it('prints other lines in black, or red when they take money off', () => {
    expect(colours('Add-On Per Ark Series Smart Switch', false)).toEqual([
      ['Add-On Per Ark Series Smart Switch', 'FF000000'],
    ]);
    expect(colours('Integration Waived', false, true)).toEqual([
      ['Integration Waived', 'FFFF0000'],
    ]);
  });
});
