import { describe, expect, it } from 'vitest';
import {
  FIXED_DT,
  campaignWorld,
  equipBomb,
  exportSave,
  importSave,
  newState,
  tick,
} from '../src/game/world';
import { tapA } from './input';

describe('Roll (B), Place (A), orthogonal kicks, and single equipped bomb', () => {
  it('A places the equipped bomb directly in front of Pip along the cardinal aim without snapping to the grid', () => {
    const world = campaignWorld();
    const east = newState(world, 'overworld', 3, 2, 5.3, 6.6);
    east.enemies = [];
    east.aimX = 0.9;
    east.aimY = 0.3; // dominant axis: east
    tapA(world, east);
    expect(east.bombs).toHaveLength(1);
    const eb = east.bombs[0]!;
    expect(eb.kind).toBe('powder');
    expect(eb.x).toBeGreaterThan(5.3 + 0.3);
    expect(eb.y).toBe(6.6); // exact cross-axis coordinate, not snapped to 6.5
    expect(eb.graceOverlap).toBe(false); // clear of Pip, so walking forward kicks it

    const north = newState(world, 'overworld', 3, 2, 5.3, 6.6);
    north.enemies = [];
    tapA(world, north); // default aim is north
    expect(north.bombs[0]!.x).toBe(5.3);
    expect(north.bombs[0]!.y).toBeLessThan(6.6 - 0.3);
  });

  it('walking into a bomb kicks it straight along the dominant axis only', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 4.5, 6.5);
    s.enemies = [];
    s.aimX = 1;
    s.aimY = 0;
    tapA(world, s);
    let kicked = false;
    for (let i = 0; i < 30 && !kicked; i++) {
      tick(world, s, { dx: 0.8, dy: 0.55 }, FIXED_DT); // a diagonal walk, mostly east
      kicked = s.events.includes('bomb-kick');
    }
    expect(kicked).toBe(true);
    const b = s.bombs[0]!;
    expect(b.kicked).toBe(true);
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBe(0);
  });

  it('START menu equipBomb selects an unlocked bomb or None (null), and v3 saves round-trip it', () => {
    const world = campaignWorld();
    const s = newState(world);
    equipBomb(s, 'ember'); // not unlocked yet
    expect(s.equipped).toBe('powder');

    s.unlockedBombs.push('ember');
    equipBomb(s, 'ember');
    expect(s.equipped).toBe('ember');

    const savedEmber = exportSave(s);
    expect(savedEmber.version).toBe(3);
    expect(savedEmber.equipped).toBe('ember');
    expect(importSave(world, JSON.parse(JSON.stringify(savedEmber)))?.equipped).toBe('ember');

    equipBomb(s, null);
    expect(s.equipped).toBeNull();
    expect(importSave(world, JSON.parse(JSON.stringify(exportSave(s))))?.equipped).toBeNull();
  });

  it('migrates version 2 saves (slots or legacy selectedBomb) cleanly to equipped', () => {
    const world = campaignWorld();
    const s = newState(world);
    s.unlockedBombs.push('ember');
    const base = exportSave(s);

    const v2Ember = { ...base, version: 2, equipped: undefined, slots: ['ember', 'powder'] };
    expect(importSave(world, JSON.parse(JSON.stringify(v2Ember)))?.equipped).toBe('ember');

    const v2None = { ...base, version: 2, equipped: undefined, slots: [null, 'powder'] };
    expect(importSave(world, JSON.parse(JSON.stringify(v2None)))?.equipped).toBeNull();

    const v2Legacy = { ...base, version: 2, equipped: undefined, selectedBomb: 'ember' };
    expect(importSave(world, JSON.parse(JSON.stringify(v2Legacy)))?.equipped).toBe('ember');
  });
});
