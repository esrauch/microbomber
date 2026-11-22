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
    expect(eb.kind).toBe('bomb');
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
    equipBomb(s, 'fire'); // not unlocked yet
    expect(s.equipped).toBe('bomb');

    s.unlockedBombs.push('fire');
    equipBomb(s, 'fire');
    expect(s.equipped).toBe('fire');

    const savedFire = exportSave(s);
    expect(savedFire.version).toBe(3);
    expect(savedFire.equipped).toBe('fire');
    expect(importSave(world, JSON.parse(JSON.stringify(savedFire)))?.equipped).toBe('fire');

    equipBomb(s, null);
    expect(s.equipped).toBeNull();
    expect(importSave(world, JSON.parse(JSON.stringify(exportSave(s))))?.equipped).toBeNull();
  });

  it('loads saves from before the rename (powder, ember) as Bomb and Fire', () => {
    const world = campaignWorld();
    const s = newState(world);
    s.unlockedBombs.push('fire');
    equipBomb(s, 'fire');
    const old = JSON.parse(
      JSON.stringify({ ...exportSave(s), unlockedBombs: ['powder', 'ember'], equipped: 'ember' }),
    );
    const loaded = importSave(world, old);
    expect(loaded?.unlockedBombs).toEqual(['bomb', 'fire']);
    expect(loaded?.equipped).toBe('fire');
  });

  it('loads saves from before the first shrine became Ice Cave (ember-crypt)', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 1, 3);
    s.solvedRooms.add('ice-cave:1,3');
    const old = JSON.parse(JSON.stringify(exportSave(s)).replaceAll('ice-cave', 'ember-crypt'));
    expect(old.zone).toBe('ember-crypt');
    const loaded = importSave(world, old);
    expect(loaded?.zone).toBe('ice-cave');
    expect(loaded?.solvedRooms.has('ice-cave:1,3')).toBe(true);
    expect([...(loaded?.visitedRooms ?? [])].every((k) => !k.startsWith('ember-crypt'))).toBe(true);
  });

  it('migrates version 2 saves (slots or legacy selectedBomb) cleanly to equipped', () => {
    const world = campaignWorld();
    const s = newState(world);
    s.unlockedBombs.push('fire');
    const base = exportSave(s);

    const v2Fire = { ...base, version: 2, equipped: undefined, slots: ['fire', 'bomb'] };
    expect(importSave(world, JSON.parse(JSON.stringify(v2Fire)))?.equipped).toBe('fire');

    const v2None = { ...base, version: 2, equipped: undefined, slots: [null, 'bomb'] };
    expect(importSave(world, JSON.parse(JSON.stringify(v2None)))?.equipped).toBeNull();

    const v2Legacy = { ...base, version: 2, equipped: undefined, selectedBomb: 'fire' };
    expect(importSave(world, JSON.parse(JSON.stringify(v2Legacy)))?.equipped).toBe('fire');
  });
});
