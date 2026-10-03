/**
 * Reads a client's text message ("Hi, need 12 switches, 3 of them 2 gang, 15 downlights warm white,
 * 2 motorised curtains and 20m LED strip") into catalogue lines for a quotation. Each phrase is
 * matched by product name first ("Lusano", "Nova S8"), then by everyday words for the category
 * ("downlights", "cctv", "aircon"), and the variant by its details ("2 gang", "black", "3000K",
 * "warm white", "double"). Quantities and LED metres are read off the phrase. Anything with a
 * number that names no product is handed back as unread, so nothing is silently dropped.
 */
import { SYSTEM_VARIANT_IDS, type CategoryId } from '../categories.ts';

export interface QuoteCatalogue {
  products: {
    id: string;
    categoryId: CategoryId;
    name: string;
    hidden?: boolean;
    system?: boolean;
  }[];
  variants: { id: string; productId: string; name: string; hidden?: boolean }[];
}

export interface QuoteLine {
  variantId: string;
  quantity: number;
  unit: 'pcs' | 'm';
  /** The words in the message it came from. */
  source: string;
}

export interface ParsedQuote {
  lines: QuoteLine[];
  /** Phrases with a number that matched no product: likely items to add by hand. */
  unread: string[];
}

/** Everyday words for each category, most specific first (a curtain track isn't a track light). */
const CATEGORY_WORDS: [CategoryId | 'driver', RegExp][] = [
  ['driver', /\bdrivers?\b|\btransformers?\b/],
  ['curtains-blinds', /curtain|blind|\broller|motori[sz]ed/],
  ['magnetic-track-lights', /magnetic/],
  ['led-strips', /\bled\b|strip|\bcove\b|\bcob\b|profile light/],
  ['track-lights', /\btracks?\b|track ?lights?/],
  ['downlights', /down ?lights?|\bdls?\b|recessed/],
  ['surface-lights', /surface|ceiling lights?/],
  ['pendant-lights', /pendant|chandelier/],
  ['spotlights', /spot ?lights?|\bspots?\b/],
  ['ceiling-fans', /\bfans?\b/],
  ['control-panels', /panels?\b|screens?\b|touch ?pad|tablet|\bnova s\d/],
  ['aircon-controllers', /air ?cons?\b|aircon|\bac\b|\bir\b|blaster/],
  ['gateways', /gateways?|\bhubs?\b|zigbee/],
  ['sensors', /sensors?|motion|\bpir\b/],
  ['cameras', /camera|cctv|\bcams?\b/],
  ['network-devices', /router|wi-?fi|\bmesh\b|access points?/],
  ['smart-locks', /\blocks?\b|digital lock/],
  ['misc-lighting', /dimmer/],
  ['misc-smart-home', /\bplugs?\b|socket|doorbell/],
  ['smart-switches', /switch|\bgangs?\b|\b[1-6] ?g\b/],
];

/** Words in product names too generic to pick a product by. */
const GENERIC = new Set([
  'smart',
  'light',
  'lights',
  'series',
  'standard',
  'with',
  'and',
  'the',
  'track',
  'strip',
  'motor',
  'sensor',
  'controller',
  'node',
  'module',
  'panel',
  'ceiling',
  'downlight',
  'surface',
  'camera',
  'lock',
  'router',
]);

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  single: 1,
  double: 2,
  triple: 3,
};

const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Splits a message into phrases, one item each. */
export function splitPhrases(text: string): string[] {
  return (
    text
      .split(/\n|[;,•]|\s+(?:and|&|plus|also|then)\s+|(?<!\b\d+)\.\s+/i)
      // Without list bullets ("- ", "• ", "1. ", "2) ").
      .map((s) => s.replace(/^\s*(?:[-*–]+|\d+[.)])\s+/, '').trim())
      .filter((s) => s.length > 0)
  );
}

