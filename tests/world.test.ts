import { describe, expect, it } from 'vitest';
import { idle, kickA, stepSeconds, tapA } from './input';
import {
  FIRE_FUSE,
  FIXED_DT,
  BOMB_FUSE,
  ROOM_W,
  campaignWorld,
  enterRoom,
  equipBomb,
  exportSave,
  importSave,
  isRoomLit,
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
    enterRoom(world, s, 'ice-cave', 1, 2, 5.28, 10.8);
    stepSeconds(world, s, 1.2, { ...idle, dy: 1 });
    // Corner-slide nudges x toward 5.5 and transitions south into Entry Hall (1, 3)
    expect([s.zone, s.rx, s.ry]).toEqual(['ice-cave', 1, 3]);
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

  it('placed Bomb breaks cracked walls and applies harmless self-knockback (0 damage)', () => {
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

    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(s.bombs).toHaveLength(0);
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('.');
    // Self-blast dealt 0 heart damage, and knocked Pip back west, away from the bomb
    expect(s.hp).toBe(startHp);
    expect(s.x).toBeLessThan(6.0);
  });

  it('a kicked Bomb bomb detonates on enemy impact', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 1, 2, 5.5, 7.5);

    // Impact detonation on enemy: Tower Causeway (2, 1) has a slime at (5.5, 4.5)
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

  it('Fire burns brambles, strips wooden shields, and enforces ordered braziers (I → II → III)', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 1, 3, 3.5, 6.5);
    s.unlockedBombs.push('fire');
    equipBomb(s, 'fire');

    // Burn inset west bramble at (2, 6) in Entry Hall
    expect(tileAt(world, s, 'ice-cave', 1, 3, 2, 6)).toBe('B');
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    tapA(world, s);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(tileAt(world, s, 'ice-cave', 1, 3, 2, 6)).toBe('.');

    // Ordered braziers in Hall of Three Flames (0, 2): (2,9)=1, (2,2)=2, (8,2)=3
    enterRoom(world, s, 'ice-cave', 0, 2, 2.5, 5.5);
    s.enemies = [];
    // Kicking into torch #2 first fizzles back to 0!
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, 0, -1);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.orderedStep).toBe(0);
    expect(s.torches.filter((t) => !t.decor).every((t) => !t.lit)).toBe(true);

    // Now kick 1 -> 2 -> 3 in order to spawn the Boss Key!
    const shots: [number, number, number, number][] = [
      [4.5, 9.5, -1, 0], // kick West into I (2, 9)
      [2.5, 5.5, 0, -1], // kick North into II (2, 2)
      [6.2, 2.5, 1, 0], // kick East into III (8, 2)
    ];
    for (const [px, py, kdx, kdy] of shots) {
      s.x = px;
      s.y = py;
      s.vx = 0;
      s.vy = 0;
      s.bombCooldown = 0; // staged setup, not a test of the cooldown
      kickA(world, s, kdx, kdy);
      stepSeconds(world, s, FIRE_FUSE + 0.15);
    }
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.kind === 'boss-key')).toBe(true);
  });

  it('Wickgeist is immune unless a corner brazier is lit (not just a bomb fire), and unleashes 3 ice storms at fixed health thresholds', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 0, 0, 5.5, 7.5);
    s.unlockedBombs.push('fire');
    const geist = s.enemies[0]!;
    expect(geist.kind).toBe('wickgeist');

    // In the dark, Bomb deals 0 damage
    equipBomb(s, 'bomb');
    s.aimX = 0;
    s.aimY = -1;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    stepSeconds(world, s, 0.45);
    expect(geist.hp).toBe(8);

    // A Fire bomb fire patch on the floor (not lighting a corner torch) does NOT expose Wickgeist!
    s.fires.push({ x: 5, y: 6, remaining: 2.0, tickCooldown: 0, generation: 0 });
    expect(isRoomLit(world, s)).toBe(false);
    geist.invulnTimer = 0;
    s.bombs.push({
      id: 888,
      kind: 'bomb',
      x: geist.x,
      y: geist.y,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });
    tick(world, s, idle, FIXED_DT);
    expect(geist.hp).toBe(8);
    s.fires = [];

    // Light NW brazier (2, 2) with Fire, then damage Wickgeist
    s.x = 3.5;
    s.y = 2.5;
    s.vx = 0;
    s.vy = 0;
    s.aimX = -1;
    s.aimY = 0;
    equipBomb(s, 'fire');
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    stepSeconds(world, s, 0.3);
    expect(s.bombs).toHaveLength(1);
    expect(s.torches.some((t) => t.lit)).toBe(false);
    expect(isRoomLit(world, s)).toBe(false);
    stepSeconds(world, s, 1.15);
    expect(s.torches.some((t) => t.lit)).toBe(true);
    expect(isRoomLit(world, s)).toBe(true);

    // Deal 8 damage across 4 phases (re-lighting after each of the 3 Ice Storm snuffs at 6, 4, 2 HP)
    let iceStormCount = 0;
    equipBomb(s, 'bomb');
    for (let volley = 0; volley < 8 && s.enemies.length > 0; volley++) {
      if (!s.torches.some((t) => t.lit)) {
        iceStormCount++;
        s.hp = s.maxHp;
        s.x = 3.5;
        s.y = 2.5;
        s.vx = 0;
        s.vy = 0;
        s.aimX = -1;
        s.aimY = 0;
        equipBomb(s, 'fire');
        s.bombCooldown = 0; // staged setup, not a test of the cooldown
        kickA(world, s, s.aimX, s.aimY);
        stepSeconds(world, s, 1.45);
        equipBomb(s, 'bomb');
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
    expect(iceStormCount).toBe(3);
    expect(s.enemies).toHaveLength(0);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.map((p) => p.kind).sort()).toEqual(['cinder-core', 'heart-container']);
  });

  it('Cinderhull requires Fire to burn thorn wraps before Bomb can damage its core, and unlocks the midpoint warp on defeat', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 1, 1, 5.5, 8.5);
    s.unlockedBombs.push('fire');
    const boss = s.enemies[0]!;
    expect(boss.kind).toBe('cinderhull');
    expect(boss.hp).toBe(12);

    // Bomb clanks off thorn armor
    equipBomb(s, 'bomb');
    s.x = boss.x;
    s.y = boss.y + 1.8;
    s.aimX = 0;
    s.aimY = -1;
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, s.aimX, s.aimY);
    stepSeconds(world, s, 0.45);
    expect(boss.hp).toBe(12);
    expect(boss.armored).toBe(true);

    // Through every phase: burn the wraps with Fire whenever they're up, then blast the
    // exposed core with Bomb until the thorns regrow
    equipBomb(s, 'bomb');
    for (let step = 0; step < 40 && s.enemies.length > 0; step++) {
      const b = s.enemies[0]!;
      b.invulnTimer = 0;
      s.hp = s.maxHp;
      s.x = b.x;
      s.y = Math.min(10.0, b.y + 1.8);
      s.vx = 0;
      s.vy = 0;
      if (b.armored) {
        // Plant a Fire on the boss with its fuse nearly spent (no kick needed)
        s.bombs.push({
          id: 999 + step,
          kind: 'fire',
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
    expect(s.cryptWarpUnlocked).toBe(true);
  });

  it('respawns on the initial screen on overworld death, in the dungeon foyer on dungeon death, and round-trips v3 autosaves cleanly', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 2, 1, 9.2, 6.5);
    s.hp = 1;
    // Collide with slime at (5.5, 4.5) in overworld (2, 1) -> returns to initial screen (3, 2)
    s.x = 5.5;
    s.y = 4.5;
    tick(world, s, idle, FIXED_DT);
    expect(s.hp).toBe(s.maxHp);
    expect([s.zone, s.rx, s.ry, s.x, s.y]).toEqual(['overworld', 3, 2, 5.5, 6.5]);

    // Die inside the dungeon (ice-cave 2, 3) -> returns to dungeon foyer (ice-cave 1, 3)
    enterRoom(world, s, 'ice-cave', 2, 3, 2.5, 6.5);
    s.invulnTimer = 0;
    s.hp = 1;
    s.x = 6.5;
    s.y = 7.5;
    tick(world, s, idle, FIXED_DT);
    expect(s.hp).toBe(s.maxHp);
    expect([s.zone, s.rx, s.ry, s.x, s.y]).toEqual(['ice-cave', 1, 3, 5.5, 9.5]);

    // Autosave export & import
    s.unlockedBombs.push('fire');
    equipBomb(s, 'fire');
    s.cores.push('cinder');
    s.maxBombs = 3;
    const saved = exportSave(s);
    expect(saved.version).toBe(3);
    const loaded = importSave(world, saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.unlockedBombs).toEqual(['bomb', 'fire']);
    expect(loaded!.equipped).toBe('fire');
    expect(loaded!.cores).toEqual(['cinder']);
    expect(loaded!.maxBombs).toBe(3);
  });
});
