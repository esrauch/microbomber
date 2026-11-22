import { describe, expect, it } from 'vitest';
import {
  FIXED_DT,
  INPUT_BUFFER_WINDOW,
  PICKUP_MAGNET_RADIUS,
  ROLL_DISTANCE,
  ROLL_DURATION,
  ROLL_IFRAME_END,
  ROLL_IFRAME_START,
  ROLL_RECOVERY,
  ROOM_H,
  ROOM_W,
  type World,
  campaignWorld,
  equipBomb,
  exportSave,
  importSave,
  isRollInvulnerable,
  newState,
  roomKey,
  tick,
  tileAt,
} from '../src/game/world';
import { idle, kickA, rollB, stepSeconds, tapA } from './input';

/** Build a clean 11x13 sandbox room so geometry, hazards, and walls are 100% deterministic. */
function sandboxWorld(rows: string[]): World {
  const world: World = { rooms: new Map() };
  world.rooms.set(roomKey('overworld', 0, 0), {
    zone: 'overworld',
    rx: 0,
    ry: 0,
    name: 'Test Sandbox',
    rows,
  });
  return world;
}

const OPEN_ROOM = Array.from({ length: ROOM_H }, (_, y) =>
  y === 0 || y === ROOM_H - 1 ? '#'.repeat(ROOM_W) : `#${'.'.repeat(ROOM_W - 2)}#`,
);