/** The details a phrase gives about the variant, as words to match against variant names. */
function variantHints(p: string): string[] {
  const hints: string[] = [];
  const gang =
    /\b([1-6])\s*-?\s*(?:gang|g)\b/.exec(p) ?? /\b(single|double|triple)\s*-?\s*gang/.exec(p);
  if (gang) hints.push(`${NUMBER_WORDS[gang[1]!] ?? gang[1]}-gang`);
  const cct = /\b(2700|3000|4000|5000|6000|6500)\s*k\b/.exec(p);
  if (cct) hints.push(`${cct[1]}k`);
  if (/warm/.test(p)) hints.push('3000k');
  if (/cool|neutral|natural white|day ?light/.test(p)) hints.push('4000k');
  const inches = /\b(46|52)\s*(?:"|in(?:ch(?:es)?)?\b|”)/.exec(p);
  if (inches) hints.push(`${inches[1]}"`);
  for (const w of ['black', 'white', 'champagne', 'round', 'square', 'pro', 'double', 'single'])
    if (new RegExp(`\\b${w}\\b`).test(p)) hints.push(w);
  return hints;
}

/** How many, and in metres when it's a length: numbers that are sizes or ratings don't count. */
function quantityOf(p: string): { quantity: number; metres: number | null } {
  const metres = /(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?|mtrs?)\b/.exec(p);
  // Take out what isn't a count: gangs, colour temperatures, inches, metres, model numbers.
  const rest = p
    .replace(/\b[1-6]\s*-?\s*(?:gang|g)\b/g, ' ')
    .replace(/\b\d{4}\s*k\b/g, ' ')
    .replace(/\b\d+\s*(?:"|”|in(?:ch(?:es)?)?\b)/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?|mtrs?)\b/g, ' ')
    .replace(/\b(?:s|wi-?fi\s*)\d+\b/g, ' ')
    .replace(/\b\d+\s*-?\s*(?:room|rm|bedroom|br)s?\b/g, ' ');
  const n =
    /\b(?:x|qty:?|quantity:?)\s*(\d+)\b/.exec(rest) ??
    /\b(\d+)\s*(?:x|pcs?|pieces?|units?|nos?|sets?|qty)\b/.exec(rest) ??
    /\b(\d+)\b/.exec(rest);
  if (n) return { quantity: Number(n[1]), metres: metres ? Number(metres[1]) : null };
  const word =
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|an?)\b/.exec(
      rest,
    );
  return {
    quantity: word ? NUMBER_WORDS[word[1]!]! : 1,
    metres: metres ? Number(metres[1]) : null,
  };
}

export function parseQuoteMessage(
  text: string,
  catalogue: QuoteCatalogue,
  opts: { preferred?: string[] } = {},
): ParsedQuote {
  const products = catalogue.products.filter((p) => !p.hidden);
  const variantsOf = (productId: string) =>
    catalogue.variants.filter((v) => v.productId === productId && !v.hidden);
  const preferred = opts.preferred ?? [];
  const lines: QuoteLine[] = [];
  const unread: string[] = [];

  for (const source of splitPhrases(text)) {
    const p = source.toLowerCase();
    const words = new Set(tokens(p));

    // The product: by its own name first, then by the category's everyday words.
    let product: (typeof products)[number] | undefined;
    let best = 0;
    for (const pr of products) {
      if (pr.system) continue;
      const nameWords = tokens(pr.name).filter((w) => w.length >= 2 && !GENERIC.has(w));
      const hits = nameWords.filter((w) => words.has(w)).length;
      // "Nova S8" needs both words; a lone shared brand word ("Nova") is weaker.
      const score = hits === 0 ? 0 : hits / nameWords.length + hits;
      if (score > best) {
        best = score;
        product = pr;
      }
    }
    const category = CATEGORY_WORDS.find(([, re]) => re.test(p))?.[0];
    if (category === 'driver') {
      const id = /track/.test(p)
        ? SYSTEM_VARIANT_IDS.trackDriver
        : SYSTEM_VARIANT_IDS.smartLedDriver;
      if (catalogue.variants.some((v) => v.id === id)) {
        lines.push({ variantId: id, quantity: quantityOf(p).quantity, unit: 'pcs', source });
        continue;
      }
    }
    // A product name that disagrees with the category words ("Luna" in "Luna track") yields to the
    // product of that brand in the named category.
    if (product && category && category !== 'driver' && product.categoryId !== category) {
      product =
        products.find(
          (pr) =>
            pr.categoryId === category &&
            tokens(pr.name).some((w) => !GENERIC.has(w) && words.has(w)),
        ) ?? undefined;
    }
    if (!product && category && category !== 'driver') {
      const inCategory = products.filter((pr) => pr.categoryId === category && !pr.system);
      // A favourite of that category if there is one, else its first product.
      product =
        inCategory.find((pr) => variantsOf(pr.id).some((v) => preferred.includes(v.id))) ??
        inCategory[0];
    }
    if (!product) {
      const smallTalk = /\b(room|hdb|condo|flat|bto|resale|landed|bedroom|budget|sqft|sqm)\b/.test(
        p,
      );
      if (/\d/.test(p) && !smallTalk) unread.push(source);
      continue;
    }

    // The variant: the one whose name has most of the details given, else a favourite, else the
    // first.
    const variants = variantsOf(product.id);
    if (variants.length === 0) continue;
    const hints = variantHints(p);
    const scored = variants.map((v) => {
      const name = v.name.toLowerCase().replace(/\s+/g, '');
      return { v, score: hints.filter((h) => name.includes(h.replace(/\s+/g, ''))).length };
    });
    const top = Math.max(...scored.map((s) => s.score));
    const pick =
      top > 0
        ? scored.find((s) => s.score === top)!.v
        : (variants.find((v) => preferred.includes(v.id)) ?? variants[0]!);

    const { quantity, metres } = quantityOf(p);
    const isStrip = product.categoryId === 'led-strips';
    lines.push({
      variantId: pick.id,
      quantity: isStrip ? (metres ?? quantity) : quantity,
      unit: isStrip ? 'm' : 'pcs',
      source,
    });
  }

  // The same item asked for twice is one line.
  const merged: QuoteLine[] = [];
  for (const l of lines) {
    const same = merged.find((m) => m.variantId === l.variantId);
    if (same) {
      same.quantity = Math.round((same.quantity + l.quantity) * 10) / 10;
      same.source = `${same.source}; ${l.source}`;
    } else merged.push({ ...l });
  }
  return { lines: merged, unread };
}

/**
 * LED strips need drivers: one per `metresPerDriver` of strip (the LED package's ratio), unless the
 * message already asked for them.
 */
export function withLedDrivers(lines: QuoteLine[], metresPerDriver: number): QuoteLine[] {
  const metres = lines.filter((l) => l.unit === 'm').reduce((s, l) => s + l.quantity, 0);
  if (metres <= 0 || lines.some((l) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver))
    return lines;
  return [
    ...lines,
    {
      variantId: SYSTEM_VARIANT_IDS.smartLedDriver,
      quantity: Math.max(1, Math.ceil(metres / metresPerDriver)),
      unit: 'pcs',
      source: `${metres} m of LED strip`,
    },
  ];
}
