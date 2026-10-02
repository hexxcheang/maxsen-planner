import type { RoomType } from './analysis.ts';

/** Room labels as they appear on drawings, mapped to room types. Checked in order. */
const TYPE_BY_NAME: [RegExp, RoomType][] = [
  [/living\s*(\/|&|and)\s*dining|living\s*\+\s*dining/i, 'living-dining'],
  [/master|mbr\b|m\.\s*bed/i, 'master-bedroom'],
  [/\b(m\.?\s*)?bath|\bwc\b|toilet|powder|shower|ensuite|en-suite/i, 'bathroom'],
  [/family|entertainment|media|attic lounge/i, 'family'],
  [/living|lounge|hall\b/i, 'living'],
  [/dining/i, 'dining'],
  [/kitchen|pantry|kit\b/i, 'kitchen'],
  [/bed\s*room|\bbed\b|bedrm|\bbr\s*\d|guest room|maid|helper/i, 'bedroom'],
  [/study|office|library/i, 'study'],
  [/foyer|entrance|lobby/i, 'foyer'],
  [/corridor|passage|hallway|walkway|gallery/i, 'corridor'],
  [/stair/i, 'staircase'],
  [/balcony|ac ledge|planter/i, 'balcony'],
  [/terrace|garden|porch|patio|courtyard|roof/i, 'outdoor'],
  [/car\s*park|garage/i, 'garage'],
  [/service|yard|laundry|utility|wash/i, 'utility'],
  [/store|shelter|walk-in|wardrobe|closet|bunker|household/i, 'store'],
];

/** The room type a drawing label suggests, or undefined when the label doesn't say. */
export function roomTypeFromName(name: string): RoomType | undefined {
  return TYPE_BY_NAME.find(([re]) => re.test(name))?.[1];
}
