import { describe, expect, it } from 'vitest';
import {
  LIFT_DELAY,
  campaignWorld,
  equipBomb,
  exportSave,
  importSave,
  newState,
  tick,
} from '../src/game/world';
import { idle, tapA } from './input';

const DT = 1 / 60;

describe('Roll (B), Pull out (A), and single equipped bomb', () => {
  it('a tap on A drops the equipped bomb; holding A lifts it overhead, and it moves with you', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 5.5, 6.5);
    s.enemies = [];
    tapA(world, s);
    expect(s.bombs).toEqual([expect.objectContaining({ kind: 'powder', x: 5.5, y: 6.5 })]);

    const t = newState(world, 'overworld', 3, 2, 4.5, 6.5);
    t.enemies = [];
    for (let i = 0; i * DT < LIFT_DELAY + DT; i++) tick(world, t, { ...idle, holdA: true }, DT);
    expect(t.bombs[0]?.carried).toBe(true);
    for (let i = 0; i < 10; i++) tick(world, t, { ...idle, holdA: true, dx: 1 }, DT);
    expect(t.bombs[0]?.x).toBe(t.x);
    const fuseBefore = t.bombs[0]!.fuse;
    tick(world, t, idle, DT); // release throws
    expect(t.bombs[0]?.carried).toBeUndefined();
    expect(t.bombs[0]?.flight).toBeDefined();
    expect(t.bombs[0]!.fuse).toBeLessThan(1.5); // the fuse burned while it was held
    expect(fuseBefore).toBeLessThan(1.5);
  });

  it('pressing B (Roll) while carrying a bomb drops it at the roll origin and dodges away', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 4.5, 6.5);
    s.enemies = [];
    for (let i = 0; i * DT < LIFT_DELAY + DT; i++) tick(world, s, { ...idle, holdA: true }, DT);
    expect(s.bombs[0]?.carried).toBe(true);

    tick(world, s, { dx: 1, dy: 0, holdA: true, holdB: true }, DT);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]?.carried).toBeUndefined();
    expect([s.bombs[0]?.x, s.bombs[0]?.y]).toEqual([4.5, 6.5]);
    expect(s.rollTimer).toBeGreaterThan(0);
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
