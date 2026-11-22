import { describe, expect, it } from 'vitest';
import { hopLanding, levelAt, pillarPos } from '../src/game/elevation';
import {
  PILLAR_TRAVEL,
  type State,
  campaignWorld,
  currentRoom,
  newState,
  roomKey,
  tick,
  tileAt,
} from '../src/game/world';
import { stepTicks } from './input';
import { arrive, standAt, useBomb, wait, walkPath } from './rig';

// Room 12 of Dungeon 999 is the elevation test bed: level 2 terrace on top (rows 2-3, its
// face on row 3 with the pillar at (5, 3)), level 1 band (rows 4-6, face on row 6 with a ramp
// at (7, 6)), and level 0 floor below (rows 7-10) with the pillar's switch at (5, 7).
describe('Floor levels, ledges, ramps and pillars (ELEVATION.md)', () => {
  const world = campaignWorld();
  const enter = (): State => arrive(world, 4, 1);
  const at = (s: State, x: number, y: number): string => tileAt(world, s, s.zone, s.rx, s.ry, x, y);
  const levelOf = (s: State, x = s.x, y = s.y): number | null =>
    levelAt(currentRoom(world, s), s, Math.floor(x), Math.floor(y));

  it('derives solid ledge edges from the level layer, leaving ramps and pillars open', () => {
    const s = enter();
    expect([2, 3, 4, 5, 6, 8].map((x) => at(s, x, 6))).toEqual(Array(6).fill('H'));
    expect(at(s, 7, 6)).toBe('s');
    expect(at(s, 5, 3)).toBe('L');
    expect(at(s, 4, 3)).toBe('H');
    expect(at(s, 3, 5)).toBe('.');
    expect(levelOf(s)).toBe(1);
  });

  it('hops Pip down a ledge at once when he pushes straight at it, over the face to the floor', () => {
    const s = enter();
    walkPath(world, s, [[4, 5]]);
    const events: string[] = [];
    let peak = 0;
    let ticks = 0;
    for (; ticks < 120 && (s.hop || levelOf(s) !== 0); ticks++) {
      tick(world, s, { dx: 0, dy: 1 });
      events.push(...s.events);
      peak = Math.max(peak, s.hopZ ?? 0);
    }
    expect(events).toContain('player-hop');
    expect(events).toContain('player-land');
    expect([Math.floor(s.x), Math.floor(s.y)]).toEqual([4, 7]);
    expect(peak).toBeGreaterThan(0.5);
    // From the push to landing: a short walk to the edge, then a hop under half a second
    expect(ticks / 60).toBeLessThan(1.2);
  });

  it('never hops on a diagonal push', () => {
    const s = enter();
    walkPath(world, s, [[4, 5]]);
    s.y = 5.8;
    const events = stepTicks(world, s, 60, { dx: 0.6, dy: 0.8 });
    expect(events).not.toContain('player-hop');
    expect(levelOf(s)).toBe(1);
  });

  it('is one-way: from the floor, a face is a wall and pushing north never hops', () => {
    const s = enter();
    walkPath(world, s, [[4, 5]]);
    stepTicks(world, s, 90, { dx: 0, dy: 1 });
    expect(levelOf(s)).toBe(0);
    const events = stepTicks(world, s, 90, { dx: 0, dy: -1 });
    expect(events).not.toContain('player-hop');
    expect(Math.floor(s.y)).toBe(7);
    expect(levelOf(s)).toBe(0);
  });

  it('north rims never hop, even from high ground', () => {
    const room = currentRoom(world, enter());
    const open = (): boolean => true;
    expect(hopLanding(room, {}, 4, 7, 0, -1, open)).toBeNull();
    expect(hopLanding(room, {}, 4, 5, 0, 1, open)).toEqual({ x: 4, y: 7 });
  });

  it('walks Pip up and down a ramp between levels', () => {
    const s = enter();
    walkPath(world, s, [[7, 5]]);
    expect(
      walkPath(
        world,
        s,
        [
          [7, 6],
          [7, 7],
        ],
        3,
      ),
    ).toBe(true);
    expect(levelOf(s)).toBe(0);
    expect(
      walkPath(
        world,
        s,
        [
          [7, 6],
          [7, 5],
        ],
        3,
      ),
    ).toBe(true);
    expect(levelOf(s)).toBe(1);
  });

  it('a bomb thrown off a ledge falls a level and lands on the floor below', () => {
    const s = enter();
    walkPath(world, s, [[3, 4]]);
    useBomb(world, s, 'bomb', 'throw', 0, 1);
    const events = stepTicks(world, s, 70);
    expect(events).toContain('bomb-fall');
    const b = s.bombs[0]!;
    expect(levelOf(s, b.x, b.y)).toBe(0);
    expect(Math.floor(b.y)).toBeGreaterThanOrEqual(7);
  });

  it('a bomb thrown at a face from below bounces off it and stays on the floor', () => {
    const s = enter();
    walkPath(world, s, [[4, 5]]);
    stepTicks(world, s, 90, { dx: 0, dy: 1 });
    standAt(s, 3, 8, 0, -1);
    useBomb(world, s, 'bomb', 'throw', 0, -1);
    wait(world, s, 1);
    const b = s.bombs[0]!;
    expect(levelOf(s, b.x, b.y)).toBe(0);
    expect(b.y).toBeGreaterThan(7);
  });

  it('a pillar carries its rider up a level over PILLAR_TRAVEL, locked on, and is a wall from below', () => {
    const s = enter();
    walkPath(world, s, [
      [5, 4],
      [5, 3],
    ]);
    expect(levelOf(s)).toBe(1);
    s.blocks.push({ x: 5, y: 7, pushCharge: 0, pushDirX: 0, pushDirY: 0 });
    expect(stepTicks(world, s, 2)).toContain('pillar-rise');
    expect(s.ridingPillar).toBe(true);
    // Mid-travel: Pip can't step off, and the tile is solid to anyone else
    const x0 = s.x;
    stepTicks(world, s, 30, { dx: 0, dy: 1 });
    expect(s.x).toBe(x0);
    expect(Math.floor(s.y)).toBe(3);
    expect(at(s, 5, 3)).toBe('H');
    const events = stepTicks(world, s, Math.ceil(PILLAR_TRAVEL * 60));
    expect(events).toContain('pillar-stop');
    expect(s.ridingPillar).toBe(false);
    expect(levelOf(s)).toBe(2);
    expect(walkPath(world, s, [[5, 2]], 2)).toBe(true);

    const below = enter();
    below.blocks.push({ x: 5, y: 7, pushCharge: 0, pushDirX: 0, pushDirY: 0 });
    walkPath(world, below, [[5, 4]]);
    expect(walkPath(world, below, [[5, 3]], PILLAR_TRAVEL + 1)).toBe(false);
    expect(levelOf(below)).toBe(1);
  });

  it('settles riders once: a centre on the tile rides, a body only overlapping its edge is nudged off', () => {
    const s = enter();
    walkPath(world, s, [[5, 4]]);
    s.y = 4.05; // centre on the level-1 tile, body overlapping the pillar's south edge
    s.blocks.push({ x: 5, y: 7, pushCharge: 0, pushDirX: 0, pushDirY: 0 });
    stepTicks(world, s, 2);
    expect(s.ridingPillar).toBe(false);
    expect(s.y - 0.14).toBeGreaterThanOrEqual(4);
  });

  it('a bomb on the pillar rides it up and keeps its fuse; a pillar sinks its riders back down', () => {
    const s = enter();
    walkPath(world, s, [
      [5, 4],
      [5, 3],
    ]);
    useBomb(world, s, 'bomb', 'drop', 0, -1);
    const bomb = s.bombs[0]!;
    walkPath(world, s, [[5, 4]]);
    const weight = { x: 5, y: 7, pushCharge: 0, pushDirX: 0, pushDirY: 0 };
    s.blocks.push(weight);
    stepTicks(world, s, 2);
    expect(bomb.ridingPillar).toBe(true);
    stepTicks(world, s, Math.ceil(PILLAR_TRAVEL * 60) + 2);
    expect(bomb.ridingPillar).toBe(false);
    expect(levelOf(s, bomb.x, bomb.y)).toBe(2);
    s.blocks = s.blocks.filter((b) => b !== weight);
    stepTicks(world, s, Math.ceil(PILLAR_TRAVEL * 60) + 4);
    expect(pillarPos(s, 5, 3)).toBe(0);
  });

  it('a timed pillar cycles on its own clock', () => {
    const base = currentRoom(world, enter())!;
    const room = { ...base, rx: 9, ry: 9, pillars: [{ x: 5, y: 3, trigger: { down: 2, up: 3 } }] };
    const timed = { rooms: new Map([[roomKey('dungeon-999', 9, 9), room]]) };
    const s = newState(timed, 'dungeon-999', 9, 9, 3.5, 4.5);
    const seen: string[] = [];
    for (let t = 0; t < 2 + PILLAR_TRAVEL + 0.2; t += 1 / 60) {
      tick(timed, s, { dx: 0, dy: 0 });
      seen.push(...s.events);
    }
    expect(seen).toContain('pillar-rise');
    expect(pillarPos(s, 5, 3)).toBe(1);
    // Up at 3.2 s, sinks from 5 s, down by 6.2 s, rises again at 7 s
    for (let t = 0; t < 3; t += 1 / 60) tick(timed, s, { dx: 0, dy: 0 });
    expect(pillarPos(s, 5, 3)).toBe(0);
  });
});
