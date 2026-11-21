import { describe, expect, it } from 'vitest';
import { idle, tapB, throwB } from './input';
import {
  EMBER_FUSE,
  POWDER_FUSE,
  ROOM_W,
  campaignWorld,
  enterRoom,
  exportSave,
  importSave,
  newState,
  tick,
  tileAt,
} from '../src/game/world';

describe('core movement, bombs, puzzles, and bosses', () => {
  it('walls stop you, and corner sliding nudges you cleanly into a 1-tile doorway', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 3.5, 4.5);
    for (let i = 0; i < 40; i++) tick(world, s, { ...idle, dx: -1 }, 0.04);
    expect(s.x).toBeGreaterThan(2.25);

    // Stand slightly off-centre below the 1-tile doorway at x=5 in Crystal Crossroads (1, 2)
    enterRoom(world, s, 'ember-crypt', 1, 2, 5.28, 10.8);
    for (let i = 0; i < 30; i++) tick(world, s, { ...idle, dy: 1 }, 0.04);
    // Corner-slide nudges x toward 5.5 and transitions south into Crypt Foyer (1, 3)
    expect([s.zone, s.rx, s.ry]).toEqual(['ember-crypt', 1, 3]);
  });

  it('walking off an open edge cuts to the adjacent room', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 0.6, 6.5);
    let moved = false;
    for (let i = 0; i < 30 && !moved; i++) {
      moved = tick(world, s, { ...idle, dx: -1 }, 0.04);
    }
    expect(moved).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 2]);
    expect(s.x).toBeGreaterThan(ROOM_W - 1);
  });

  it('dropped Blackpowder breaks cracked walls and applies harmless self-knockback (0 damage)', () => {
    const world = campaignWorld();
    // Millbrook Square has a cracked smithy wall at (7, 1)
    const s = newState(world, 'overworld', 3, 2, 6.5, 1.5);
    const startHp = s.hp;
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('%');

    s.bombCooldown = 0; // staged setup, not a test of the cooldown

    tapB(world, s);
    expect(s.bombs).toHaveLength(1);

    for (let t = 0; t < POWDER_FUSE + 0.15; t += 0.05) {
      tick(world, s, idle, 0.05);
    }
    expect(s.bombs).toHaveLength(0);
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('.');
    // Self-blast dealt 0 heart damage, and knocked Pip ~1 tile South (opposite North facing)
    expect(s.hp).toBe(startHp);
    expect(s.y).toBeGreaterThan(2.1);
  });

  it('thrown bombs arc over low fences to flip Crystal Switches and detonate on enemy impact', () => {
    const world = campaignWorld();
    // Crystal Crossroads (1, 2): Crystal Switch 'C' sits at (5, 5) behind '=' balustrade at (5, 6)
    const s = newState(world, 'ember-crypt', 1, 2, 5.5, 7.5);
    s.aimX = 0;
    s.aimY = -1;
    expect(s.crystalColor).toBe('red');

    s.bombCooldown = 0; // staged setup, not a test of the cooldown

    throwB(world, s);
    for (let i = 0; i < 15; i++) tick(world, s, idle, 0.04);
    expect(s.crystalColor).toBe('blue');

    // Impact detonation on enemy: Spire Causeway (2, 1) has a slime at (5.5, 4.5)
    enterRoom(world, s, 'overworld', 2, 1, 5.5, 6.5);
    s.aimX = 0;
    s.aimY = -1;
    const initialEnemies = s.enemies.length;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    throwB(world, s);
    // Flight takes <= 0.25s — far less than the 1.5s fuse!
    for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
    expect(s.enemies.length).toBeLessThan(initialEnemies);
  });

  it('Ember burns brambles, strips wooden shields, and enforces ordered braziers (I → II → III)', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 1, 3, 3.5, 6.5);
    s.unlockedBombs.push('ember');
    s.slots[0] = 'ember';

    // Burn inset west bramble at (2, 6) in Crypt Foyer
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 2, 6)).toBe('B');
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    tapB(world, s);
    for (let t = 0; t < EMBER_FUSE + 0.15; t += 0.05) tick(world, s, idle, 0.05);
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 2, 6)).toBe('.');

    // Ordered braziers in Hall of Three Flames (0, 2): (2,9)=1, (2,2)=2, (8,2)=3
    enterRoom(world, s, 'ember-crypt', 0, 2, 3.5, 2.5);
    s.enemies = [];
    // Lighting torch #2 first fizzles back to 0!
    s.aimX = -1;
    s.aimY = 0;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    throwB(world, s);
    for (let i = 0; i < 12; i++) tick(world, s, idle, 0.04);
    expect(s.orderedStep).toBe(0);
    expect(s.torches.every((t) => !t.lit)).toBe(true);

    // Now light 1 -> 2 -> 3 in order to spawn the Boss Key!
    const steps: [number, number, number, number][] = [
      [3.5, 9.5, -1, 0],
      [3.5, 2.5, -1, 0],
      [7.5, 2.5, 1, 0],
    ];
    for (const [px, py, fx, fy] of steps) {
      s.x = px;
      s.y = py;
      s.aimX = fx;
      s.aimY = fy;
      s.bombCooldown = 0; // staged setup, not a test of the cooldown
      throwB(world, s);
      for (let i = 0; i < 12; i++) tick(world, s, idle, 0.04);
    }
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.kind === 'boss-key')).toBe(true);
  });

  it('Wickgeist requires lighting a brazier in the dark, and unlocks the midpoint warp on defeat', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 1, 1, 5.5, 7.5);
    s.unlockedBombs.push('ember');
    const geist = s.enemies[0]!;
    expect(geist.kind).toBe('wickgeist');

    // In the dark, Blackpowder deals 0 damage
    s.slots[0] = 'powder';
    s.aimX = 0;
    s.aimY = -1;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    throwB(world, s);
    for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
    expect(geist.hp).toBe(8);

    // Light NW brazier (2, 2) with Ember, then damage Wickgeist
    s.x = 3.5;
    s.y = 2.5;
    s.aimX = -1;
    s.aimY = 0;
    s.slots[0] = 'ember';
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    throwB(world, s);
    for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
    expect(s.torches.some((t) => t.lit)).toBe(true);

    // Deal 8 damage with Blackpowder throws (re-lighting if phase 2 snuffs a torch)
    s.slots[0] = 'powder';
    for (let volley = 0; volley < 6 && s.enemies.length > 0; volley++) {
      if (!s.torches.some((t) => t.lit)) {
        s.x = 3.5;
        s.y = 2.5;
        s.aimX = -1;
        s.aimY = 0;
        s.slots[0] = 'ember';
        s.bombCooldown = 0; // staged setup, not a test of the cooldown
        throwB(world, s);
        for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
        s.slots[0] = 'powder';
      }
      const target = s.enemies[0];
      if (!target) break;
      target.invulnTimer = 0;
      s.x = target.x;
      s.y = Math.min(10.2, target.y + 1.8);
      s.aimX = 0;
      s.aimY = -1;
      s.bombCooldown = 0; // staged setup, not a test of the cooldown
      throwB(world, s);
      for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
    }
    expect(s.enemies).toHaveLength(0);
    expect(s.cryptWarpUnlocked).toBe(true);
  });

  it('Cinderhull requires Ember to burn thorn wraps before Blackpowder can damage its core', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 0, 0, 5.5, 8.5);
    s.unlockedBombs.push('ember');
    const boss = s.enemies[0]!;
    expect(boss.kind).toBe('cinderhull');
    expect(boss.hp).toBe(12);

    // Blackpowder clanks off thorn armor
    s.slots[0] = 'powder';
    s.x = boss.x;
    s.y = boss.y + 1.8;
    s.aimX = 0;
    s.aimY = -1;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    throwB(world, s);
    for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
    expect(boss.hp).toBe(12);
    expect(boss.armored).toBe(true);

    // Through every phase: burn the wraps with Ember whenever they're up, then blast the
    // exposed core with Blackpowder until the thorns regrow
    s.slots[0] = 'powder';
    for (let step = 0; step < 40 && s.enemies.length > 0; step++) {
      const b = s.enemies[0]!;
      b.invulnTimer = 0;
      s.x = b.x;
      s.y = Math.min(10.0, b.y + 1.8);
      if (b.armored) {
        // Ember has no impact detonation, so plant one on the boss with its fuse nearly spent
        s.bombs.push({
          id: 999 + step,
          kind: 'ember',
          x: b.x,
          y: b.y,
          fuse: 0.01,
          graceOverlap: false,
        });
        tick(world, s, idle, 0.02);
        expect(b.armored).toBe(false);
      } else {
        s.aimX = 0;
        s.aimY = -1;
        s.bombCooldown = 0; // staged setup, not a test of the cooldown
        throwB(world, s);
        for (let i = 0; i < 10; i++) tick(world, s, idle, 0.03);
      }
    }

    expect(s.enemies).toHaveLength(0);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.map((p) => p.kind).sort()).toEqual(['cinder-core', 'heart-container']);
  });

  it('respawns at the current room doorway on death and round-trips autosaves cleanly', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 2, 1, 9.2, 6.5);
    s.hp = 1;
    // Collide with slime at (5.5, 4.5)
    s.x = 5.5;
    s.y = 4.5;
    tick(world, s, idle, 0.05);
    expect(s.hp).toBe(s.maxHp);
    expect([s.x, s.y]).toEqual([9.2, 6.5]);

    // Autosave export & import
    s.unlockedBombs.push('ember');
    s.cores.push('cinder');
    s.maxBombs = 3;
    const saved = exportSave(s);
    const loaded = importSave(world, saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.unlockedBombs).toEqual(['powder', 'ember']);
    expect(loaded!.cores).toEqual(['cinder']);
    expect(loaded!.maxBombs).toBe(3);
  });
});
