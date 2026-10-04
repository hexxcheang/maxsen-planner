/**
 * Product sample shots: the instructions an image model gets to place a photographed product into
 * a premium Singapore home, as it would be installed. Where it goes and how it's shown depends on
 * its category, so a switch is on the wall by the door and a downlight is recessed in the ceiling.
 */
import type { CategoryId } from '../categories.ts';

export const SHOT_ROOMS = [
  { id: 'living', label: 'Living room' },
  { id: 'master', label: 'Master bedroom' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining', label: 'Dining area' },
  { id: 'study', label: 'Study' },
  { id: 'foyer', label: 'Foyer / entrance' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'balcony', label: 'Balcony' },
] as const;
export type ShotRoom = (typeof SHOT_ROOMS)[number]['id'];

export const SHOT_STYLES = [
  {
    id: 'warm-luxury',
    label: 'Warm modern luxury',
    words:
      'warm modern luxury: travertine, walnut, brushed brass accents, champagne and ivory tones',
  },
  {
    id: 'japandi',
    label: 'Japandi',
    words: 'Japandi: light oak, limewash walls, linen, low furniture, calm and minimal',
  },
  {
    id: 'contemporary-dark',
    label: 'Contemporary dark',
    words:
      'contemporary dark: charcoal fluted panels, smoked glass, black metal, moody accent lighting',
  },
  {
    id: 'scandinavian',
    label: 'Scandinavian',
    words: 'Scandinavian: white walls, pale ash wood, soft wool textiles, airy and bright',
  },
  {
    id: 'classic',
    label: 'Classic elegance',
    words: 'classic elegance: wall panel mouldings, marble, cream upholstery, gold details',
  },
] as const;
export type ShotStyle = (typeof SHOT_STYLES)[number]['id'];

export const SHOT_LIGHT = [
  { id: 'day', label: 'Bright daylight', words: 'soft natural daylight from large windows' },
  { id: 'golden', label: 'Golden hour', words: 'warm late-afternoon golden-hour sunlight' },
  {
    id: 'evening',
    label: 'Evening, lights on',
    words: 'evening, with warm 3000K interior lighting switched on',
  },
] as const;
export type ShotLight = (typeof SHOT_LIGHT)[number]['id'];

/** How each category is installed and framed, so the model puts it where it belongs. */
const PLACEMENT: Record<CategoryId, string> = {
  'smart-switches':
    'mounted flush on the wall about 1.2 m from the floor, beside a doorway, as an installed light switch. Frame it as the hero with the room softly out of focus behind',
  'control-panels':
    'mounted on the wall at eye level near the room entrance, its screen lit, as a smart home control panel. Frame it as the hero with the room behind',
  'curtains-blinds':
    'installed across a full-height window: the track in a ceiling pelmet with flowing sheer and blackout curtains, motorised and neatly hung',
  'aircon-controllers':
    'placed discreetly on a console or shelf facing the air-conditioner, as a smart IR remote',
  gateways: 'placed neatly on a media console or shelf, as a smart home hub',
  sensors:
    'installed where such a sensor belongs (on the ceiling or high on the wall, or on a door frame for a contact sensor)',
  cameras:
    'installed where a home security camera belongs: high in a corner or on a shelf overlooking the room, or outside the main door',
  'network-devices': 'mounted on the ceiling or placed on a shelf, as a Wi-Fi access point',
  'smart-locks':
    'installed on a solid main entrance door, seen from the foyer side at handle height',
  'misc-smart-home': 'installed where it would naturally be used in the room',
  downlights:
    'recessed in a clean plaster ceiling as a set of downlights, switched on and casting soft pools of light; the product itself visible in close-up in the foreground',
  'surface-lights': 'mounted on the ceiling, switched on, lighting the room',
  'track-lights': 'on a ceiling track, spots angled at artwork and furniture, switched on',
  'led-strips':
    'concealed in a ceiling cove and under cabinets as indirect LED cove lighting, switched on with an even warm glow',
  'magnetic-track-lights':
    'on a slim recessed magnetic track in the ceiling, with linear and spot modules switched on',
  'pendant-lights': 'hanging over a dining table or kitchen island, switched on',
  'ceiling-fans':
    'installed on the ceiling at the centre of the room, blades still, light on if it has one',
  spotlights: 'recessed or surface-mounted in the ceiling, aimed at features, switched on',
  'misc-lighting': 'installed where it naturally belongs in the room, switched on',
};

export interface ShotOptions {
  categoryId: CategoryId;
  /** The catalogue product (and variant) photographed, when picked. */
  productName?: string;
  variantName?: string;
  room: ShotRoom;
  style: ShotStyle;
  light: ShotLight;
  /** Anything else to say (finish, wall colour, what to include). */
  notes?: string;
}

/** The instructions for the image model; the product photo goes with them. */
export function productShotPrompt(o: ShotOptions): string {
  const room = SHOT_ROOMS.find((r) => r.id === o.room)!.label.toLowerCase();
  const style = SHOT_STYLES.find((s) => s.id === o.style)!.words;
  const light = SHOT_LIGHT.find((l) => l.id === o.light)!.words;
  const what = [o.productName, o.variantName].filter(Boolean).join(', ');
  return [
    `Create a premium, photorealistic interior photograph of the product in the attached photo${what ? ` (${what})` : ''}, installed in the ${room} of a luxury Singapore home.`,
    `Keep the product exactly as photographed: the same shape, proportions, colour, finish, buttons, markings and logo. Do not redesign, restyle or add parts to it; only light it to match the scene.`,
    `Placement: ${PLACEMENT[o.categoryId]}.`,
    `Interior style: ${style}. Lighting: ${light}.`,
    'Shot like an architectural magazine feature: full-frame camera, 35 mm lens, eye-level, straight verticals, gentle depth of field, realistic shadows and reflections, clean and uncluttered styling.',
    'No people, no text, no watermark, no brand names other than what is on the product.',
    o.notes?.trim() ? `Also: ${o.notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
