import { describe, expect, it } from 'vitest';
import type { EnemyAiState } from '../src/game/types';
import {
  CURRENT_SPEED,
  ENEMY_FLEE_RADIUS,
  ENEMY_NOTICE_RADIUS,
  FIRE_SPREAD_INTERVAL,
  FIXED_DT,
  MAX_FIRE_GENERATION,
  BOMB_FUSE,
  ROOM_H,
  ROOM_W,
  type RoomSpec,
  type Tile,
  type World,
  currentVector,
  equipBomb,
  isWaterTile,
  newState,
  roomKey,
  spawnWindGust,
  tick,
  tileAt,
  windVectorAt,
} from '../src/game/world';
import { idle, kickA, stepSeconds, stepTicks } from './input';

function openRows(): string[] {
  return Array.from({ length: ROOM_H }, (_, y) =>
    y === 0 || y === ROOM_H - 1 ? '#'.repeat(ROOM_W) : `#${'.'.repeat(ROOM_W - 2)}#`,
  );
}

function setCell(rows: string[], x: number, y: number, ch: Tile | 'P'): void {
  const r = rows[y]!;
  rows[y] = `${r.slice(0, x)}${ch}${r.slice(x + 1)}`;
}

function sandboxWorld(
  rows: string[],
  extra: Partial<Omit<RoomSpec, 'zone' | 'rx' | 'ry' | 'name' | 'rows'>> = {},
): World {
  const world: World = { rooms: new Map() };
  world.rooms.set(roomKey('overworld', 0, 0), {
    zone: 'overworld',
    rx: 0,
    ry: 0,
    name: 'Systemic Sandbox',
    rows,
    ...extra,
  });
  return world;
}

