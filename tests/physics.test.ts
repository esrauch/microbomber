import { describe, expect, it } from 'vitest';
import {
  BOMB_FRICTION,
  BOMB_RADIUS,
  BOMB_WALL_BOUNCE,
  FIXED_DT,
  KICK_SPEED,
  BOMB_FUSE,
  ROOM_H,
  ROOM_W,
  SHOVE_BOMB_SPEED,
  type State,
  type World,
  equipBomb,
  newState,
  roomKey,
  tick,
  tileAt,
} from '../src/game/world';
import { idle, kickA, stepSeconds, stepTicks, tapA } from './input';

/** Build a clean 11x13 sandbox world with optional connected neighbors for doorway tests. */
function sandboxWorld(rows: string[], extraRooms: Array<[number, number, string[]]> = []): World {
  const world: World = { rooms: new Map() };
  world.rooms.set(roomKey('overworld', 0, 0), {
    zone: 'overworld',
    rx: 0,
    ry: 0,
    name: 'Physics Sandbox',
    rows,
  });
  for (const [rx, ry, neighborRows] of extraRooms) {
    world.rooms.set(roomKey('overworld', rx, ry), {
      zone: 'overworld',
      rx,
      ry,
      name: `Neighbor ${rx},${ry}`,
      rows: neighborRows,
    });
  }
  return world;
}

const OPEN_ROOM = Array.from({ length: ROOM_H }, (_, y) =>
  y === 0 || y === ROOM_H - 1 ? '#'.repeat(ROOM_W) : `#${'.'.repeat(ROOM_W - 2)}#`,
);

