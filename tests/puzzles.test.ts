import { describe, expect, it } from 'vitest';
import {
  FIRE_FUSE,
  FIXED_DT,
  BOMB_FUSE,
  ROOM_H,
  ROOM_W,
  SLOPE_ACCEL,
  type Tile,
  type World,
  campaignWorld,
  enterRoom,
  equipBomb,
  newState,
  roomKey,
  tick,
  tileAt,
} from '../src/game/world';
import { idle, kickA, placeDownChute, rollB, stepSeconds, stepTicks } from './input';

/** Build an isolated 11x13 sandbox world for unit-testing contact triggers & slope vectors. */
function sandboxWorld(
  rows: string[],
  opts: {
    condition?: 'none' | 'all-torches' | 'ordered-torches' | 'hold-buttons';
    torches?: Array<{ x: number; y: number; order?: number; timedSeconds?: number }>;
  } = {},
): World {
  const world: World = { rooms: new Map() };
  world.rooms.set(roomKey('ice-cave', 0, 0), {
    zone: 'ice-cave',
    rx: 0,
    ry: 0,
    name: 'Puzzle Sandbox',
    rows,
    ...(opts.condition ? { condition: opts.condition } : {}),
    ...(opts.torches ? { torches: opts.torches } : {}),
  });
  return world;
}

const OPEN_CRYPT = Array.from({ length: ROOM_H }, (_, y) =>
  y <= 1 || y >= ROOM_H - 2 ? '#'.repeat(ROOM_W) : `##${'.'.repeat(ROOM_W - 4)}##`,
);

function setCell(rows: string[], x: number, y: number, ch: Tile | 'P'): void {
  const r = rows[y]!;
  rows[y] = `${r.slice(0, x)}${ch}${r.slice(x + 1)}`;
}

