import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flipDoorSwing,
  removeRoom,
  renameRoom,
  retypeRoom,
  setMainEntrance,
  swapDoorHinge,
} from '../src/magic/edit-analysis.ts';
import { sampleAnalysisFor } from '../src/sample/analyses.ts';

const hdb = sampleAnalysisFor('file_sample_plan_hdb')!;

describe('editing a floor reading', () => {
  it('renames and retypes a room', () => {
    const a = retypeRoom(renameRoom(hdb, 'r2', 'Wet Kitchen'), 'r2', 'utility');
    assert.deepEqual([a.rooms[1]!.name, a.rooms[1]!.type], ['Wet Kitchen', 'utility']);
    assert.equal(hdb.rooms[1]!.name, 'Kitchen');
  });

  it('removes a room with the doors into it and unlinks its windows', () => {
    const a = removeRoom(hdb, 'r2');
    assert.ok(!a.rooms.some((r) => r.id === 'r2'));
    assert.ok(a.doors.every((d) => !d.sides.includes('r2')));
    assert.ok(a.windows.every((w) => w.roomId !== 'r2'));
    assert.ok(a.doors.length < hdb.doors.length);
  });

  it('flips a door to swing into the other room, and swaps its hinge', () => {
    const d = hdb.doors[0]!;
    const flipped = flipDoorSwing(hdb, d.id).doors[0]!;
    assert.equal(flipped.swingsInto, d.sides[1]);
    assert.deepEqual(flipped.sides, [d.sides[1], d.sides[0]]);
    const swapped = swapDoorHinge(hdb, d.id).doors[0]!;
    assert.deepEqual([swapped.hinge, swapped.latch], [d.latch, d.hinge]);
  });

  it('keeps a single main entrance', () => {
    const a = setMainEntrance(hdb, 'd3');
    assert.deepEqual(
      a.doors.filter((d) => d.isMainEntrance).map((d) => d.id),
      ['d3'],
    );
    assert.equal(setMainEntrance(hdb, null).doors.filter((d) => d.isMainEntrance).length, 0);
  });
});
