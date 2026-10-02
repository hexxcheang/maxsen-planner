import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { removeRoom, renameRoom, retypeRoom } from '../src/magic/edit-analysis.ts';
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
});
