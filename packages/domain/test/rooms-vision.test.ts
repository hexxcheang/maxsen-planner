import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { roomReader } from '../src/magic/vision/rooms.ts';
import { withFoundRooms, type RoomLayout } from '../src/magic/room-layout.ts';
import { condo2bed, hdb4room } from '../src/sample/drawings.ts';
import { rasterize } from './helpers/raster.ts';

// Drawing units (1400 × 1000) to fractions and back.
const at = (x: number, y: number) => [x / 1400, y / 1000] as const;
const px = (b: { x: number; y: number; w: number; h: number }) => [
  Math.round(b.x * 1400),
  Math.round(b.y * 1000),
  Math.round(b.w * 1400),
  Math.round(b.h * 1000),
];
const near = (a: number[], b: number[], tol = 12) =>
  a.every((v, i) => Math.abs(v - b[i]!) <= tol) ||
  assert.fail(`${a.join(',')} not near ${b.join(',')}`);

describe('reading rooms off the drawing', () => {
  const hdb = roomReader(rasterize(hdb4room).image);

  it('outlines the room around a tap, with its door', () => {
    const kitchen = hdb.at(...at(420, 230))!;
    near(px(kitchen.box), [280, 100, 280, 260]);
    assert.deepEqual(kitchen.parts, []);
    // The wider of its two openings onto the living room (440–520 on the wall at y = 360).
    near([kitchen.door!.x * 1400, kitchen.door!.y * 1000], [480, 360]);

    const bed2 = hdb.at(...at(1090, 570))!;
    near(px(bed2.box), [880, 460, 420, 220]);
    near([bed2.door!.x * 1400, bed2.door!.y * 1000], [880, 540]);
  });

  it('describes an L-shaped room with an extra area', () => {
    // The master bedroom wraps around its bathroom.
    const master = hdb.at(...at(1000, 300))!;
    near(px(master.box), [880, 100, 264, 360]);
    assert.equal(master.parts.length, 1);
    near(px(master.parts[0]!), [1140, 300, 160, 160]);
  });

  it('finds a tap on a wall line too, and nothing outside the home', () => {
    assert.ok(hdb.at(...at(880, 520)));
    assert.equal(hdb.at(...at(40, 40)), null);
  });

  it('finds every room at once', () => {
    assert.equal(hdb.all().length, 10);
    assert.equal(roomReader(rasterize(condo2bed).image).all().length, 8);
  });

  it('adds the rooms found as unnamed rooms, keeping those already outlined', () => {
    const layout: RoomLayout = {
      presetId: 'hdb-4',
      floorAreaM2: 93,
      rooms: [
        { id: 'k', type: 'kitchen', name: 'Kitchen', x: 0.2, y: 0.1, w: 0.2, h: 0.26, door: null },
        { id: 'b', type: 'bedroom', name: 'Bedroom 2', x: 0, y: 0, w: 0, h: 0, door: null },
      ],
    };
    const out = withFoundRooms(layout, hdb.all());
    assert.equal(out.rooms.length, 10);
    assert.equal(out.rooms[0]!.name, 'Kitchen');
    assert.ok(!out.rooms.some((r) => r.name === 'Bedroom 2'));
    assert.ok(out.rooms.slice(1).every((r) => r.type === 'other' && /^Room \d+$/.test(r.name)));
  });
});