describe('Phase 1: Roll, Pull out, 360° analog throw, input buffer, magnet pickups, and v2->v3 save migration', () => {
  it('rolls ~2.0 tiles in 0.25s along analog stick or idle facing, then allows walking during 0.35s recovery', () => {
    const world = sandboxWorld(OPEN_ROOM);
    const s = newState(world, 'overworld', 0, 0, 3.5, 6.5);

    // Idle roll uses current facing (defaults to north (0, -1))
    rollB(world, s);
    expect(s.x).toBeCloseTo(3.5, 3);
    expect(s.y).toBeCloseTo(6.5 - ROLL_DISTANCE, 2);
    expect(s.rollTimer).toBe(0);
    expect(s.rollRecoveryTimer).toBeCloseTo(ROLL_RECOVERY, 3);

    // During recovery, normal walking works, while pressing B early (outside buffer) cannot start a roll yet
    const yAfterRoll = s.y;
    for (let i = 0; i < 6; i++) tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    expect(s.x).toBeGreaterThan(3.8);
    expect(s.rollRecoveryTimer).toBeCloseTo(ROLL_RECOVERY - 6 * FIXED_DT, 3);

    // Wait out remaining recovery + bomb cooldown, then roll along a 360° diagonal stick angle
    stepSeconds(world, s, 0.7);
    s.bombs = [];
    s.x = 3.5;
    s.y = yAfterRoll + 2.0;
    const diagX = Math.SQRT1_2;
    const diagY = Math.SQRT1_2;
    rollB(world, s, diagX, diagY);
    expect(s.x - 3.5).toBeCloseTo(ROLL_DISTANCE * diagX, 2);
    expect(s.y - (yAfterRoll + 2.0)).toBeCloseTo(ROLL_DISTANCE * diagY, 2);
  });

  it('slides smoothly along walls when rolling diagonally and stops cleanly at solids, pits (^), and water (~)', () => {
    const rows = OPEN_ROOM.map((r) => r.split(''));
    // Put a pit at (6, 5) and water at (6, 8)
    rows[5]![6] = '^';
    rows[8]![6] = '~';
    const world = sandboxWorld(rows.map((r) => r.join('')));

    // Diagonal roll into the north wall (y = 0) slides east while stopping flush against y = 1.28
    const s = newState(world, 'overworld', 0, 0, 3.5, 1.4);
    rollB(world, s, Math.SQRT1_2, -Math.SQRT1_2);
    expect(s.y).toBeCloseTo(1.14, 2);
    expect(s.x).toBeGreaterThan(4.6);

    // Rolling directly toward a pit ('^') stops at the pit edge with 0 fall damage
    const p = newState(world, 'overworld', 0, 0, 4.8, 5.5);
    const startHp = p.hp;
    rollB(world, p, 1, 0);
    expect(p.hp).toBe(startHp);
    expect(p.x).toBeLessThan(6.0);
    expect(tileAt(world, p, 'overworld', 0, 0, Math.floor(p.x), Math.floor(p.y))).toBe('.');

    // Rolling directly toward water ('~') stops at the water edge with 0 fall damage
    const w = newState(world, 'overworld', 0, 0, 4.8, 8.5);
    rollB(world, w, 1, 0);
    expect(w.hp).toBe(startHp);
    expect(w.x).toBeLessThan(6.0);
    expect(tileAt(world, w, 'overworld', 0, 0, Math.floor(w.x), Math.floor(w.y))).toBe('.');
  });

  it('grants i-frames during middle 0.15s [0.05, 0.20] against enemies and spikes, while outer frames & recovery take damage', () => {
    const spikeRows = OPEN_ROOM.map((r, y) => (y === 6 ? '#....!....#' : r));
    const world = sandboxWorld(spikeRows);

    // 1. Check isRollInvulnerable boundaries directly
    expect(isRollInvulnerable({ rollTimer: 0 })).toBe(false);
    expect(isRollInvulnerable({ rollTimer: ROLL_DURATION - 0.02 })).toBe(false); // 0.02s < 0.05s
    expect(isRollInvulnerable({ rollTimer: ROLL_DURATION - ROLL_IFRAME_START })).toBe(true); // 0.05s
    expect(isRollInvulnerable({ rollTimer: ROLL_DURATION - 0.12 })).toBe(true); // middle
    expect(isRollInvulnerable({ rollTimer: ROLL_DURATION - ROLL_IFRAME_END })).toBe(true); // 0.20s
    expect(isRollInvulnerable({ rollTimer: ROLL_DURATION - 0.23 })).toBe(false); // 0.23s > 0.20s

    // 2. Rolling from x=4.5 east across a 1-tile spike strip at x=5 crosses it during [0.0625s, 0.1875s] unscathed!
    const s = newState(world, 'overworld', 0, 0, 4.5, 6.5);
    equipBomb(s, null);
    rollB(world, s, 1, 0);
    expect(s.x).toBeCloseTo(6.5, 2);
    expect(s.hp).toBe(s.maxHp);

    // 3. Rolling through an enemy during i-frames deals 0 damage and applies 0 knockback shove
    const eState = newState(world, 'overworld', 0, 0, 3.5, 4.5);
    equipBomb(eState, null);
    eState.enemies.push({
      id: 50,
      kind: 'slime',
      x: 4.5,
      y: 4.5,
      vx: 0,
      vy: 0,
      fx: -1,
      fy: 0,
      hp: 2,
      maxHp: 2,
      armored: false,
      exposedTimer: 0,
      invulnTimer: 0,
      aiTimer: 0,
      phase: 1,
      aiState: 'patrol',
      stateTimer: 0,
      stumbleTimer: 0,
      homeX: 4.5,
      homeY: 4.5,
    });
    rollB(world, eState, 1, 0);
    expect(eState.hp).toBe(eState.maxHp);
    expect(eState.vx).toBe(0);
    expect(eState.x).toBeGreaterThan(5.2);

    // 4. Outer frames (< 0.05s and > 0.20s) and recovery (rollTimer === 0, rollRecoveryTimer > 0) DO take damage
    const early = newState(world, 'overworld', 0, 0, 5.5, 6.5); // standing on '!' at (5, 6)
    equipBomb(early, null);
    tick(world, early, { dx: 1, dy: 0, holdB: true }, FIXED_DT); // elapsed = 1/60s (< 0.05s)
    expect(early.hp).toBe(early.maxHp - 1);

    const late = newState(world, 'overworld', 0, 0, 3.65, 6.5); // reaches spike at x=5 after 0.20s!
    equipBomb(late, null);
    tick(world, late, { dx: 1, dy: 0, holdB: true }, FIXED_DT);
    for (let i = 1; i < 13; i++) tick(world, late, { dx: 1, dy: 0 }, FIXED_DT); // 13/60 ≈ 0.2167s > 0.20s on '!'
    expect(late.hp).toBe(late.maxHp - 1);

    const rec = newState(world, 'overworld', 0, 0, 2.5, 5.5); // safe roll from 2.5 -> 4.5 on row 5
    equipBomb(rec, null);
    rollB(world, rec, 1, 0);
    expect(rec.hp).toBe(rec.maxHp);
    // Step onto spike (5, 6) while in recovery (rollTimer === 0, rollRecoveryTimer > 0)
    rec.x = 5.5;
    rec.y = 6.5;
    tick(world, rec, idle, FIXED_DT);
    expect(rec.rollRecoveryTimer).toBeGreaterThan(0);
    expect(rec.hp).toBe(rec.maxHp - 1);
  });

  it('never lays the equipped bomb: rolling is a pure dodge whatever is equipped', () => {
    const world = sandboxWorld(OPEN_ROOM);
    const s = newState(world, 'overworld', 0, 0, 4.5, 6.5);
    expect(s.equipped).toBe('bomb');
    rollB(world, s, 1, 0);
    expect(s.bombs).toHaveLength(0);
    expect(s.bombCooldown).toBe(0);
    expect(s.x).toBeCloseTo(6.5, 2);
  });

  it('kicks only orthogonally, and a kicked bomb rolling into a crystal switch flips it', () => {
    const rows = OPEN_ROOM.map((r) => r.split(''));
    rows[3]![7] = 'C'; // crystal switch east of Pip
    const world = sandboxWorld(rows.map((r) => r.join('')));

    // A diagonal stick aims along its dominant axis: the bomb rolls due east
    const s = newState(world, 'overworld', 0, 0, 4.5, 3.5);
    kickA(world, s, 0.8, 0.6);
    const b = s.bombs[0]!;
    expect(b.kicked).toBe(true);
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBe(0);

    stepSeconds(world, s, 1.55);
    expect(s.crystalColor).toBe('blue');
  });

  it('buffers roll presses during the last 130ms of recovery and drop/lift presses during bombCooldown', () => {
    const world = sandboxWorld(OPEN_ROOM);

    // 1. Roll buffer: pressing B 90ms before recovery ends fires the next roll automatically!
    const r = newState(world, 'overworld', 0, 0, 2.5, 6.5);
    equipBomb(r, null);
    rollB(world, r, 1, 0); // rolls to 4.5, recovery = 0.35s
    // Advance until ~0.09s left in recovery (inside 0.13s INPUT_BUFFER_WINDOW)
    for (let i = 0; i < 60 && r.rollRecoveryTimer > 0.095; i++) tick(world, r, idle, FIXED_DT);
    // Tap B once during recovery
    tick(world, r, { dx: 1, dy: 0, holdB: true }, FIXED_DT);
    tick(world, r, { dx: 1, dy: 0 }, FIXED_DT);
    expect(r.rollBufferTimer).toBeGreaterThan(0);
    // Step past end of recovery with B released: buffered roll fires and carries Pip past x=6!
    stepSeconds(world, r, 0.35, { dx: 1, dy: 0 });
    expect(r.x).toBeGreaterThan(6.2);

    // Pressing B too early (> 0.15s before recovery ends) expires without rolling
    const rEarly = newState(world, 'overworld', 0, 0, 2.5, 6.5);
    equipBomb(rEarly, null);
    rollB(world, rEarly, 1, 0); // x ≈ 4.5, recovery = 0.35s
    tick(world, rEarly, { ...idle, holdB: true }, FIXED_DT); // 0.33s left > 0.13s window
    stepSeconds(world, rEarly, 0.45);
    expect(rEarly.x).toBeCloseTo(4.5, 2);

    // 2. Pull-out buffer: tapping A ~80ms before bombCooldown ends pulls a bomb overhead when ready!
    const d = newState(world, 'overworld', 0, 0, 3.5, 6.5);
    tapA(world, d); // pulls & drops bomb #1 at (3.5, 6.5), bombCooldown = 0.7s
    // Walk east off the first bomb so Pip is neither underfoot nor overlapping (3, 6)
    for (let i = 0; i < 60 && d.bombCooldown > INPUT_BUFFER_WINDOW - 0.04; i++) {
      tick(world, d, { dx: 1, dy: 0 }, FIXED_DT);
    }
    expect(d.bombCooldown).toBeGreaterThan(0);
    expect(d.bombs).toHaveLength(1);
    expect(d.heldBomb).toBeNull();
    tick(world, d, { ...idle, holdA: true }, FIXED_DT); // buffered Pull tap during last ~85ms of cooldown!
    tick(world, d, idle, FIXED_DT);
    expect(d.heldBomb).toBeNull(); // still on cooldown right now
    stepSeconds(world, d, 0.12);
    expect(d.heldBomb).toBe('bomb'); // auto-pulled overhead as soon as cooldown hit 0!
    tapA(world, d);
    expect(d.bombs).toHaveLength(2);
  });

  it('magnetizes pickups within ~1 tile into a stationary Pip while leaving distant pickups untouched', () => {
    const world = sandboxWorld(OPEN_ROOM);
    const s = newState(world, 'overworld', 0, 0, 5.5, 6.5);
    s.pickups = [
      { id: 'near-key', kind: 'small-key', x: 5.5 + 1.05, y: 6.5 }, // inside PICKUP_MAGNET_RADIUS (1.15)
      { id: 'far-key', kind: 'small-key', x: 5.5 + PICKUP_MAGNET_RADIUS + 0.35, y: 6.5 },
    ];

    stepSeconds(world, s, 0.3);
    expect(s.smallKeys).toBe(1);
    expect(s.collectedPickups.has('near-key')).toBe(true);
    expect(s.pickups).toHaveLength(1);
    expect(s.pickups[0]?.id).toBe('far-key');
    expect(s.pickups[0]?.x).toBeCloseTo(5.5 + PICKUP_MAGNET_RADIUS + 0.35, 4);
  });

  it('migrates v2 saves (slots -> equipped) and round-trips v3 saves cleanly', () => {
    const world = campaignWorld();
    const base = exportSave(newState(world));

    const v2WithFire = {
      ...base,
      version: 2,
      unlockedBombs: ['bomb', 'fire'],
      equipped: undefined,
      slots: ['fire', 'bomb'],
    };
    const loadedFire = importSave(world, v2WithFire);
    expect(loadedFire?.equipped).toBe('fire');

    const v2WithNone = {
      ...base,
      version: 2,
      unlockedBombs: ['bomb', 'fire'],
      equipped: undefined,
      slots: [null, 'bomb'],
    };
    const loadedNone = importSave(world, v2WithNone);
    expect(loadedNone?.equipped).toBeNull();
  });
});