describe('Phase 2: Deterministic 60 Hz bomb physics, bounce, kick, radial blast shove, chains, and safety', () => {
  it('exports Phase 2 physics constants and produces bit-identical trajectories at FIXED_DT', () => {
    expect(FIXED_DT).toBe(1 / 60);
    expect(BOMB_RADIUS).toBe(0.12);
    expect(BOMB_FRICTION).toBeGreaterThan(0);
    expect(BOMB_WALL_BOUNCE).toBeGreaterThan(0);
    expect(KICK_SPEED).toBeGreaterThan(0);
    expect(SHOVE_BOMB_SPEED).toBeGreaterThan(0);

    const runScenario = (): Array<number[]> => {
      const rows = OPEN_ROOM.map((r) => r.split(''));
      rows[4]![7] = '#';
      rows[5]![7] = '#';
      const world = sandboxWorld(rows.map((r) => r.join('')));
      const s = newState(world, 'overworld', 0, 0, 4.5, 8.5);
      s.maxBombs = 3;

      const trace: Array<number[]> = [];
      const record = (st: State): void => {
        const flat = [st.x, st.y, st.vx, st.vy];
        for (const b of st.bombs) {
          flat.push(b.x, b.y, b.vx, b.vy, b.z, b.vz, b.fuse, b.shoveCount);
        }
        trace.push(flat);
      };

      // Bank throw NE toward the pillar, drop & kick a second bomb, then let fuses progress
      kickA(world, s, 0.75, -0.66);
      for (let i = 0; i < 45; i++) {
        tick(world, s, { dx: -0.5, dy: 0 }, FIXED_DT);
        record(s);
      }
      s.bombCooldown = 0;
      tapA(world, s);
      for (let i = 0; i < 18; i++) {
        tick(world, s, { dx: -1, dy: 0 }, FIXED_DT);
        record(s);
      }
      for (let i = 0; i < 35; i++) {
        tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
        record(s);
      }
      return trace;
    };

    const run1 = runScenario();
    const run2 = runScenario();
    expect(run1.length).toBeGreaterThan(80);
    expect(run1).toEqual(run2);
  });

  it('throws bombs orthogonally over fences and rolls them along the ground; friction brings them to rest ~1.5-2 tiles on', () => {
    const fenceRows = OPEN_ROOM.map((r) => r.split(''));
    fenceRows[9]![5] = '='; // fence directly north of (5.5, 10.5)
    const world = sandboxWorld(fenceRows.map((r) => r.join('')));
    const s = newState(world, 'overworld', 0, 0, 5.5, 10.5);

    kickA(world, s, 0, -1);
    expect(s.bombs).toHaveLength(1);
    const b = s.bombs[0]!;
    expect(b.kicked).toBe(true);
    expect(b.z).toBeGreaterThan(0.22); // airborne enough to clear the '=' fence at y=9!
    expect(b.vy).toBeLessThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(1e-6);
    const kickY = b.y;

    const rollingSpeeds: number[] = [];
    for (let i = 0; i < 80; i++) {
      tick(world, s, idle, FIXED_DT);
      if (s.bombs.length === 0) break;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed === 0 && b.z === 0) break;
      if (b.z === 0) rollingSpeeds.push(speed);
    }

    expect(s.bombs).toHaveLength(1); // stopped well before the 1.5 s fuse
    expect(b.z).toBe(0);
    // Friction monotonically reduces speed while rolling freely on open ground
    for (let i = 1; i < rollingSpeeds.length; i++) {
      expect(rollingSpeeds[i]!).toBeLessThanOrEqual(rollingSpeeds[i - 1]! + 1e-9);
    }
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(0);
    expect(b.x).toBe(5.5);
    const rollDist = kickY - b.y;
    expect(rollDist).toBeGreaterThanOrEqual(1.5);
    expect(rollDist).toBeLessThanOrEqual(2.5);
  });

  it('rebounds kicked bombs straight back off solid stone walls without penetrating tiles', () => {
    const rows = OPEN_ROOM.map((r) => r.split(''));
    // Solid north-south wall column at x = 7 (west face at x = 7.0)
    for (let y = 3; y <= 9; y++) rows[y]![7] = '#';
    const world = sandboxWorld(rows.map((r) => r.join('')));

    // 1. Kick east from (5.0, 8.5) into the west face of x = 7: it rebounds due west
    const s = newState(world, 'overworld', 0, 0, 5.0, 8.5);
    kickA(world, s, 1, 0);
    const b = s.bombs[0]!;
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBe(0);

    let sawWallBank = false;
    let sawBounce = false;
    for (let i = 0; i < 75; i++) {
      tick(world, s, idle, FIXED_DT);
      if (s.events.includes('bomb-bounce')) sawBounce = true;
      if (s.bombs.length === 0) break;
      // Bomb centre must never cross closer than BOMB_RADIUS into the x >= 7.0 wall
      expect(b.x).toBeLessThanOrEqual(7 - BOMB_RADIUS + 1e-3);
      if (b.vx < -0.1) {
        sawWallBank = true;
      }
      expect(b.vy).toBe(0); // orthogonal kicks stay on their axis
      if (b.z === 0 && b.vx === 0 && b.vy === 0) break;
    }

    expect(sawBounce).toBe(true);
    expect(sawWallBank).toBe(true);
    expect(b.x).toBeLessThan(7 - BOMB_RADIUS);
    expect(b.y).toBe(8.5);

    // 2. Head-on kick north at the y = 0 stone wall flips vy from negative to positive
    const north = newState(world, 'overworld', 0, 0, 4.5, 2.4);
    kickA(world, north, 0, -1);
    const nb = north.bombs[0]!;
    expect(nb.vy).toBeLessThan(0);
    let flippedVy = false;
    for (let i = 0; i < 45; i++) {
      tick(world, north, idle, FIXED_DT);
      expect(nb.y).toBeGreaterThanOrEqual(1 + BOMB_RADIUS - 1e-3);
      if (nb.vy > 0.2) {
        flippedVy = true;
        break;
      }
    }
    expect(flippedVy).toBe(true);
  });

  it('swallows bombs landing or rolling onto pits (^) without blast, and stops bombs in water (~) while ticking fuse', () => {
    // 1a. Thrown bomb touching down onto a pit ('^') is swallowed harmlessly
    const pitRows = OPEN_ROOM.map((r) => r.split(''));
    for (let y = 5; y <= 8; y++) {
      pitRows[y]![4] = '^';
      pitRows[y]![5] = '^';
      pitRows[y]![6] = '^';
    }
    const pitWorld = sandboxWorld(pitRows.map((r) => r.join('')));
    const ps = newState(pitWorld, 'overworld', 0, 0, 5.5, 9.8);
    kickA(pitWorld, ps, 0, -1);

    const pitEvents = stepSeconds(pitWorld, ps, BOMB_FUSE + 0.2);
    expect(pitEvents).toContain('bomb-swallow');
    expect(pitEvents).not.toContain('boom-bomb');
    expect(ps.bombs).toHaveLength(0);

    // 1b. Bomb thrown over a fence into a pit ('^') is also swallowed without blast
    const kickPitRows = OPEN_ROOM.map((r) => r.split(''));
    kickPitRows[6]![4] = '=';
    kickPitRows[6]![5] = '^';
    kickPitRows[6]![6] = '^';
    const kickPitWorld = sandboxWorld(kickPitRows.map((r) => r.join('')));
    const kps = newState(kickPitWorld, 'overworld', 0, 0, 3.5, 6.5);
    kickA(kickPitWorld, kps, 1, 0);
    const kickPitEvents = stepSeconds(kickPitWorld, kps, 0.45, { dx: 1, dy: 0 });
    expect(kickPitEvents).toContain('bomb-swallow');
    expect(kps.bombs).toHaveLength(0);

    // 2. Bomb landing/rolling onto water ('~') splashes to a stop (vx=0, vy=0) and still ticks its fuse
    const waterRows = OPEN_ROOM.map((r) => r.split(''));
    for (let y = 5; y <= 8; y++) {
      waterRows[y]![4] = '~';
      waterRows[y]![5] = '~';
      waterRows[y]![6] = '~';
    }
    const waterWorld = sandboxWorld(waterRows.map((r) => r.join('')));
    const ws = newState(waterWorld, 'overworld', 0, 0, 5.5, 9.8);
    kickA(waterWorld, ws, 0, -1);

    let splashed = false;
    for (let i = 0; i < 45; i++) {
      tick(waterWorld, ws, idle, FIXED_DT);
      if (ws.events.includes('bomb-splash')) {
        splashed = true;
        break;
      }
    }
    expect(splashed).toBe(true);
    expect(ws.bombs).toHaveLength(1);
    const wb = ws.bombs[0]!;
    expect(wb.vx).toBe(0);
    expect(wb.vy).toBe(0);
    expect(wb.z).toBe(0);
    expect(tileAt(waterWorld, ws, 'overworld', 0, 0, Math.floor(wb.x), Math.floor(wb.y))).toBe('~');

    const fuseAfterSplash = wb.fuse;
    expect(fuseAfterSplash).toBeGreaterThan(0.2);
    stepTicks(waterWorld, ws, 5);
    expect(wb.fuse).toBeLessThan(fuseAfterSplash);
    expect(wb.vx).toBe(0);
    expect(wb.vy).toBe(0);

    const boomEvents = stepSeconds(waterWorld, ws, fuseAfterSplash + 0.1);
    expect(boomEvents).toContain('boom-bomb');
    expect(ws.bombs).toHaveLength(0);
  });

  it('pulls a bomb overhead (pausing fuse & halving walk speed), then throws or drops without trapping Pip, and stepping on ground fire hurts', () => {
    const world = sandboxWorld(OPEN_ROOM);
    const s = newState(world, 'overworld', 0, 0, 3.5, 6.5);
    s.aimX = 1;
    s.aimY = 0;

    // Pull overhead with A, then throw with A: rolls east with KICK_SPEED while Pip steps away north
    kickA(world, s, 1, 0);
    const b = s.bombs[0]!;
    expect(b.vx).toBeGreaterThan(KICK_SPEED * 0.6);
    expect(b.vy).toBe(0);

    // Bomb rolls east ahead of Pip while Pip can freely step away north
    stepSeconds(world, s, 0.35, { dx: 0, dy: -1 });
    expect(b.x).toBeGreaterThan(4.6);
    expect(s.y).toBeLessThan(5.6);

    // Dropped against a wall it overlaps Pip: grace until Pip walks off
    const w = newState(world, 'overworld', 0, 0, 1.4, 6.5);
    w.aimX = -1;
    w.aimY = 0;
    tapA(world, w);
    const wb = w.bombs[0]!;
    expect(wb.graceOverlap).toBe(true);
    stepSeconds(world, w, 0.3, { dx: 1, dy: 0 });
    expect(wb.graceOverlap).toBe(false);
    expect(w.x).toBeGreaterThan(2.2);

    // Stepping on fire on the ground hurts Pip (1 half-heart)
    const fState = newState(world, 'overworld', 0, 0, 5.5, 6.5);
    const hpBeforeFire = fState.hp;
    fState.fires.push({ x: 5, y: 6, remaining: 2.0, tickCooldown: 0, generation: 0 });
    tick(world, fState, idle, FIXED_DT);
    expect(fState.hp).toBe(hpBeforeFire - 1);
  });

  it('applies unified radial blast shove to Pip (0 damage), enemies, push blocks, and unshoved live bombs', () => {
    const rows = OPEN_ROOM.map((r) => r.split(''));
    rows[6]![4] = 'P'; // push block 1 tile west of blast centre (5, 6), with open floor at (3, 6)
    const world = sandboxWorld(rows.map((r) => r.join('')));
    const s = newState(world, 'overworld', 0, 0, 5.5, 7.3); // south of blast
    const startHp = s.hp;

    // Tough enemy north of blast so it survives the 2-damage hit and exhibits knockback velocity
    s.enemies.push({
      id: 101,
      kind: 'slime',
      x: 5.5,
      y: 5.65,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 1,
      hp: 4,
      maxHp: 4,
      armored: false,
      exposedTimer: 0,
      invulnTimer: 0,
      aiTimer: 0,
      phase: 1,
      aiState: 'patrol',
      stateTimer: 0,
      stumbleTimer: 0,
      homeX: 5.5,
      homeY: 5.65,
    });

    // Bomb #1 detonates at (5.5, 6.5); Bomb #2 sits unshoved 1 tile east at (6.5, 6.5)
    s.bombs.push(
      {
        id: 201,
        kind: 'bomb',
        x: 5.5,
        y: 6.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      },
      {
        id: 202,
        kind: 'bomb',
        x: 6.5,
        y: 6.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 1.4,
        graceOverlap: false,
        shoveCount: 0,
      },
    );

    tick(world, s, idle, FIXED_DT);

    // 1. Blast fired; Pip took 0 damage and received southward knockback
    expect(s.events).toContain('boom-bomb');
    expect(s.hp).toBe(startHp);
    expect(s.vy).toBeGreaterThan(0);

    // 2. Push block was shoved 1 tile west from (4, 6) -> (3, 6)
    expect(s.events).toContain('block-push');
    expect(s.blocks[0]).toMatchObject({ x: 3, y: 6 });

    // 3. Surviving enemy took damage and received northward radial knockback
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]!.hp).toBe(2);
    expect(s.enemies[0]!.vy).toBeLessThan(0);

    // 4. Second bomb was NOT instant-detonated: it recorded shoveCount === 1 and gained eastward velocity
    expect(s.events).toContain('bomb-shove');
    expect(s.bombs).toHaveLength(1);
    const shoved = s.bombs[0]!;
    expect(shoved.id).toBe(202);
    expect(shoved.shoveCount).toBe(1);
    expect(shoved.vx).toBeGreaterThan(0);

    // Let knockback & bomb roll play out over a few frames
    stepTicks(world, s, 10);
    expect(s.y).toBeGreaterThan(7.5);
    expect(shoved.x).toBeGreaterThan(7.0);
  });

  it('chain-detonates an already-shoved bomb on its 2nd blast hit and preserves thrown Bomb impact detonation', () => {
    const world = sandboxWorld(OPEN_ROOM);
    const s = newState(world, 'overworld', 0, 0, 1.8, 10.5);

    // First blast at (3.5, 6.5) shoves target bomb at (4.5, 6.5) -> shoveCount becomes 1
    s.bombs.push(
      {
        id: 301,
        kind: 'bomb',
        x: 3.5,
        y: 6.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      },
      {
        id: 302,
        kind: 'bomb',
        x: 4.5,
        y: 6.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 1.4,
        graceOverlap: false,
        shoveCount: 0,
      },
    );

    tick(world, s, idle, FIXED_DT);
    const target = s.bombs[0]!;
    expect(target.id).toBe(302);
    expect(target.shoveCount).toBe(1);
    expect(target.fuse).toBeGreaterThan(1.3);

    // Step 2 frames while sliding, then detonate a 3rd bomb adjacent to target -> immediate chain boom!
    stepTicks(world, s, 2);
    s.bombs.push({
      id: 303,
      kind: 'bomb',
      x: Math.floor(target.x) + 0.5,
      y: 7.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });

    const chainEvents = stepTicks(world, s, 4);
    const boomCount = chainEvents.filter((e) => e === 'boom-bomb').length;
    expect(boomCount).toBe(2); // both bomb 303 and shoved bomb 302 detonated >1.2s early!
    expect(s.bombs).toHaveLength(0);

    // Every kicked bomb impact-detonates on an enemy, Bomb and Fire alike
    const pState = newState(world, 'overworld', 0, 0, 5.5, 7.5);
    pState.enemies.push({
      id: 401,
      kind: 'slime',
      x: 5.5,
      y: 5.5,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 1,
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
      homeX: 5.5,
      homeY: 5.5,
    });
    kickA(world, pState, 0, -1);
    const impactEvents = stepSeconds(world, pState, 0.4); // << BOMB_FUSE (1.5s)
    expect(impactEvents).toContain('boom-bomb');
    expect(pState.bombs).toHaveLength(0);
    expect(pState.enemies).toHaveLength(0);

    const eState = newState(world, 'overworld', 0, 0, 5.5, 7.5);
    eState.unlockedBombs.push('fire');
    equipBomb(eState, 'fire');
    eState.enemies.push({
      id: 402,
      kind: 'slime',
      x: 5.5,
      y: 5.5,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 1,
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
      homeX: 5.5,
      homeY: 5.5,
    });
    kickA(world, eState, 0, -1);
    const fireEvents = stepSeconds(world, eState, 0.4); // << FIRE_FUSE (1.3s)
    expect(fireEvents).toContain('boom-fire');
    expect(eState.bombs).toHaveLength(0);
  });

  it('keeps thrown, kicked, and shoved bombs inside room bounds at open doorways and never wedges Pip in corners', () => {
    // Room with open doorways on all 4 edges + connected neighbor rooms
    const doorRows = OPEN_ROOM.map((r, y) => {
      const chars = r.split('');
      if (y === 0 || y === ROOM_H - 1) chars[5] = '.';
      if (y === 6) {
        chars[0] = '.';
        chars[ROOM_W - 1] = '.';
      }
      return chars.join('');
    });
    const world = sandboxWorld(doorRows, [
      [1, 0, doorRows],
      [-1, 0, doorRows],
      [0, 1, doorRows],
      [0, -1, doorRows],
    ]);

    const assertBombsInBounds = (st: State): void => {
      for (const b of st.bombs) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(ROOM_W);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThanOrEqual(ROOM_H);
      }
    };

    // 1. Thrown straight toward open east doorway (10, 6)
    const thrownDoor = newState(world, 'overworld', 0, 0, 8.5, 6.5);
    kickA(world, thrownDoor, 1, 0);
    for (let i = 0; i < 70; i++) {
      tick(world, thrownDoor, idle, FIXED_DT);
      assertBombsInBounds(thrownDoor);
    }
    expect([thrownDoor.rx, thrownDoor.ry]).toEqual([0, 0]);

    // 2. Kicked straight toward open west doorway (0, 6)
    const kickedDoor = newState(world, 'overworld', 0, 0, 1.5, 6.5);
    tapA(world, kickedDoor);
    stepSeconds(world, kickedDoor, 0.3, { dx: 1, dy: 0 });
    for (let i = 0; i < 30; i++) {
      tick(world, kickedDoor, { dx: -1, dy: 0 }, FIXED_DT);
      assertBombsInBounds(kickedDoor);
      // Stop Pip before walking through the doorway once kicked
      if (kickedDoor.x < 1.2) break;
    }
    for (let i = 0; i < 40; i++) {
      tick(world, kickedDoor, idle, FIXED_DT);
      assertBombsInBounds(kickedDoor);
    }

    // 3. Blast-shoved straight toward open south doorway (5, 12)
    const shovedDoor = newState(world, 'overworld', 0, 0, 2.5, 6.5);
    shovedDoor.bombs.push(
      {
        id: 501,
        kind: 'bomb',
        x: 5.5,
        y: 10.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      },
      {
        id: 502,
        kind: 'bomb',
        x: 5.5,
        y: 11.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 1.4,
        graceOverlap: false,
        shoveCount: 0,
      },
    );
    for (let i = 0; i < 50; i++) {
      tick(world, shovedDoor, idle, FIXED_DT);
      assertBombsInBounds(shovedDoor);
    }

    // 4. Corner safety: dropping or point-blank throwing a bomb into NW corner (1, 1) never traps Pip
    const cornerDrop = newState(world, 'overworld', 0, 0, 1.32, 1.32);
    tapA(world, cornerDrop);
    stepSeconds(world, cornerDrop, 0.55, { dx: 1, dy: 1 });
    expect(cornerDrop.x).toBeGreaterThan(2.3);
    expect(cornerDrop.y).toBeGreaterThan(2.3);

    const cornerThrow = newState(world, 'overworld', 0, 0, 1.4, 1.4);
    kickA(world, cornerThrow, -1, -1); // rebounds off NW corner right onto Pip
    stepSeconds(world, cornerThrow, 0.35);
    stepSeconds(world, cornerThrow, 0.55, { dx: 1, dy: 1 });
    expect(cornerThrow.x).toBeGreaterThan(2.3);
    expect(cornerThrow.y).toBeGreaterThan(2.3);
  });
});
