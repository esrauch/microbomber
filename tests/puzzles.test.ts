import { describe, expect, it } from 'vitest';
import {
  EMBER_FUSE,
  FIXED_DT,
  POWDER_FUSE,
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
  world.rooms.set(roomKey('ember-crypt', 0, 0), {
    zone: 'ember-crypt',
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

describe('Phase 3: Contact-radius triggers, directional slopes, Ember Crypt physics solves, and Overworld secrets', () => {
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
    const s = newState(world, 'ember-crypt', 0, 0, 5.5, 8.5);

    // Detonate off-axis Powder bomb at (5.5, 5.12): diagonal to (4, 4) 'C' and (6, 4) '%'
    // Note: cardinal cross rays from (5, 5) go through (5, 4), (5, 6), (4, 5), (6, 5) — NOT (4, 4) or (6, 4)!
    s.bombs.push({
      id: 901,
      kind: 'powder',
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
    expect(tileAt(world, s, 'ember-crypt', 0, 0, 6, 4)).toBe('.');

    // Obstructed bomb behind '#' wall does NOT flip walled 'C' at (2, 2)
    const wallRows = [...OPEN_CRYPT];
    setCell(wallRows, 2, 2, 'C');
    setCell(wallRows, 3, 2, '#');
    setCell(wallRows, 2, 3, '#');
    setCell(wallRows, 3, 3, '#');
    const wallWorld = sandboxWorld(wallRows);
    const wallTest = newState(wallWorld, 'ember-crypt', 0, 0, 5.5, 8.5);
    wallTest.bombs.push({
      id: 902,
      kind: 'powder',
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

    // 2. Live rolling Ember bomb brushing within 0.76 tiles of 'T' lights it BEFORE fuse expires!
    const tRows = [...OPEN_CRYPT];
    setCell(tRows, 5, 3, 'T');
    const tWorld = sandboxWorld(tRows, {
      condition: 'all-torches',
      torches: [{ x: 5, y: 3 }],
    });
    const ts = newState(tWorld, 'ember-crypt', 0, 0, 4.3, 5.5);
    ts.unlockedBombs.push('ember');
    equipBomb(ts, 'ember');
    ts.bombs.push({
      id: 903,
      kind: 'ember',
      x: 4.75,
      y: 4.6,
      vx: 0,
      vy: -7.0,
      z: 0,
      vz: 0,
      fuse: EMBER_FUSE,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(tWorld, ts, 0.35); // well before 1.3s EMBER_FUSE!
    expect(ts.bombs).toHaveLength(1);
    expect(ts.torches[0]?.lit).toBe(true);
    expect(ts.roomSolved).toBe(true);

    // 3. Grounded bomb rolling onto 'O' floor button triggers and solves 'hold-buttons'
    const bRows = [...OPEN_CRYPT];
    setCell(bRows, 7, 6, 'O');
    const bWorld = sandboxWorld(bRows, { condition: 'hold-buttons' });
    const bs = newState(bWorld, 'ember-crypt', 0, 0, 3.5, 6.5);
    expect(bs.roomSolved).toBe(false);
    bs.bombs.push({
      id: 904,
      kind: 'powder',
      x: 5.8,
      y: 6.5,
      vx: 6.5,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: POWDER_FUSE,
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
      const s = newState(world, 'ember-crypt', 0, 0, c.drop[0], c.drop[1]);

      placeDownChute(world, s);
      expect(s.bombs).toHaveLength(1);
      // Step away from blast while the stationary-dropped bomb accelerates downhill on its own
      stepSeconds(world, s, POWDER_FUSE + 0.15);
      expect(
        tileAt(world, s, 'ember-crypt', 0, 0, c.crate[0], c.crate[1]),
        `slope '${c.slope}' failed to bowl crate`,
      ).toBe('.');
    }
  });

  it('solves Room 1 (Crypt Foyer) & Room 2 (Block Antechamber) via slope chutes and blast-shove to claim crypt-key-1', () => {
    const world = campaignWorld();

    // --- 1. Crypt Foyer (1, 3): drop bomb on East 'ee' chute (6..7, 6) to smash crate W at (8, 6) ---
    const s = newState(world, 'ember-crypt', 1, 3, 6.5, 6.5);
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 8, 6)).toBe('W');
    placeDownChute(world, s);
    stepSeconds(world, s, 0.35, { dx: -1, dy: 0 });
    stepSeconds(world, s, POWDER_FUSE);
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 8, 6)).toBe('.');

    // Walk East through the newly opened chute into Block Antechamber (2, 3)
    let transitioned = false;
    for (let i = 0; i < 120 && !transitioned; i++) {
      transitioned = tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    }
    expect(transitioned).toBe(true);
    expect([s.rx, s.ry]).toEqual([2, 3]);
    expect(s.roomSolved).toBe(false);

    // --- 2. Block Antechamber (2, 3): blast-shove P (4, 4) -> O (4, 3), then bowl East 'n' chute -> O (8, 2) ---
    s.enemies = [];
    s.x = 4.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.35, { dx: 0, dy: 1 });
    stepSeconds(world, s, POWDER_FUSE);
    expect(s.blocks[0]).toMatchObject({ x: 4, y: 3 });
    expect(s.roomSolved).toBe(false); // East button (8, 2) still needs to be bowled!

    // Drop a bomb at the foot of the East 'n' chute (8.5, 5.5): rolls up into O (8, 2) & locks roomSolved!
    s.x = 8.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.8);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.id === 'crypt-key-1')).toBe(true);

    // Collect crypt-key-1 at (5.5, 6.5)
    s.x = 5.5;
    s.y = 6.5;
    stepSeconds(world, s, 0.2);
    expect(s.smallKeys).toBe(1);

    // Also verify West inset bramble (2, 6) in Crypt Foyer burns cleanly once Ember is unlocked
    enterRoom(world, s, 'ember-crypt', 1, 3, 3.5, 6.5);
    s.unlockedBombs.push('ember');
    equipBomb(s, 'ember');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    expect(tileAt(world, s, 'ember-crypt', 1, 3, 2, 6)).toBe('.');
  });

  it('solves Room 3 (Crystal Crossroads) & Room 4 (Vault of Sparks) via L-bank chute and 2-stage slope cannon', () => {
    const world = campaignWorld();

    // --- 3. Crystal Crossroads (1, 2): drop bomb on 'n' -> 'ee' L-chute (3.5, 7.5) to bank into C (5, 5) ---
    const s = newState(world, 'ember-crypt', 1, 2, 3.5, 7.5);
    expect(s.crystalColor).toBe('red');
    placeDownChute(world, s);
    stepSeconds(world, s, 0.25, { dx: 0, dy: 1 });
    stepSeconds(world, s, POWDER_FUSE + 0.15);
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

    // --- 4. Vault of Sparks (2, 2): grab SW crypt-key-2, bowl % (5, 5), then bowl C (8, 5) & unlock N door ---
    s.enemies = [];
    // RRR at y=9 is flat while crystalColor === 'blue' -> walk South to (3.5, 10.5) for crypt-key-2
    s.x = 3.5;
    s.y = 8.5;
    stepSeconds(world, s, 0.65, { dx: 0, dy: 1 });
    expect(s.smallKeys).toBe(1);
    expect(s.collectedPickups.has('crypt-key-2')).toBe(true);

    // Stage 1 cannon shot from (3.5, 5.5) down 'ee' breaks '%' at (5, 5)
    expect(tileAt(world, s, 'ember-crypt', 2, 2, 5, 5)).toBe('%');
    s.x = 3.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.25, { dx: -1, dy: 0 });
    stepSeconds(world, s, POWDER_FUSE + 0.1);
    expect(tileAt(world, s, 'ember-crypt', 2, 2, 5, 5)).toBe('.');

    // Stage 2 cannon shot from the exact same mouth (3.5, 5.5) rockets across (5, 5) & 'ee' into C (8, 5)!
    s.x = 3.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.25, { dx: -1, dy: 0 });
    stepSeconds(world, s, POWDER_FUSE + 0.1);
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

  it('solves Room 5 (Alchemist Reliquary) & Room 6 (Lantern Hall) via Ember slope chutes to unlock midpoint warp', () => {
    const world = campaignWorld();

    // --- 5. Alchemist Reliquary (2, 1): claim Ember Bomb & bowl both North 'n' chutes ---
    const s = newState(world, 'ember-crypt', 2, 1, 5.5, 6.5);
    stepSeconds(world, s, 0.15);
    expect(s.unlockedBombs).toContain('ember');
    expect(s.equipped).toBe('ember');
    expect(s.roomSolved).toBe(false);

    // Bowl NW brazier (2, 2) via West 'n' chute (2.5, 4.5)
    s.x = 2.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.45);
    expect(s.torches.find((t) => t.x === 2 && t.y === 2)?.lit).toBe(true);

    // Bowl NE brazier (8, 2) via East 'n' chute (8.5, 4.5) -> opens West 'S' shutters!
    s.x = 8.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.45);
    expect(s.torches.every((t) => t.lit)).toBe(true);
    expect(s.roomSolved).toBe(true);

    // Let bowled Ember bombs finish detonating so a satchel slot frees up, then burn West brambles (3, 6)
    stepSeconds(world, s, EMBER_FUSE);
    s.x = 4.5;
    s.y = 6.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    expect(tileAt(world, s, 'ember-crypt', 2, 1, 3, 6)).toBe('.');

    let enteredLantern = false;
    for (let i = 0; i < 150 && !enteredLantern; i++) {
      enteredLantern = tick(world, s, { dx: -1, dy: 0 }, FIXED_DT);
    }
    expect(enteredLantern).toBe(true);
    expect([s.rx, s.ry]).toEqual([1, 1]);

    // --- 6. Lantern Hall (1, 1): bowl corner 'n'/'s' feeders with Ember & defeat Wickgeist ---
    expect(s.cryptWarpUnlocked).toBe(false);
    // Bowl NW brazier (2, 2) from safe feeder (2.5, 4.5)
    equipBomb(s, 'ember');
    s.x = 2.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.5);
    expect(s.torches.some((t) => t.lit)).toBe(true);

    // Defeat Wickgeist with Blackpowder (re-bowling SE 's' feeder (8.5, 8.5) when Phase 2 snuffs a torch)
    equipBomb(s, 'powder');
    for (let volley = 0; volley < 10 && s.enemies.length > 0; volley++) {
      if (!s.torches.some((t) => t.lit)) {
        equipBomb(s, 'ember');
        s.x = 8.5;
        s.y = 8.5;
        s.vx = 0;
        s.vy = 0;
        s.bombCooldown = 0;
        placeDownChute(world, s);
        stepSeconds(world, s, 0.5);
        equipBomb(s, 'powder');
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
    expect(s.cryptWarpUnlocked).toBe(true);
  });

  it('solves Room 7 (Bramble Crypt) & Room 8 (Hall of Three Flames) via rapid banked chutes & ordered shots', () => {
    const world = campaignWorld();

    // --- 7. Bramble Crypt (0, 3): strip & defeat 2 Shielders, then bowl both 7s banked chutes ---
    const s = newState(world, 'ember-crypt', 0, 3, 5.5, 6.5);
    s.unlockedBombs.push('ember');
    s.maxBombs = 3;

    // Strip & defeat both Shielders
    for (let round = 0; round < 10 && s.enemies.length > 0; round++) {
      const sh = s.enemies[0]!;
      sh.invulnTimer = 0;
      s.hp = s.maxHp;
      if (sh.armored) {
        s.bombs.push({
          id: 700 + round,
          kind: 'ember',
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
        equipBomb(s, 'powder');
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

    // Bowl West banked chute (3.5, 4.5) -> (3, 2) 'w' -> (2, 2) 'T', roll East, and bowl East chute (7.5, 4.5) -> (8, 2) 'T'
    equipBomb(s, 'ember');
    s.x = 3.5;
    s.y = 4.5;
    s.vx = 0;
    s.vy = 0;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    rollB(world, s, 1, 0); // dodges 2 tiles East to ~5.5 while bomb #1 banks into NW torch!
    stepSeconds(world, s, 0.5, { dx: 1, dy: 0 }); // arrives at ~7.5 right as cooldown clears
    s.x = 7.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);

    expect(s.torches.every((t) => t.lit)).toBe(true);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.id === 'crypt-shard')).toBe(true);

    // --- 8. Hall of Three Flames (0, 2): ordered physics shots I (SW) -> II (NW) -> III (NE) ---
    enterRoom(world, s, 'ember-crypt', 0, 2, 5.5, 10.5);
    s.enemies = [];
    equipBomb(s, 'ember');

    // Shot I: SW 'ww' chute from (4.5, 9.5) into (2, 9)
    s.x = 4.5;
    s.y = 9.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.6);
    expect(s.orderedStep).toBe(1);

    // Shot II: NW 'n' chute past '~' water from (2.5, 5.5) into (2, 2)
    s.x = 2.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, 0.7);
    expect(s.orderedStep).toBe(2);

    // Shot III: NE 'n' -> 'ee' banked chute from (6.5, 4.5) into (8, 2)
    s.x = 6.5;
    s.y = 4.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    expect(s.orderedStep).toBe(3);
    expect(s.roomSolved).toBe(true);
    expect(s.pickups.some((p) => p.id === 'crypt-boss-key')).toBe(true);

    // Collect crypt-boss-key at (5.5, 7.5)
    s.x = 5.5;
    s.y = 7.5;
    stepSeconds(world, s, 0.2);
    expect(s.hasBossKey).toBe(true);
  });

  it('solves Room 9 (Sanctum Ante-Room) & Room 10 (Sanctum of Ash) using slope launch pads against Cinderhull', () => {
    const world = campaignWorld();

    // --- 9. Sanctum Ante-Room (0, 1): bowl open West crate cache (3, 8) via 'ww' chute & unlock Boss Door K ---
    const s = newState(world, 'ember-crypt', 0, 1, 5.5, 8.5);
    s.unlockedBombs.push('ember');
    s.hasBossKey = true;
    s.hp = 4; // damaged so ante-heart (+2 hp) visibly heals Pip
    expect(tileAt(world, s, 'ember-crypt', 0, 1, 3, 8)).toBe('W');

    equipBomb(s, 'powder');
    placeDownChute(world, s);
    stepSeconds(world, s, 0.25, { dx: 1, dy: 0 });
    stepSeconds(world, s, POWDER_FUSE + 0.1);
    expect(tileAt(world, s, 'ember-crypt', 0, 1, 3, 8)).toBe('.');

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

    // --- 10. Sanctum of Ash (0, 0): verify slope launch pad bowls Ember torpedo north into Cinderhull ---
    const boss = s.enemies[0]!;
    expect(boss.kind).toBe('cinderhull');
    expect(boss.armored).toBe(true);

    // Position Cinderhull north of the West 'n' launch pad (3, 7..8) and bowl an Ember shot uphill!
    boss.x = 3.5;
    boss.y = 5.2;
    boss.vx = 0;
    boss.vy = 0;
    equipBomb(s, 'ember');
    s.x = 3.5;
    s.y = 8.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    for (let i = 0; i < 95 && boss.armored; i++) {
      boss.x = 3.5;
      boss.y = 5.2;
      s.hp = s.maxHp;
      tick(world, s, { dx: 0, dy: 1 }, FIXED_DT);
    }
    expect(boss.armored).toBe(false); // Slope-launched Ember burned away Cinderhull's thorn wraps!

    // Finish all remaining boss phases to claim Heart Container & Cinder Core
    equipBomb(s, 'powder');
    for (let step = 0; step < 40 && s.enemies.length > 0; step++) {
      const b = s.enemies[0]!;
      b.invulnTimer = 0;
      s.hp = s.maxHp;
      if (b.armored) {
        b.x = 7.5;
        b.y = 5.2;
        equipBomb(s, 'ember');
        s.x = 7.5;
        s.y = 8.5;
        s.vx = 0;
        s.vy = 0;
        s.bombCooldown = 0;
        placeDownChute(world, s);
        for (let i = 0; i < 95 && b.armored; i++) {
          b.x = 7.5;
          b.y = 5.2;
          s.hp = s.maxHp;
          tick(world, s, { dx: 0, dy: 1 }, FIXED_DT);
        }
        equipBomb(s, 'powder');
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
    // Sweep across (4.2, 6.5) and (6.8, 6.5) to collect any remaining boss reward pickup
    s.x = 4.2;
    s.y = 6.5;
    stepSeconds(world, s, 0.2);
    s.x = 6.8;
    s.y = 6.5;
    stepSeconds(world, s, 0.2);
    expect(s.collectedPickups.has('boss-heart-container')).toBe(true);
    expect(s.cores).toContain('cinder');
  });

  it('keeps every Overworld cracked-wall (%) and bramble (B) secret solvable with physics bombs', () => {
    const world = campaignWorld();

    // 1. Millbrook Square (3, 2): rusted smithy '%' at (7, 1) -> ow-smithy-shard at (8.5, 1.5)
    const s = newState(world, 'overworld', 3, 2, 6.5, 1.5);
    s.unlockedBombs.push('ember');
    placeDownChute(world, s);
    stepSeconds(world, s, POWDER_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 2, 7, 1)).toBe('.');
    stepSeconds(world, s, 0.6, { dx: 1, dy: 0 });
    expect(s.collectedPickups.has('ow-smithy-shard')).toBe(true);

    // 2. Millbrook West (2, 2): brambles 'B' at (4, 5) -> ow-west-powder at (3.5, 4.5)
    enterRoom(world, s, 'overworld', 2, 2, 5.5, 4.5);
    equipBomb(s, 'ember');
    s.bombCooldown = 0;
    kickA(world, s, -1, 0);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    s.x = 3.5;
    s.y = 4.5;
    stepSeconds(world, s, 0.2);
    expect(s.collectedPickups.has('ow-west-powder')).toBe(true);

    // 3. Orchard Gate (2, 3): East cracked gate '%' at (9, 6)
    enterRoom(world, s, 'overworld', 2, 3, 8.5, 6.5);
    s.enemies = [];
    equipBomb(s, 'powder');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, POWDER_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 2, 3, 9, 6)).toBe('.');

    // 4. Bramble Woods (3, 3): NE brambles 'B' at (7, 3) -> ow-woods-shard at (8.5, 3.5)
    enterRoom(world, s, 'overworld', 3, 3, 6.5, 3.5);
    s.enemies = [];
    equipBomb(s, 'ember');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, EMBER_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 3, 7, 3)).toBe('.');
    stepSeconds(world, s, 0.6, { dx: 1, dy: 0 });
    expect(s.collectedPickups.has('ow-woods-shard')).toBe(true);

    // 5. Cinder Trail (3, 4): canyon satchel '%' at (7, 7) -> ow-trail-satchel at (8.5, 7.5) & upper '%' (8, 4)
    enterRoom(world, s, 'overworld', 3, 4, 6.5, 7.5);
    s.enemies = [];
    equipBomb(s, 'powder');
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, POWDER_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 4, 7, 7)).toBe('.');
    stepSeconds(world, s, 0.6, { dx: 1, dy: 0 });
    expect(s.collectedPickups.has('ow-trail-satchel')).toBe(true);

    s.x = 7.5;
    s.y = 5.5;
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, POWDER_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 4, 8, 4)).toBe('.');

    // 6. Ember Crypt Arch (3, 5): mausoleum seal '%' at (5, 6) -> enter stairs '>' at (5, 5)
    enterRoom(world, s, 'overworld', 3, 5, 5.5, 7.5);
    s.bombCooldown = 0;
    placeDownChute(world, s);
    stepSeconds(world, s, POWDER_FUSE + 0.15);
    expect(tileAt(world, s, 'overworld', 3, 5, 5, 6)).toBe('.');
    s.x = 5.5;
    s.y = 7.2;
    s.vx = 0;
    s.vy = 0;
    for (let i = 0; i < 120 && s.zone !== 'ember-crypt'; i++) {
      tick(world, s, { dx: 0, dy: -1 }, FIXED_DT);
    }
    expect([s.zone, s.rx, s.ry]).toEqual(['ember-crypt', 1, 3]);
  });
});
