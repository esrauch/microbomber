import { describe, expect, it } from 'vitest';
import {
  FIXED_DT,
  campaignWorld,
  cycleEquippedBomb,
  equipBomb,
  exportSave,
  importSave,
  newState,
  tick,
} from '../src/game/world';
import { stepSeconds, tapA } from './input';

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

  it('throwing an overhead bomb sends it straight along the dominant orthogonal axis and over fences', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 4.5, 6.5);
    s.enemies = [];
    // Pull bomb overhead with A
    tick(world, s, { dx: 0, dy: 0, holdA: true }, FIXED_DT);
    tick(world, s, { dx: 0, dy: 0 }, FIXED_DT);
    expect(s.heldBomb).toBe('bomb');
    // Aim diagonally (mostly east) and press A to throw
    tick(world, s, { dx: 0.8, dy: 0.55, holdA: true }, FIXED_DT);
    expect(s.heldBomb).toBeNull();
    expect(s.events).toContain('bomb-throw');
    const b = s.bombs[0]!;
    expect(b.kicked).toBe(true);
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBe(0);
    expect(b.z).toBeGreaterThan(0.22); // high enough to clear '=' fences!
  });

  it('starts a fresh game inside Mouse House Interior with Roll only (no bombs until the basement)', () => {
    const world = campaignWorld();
    const fresh = newState(world);
    expect([fresh.zone, fresh.rx, fresh.ry]).toEqual(['basement', 1, 3]);
    expect(fresh.unlockedBombs).toEqual([]);
    expect(fresh.equipped).toBeNull();
    expect(cycleEquippedBomb(fresh)).toBeNull();

    const saved = exportSave(fresh);
    const restored = importSave(world, JSON.parse(JSON.stringify(saved)));
    expect(restored?.zone).toBe('basement');
    expect(restored?.unlockedBombs).toEqual([]);
    expect(restored?.equipped).toBeNull();
  });

  it('cycleEquippedBomb fast-swaps unlocked bombs in play without disarming to null, including held bombs', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld');
    expect(s.equipped).toBe('bomb');
    s.unlockedBombs.push('fire');

    expect(cycleEquippedBomb(s)).toBe('fire');
    expect(s.events).toContain('bomb-swap');

    // Pull Fire overhead, then fast-swap while holding -> swaps heldBomb in place!
    tick(world, s, { dx: 0, dy: 0, holdA: true }, FIXED_DT);
    tick(world, s, { dx: 0, dy: 0 }, FIXED_DT);
    expect(s.heldBomb).toBe('fire');
    expect(cycleEquippedBomb(s)).toBe('bomb');
    expect(s.heldBomb).toBe('bomb');
  });

  it('START menu equipBomb selects an unlocked bomb or None (null), and v3 saves round-trip it', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld');
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
    const s = newState(world, 'overworld');
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
    const s = newState(world, 'overworld');
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

describe('Heart Pieces', () => {
  it('adds a heart for every four pieces', () => {
    const world = campaignWorld();
    const s = newState(world);
    const startMax = s.maxHp;
    for (let i = 0; i < 4; i++) {
      s.pickups.push({ id: `test-piece-${i}`, kind: 'heart-shard', x: s.x, y: s.y });
      // Each pickup holds the game for a beat; step past it
      stepSeconds(world, s, 1.5);
      expect(s.heartShards).toBe(i + 1);
      expect(s.maxHp).toBe(i < 3 ? startMax : startMax + 2);
    }
  });
});
