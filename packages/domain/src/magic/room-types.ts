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

/** How each room type is named in the app. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: 'Living room',
  dining: 'Dining room',
  'living-dining': 'Living / dining',
  family: 'Family area',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  'master-bedroom': 'Master bedroom',
  bathroom: 'Bathroom',
  study: 'Study',
  corridor: 'Corridor',
  foyer: 'Foyer',
  staircase: 'Staircase',
  balcony: 'Balcony',
  utility: 'Utility / yard',
  store: 'Store',
  garage: 'Garage / car porch',
  outdoor: 'Outdoor',
  other: 'Other',
};

/** Words that appear in room labels, for repairing misread text. */
const VOCABULARY = [
  'master',
  'bedroom',
  'bath',
  'bathroom',
  'kitchen',
  'dining',
  'living',
  'service',
  'yard',
  'shelter',
  'household',
  'foyer',
  'balcony',
  'study',
  'store',
  'stairs',
  'porch',
  'garden',
  'family',
  'area',
  'powder',
  'guest',
  'room',
  'walk-in',
  'lounge',
  'attic',
  'roof',
  'terrace',
  'toilet',
  'utility',
  'laundry',
  'corridor',
  'entrance',
  'lobby',
  'pantry',
  'dry',
  'wet',
  'car',
  'patio',
  'office',
  'library',
  'helper',
  'maid',
  'wardrobe',
  'closet',
  'shower',
  'ensuite',
  'hall',
  'hallway',
  'garage',
  'media',
  'gallery',
  'passage',
  'planter',
  'ledge',
  'open',
];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/**
 * Tidies a label read by OCR: drops stray punctuation and snaps near-misses to room words
 * ("aster Bedroo" → "Master Bedroom"). `changed` says whether any word had to be guessed.
 */
export function cleanLabel(text: string): { text: string; changed: boolean } {
  let changed = false;
  const words = text
    .replace(/[“”"'‘’`|_~]+/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (!/^[a-z-]{3,}$/.test(lower) || VOCABULARY.includes(lower)) return word;
      const limit = lower.length >= 7 ? 2 : 1;
      let best: string | null = null;
      let bestD = limit + 1;
      for (const v of VOCABULARY) {
        if (Math.abs(v.length - lower.length) > limit) continue;
        const d = distance(lower, v);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      if (!best) return word;
      changed = true;
      return best[0]!.toUpperCase() + best.slice(1);
    });
  // Labels are written in title or upper case; a lower-case first letter is a misread.
  const first = words[0];
  if (first && /^[a-z]/.test(first)) words[0] = first[0]!.toUpperCase() + first.slice(1);
  return { text: words.join(' '), changed };
}