describe('Phase 4: Systemic world (fire spread, water currents, wind) and enemy/boss AI', () => {
  it('spreads fire tile-by-tile across , -> B -> W to light T, stops at ~ and #, and terminates at MAX_FIRE_GENERATION', () => {
    expect(MAX_FIRE_GENERATION).toBe(6);
    expect(FIRE_SPREAD_INTERVAL).toBe(0.72);

    // 1. Sequential chain: ',' -> ',' -> 'B' -> 'W' -> 'T', plus '~' water and '#' wall firebreaks
    const rows = openRows();
    // Middle lane (y = 6): dry grass -> dry grass -> bramble -> crate -> unlit brazier
    setCell(rows, 2, 6, ',');
    setCell(rows, 3, 6, ',');
    setCell(rows, 4, 6, 'B');
    setCell(rows, 5, 6, 'W');
    setCell(rows, 6, 6, 'T');

    // Upper lane (y = 2): ',' blocked by '~' water before another ','
    setCell(rows, 2, 2, ',');
    setCell(rows, 3, 2, '~');
    setCell(rows, 4, 2, ',');

    // Lower lane (y = 10): ',' blocked by '#' stone wall before another ','
    setCell(rows, 2, 10, ',');
    setCell(rows, 3, 10, '#');
    setCell(rows, 4, 10, ',');

    const world = sandboxWorld(rows, {
      condition: 'all-torches',
      torches: [{ x: 6, y: 6 }],
    });
    const s = newState(world, 'overworld', 0, 0, 8.5, 6.5);

    // Ignite the West end (x = 1.5) of all three lanes simultaneously
    for (const [id, y] of [
      [101, 6.5],
      [102, 2.5],
      [103, 10.5],
    ] as const) {
      s.bombs.push({
        id,
        kind: 'fire',
        x: 1.5,
        y,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      });
    }

    // Immediately after detonation, far tiles in the chain are not yet burned/lit (tile-by-tile spread)
    tick(world, s, idle, FIXED_DT);
    expect(tileAt(world, s, 'overworld', 0, 0, 4, 6)).toBe('B');
    expect(tileAt(world, s, 'overworld', 0, 0, 5, 6)).toBe('W');
    expect(s.torches[0]!.lit).toBe(false);

    // Advance long enough for the 4-hop chain to burn across and light the brazier at (6, 6)
    stepSeconds(world, s, FIRE_SPREAD_INTERVAL * 7 + 0.6);
    expect(tileAt(world, s, 'overworld', 0, 0, 2, 6)).toBe('.');
    expect(tileAt(world, s, 'overworld', 0, 0, 3, 6)).toBe('.');
    expect(tileAt(world, s, 'overworld', 0, 0, 4, 6)).toBe('.');
    expect(tileAt(world, s, 'overworld', 0, 0, 5, 6)).toBe('.');
    expect(s.torches[0]!.lit).toBe(true);
    expect(s.roomSolved).toBe(true);

    // Water '~' and stone '#' cleanly blocked fire from reaching (4, 2) and (4, 10)
    expect(tileAt(world, s, 'overworld', 0, 0, 2, 2)).toBe('.');
    expect(tileAt(world, s, 'overworld', 0, 0, 3, 2)).toBe('~');
    expect(tileAt(world, s, 'overworld', 0, 0, 4, 2)).toBe(',');
    expect(tileAt(world, s, 'overworld', 0, 0, 2, 10)).toBe('.');
    expect(tileAt(world, s, 'overworld', 0, 0, 3, 10)).toBe('#');
    expect(tileAt(world, s, 'overworld', 0, 0, 4, 10)).toBe(',');

    // 2. Bounded MAX_FIRE_GENERATION on a 19-tile serpentine ',' strip separated by '#' wall
    const stripRows = openRows();
    for (let y = 2; y <= 10; y++) {
      setCell(stripRows, 2, y, ',');
      setCell(stripRows, 4, y, ',');
      if (y < 10) setCell(stripRows, 3, y, '#');
    }
    setCell(stripRows, 3, 10, ',');

    const stripWorld = sandboxWorld(stripRows);
    const stripState = newState(stripWorld, 'overworld', 0, 0, 8.5, 6.5);
    stripState.bombs.push({
      id: 104,
      kind: 'fire',
      x: 1.5,
      y: 2.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });

    let maxObservedGen = 0;
    let settled = false;
    for (let step = 0; step < 600; step++) {
      tick(stripWorld, stripState, idle, FIXED_DT);
      for (const f of stripState.fires) {
        const gen = f.generation ?? 0;
        if (gen > maxObservedGen) maxObservedGen = gen;
        expect(gen).toBeLessThanOrEqual(MAX_FIRE_GENERATION);
      }
      if (step > 5 && stripState.fires.length === 0) {
        settled = true;
        break;
      }
    }

    expect(settled).toBe(true);
    expect(stripState.fires).toHaveLength(0);
    expect(maxObservedGen).toBe(MAX_FIRE_GENERATION);
    expect(tileAt(stripWorld, stripState, 'overworld', 0, 0, 2, 2)).toBe('.');
    expect(tileAt(stripWorld, stripState, 'overworld', 0, 0, 2, 6)).toBe('.');
    // Far end of the 19-tile strip remains unburned ',' past MAX_FIRE_GENERATION
    expect(tileAt(stripWorld, stripState, 'overworld', 0, 0, 4, 2)).toBe(',');
  });

  it('floats and drifts bombs along directional water currents (1..4) while stopping drift on still water (~)', () => {
    expect(CURRENT_SPEED).toBe(1.4);
    expect(isWaterTile('~')).toBe(true);
    expect(isWaterTile('1')).toBe(true);
    expect(isWaterTile('2')).toBe(true);
    expect(isWaterTile('3')).toBe(true);
    expect(isWaterTile('4')).toBe(true);
    expect(isWaterTile('.')).toBe(false);
    expect(isWaterTile('^')).toBe(false);

    expect(currentVector('1')).toEqual({ dx: 0, dy: -1 });
    expect(currentVector('2')).toEqual({ dx: 0, dy: 1 });
    expect(currentVector('3')).toEqual({ dx: 1, dy: 0 });
    expect(currentVector('4')).toEqual({ dx: -1, dy: 0 });
    expect(currentVector('~')).toBeNull();
    expect(currentVector('.')).toBeNull();

    // 1. Throw a bomb onto an East ('3') current channel -> floats (z === 0) & drifts downstream to break 'W'
    const eastRows = openRows();
    // The crate sits where a 1.5 s fuse drifting at CURRENT_SPEED can reach it
    for (let x = 2; x <= 6; x++) setCell(eastRows, x, 6, '3');
    setCell(eastRows, 7, 6, 'W');
    const eastWorld = sandboxWorld(eastRows);
    const es = newState(eastWorld, 'overworld', 0, 0, 1.5, 6.5);

    kickA(eastWorld, es, 1, 0);
    stepSeconds(eastWorld, es, 0.45);
    expect(es.bombs).toHaveLength(1);
    const eastBomb = es.bombs[0]!;
    expect(eastBomb.z).toBe(0);
    const landedX = eastBomb.x;

    stepSeconds(eastWorld, es, 0.9);
    expect(es.bombs).toHaveLength(1);
    expect(eastBomb.z).toBe(0);
    expect(eastBomb.x).toBeGreaterThan(landedX + 0.8);

    stepSeconds(eastWorld, es, BOMB_FUSE);
    expect(tileAt(eastWorld, es, 'overworld', 0, 0, 7, 6)).toBe('.');

    // 2. Place/drop a Fire bomb onto a South ('2') current -> floats downstream to light 'T'
    const southRows = openRows();
    for (let y = 2; y <= 7; y++) setCell(southRows, 5, y, '2');
    setCell(southRows, 5, 8, 'T');
    const southWorld = sandboxWorld(southRows, {
      condition: 'all-torches',
      torches: [{ x: 5, y: 8 }],
    });
    const ss = newState(southWorld, 'overworld', 0, 0, 3.5, 2.5);
    ss.unlockedBombs.push('fire');
    equipBomb(ss, 'fire');
    ss.bombs.push({
      id: 201,
      kind: 'fire',
      x: 5.5,
      y: 2.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 4.4,
      graceOverlap: false,
      shoveCount: 0,
    });

    stepSeconds(southWorld, ss, 1.0);
    expect(ss.bombs).toHaveLength(1);
    expect(ss.bombs[0]!.z).toBe(0);
    expect(ss.bombs[0]!.y).toBeGreaterThan(3.5);

    // About 5.3 tiles at CURRENT_SPEED (with its ramp-up) arrives just before the 4.4 s fuse
    stepSeconds(southWorld, ss, 3.6);
    expect(ss.torches[0]!.lit).toBe(true);

    // 3. Still water '~' with zero wind stops horizontal drift on touchdown
    const stillRows = openRows();
    for (let x = 2; x <= 8; x++) setCell(stillRows, x, 6, '~');
    const stillWorld = sandboxWorld(stillRows);
    const sts = newState(stillWorld, 'overworld', 0, 0, 1.5, 6.5);

    kickA(stillWorld, sts, 1, 0);
    stepSeconds(stillWorld, sts, 0.45);
    expect(sts.bombs).toHaveLength(1);
    const stillBomb = sts.bombs[0]!;
    expect(stillBomb.z).toBe(0);
    const splashX = stillBomb.x;

    stepSeconds(stillWorld, sts, 0.4);
    expect(Math.hypot(stillBomb.vx, stillBomb.vy)).toBeLessThan(0.05);
    expect(Math.abs(stillBomb.x - splashX)).toBeLessThan(0.05);
  });

  it('applies room wind and spawnWindGust to floating/grounded bombs, pickups (never into pits/walls), and downwind fire spread', () => {
    // 1. windVectorAt combines room wind + active gusts, carrying floating bombs on still water '~'
    const floatRows = openRows();
    for (let x = 3; x <= 8; x++) setCell(floatRows, x, 6, '~');
    const floatWorld = sandboxWorld(floatRows, { wind: { dx: 1.5, dy: 0 } });
    const fs = newState(floatWorld, 'overworld', 0, 0, 1.5, 1.5);

    expect(windVectorAt(floatWorld, fs, 5.5, 6.5)).toEqual({ dx: 1.5, dy: 0 });
    spawnWindGust(fs, 4.0, 6.5, 3.0, 0, 2.5, 0.5);
    expect(fs.gusts).toHaveLength(1);
    expect(windVectorAt(floatWorld, fs, 4.0, 6.5).dx).toBeGreaterThan(3.0);
    expect(windVectorAt(floatWorld, fs, 9.5, 10.5)).toEqual({ dx: 1.5, dy: 0 });

    fs.bombs.push({
      id: 301,
      kind: 'bomb',
      x: 3.5,
      y: 6.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 4.0,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(floatWorld, fs, 0.65);
    expect(fs.bombs[0]!.z).toBe(0);
    expect(fs.bombs[0]!.x).toBeGreaterThan(4.1);
    expect(fs.gusts).toHaveLength(0);

    // 2. Gusts push grounded bombs & uncollected ActivePickups across floor, stopping before walls & pits
    const pushRows = openRows();
    setCell(pushRows, 5, 4, '#'); // solid stone wall blocking bomb #1
    setCell(pushRows, 5, 6, '^'); // pit blocking bomb #2
    setCell(pushRows, 5, 8, '^'); // pit blocking pickup
    const pushWorld = sandboxWorld(pushRows);
    const ps = newState(pushWorld, 'overworld', 0, 0, 1.5, 1.5);

    ps.bombs.push(
      {
        id: 302,
        kind: 'bomb',
        x: 3.5,
        y: 4.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 5.0,
        graceOverlap: false,
        shoveCount: 0,
      },
      {
        id: 303,
        kind: 'bomb',
        x: 3.5,
        y: 6.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 5.0,
        graceOverlap: false,
        shoveCount: 0,
      },
    );
    ps.pickups.push({ id: 'gust-key', kind: 'small-key', x: 3.5, y: 8.5 });

    spawnWindGust(ps, 3.8, 6.5, 6.0, 0, 4.5, 0.9);
    const gustEvents = stepSeconds(pushWorld, ps, 0.8);
    expect(gustEvents).not.toContain('bomb-swallow');
    expect(ps.bombs).toHaveLength(2);

    const wallBomb = ps.bombs.find((b) => b.id === 302)!;
    const pitBomb = ps.bombs.find((b) => b.id === 303)!;
    const pushedPickup = ps.pickups[0]!;

    expect(wallBomb.x).toBeGreaterThan(3.7);
    expect(Math.floor(wallBomb.x)).toBeLessThan(5);

    expect(pitBomb.x).toBeGreaterThan(3.7);
    expect(Math.floor(pitBomb.x)).toBeLessThan(5);
    expect(
      tileAt(pushWorld, ps, 'overworld', 0, 0, Math.floor(pitBomb.x), Math.floor(pitBomb.y)),
    ).toBe('.');

    expect(pushedPickup.x).toBeGreaterThan(3.7);
    expect(Math.floor(pushedPickup.x)).toBeLessThan(5);
    expect(
      tileAt(
        pushWorld,
        ps,
        'overworld',
        0,
        0,
        Math.floor(pushedPickup.x),
        Math.floor(pushedPickup.y),
      ),
    ).toBe('.');

    // 3. Downwind fire spreads across dry grass faster than calm air
    const measureSpreadTicks = (windDx: number): number => {
      const grassRows = openRows();
      for (let x = 2; x <= 7; x++) setCell(grassRows, x, 6, ',');
      const w = sandboxWorld(grassRows, windDx !== 0 ? { wind: { dx: windDx, dy: 0 } } : {});
      const st = newState(w, 'overworld', 0, 0, 5.5, 2.5);
      st.bombs.push({
        id: 304,
        kind: 'fire',
        x: 1.5,
        y: 6.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      });
      for (let t = 1; t <= 400; t++) {
        tick(w, st, idle, FIXED_DT);
        if (
          st.fires.some((f) => f.x === 6 && f.y === 6) ||
          tileAt(w, st, 'overworld', 0, 0, 6, 6) === '.'
        ) {
          return t;
        }
      }
      throw new Error(`Fire failed to reach (6, 6) within 400 ticks (windDx=${windDx})`);
    };

    const calmTicks = measureSpreadTicks(0);
    const downwindTicks = measureSpreadTicks(3.0);
    expect(downwindTicks).toBeLessThan(calmTicks);
  });

  it('drives slime AI through patrol -> notice -> chase -> windup -> recover', () => {
    expect(ENEMY_NOTICE_RADIUS).toBe(5.2);
    expect(ENEMY_FLEE_RADIUS).toBe(2.1);

    const world = sandboxWorld(openRows(), {
      enemies: [{ kind: 'slime', x: 5.5, y: 2.5 }],
    });
    // Start Pip at (5.5, 10.5), 8.0 tiles away (> 5.2 notice radius)
    const s = newState(world, 'overworld', 0, 0, 5.5, 10.5);
    const slime = s.enemies[0]!;

    stepTicks(world, s, 10);
    expect(slime.aiState).toBe('patrol');

    // Step Pip within ENEMY_NOTICE_RADIUS (dist ≈ 4.3 < 5.2) -> enters 'notice' ('enemy-notice')
    s.x = 5.5;
    s.y = 6.8;
    const seenStates: EnemyAiState[] = [];
    const seenEvents: string[] = [];
    const recordStep = (): void => {
      s.hp = s.maxHp;
      s.vx = 0;
      s.vy = 0;
      tick(world, s, idle, FIXED_DT);
      if (seenStates[seenStates.length - 1] !== slime.aiState) {
        seenStates.push(slime.aiState);
      }
      seenEvents.push(...s.events);
    };

    for (let i = 0; i < 60 && !seenStates.includes('chase'); i++) {
      recordStep();
    }
    expect(seenStates).toContain('notice');
    expect(seenEvents).toContain('enemy-notice');
    expect(seenStates).toContain('chase');
    expect(seenStates.indexOf('notice')).toBeLessThan(seenStates.indexOf('chase'));

    // Bring Pip into close range so slime telegraphs 'windup' ('enemy-windup'), lunges, and enters 'recover'
    s.x = slime.x;
    s.y = Math.min(ROOM_H - 1.5, slime.y + 1.15);
    const preLungeY = slime.y;
    for (let i = 0; i < 120 && !seenStates.includes('recover'); i++) {
      recordStep();
    }

    expect(seenStates).toContain('windup');
    expect(seenEvents).toContain('enemy-windup');
    expect(seenStates).toContain('recover');
    expect(seenStates.indexOf('windup')).toBeLessThan(seenStates.indexOf('recover'));
    // The lunge carries it toward Pip over the recovery, not in its first frame
    for (let i = 0; i < 30 && slime.aiState === 'recover'; i++) {
      recordStep();
    }
    expect(slime.y).toBeGreaterThan(preLungeY + 0.15);
  });

  it('triggers enemy flee from imminent fuses (< 0.9s) and hit stumble on non-lethal damage', () => {
    // 1. Live bomb with fuse < 0.9 near an unarmored slime triggers 'flee' away from the bomb
    const world = sandboxWorld(openRows(), {
      enemies: [{ kind: 'slime', x: 5.5, y: 6.5 }],
    });
    const s = newState(world, 'overworld', 0, 0, 5.5, 10.5);
    const slime = s.enemies[0]!;

    s.bombs.push({
      id: 501,
      kind: 'bomb',
      x: 5.5,
      y: 5.4,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.8,
      graceOverlap: false,
      shoveCount: 0,
    });

    stepSeconds(world, s, 0.35);
    expect(slime.aiState).toBe('flee');
    expect(Math.hypot(slime.x - 5.5, slime.y - 5.4)).toBeGreaterThan(1.3);

    // 2. Non-lethal damage on an unarmored enemy sets stumbleTimer > 0 and emits 'enemy-stumble'
    const stumbleWorld = sandboxWorld(openRows(), {
      enemies: [{ kind: 'shielder', x: 5.5, y: 5.5 }],
    });
    const sts = newState(stumbleWorld, 'overworld', 0, 0, 5.5, 9.5);
    const shielder = sts.enemies[0]!;
    shielder.armored = false; // 2-HP unarmored shielder hit by 1-damage Fire -> 1 HP (non-lethal)

    sts.bombs.push({
      id: 502,
      kind: 'fire',
      x: 5.5,
      y: 6.0,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });

    tick(stumbleWorld, sts, idle, FIXED_DT);
    expect(shielder.hp).toBe(1);
    expect(shielder.stumbleTimer).toBeGreaterThan(0);
    expect(sts.events).toContain('enemy-stumble');
  });

  it('executes world reactions: bats snuff flames, slimes split once in fire, and shielders kick bombs back', () => {
    // 1. Bat flying over a burning FirePatch snuffs it out ('flame-snuff', s.fires cleared)
    const batWorld = sandboxWorld(openRows(), {
      enemies: [{ kind: 'bat', x: 5.5, y: 5.5 }],
    });
    const bs = newState(batWorld, 'overworld', 0, 0, 5.5, 9.5);
    bs.fires.push({
      x: 5,
      y: 5,
      remaining: 2.5,
      tickCooldown: 0.4,
      spreadTimer: FIRE_SPREAD_INTERVAL,
      generation: 0,
    });

    const batEvents = stepSeconds(batWorld, bs, 0.5);
    expect(batEvents).toContain('flame-snuff');
    expect(bs.fires).toHaveLength(0);

    // 2. Hitting a full slime with 'fire' splits it into 2 1-HP mini-slimes (splitGen === 1), no re-split
    const slimeWorld = sandboxWorld(openRows(), {
      enemies: [{ kind: 'slime', x: 5.5, y: 5.5 }],
    });
    const sls = newState(slimeWorld, 'overworld', 0, 0, 5.5, 9.5);
    sls.bombs.push({
      id: 601,
      kind: 'fire',
      x: 5.5,
      y: 5.0,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });

    const splitEvents = stepTicks(slimeWorld, sls, 2);
    expect(splitEvents).toContain('slime-split');
    expect(sls.enemies).toHaveLength(2);
    for (const mini of sls.enemies) {
      expect(mini.kind).toBe('slime');
      expect(mini.hp).toBe(1);
      expect(mini.maxHp).toBe(1);
      expect(mini.splitGen).toBe(1);
    }

    // Subsequent Fire hits defeat both mini-slimes without splitting again
    sls.fires = [];
    sls.enemies.forEach((mini, idx) => {
      mini.invulnTimer = 0;
      sls.bombs.push({
        id: 602 + idx,
        kind: 'fire',
        x: mini.x,
        y: mini.y,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      });
    });
    const finishEvents = stepTicks(slimeWorld, sls, 2);
    expect(finishEvents).not.toContain('slime-split');
    expect(sls.enemies).toHaveLength(0);

    // 3. Rolling/placing a bomb (fuse > 0.5) in front of an armored shielder triggers 'shielder-kick'
    const shieldWorld = sandboxWorld(openRows(), {
      enemies: [{ kind: 'shielder', x: 5.5, y: 4.5 }],
    });
    const shs = newState(shieldWorld, 'overworld', 0, 0, 5.5, 8.5);
    const shielder = shs.enemies[0]!;
    shielder.fx = 0;
    shielder.fy = 1;

    shs.bombs.push({
      id: 604,
      kind: 'bomb',
      x: 5.5,
      y: 5.35,
      vx: 0,
      vy: -3.5,
      z: 0,
      vz: 0,
      fuse: 1.4,
      graceOverlap: false,
      shoveCount: 0,
    });

    const kickEvents = stepSeconds(shieldWorld, shs, 0.4);
    expect(kickEvents).toContain('shielder-kick');
    expect(shs.bombs).toHaveLength(1);
    expect(shs.bombs[0]!.vy).toBeGreaterThan(0.5);
  });

  it('updates Wickgeist (Phase 2 WindGust) and Cinderhull (windup telegraph & exposed-core stumble)', () => {
    // 1. Phase 2 Wickgeist emits a WindGust (s.gusts.length > 0 / 'wind-gust')
    const geistRows = openRows();
    setCell(geistRows, 2, 2, 'T');
    setCell(geistRows, 8, 2, 'T');
    const geistWorld = sandboxWorld(geistRows, {
      dark: true,
      condition: 'miniboss',
      torches: [
        { x: 2, y: 2, initiallyLit: true },
        { x: 8, y: 2, initiallyLit: true },
      ],
      enemies: [{ kind: 'wickgeist', x: 5.5, y: 4.5 }],
    });
    const gs = newState(geistWorld, 'overworld', 0, 0, 5.5, 9.5);
    const geist = gs.enemies[0]!;
    const geistEvents: string[] = [];
    let sawGust = false;

    for (let hit = 0; hit < 2; hit++) {
      geist.invulnTimer = 0;
      gs.torches[0]!.lit = true;
      gs.bombs.push({
        id: 701 + hit,
        kind: 'bomb',
        x: geist.x,
        y: geist.y + 0.4,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: 0.005,
        graceOverlap: false,
        shoveCount: 0,
      });
      tick(geistWorld, gs, idle, FIXED_DT);
      geistEvents.push(...gs.events);
      if (gs.gusts.length > 0) sawGust = true;
    }
    expect(geist.phase).toBe(3);
    expect(geistEvents).toContain('ice-storm');

    for (let step = 0; step < 210 && (!sawGust || !geistEvents.includes('wind-gust')); step++) {
      gs.hp = gs.maxHp;
      gs.torches[0]!.lit = true;
      tick(geistWorld, gs, idle, FIXED_DT);
      geistEvents.push(...gs.events);
      if (gs.gusts.length > 0) sawGust = true;
    }
    expect(sawGust).toBe(true);
    expect(geistEvents).toContain('wind-gust');

    // 2. Cinderhull telegraphs 'windup' before its thorn barrage and stumbles when its exposed core is blasted
    const bossWorld = sandboxWorld(openRows(), {
      condition: 'boss',
      enemies: [{ kind: 'cinderhull', x: 5.5, y: 4.5 }],
    });
    const cs = newState(bossWorld, 'overworld', 0, 0, 5.5, 9.5);
    const boss = cs.enemies[0]!;

    let firstWindupTick = -1;
    let firstBarrageTick = -1;
    for (let step = 0; step < 240; step++) {
      cs.hp = cs.maxHp;
      tick(bossWorld, cs, idle, FIXED_DT);
      if (
        firstWindupTick < 0 &&
        (boss.aiState === 'windup' || cs.events.includes('enemy-windup'))
      ) {
        firstWindupTick = step;
      }
      if (firstBarrageTick < 0 && cs.projectiles.length >= 3) {
        firstBarrageTick = step;
      }
      if (firstWindupTick >= 0 && firstBarrageTick >= 0) break;
    }

    expect(firstWindupTick).toBeGreaterThanOrEqual(0);
    expect(firstBarrageTick).toBeGreaterThan(firstWindupTick);

    // Burn away Cinderhull's thorn wraps with Fire, then blast exposed core with Bomb -> stumble!
    boss.invulnTimer = 0;
    cs.bombs.push({
      id: 710,
      kind: 'fire',
      x: boss.x,
      y: boss.y + 0.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });
    tick(bossWorld, cs, idle, FIXED_DT);
    expect(boss.armored).toBe(false);

    // The Fire's fire patch may already have burned the exposed core; measure the
    // Bomb hit on its own
    const hpBeforeBomb = boss.hp;
    boss.invulnTimer = 0;
    cs.bombs.push({
      id: 711,
      kind: 'bomb',
      x: boss.x,
      y: boss.y + 0.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.005,
      graceOverlap: false,
      shoveCount: 0,
    });
    tick(bossWorld, cs, idle, FIXED_DT);
    expect(boss.hp).toBe(hpBeforeBomb - 2);
    expect(boss.stumbleTimer).toBeGreaterThan(0);
    expect(cs.events).toContain('enemy-stumble');
  });
});
