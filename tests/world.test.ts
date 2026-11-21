import { describe, expect, it } from 'vitest';
import { idle, kickA, stepSeconds, tapA } from './input';
import {
  EMBER_FUSE,
  FIXED_DT,
  POWDER_FUSE,
  ROOM_W,
  campaignWorld,
  enterRoom,
  equipBomb,
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
    stepSeconds(world, s, 1.6, { ...idle, dx: -1 });
    expect(s.x).toBeGreaterThan(2.12);

    // Stand slightly off-centre below the 1-tile doorway at x=5 in Crystal Crossroads (1, 2)
    enterRoom(world, s, 'ember-crypt', 1, 2, 5.28, 10.8);
    stepSeconds(world, s, 1.2, { ...idle, dy: 1 });
    // Corner-slide nudges x toward 5.5 and transitions south into Crypt Foyer (1, 3)
    expect([s.zone, s.rx, s.ry]).toEqual(['ember-crypt', 1, 3]);
  });

  it('walking off an open edge cuts to the adjacent room', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 0.6, 6.5);
    let moved = false;
    for (let i = 0; i < 80 && !moved; i++) {
      moved = tick(world, s, { ...idle, dx: -1 }, FIXED_DT);
    }
    expect(moved).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 2]);
    expect(s.x).toBeGreaterThan(ROOM_W - 1);
  });

  it('placed Blackpowder breaks cracked walls and applies harmless self-knockback (0 damage)', () => {
    const world = campaignWorld();
    // Millbrook Square has a cracked smithy wall at (7, 1)
    const s = newState(world, 'overworld', 3, 2, 6.5, 1.5);
    const startHp = s.hp;
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('%');

    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    s.aimX = 1; // face the cracked wall: the bomb is placed against it
    s.aimY = 0;

    tapA(world, s);
    expect(s.bombs).toHaveLength(1);

    stepSeconds(world, s, POWDER_FUSE + 0.15);
    expect(s.bombs).toHaveLength(0);
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('.');
    // Self-blast dealt 0 heart damage, and knocked Pip back west, away from the bomb
    expect(s.hp).toBe(startHp);
    expect(s.x).toBeLessThan(6.0);
  });

  it('a kicked Blackpowder bomb detonates on enemy impact', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 1, 2, 5.5, 7.5);

    // Impact detonation on enemy: Spire Causeway (2, 1) has a slime at (5.5, 4.5)
    enterRoom(world, s, 'overworld', 2, 1, 5.5, 6.5);
    s.aimX = 0;
    s.aimY = -1;
    const initialEnemies = s.enemies.length;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    // Impact happens far earlier than the 1.5 s fuse
    stepSeconds(world, s, 0.45);
    expect(s.enemies.length).toBeLessThan(initialEnemies);
  });

  it('Ember burns brambles, strips wooden shields, and enforces ordered braziers (I → II → III)', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 1, 3, 3.5, 6.5);
    s.unlockedBombs.push('ember');
    equipBomb(s, 'ember');

    // Burn inset west bramble at (2, 6) in Crypt Foyer
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 2, 6)).toBe('B');
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    tapA(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 2, 6)).toBe('.');

    // Ordered braziers in Hall of Three Flames (0, 2): (2,9)=1, (2,2)=2, (8,2)=3
    enterRoom(world, s, 'ember-crypt', 0, 2, 2.5, 5.5);
    s.enemies = [];
    // Bowling torch #2 first along the NW 'n' chute fizzles back to 0!
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    tapA(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    expect(s.orderedStep).toBe(0);
    expect(s.torches.every((t) => !t.lit)).toBe(true);

    // Now bowl 1 -> 2 -> 3 in order down the three slope chutes to spawn the Boss Key!
    const chuteDrops: [number, number][] = [
      [4.5, 9.5], // 'w' chute into I (2, 9)
      [2.5, 5.5], // 'n' chute past water into II (2, 2)
      [6.5, 4.5], // 'n' -> 'e' banked chute into III (8, 2)
    ];
    for (const [px, py] of chuteDrops) {
      s.x = px;
      s.y = py;
      s.vx = 0;
      s.vy = 0;
      s.bombCooldown = 0; // staged setup, not a test of the cooldown
      tapA(world, s);
      stepSeconds(world, s, EMBER_FUSE + 0.15);
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
    equipBomb(s, 'powder');
    s.aimX = 0;
    s.aimY = -1;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    stepSeconds(world, s, 0.45);
    expect(geist.hp).toBe(8);

    // Light NW brazier (2, 2) with Ember, then damage Wickgeist
    s.x = 3.5;
    s.y = 2.5;
    s.vx = 0;
    s.vy = 0;
    s.aimX = -1;
    s.aimY = 0;
    equipBomb(s, 'ember');
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    stepSeconds(world, s, 1.45);
    expect(s.torches.some((t) => t.lit)).toBe(true);

    // Deal 8 damage with Blackpowder throws (re-lighting if phase 2 snuffs a torch)
    equipBomb(s, 'powder');
    for (let volley = 0; volley < 8 && s.enemies.length > 0; volley++) {
      if (!s.torches.some((t) => t.lit)) {
        s.hp = s.maxHp;
        s.x = 3.5;
        s.y = 2.5;
        s.vx = 0;
        s.vy = 0;
        s.aimX = -1;
        s.aimY = 0;
        equipBomb(s, 'ember');
        s.bombCooldown = 0; // staged setup, not a test of the cooldown
        kickA(world, s, s.aimX, s.aimY);
        stepSeconds(world, s, 1.45);
        equipBomb(s, 'powder');
      }
      const target = s.enemies[0];
      if (!target) break;
      target.invulnTimer = 0;
      s.hp = s.maxHp;
      s.x = target.x;
      s.y = Math.min(10.2, target.y + 1.8);
      s.vx = 0;
      s.vy = 0;
      s.aimX = 0;
      s.aimY = -1;
      s.bombCooldown = 0; // staged setup, not a test of the cooldown
      kickA(world, s, s.aimX, s.aimY);
      stepSeconds(world, s, 0.45);
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
    equipBomb(s, 'powder');
    s.x = boss.x;
    s.y = boss.y + 1.8;
    s.aimX = 0;
    s.aimY = -1;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    stepSeconds(world, s, 0.45);
    expect(boss.hp).toBe(12);
    expect(boss.armored).toBe(true);

    // Through every phase: burn the wraps with Ember whenever they're up, then blast the
    // exposed core with Blackpowder until the thorns regrow
    equipBomb(s, 'powder');
    for (let step = 0; step < 40 && s.enemies.length > 0; step++) {
      const b = s.enemies[0]!;
      b.invulnTimer = 0;
      s.hp = s.maxHp;
      s.x = b.x;
      s.y = Math.min(10.0, b.y + 1.8);
      s.vx = 0;
      s.vy = 0;
      if (b.armored) {
        // Ember has no impact detonation, so plant one on the boss with its fuse nearly spent
        s.bombs.push({
          id: 999 + step,
          kind: 'ember',
          x: b.x,
          y: b.y,
          vx: 0,
          vy: 0,
          z: 0,
          vz: 0,
          fuse: 0.01,
          graceOverlap: false,
          shoveCount: 0,
        });
        tick(world, s, idle, FIXED_DT);
        expect(b.armored).toBe(false);
      } else {
        s.aimX = 0;
        s.aimY = -1;
        s.bombCooldown = 0; // staged setup, not a test of the cooldown
        kickA(world, s, s.aimX, s.aimY);
        for (let i = 0; i < 28 && s.enemies.length > 0; i++) {
          tick(world, s, idle, FIXED_DT);
        }
      }
    }

    expect(s.enemies).toHaveLength(0);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.map((p) => p.kind).sort()).toEqual(['cinder-core', 'heart-container']);
  });

  it('respawns at the current room doorway on death and round-trips v3 autosaves cleanly', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 2, 1, 9.2, 6.5);
    s.hp = 1;
    // Collide with slime at (5.5, 4.5)
    s.x = 5.5;
    s.y = 4.5;
    tick(world, s, idle, FIXED_DT);
    expect(s.hp).toBe(s.maxHp);
    expect([s.x, s.y]).toEqual([9.2, 6.5]);

    // Autosave export & import
    s.unlockedBombs.push('ember');
    equipBomb(s, 'ember');
    s.cores.push('cinder');
    s.maxBombs = 3;
    const saved = exportSave(s);
    expect(saved.version).toBe(3);
    const loaded = importSave(world, saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.unlockedBombs).toEqual(['powder', 'ember']);
    expect(loaded!.equipped).toBe('ember');
    expect(loaded!.cores).toEqual(['cinder']);
    expect(loaded!.maxBombs).toBe(3);
  });
});
