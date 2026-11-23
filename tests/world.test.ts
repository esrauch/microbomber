import { describe, expect, it } from 'vitest';
import { idle, kickA, stepSeconds, tapA } from './input';
import {
  FIRE_FUSE,
  FIXED_DT,
  BOMB_FUSE,
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
  it('walls stop you, and corner sliding nudges you cleanly into a doorway', () => {
    const world = campaignWorld();
    // Mouse House: the tree wall west of the doorstep ends at x = 4
    const s = newState(world, 'overworld', 3, 2, 6.5, 8.5);
    stepSeconds(world, s, 1.6, { ...idle, dx: -1 });
    expect(s.x).toBeGreaterThan(4.12);

    // Stand off-centre below the 2-tile doorway at x = 10..11 in Crystal Crossroads (1, 2)
    enterRoom(world, s, 'ice-cave', 1, 2, 9.95, 20.8);
    stepSeconds(world, s, 2.4, { ...idle, dy: 1 });
    // Corner-slide nudges x into the doorway and transitions south into Entry Hall (1, 3)
    expect([s.zone, s.rx, s.ry]).toEqual(['ice-cave', 1, 3]);
  });

  it('walking off an open edge cuts to the adjacent room', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 0.6, 12.5);
    let moved = false;
    for (let i = 0; i < 80 && !moved; i++) {
      moved = tick(world, s, { ...idle, dx: -1 }, FIXED_DT);
    }
    expect(moved).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 2]);
    expect(s.x).toBeGreaterThan(s.roomW - 1);
  });

  it('placed Bomb breaks cracked walls and deals 1/4th heart (0.5 half-hearts) splashback with knockback when no enemy is hit', () => {
    const world = campaignWorld();
    // Mouse House has a cracked smithy wall at (14..15, 2..3), which breaks as one piece
    const s = newState(world, 'overworld', 3, 2, 12.5, 2.5);
    const startHp = s.hp;
    expect(tileAt(world, s, 'overworld', 3, 2, 14, 2)).toBe('%');

    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    s.aimX = 1; // face the cracked wall: the bomb is placed against it
    s.aimY = 0;

    tapA(world, s);
    expect(s.bombs).toHaveLength(1);

    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(s.bombs).toHaveLength(0);
    for (const [x, y] of [
      [14, 2],
      [15, 2],
      [14, 3],
      [15, 3],
    ] as const) {
      expect(tileAt(world, s, 'overworld', 3, 2, x, y)).toBe('.');
    }
    // Self-blast dealt 1/4th heart (0.5 half-hearts) splashback and knocked Pip back west
    expect(s.hp).toBe(startHp - 0.5);
    expect(s.x).toBeLessThan(12.0);
  });

  it('a kicked Bomb bomb detonates on enemy impact', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 1, 2, 10.5, 14.5);

    // Impact detonation on enemy: Tower Causeway (2, 1) has a slime at (10.5, 8.5)
    enterRoom(world, s, 'overworld', 2, 1, 10.5, 10.5);
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
    const s = newState(world, 'ice-cave', 1, 3, 6.5, 12.5);
    s.unlockedBombs.push('fire');
    equipBomb(s, 'fire');

    // Burn the inset west bramble (4..5, 12..13) in Entry Hall: the fire spreads through it
    expect(tileAt(world, s, 'ice-cave', 1, 3, 4, 12)).toBe('B');
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    tapA(world, s);
    stepSeconds(world, s, FIRE_FUSE + 2);
    expect(tileAt(world, s, 'ice-cave', 1, 3, 4, 12)).toBe('.');

    // Ordered 2 x 2 braziers in Hall of Three Flames (0, 2): (4,18)=1, (4,4)=2, (16,4)=3
    enterRoom(world, s, 'ice-cave', 0, 2, 4.5, 8.5);
    s.enemies = [];
    // Kicking into torch #2 first fizzles back to 0!
    s.bombCooldown = 0; // staged setup, not a test of the cooldown
    kickA(world, s, 0, -1);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.orderedStep).toBe(0);
    expect(s.torches.filter((t) => !t.decor).every((t) => !t.lit)).toBe(true);

    // Now kick 1 -> 2 -> 3 in order to spawn the Boss Key!
    const shots: [number, number, number, number][] = [
      [8.5, 18.5, -1, 0], // kick West into I (4, 18)
      [4.5, 8.5, 0, -1], // kick North into II (4, 4)
      [13.5, 4.5, 1, 0], // kick East into III (16, 4)
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
    const s = newState(world, 'ice-cave', 0, 0, 10.5, 12.5);
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
    s.fires.push({ x: 10, y: 12, remaining: 2.0, tickCooldown: 0, generation: 0 });
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

    // Light the NW brazier (4..5, 4..5) with Fire, then damage Wickgeist
    s.x = 7.5;
    s.y = 4.5;
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
    stepSeconds(world, s, FIRE_FUSE - 0.15);
    expect(s.torches.some((t) => t.lit)).toBe(true);
    expect(isRoomLit(world, s)).toBe(true);

    // Deal 8 damage across 4 phases (re-lighting after each of the 3 Ice Storm snuffs at 6, 4, 2 HP)
    let iceStormCount = 0;
    equipBomb(s, 'bomb');
    for (let volley = 0; volley < 8 && s.enemies.length > 0; volley++) {
      if (!s.torches.some((t) => t.lit)) {
        iceStormCount++;
        s.hp = s.maxHp;
        s.x = 7.5;
        s.y = 4.5;
        s.vx = 0;
        s.vy = 0;
        s.aimX = -1;
        s.aimY = 0;
        equipBomb(s, 'fire');
        s.bombCooldown = 0; // staged setup, not a test of the cooldown
        kickA(world, s, s.aimX, s.aimY);
        stepSeconds(world, s, FIRE_FUSE + 0.15);
        equipBomb(s, 'bomb');
      }
      const target = s.enemies[0];
      if (!target) break;
      target.invulnTimer = 0;
      s.hp = s.maxHp;
      // This test is about the damage thresholds, not the chase: in the big room the
      // Wickgeist flees to a far corner, so stage each volley in the middle of the room
      target.x = 10.5;
      target.y = 12.5;
      target.vx = 0;
      target.vy = 0;
      s.x = target.x;
      s.y = target.y + 1.8;
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

  it('an Ice Storm blinks the Wickgeist to open floor in the far quarter, never into a wall or brazier', () => {
    const world = campaignWorld();
    for (const [gx, gy] of [
      [7.5, 6.5],
      [14.5, 6.5],
      [7.5, 19.5],
      [14.5, 19.5],
    ] as const) {
      const s = newState(world, 'ice-cave', 0, 0, 11, 13);
      for (const t of s.torches) t.lit = true;
      const geist = s.enemies[0]!;
      geist.x = gx;
      geist.y = gy;
      geist.hp = 7;
      geist.invulnTimer = 0;
      s.invulnTimer = 999;
      s.bombs.push({
        id: 888,
        kind: 'bomb',
        x: gx,
        y: gy,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      });
      tick(world, s, idle, FIXED_DT);
      expect(s.events).toContain('ice-storm');
      // Its whole 2x body is on open floor, on the far side of the room both ways
      expect(Math.sign(geist.x - 11)).toBe(-Math.sign(gx - 11));
      expect(Math.sign(geist.y - 13)).toBe(-Math.sign(gy - 13));
      for (const oy of [-0.85, 0, 0.85]) {
        for (const ox of [-0.85, 0, 0.85]) {
          const tx = Math.floor(geist.x + ox);
          const ty = Math.floor(geist.y + oy);
          expect(tileAt(world, s, 'ice-cave', 0, 0, tx, ty), `${tx},${ty}`).toBe('.');
        }
      }
      // And it comes back out after Pip
      const d0 = Math.hypot(geist.x - s.x, geist.y - s.y);
      stepSeconds(world, s, 3);
      expect(Math.hypot(geist.x - s.x, geist.y - s.y)).toBeLessThan(d0 - 1);
    }
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
    const s = newState(world, 'overworld', 2, 1, 18.2, 12.5);
    s.hp = 1;
    // Collide with the slime in overworld (2, 1) -> returns to initial screen (3, 2)
    s.x = s.enemies[0]!.x;
    s.y = s.enemies[0]!.y;
    tick(world, s, idle, FIXED_DT);
    expect(s.hp).toBe(s.maxHp);
    expect([s.zone, s.rx, s.ry, s.x, s.y]).toEqual(['overworld', 3, 2, 10.5, 12.5]);

    // Die inside the dungeon (ice-cave 2, 3) -> returns to dungeon foyer (ice-cave 1, 3)
    enterRoom(world, s, 'ice-cave', 2, 3, 4.5, 12.5);
    s.invulnTimer = 0;
    s.hp = 1;
    s.x = s.enemies[0]!.x;
    s.y = s.enemies[0]!.y;
    tick(world, s, idle, FIXED_DT);
    expect(s.hp).toBe(s.maxHp);
    expect([s.zone, s.rx, s.ry, s.x, s.y]).toEqual(['ice-cave', 1, 3, 10.5, 18.5]);

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