describe('Phase 3: Contact-radius triggers, directional slopes, Ice Cave physics solves, and Overworld secrets', () => {
  it('triggers C, T, %, and O by continuous contact radius rather than strict grid alignment', () => {
    expect(SLOPE_ACCEL).toBe(22);

    // 1. Off-axis continuous blast contact flips 'C', breaks '%', and lights 'T' (unless blocked by '#')
    const rows = [...OPEN_CRYPT];
    setCell(rows, 4, 4, 'C'); // diagonal from (5.15, 5.15) -> edge dist sqrt(0.15^2 + 0.15^2) ≈ 0.21 < 1.18
    setCell(rows, 6, 4, '%'); // diagonal NE from (5.85, 5.15) -> edge dist ≈ 0.21 < 1.18
    setCell(rows, 2, 2, 'C'); // walled off behind '#' at (3, 2), (2, 3), (3, 3)
    setCell(rows, 3, 2, '#');
    setCell(rows, 2, 3, '#');
    setCell(rows, 3, 3, '#');
    const world = sandboxWorld(rows);
    const s = newState(world, 'ice-cave', 0, 0, 5.5, 8.5);

    // Detonate off-axis Bomb at (5.5, 5.12): diagonal to (4, 4) 'C' and (6, 4) '%'
    // Note: cardinal cross rays from (5, 5) go through (5, 4), (5, 6), (4, 5), (6, 5) — NOT (4, 4) or (6, 4)!
    s.bombs.push({
      id: 901,
      kind: 'bomb',
      x: 5.5,
      y: 5.12,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });
    tick(world, s, idle, FIXED_DT);
    expect(s.crystalColor).toBe('blue');
    expect(tileAt(world, s, 'ice-cave', 0, 0, 6, 4)).toBe('.');

    // Obstructed bomb behind '#' wall does NOT flip walled 'C' at (2, 2)
    const wallRows = [...OPEN_CRYPT];
    setCell(wallRows, 2, 2, 'C');
    setCell(wallRows, 3, 2, '#');
    setCell(wallRows, 2, 3, '#');
    setCell(wallRows, 3, 3, '#');
    const wallWorld = sandboxWorld(wallRows);
    const wallTest = newState(wallWorld, 'ice-cave', 0, 0, 5.5, 8.5);
    wallTest.bombs.push({
      id: 902,
      kind: 'bomb',
      x: 3.15,
      y: 4.15,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });
    tick(wallWorld, wallTest, idle, FIXED_DT);
    expect(wallTest.crystalColor).toBe('red');

    // 2. Fire bomb only lights 'T' once it explodes (not while still ticking/rolling)
    const tRows = [...OPEN_CRYPT];
    setCell(tRows, 5, 3, 'T');
    const tWorld = sandboxWorld(tRows, {
      condition: 'all-torches',
      torches: [{ x: 5, y: 3 }],
    });
    const ts = newState(tWorld, 'ice-cave', 0, 0, 4.3, 5.5);
    ts.unlockedBombs.push('fire');
    equipBomb(ts, 'fire');
    ts.bombs.push({
      id: 903,
      kind: 'fire',
      x: 5.5,
      y: 4.2,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: FIRE_FUSE,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(tWorld, ts, 0.35); // before 1.3s FIRE_FUSE: still unlit!
    expect(ts.bombs).toHaveLength(1);
    expect(ts.torches[0]?.lit).toBe(false);
    stepSeconds(tWorld, ts, FIRE_FUSE);
    expect(ts.torches[0]?.lit).toBe(true);
    expect(ts.roomSolved).toBe(true);

    // 3. Grounded bomb rolling onto 'O' floor button triggers and solves 'hold-buttons'
    const bRows = [...OPEN_CRYPT];
    setCell(bRows, 7, 6, 'O');
    const bWorld = sandboxWorld(bRows, { condition: 'hold-buttons' });
    const bs = newState(bWorld, 'ice-cave', 0, 0, 3.5, 6.5);
    expect(bs.roomSolved).toBe(false);
    bs.bombs.push({
      id: 904,
      kind: 'bomb',
      x: 5.8,
      y: 6.5,
      vx: 6.5,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: BOMB_FUSE,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(bWorld, bs, 0.5);
    expect(bs.roomSolved).toBe(true);
  });

  it('rolls stationary dropped bombs downhill along all 4 directional slopes (n, s, e, w)', () => {
    const cases: Array<{
      slope: 'n' | 's' | 'e' | 'w';
      cells: Array<[number, number]>;
      drop: [number, number];
      crate: [number, number];
    }> = [
      {
        slope: 'n',
        cells: [
          [5, 6],
          [5, 5],
        ],
        drop: [5.5, 6.5],
        crate: [5, 3],
      },
      {
        slope: 's',
        cells: [
          [5, 5],
          [5, 6],
        ],
        drop: [5.5, 5.5],
        crate: [5, 8],
      },
      {
        slope: 'e',
        cells: [
          [4, 6],
          [5, 6],
        ],
        drop: [4.5, 6.5],
        crate: [7, 6],
      },
      {
        slope: 'w',
        cells: [
          [6, 6],
          [5, 6],
        ],
        drop: [6.5, 6.5],
        crate: [3, 6],
      },
    ];

    for (const c of cases) {
      const rows = [...OPEN_CRYPT];
      for (const [sx, sy] of c.cells) setCell(rows, sx, sy, c.slope);
      setCell(rows, c.crate[0], c.crate[1], 'W');
      const world = sandboxWorld(rows);
      const s = newState(world, 'ice-cave', 0, 0, c.drop[0], c.drop[1]);

      placeDownChute(world, s);
      expect(s.bombs).toHaveLength(1);
      // Step away from blast while the stationary-dropped bomb accelerates downhill on its own
      stepSeconds(world, s, BOMB_FUSE + 0.15);
      expect(
        tileAt(world, s, 'ice-cave', 0, 0, c.crate[0], c.crate[1]),
        `slope '${c.slope}' failed to bowl crate`,
      ).toBe('.');
    }
  });

  it('solves Room 1 (Entry Hall) & Room 2 (Switch Antechamber) via bomb place/kick and single floor switch to claim crypt-key-1', () => {
    const world = campaignWorld();

    // --- 1. Entry Hall (1, 3): kick/place bomb to smash crate W at (8, 6) ---
    const s = newState(world, 'ice-cave', 1, 3, 6.5, 6.5);
    expect(tileAt(world, s, 'ice-cave', 1, 3, 8, 6)).toBe('W');
    kickA(world, s, 1, 0);
    stepSeconds(world, s, BOMB_FUSE + 0.1);
    expect(tileAt(world, s, 'ice-cave', 1, 3, 8, 6)).toBe('.');

    // Walk East through the newly opened corridor into Switch Antechamber (2, 3)
    let transitioned = false;
    for (let i = 0; i < 120 && !transitioned; i++) {
      transitioned = tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    }
    expect(transitioned).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 3]);
    expect(s.roomSolved).toBe(false);

    // --- 2. Switch Antechamber (2, 3): step onto the single floor switch O at (5, 3) ---
    s.enemies = [];
    s.x = 5.5;
    s.y = 4.5;
    stepSeconds(world, s, 0.5, { dx: 0, dy: -1 });
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.id === 'crypt-key-1')).toBe(true);

    // Collect crypt-key-1 at dead center (5.5, 6.5)
    s.x = 5.5;
    s.y = 6.5;
    stepSeconds(world, s, 0.2);
    expect(s.smallKeys).toBe(1);

    // Also verify West inset bramble (2, 6) in Entry Hall burns cleanly once Fire is unlocked
    enterRoom(world, s, 'ice-cave', 1, 3, 3.5, 6.5);
    s.unlockedBombs.push('fire');
    equipBomb(s, 'fire');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(tileAt(world, s, 'ice-cave', 1, 3, 2, 6)).toBe('.');
  });

  it('solves Room 3 (Crystal Crossroads) & Room 4 (Vault of Sparks) via bomb place and orthogonal kicks', () => {
    const world = campaignWorld();

    // --- 3. Crystal Crossroads (1, 2): kick bomb East down row 5 into C (5, 5) ---
    const s = newState(world, 'ice-cave', 1, 2, 3.2, 5.5);
    expect(s.crystalColor).toBe('red');
    kickA(world, s, 1, 0);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(s.crystalColor).toBe('blue'); // East 'R' barriers at (8, 5..7) are now flat!

    // Walk East from Crystal Crossroads into Vault of Sparks (2, 2)
    s.x = 7.5;
    s.y = 6.5;
    let enteredVault = false;
    for (let i = 0; i < 120 && !enteredVault; i++) {
      enteredVault = tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    }
    expect(enteredVault).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 2]);

    // --- 4. Vault of Sparks (2, 2): grab center crypt-key-2, blast % (5, 5), then kick bomb into C (8, 5) & unlock N door ---
    s.enemies = [];
    // R at (4, 6) is flat while crystalColor === 'blue' -> walk East to dead center (5.5, 6.5) for crypt-key-2
    s.x = 3.5;
    s.y = 6.5;
    stepSeconds(world, s, 0.85, { dx: 1, dy: 0 });
    expect(s.smallKeys).toBe(1);
    expect(s.collectedPickups.has('crypt-key-2')).toBe(true);
    expect(s.pickupFreezeTimer).toBe(0);

    // Stage 1: kick bomb from (3.2, 5.5) East to break '%' at (5, 5)
    expect(tileAt(world, s, 'ice-cave', 2, 2, 5, 5)).toBe('%');
    s.x = 3.2;
    s.y = 5.5;
    s.bombCooldown = 0;
    kickA(world, s, 1, 0);
    stepSeconds(world, s, BOMB_FUSE + 0.1);
    expect(tileAt(world, s, 'ice-cave', 2, 2, 5, 5)).toBe('.');

    // Stage 2: step onto the cleared (5.5, 5.5) gap and kick bomb East into C (8, 5)!
    s.x = 5.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    kickA(world, s, 1, 0);
    stepSeconds(world, s, BOMB_FUSE + 0.1);
    expect(s.crystalColor).toBe('red'); // 'U' barriers at (5, 2..3) are now flat!

    // Walk North along col 5 to unlock 'D' at (5, 0) and enter Alchemist Reliquary (2, 1)
    s.x = 5.5;
    s.y = 3.5;
    let enteredReliquary = false;
    for (let i = 0; i < 120 && !enteredReliquary; i++) {
      enteredReliquary = tick(world, s, { dx: 0, dy: -1 }, FIXED_DT);
    }
    expect(enteredReliquary).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 1]);
    expect(s.smallKeys).toBe(0);
  });

  it('solves Room 5 (Alchemist Reliquary) & Room 6 (Lantern Hall) via Fire kicks to unlock midpoint warp', () => {
    const world = campaignWorld();

    // --- 5. Alchemist Reliquary (2, 1): claim Fire Bomb & kick Fire up both North lanes ---
    const s = newState(world, 'ice-cave', 2, 1, 5.5, 6.5);
    s.enemies.push({
      id: 99,
      kind: 'slime',
      x: 5.5,
      y: 9.5,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: -1,
      hp: 2,
      maxHp: 2,
      armored: false,
      exposedTimer: 0,
      invulnTimer: 0,
      aiTimer: 0.5,
      phase: 1,
      aiState: 'chase',
      stateTimer: 0,
      stumbleTimer: 0,
      homeX: 5.5,
      homeY: 9.5,
    });
    stepSeconds(world, s, 0.15);
    expect(s.unlockedBombs).toContain('fire');
    expect(s.equipped).toBe('fire');
    expect(s.pickupFreezeTimer).toBeGreaterThan(1.0);
    // While pickupFreezeTimer is active, monsters and player movement are frozen
    const slimeXBefore = s.enemies[0]!.x;
    const slimeYBefore = s.enemies[0]!.y;
    tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    expect(s.x).toBe(5.5);
    expect([s.enemies[0]!.x, s.enemies[0]!.y]).toEqual([slimeXBefore, slimeYBefore]);
    stepSeconds(world, s, 1.25);
    expect(s.pickupFreezeTimer).toBe(0);
    s.enemies = [];
    expect(s.roomSolved).toBe(false);

    // Kick Fire North into NW brazier (2, 2) from (2.5, 4.5)
    s.x = 2.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    kickA(world, s, 0, -1);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.torches.find((t) => t.x === 2 && t.y === 2)?.lit).toBe(true);

    // Kick Fire North into NE brazier (8, 2) from (8.5, 4.5) -> opens West 'S' shutters!
    s.x = 8.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    kickA(world, s, 0, -1);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.torches.every((t) => t.lit)).toBe(true);
    expect(s.roomSolved).toBe(true);

    // Burn West brambles (3, 6)
    s.x = 4.5;
    s.y = 6.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(tileAt(world, s, 'ice-cave', 2, 1, 3, 6)).toBe('.');

    let enteredLantern = false;
    for (let i = 0; i < 150 && !enteredLantern; i++) {
      enteredLantern = tick(world, s, { dx: -1, dy: 0 }, FIXED_DT);
    }
    expect(enteredLantern).toBe(true);
    expect([s.rx, s.ry]).toEqual([1, 1]);

    // --- 6. Lantern Hall (1, 1): defeat Ice Golem (cinderhull) miniboss to unlock midpoint warp ---
    expect(s.cryptWarpUnlocked).toBe(false);
    const miniboss = s.enemies[0]!;
    expect(miniboss.kind).toBe('cinderhull');
    for (let step = 0; step < 40 && s.enemies.length > 0; step++) {
      const b = s.enemies[0]!;
      b.invulnTimer = 0;
      s.hp = s.maxHp;
      if (b.armored) {
        b.x = 5.5;
        b.y = 5.2;
        equipBomb(s, 'fire');
        s.x = 5.5;
        s.y = 8.2;
        s.vx = 0;
        s.vy = 0;
        s.bombCooldown = 0;
        kickA(world, s, 0, -1);
        for (let i = 0; i < 95 && b.armored; i++) {
          b.x = 5.5;
          b.y = 5.2;
          s.hp = s.maxHp;
          tick(world, s, { dx: 0, dy: 1 }, FIXED_DT);
        }
        equipBomb(s, 'bomb');
      } else {
        s.x = b.x;
        s.y = Math.min(10.0, b.y + 1.8);
        s.vx = 0;
        s.vy = 0;
        s.bombCooldown = 0;
        kickA(world, s, 0, -1);
        stepTicks(world, s, 28);
      }
    }
    expect(s.enemies).toHaveLength(0);
    expect(s.roomSolved).toBe(true);
    expect(s.cryptWarpUnlocked).toBe(true);
  });

  it('solves Room 7 (Bramble Hall) & Room 8 (Hall of Three Flames) via timed & ordered Fire kicks', () => {
    const world = campaignWorld();

    // --- 7. Bramble Hall (0, 3): strip & defeat 2 Shielders, then light both 7s North braziers ---
    const s = newState(world, 'ice-cave', 0, 3, 5.5, 6.5);
    s.unlockedBombs.push('fire');
    s.maxBombs = 3;

    // Strip & defeat both Shielders
    for (let round = 0; round < 10 && s.enemies.length > 0; round++) {
      const sh = s.enemies[0]!;
      sh.invulnTimer = 0;
      s.hp = s.maxHp;
      if (sh.armored) {
        s.bombs.push({
          id: 700 + round,
          kind: 'fire',
          x: sh.x,
          y: sh.y,
          vx: 0,
          vy: 0,
          z: 0,
          vz: 0,
          fuse: 0.005,
          graceOverlap: false,
          shoveCount: 0,
        });
        tick(world, s, idle, FIXED_DT);
      } else {
        equipBomb(s, 'bomb');
        s.x = sh.x;
        s.y = Math.min(10.2, sh.y + 1.7);
        s.vx = 0;
        s.vy = 0;
        s.bombCooldown = 0;
        kickA(world, s, 0, -1);
        stepSeconds(world, s, 0.45);
      }
    }
    expect(s.enemies).toHaveLength(0);

    // Kick Fire West into NW torch (2, 2), roll East, and kick Fire East into NE torch (8, 2)
    equipBomb(s, 'fire');
    s.x = 4.5;
    s.y = 2.5;
    s.vx = 0;
    s.vy = 0;
    s.bombCooldown = 0;
    kickA(world, s, -1, 0);
    rollB(world, s, 1, 0);
    stepSeconds(world, s, 0.5, { dx: 1, dy: 0 });
    s.x = 6.5;
    s.y = 2.5;
    s.bombCooldown = 0;
    kickA(world, s, 1, 0);
    stepSeconds(world, s, FIRE_FUSE + 0.15);

    expect(s.torches.every((t) => t.lit)).toBe(true);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.id === 'crypt-shard')).toBe(true);

    // --- 8. Hall of Three Flames (0, 2): ordered Fire kicks I (SW) -> II (NW) -> III (NE) ---
    enterRoom(world, s, 'ice-cave', 0, 2, 5.5, 10.5);
    s.enemies = [];
    equipBomb(s, 'fire');

    // Shot I: kick West from (4.5, 9.5) into (2, 9)
    s.x = 4.5;
    s.y = 9.5;
    s.bombCooldown = 0;
    kickA(world, s, -1, 0);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.orderedStep).toBe(1);

    // Shot II: kick North past '~' water from (2.5, 5.5) into (2, 2)
    s.x = 2.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    kickA(world, s, 0, -1);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.orderedStep).toBe(2);

    // Shot III: kick East from (6.2, 2.5) into (8, 2)
    s.x = 6.2;
    s.y = 2.5;
    s.bombCooldown = 0;
    kickA(world, s, 1, 0);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(s.orderedStep).toBe(3);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.id === 'crypt-boss-key')).toBe(true);

    // Collect crypt-boss-key at dead center (5.5, 6.5)
    s.x = 5.5;
    s.y = 6.5;
    stepSeconds(world, s, 0.2);
    expect(s.hasBossKey).toBe(true);
  });

  it('solves Room 9 (Sanctum Ante-Room) & Room 10 (Sanctum of Ash) using orthogonal kicks against Cinderhull', () => {
    const world = campaignWorld();

    // --- 9. Sanctum Ante-Room (0, 1): kick bomb West into crate cache (3, 8) & unlock Boss Door K ---
    const s = newState(world, 'ice-cave', 0, 1, 5.5, 8.5);
    s.unlockedBombs.push('fire');
    s.hasBossKey = true;
    s.hp = 4; // damaged so ante-heart (+2 hp) visibly heals Pip
    expect(tileAt(world, s, 'ice-cave', 0, 1, 3, 8)).toBe('W');

    equipBomb(s, 'bomb');
    kickA(world, s, -1, 0);
    stepSeconds(world, s, BOMB_FUSE + 0.1);
    expect(tileAt(world, s, 'ice-cave', 0, 1, 3, 8)).toBe('.');

    // Walk into West cache (2.5, 8.5) to claim ante-heart
    s.x = 2.5;
    s.y = 8.5;
    stepSeconds(world, s, 0.2);
    expect(s.hp).toBe(6);

    // Walk North along col 5 through Boss Door 'K' (5, 0) into Sanctum of Ash (0, 0)
    s.x = 5.5;
    s.y = 2.5;
    let enteredBoss = false;
    for (let i = 0; i < 120 && !enteredBoss; i++) {
      enteredBoss = tick(world, s, { dx: 0, dy: -1 }, FIXED_DT);
    }
    expect(enteredBoss).toBe(true);
    expect([s.rx, s.ry]).toEqual([0, 0]);

    // --- 10. Frozen Sanctum (0, 0): light corner braziers across 3 Ice Storm snuffs to defeat Ice Wraith ---
    const boss = s.enemies[0]!;
    expect(boss.kind).toBe('wickgeist');
    expect(boss.armored).toBe(true);

    for (let volley = 0; volley < 10 && s.enemies.length > 0; volley++) {
      if (!s.torches.some((t) => t.lit)) {
        equipBomb(s, 'fire');
        s.x = 2.5;
        s.y = 4.5;
        s.vx = 0;
        s.vy = 0;
        s.bombCooldown = 0;
        kickA(world, s, 0, -1);
        stepSeconds(world, s, FIRE_FUSE + 0.15);
        equipBomb(s, 'bomb');
      }
      const geist = s.enemies[0];
      if (!geist) break;
      geist.invulnTimer = 0;
      s.hp = s.maxHp;
      s.x = geist.x;
      s.y = Math.min(10.0, geist.y + 1.8);
      s.vx = 0;
      s.vy = 0;
      s.bombCooldown = 0;
      kickA(world, s, 0, -1);
      stepSeconds(world, s, 0.45);
    }
    expect(s.enemies).toHaveLength(0);
    expect(s.roomSolved).toBe(true);
    // Sweep across (4.2, 6.5) and (6.8, 6.5) to collect any remaining boss reward pickup
    s.x = 4.2;
    s.y = 6.5;
    stepSeconds(world, s, 1.35);
    s.x = 6.8;
    s.y = 6.5;
    stepSeconds(world, s, 1.35);
    expect(s.collectedPickups.has('boss-heart-container')).toBe(true);
    expect(s.cores).toContain('cinder');
  });

  it('keeps every Overworld cracked-wall (%) and bramble (B) secret solvable with physics bombs', () => {
    const world = campaignWorld();

    // 1. Millbrook Square (3, 2): rusted smithy '%' at (7, 1) -> ow-smithy-shard at (8.5, 1.5)
    const s = newState(world, 'overworld', 3, 2, 6.5, 1.5);
    s.unlockedBombs.push('fire');
    placeDownChute(world, s);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('.');
    stepSeconds(world, s, 0.6, { dx: 1, dy: 0 });
    expect(s.collectedPickups.has('ow-smithy-shard')).toBe(true);

    // 2. Millbrook West (2, 2): sealed bramble cage 'B' at (4, 4) guards ow-west-powder at (3.5, 4.5)
    enterRoom(world, s, 'overworld', 2, 2, 5.5, 4.5);
    stepSeconds(world, s, 0.5, { dx: -1, dy: 0 });
    expect(s.x).toBeGreaterThan(5.1);
    expect(s.collectedPickups.has('ow-west-powder')).toBe(false);
    equipBomb(s, 'fire');
    s.bombCooldown = 0;
    kickA(world, s, -1, 0);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 2, 2, 4, 4)).toBe('.');
    stepSeconds(world, s, 0.8, { dx: -1, dy: 0 });
    expect(s.collectedPickups.has('ow-west-powder')).toBe(true);

    // 3. Orchard Gate (2, 3): East cracked gate '%' at (9, 6)
    enterRoom(world, s, 'overworld', 2, 3, 8.5, 6.5);
    s.enemies = [];
    equipBomb(s, 'bomb');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 2, 3, 9, 6)).toBe('.');

    // 4. Bramble Woods (3, 3): NE brambles 'B' at (7, 3) -> ow-woods-shard at (8.5, 3.5)
    enterRoom(world, s, 'overworld', 3, 3, 6.5, 3.5);
    s.enemies = [];
    equipBomb(s, 'fire');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, FIRE_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 3, 7, 3)).toBe('.');
    stepSeconds(world, s, 0.6, { dx: 1, dy: 0 });
    expect(s.collectedPickups.has('ow-woods-shard')).toBe(true);

    // 5. Cinder Trail (3, 4): canyon satchel '%' at (7, 7) -> ow-trail-satchel at (8.5, 7.5) & upper '%' (8, 4)
    enterRoom(world, s, 'overworld', 3, 4, 6.5, 7.5);
    s.enemies = [];
    equipBomb(s, 'bomb');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 4, 7, 7)).toBe('.');
    stepSeconds(world, s, 0.6, { dx: 1, dy: 0 });
    expect(s.collectedPickups.has('ow-trail-satchel')).toBe(true);
    stepSeconds(world, s, 1.3);

    s.x = 7.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 4, 8, 4)).toBe('.');

    // 6. Ice Cave Arch (3, 5): mausoleum seal '%' at (5, 6) -> enter stairs '>' at (5, 5)
    enterRoom(world, s, 'overworld', 3, 5, 5.5, 7.5);
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 5, 5, 6)).toBe('.');
    s.x = 5.5;
    s.y = 7.2;
    s.vx = 0;
    s.vy = 0;
    for (let i = 0; i < 120 && s.zone !== 'ice-cave'; i++) {
      tick(world, s, { dx: 0, dy: -1 }, FIXED_DT);
    }
    expect([s.zone, s.rx, s.ry]).toEqual(['ice-cave', 1, 3]);
  });
});
