import { describe, expect, it } from 'vitest';
import {
  LIFT_DELAY,
  campaignWorld,
  equipItem,
  exportSave,
  importSave,
  newState,
  tick,
} from '../src/game/world';
import { idle, tapB } from './input';

const DT = 1 / 60;

describe('item buttons B and A', () => {
  it('a tap drops the equipped bomb; holding lifts it overhead, and it moves with you', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 5.5, 6.5);
    s.enemies = [];
    tapB(world, s);
    expect(s.bombs).toEqual([expect.objectContaining({ kind: 'powder', x: 5.5, y: 6.5 })]);

    const t = newState(world, 'overworld', 3, 2, 4.5, 6.5);
    t.enemies = [];
    for (let i = 0; i * DT < LIFT_DELAY + DT; i++) tick(world, t, { ...idle, holdB: true }, DT);
    expect(t.bombs[0]?.carriedBy).toBe(0);
    for (let i = 0; i < 10; i++) tick(world, t, { ...idle, holdB: true, dx: 1 }, DT);
    expect(t.bombs[0]?.x).toBe(t.x);
    const fuseBefore = t.bombs[0]!.fuse;
    tick(world, t, idle, DT); // release
    expect(t.bombs[0]?.carriedBy).toBeUndefined();
    expect(t.bombs[0]?.flight).toBeDefined();
    expect(t.bombs[0]!.fuse).toBeLessThan(1.5); // the fuse burned while it was held
    expect(fuseBefore).toBeLessThan(1.5);
  });

  it("only the button that lifted a bomb throws it, and the other button can't act meanwhile", () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 4.5, 6.5);
    s.enemies = [];
    s.unlockedBombs.push('ember');
    s.slots = ['powder', 'ember'];
    for (let i = 0; i * DT < LIFT_DELAY + DT; i++) tick(world, s, { ...idle, holdB: true }, DT);
    tick(world, s, { ...idle, holdB: true, holdA: true }, DT);
    tick(world, s, { ...idle, holdB: true }, DT); // A released: no throw, no Ember dropped
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]?.carriedBy).toBe(0);
    tick(world, s, idle, DT);
    expect(s.bombs[0]?.flight).toBeDefined();
  });

  it('the pause menu equips an item on B or A, swapping if it was on the other button', () => {
    const world = campaignWorld();
    const s = newState(world);
    equipItem(s, 1, 'ember'); // not unlocked yet
    expect(s.slots).toEqual(['powder', null]);
    s.unlockedBombs.push('ember');
    equipItem(s, 1, 'ember');
    expect(s.slots).toEqual(['powder', 'ember']);
    equipItem(s, 0, 'ember');
    expect(s.slots).toEqual(['ember', 'powder']);
    expect(importSave(world, JSON.parse(JSON.stringify(exportSave(s))))?.slots).toEqual([
      'ember',
      'powder',
    ]);
  });

  it('older saves without slots start with Blackpowder on B and Ember on A', () => {
    const world = campaignWorld();
    const s = newState(world);
    s.unlockedBombs.push('ember');
    const old = { ...exportSave(s), slots: undefined, selectedBomb: 'ember' };
    expect(importSave(world, JSON.parse(JSON.stringify(old)))?.slots).toEqual(['powder', 'ember']);
  });
});
