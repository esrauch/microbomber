import { describe, expect, it } from 'vitest';
import { DUNGEON_999_ROOMS } from '../src/game/dungeon999';
import { campaignWorld } from '../src/game/world';
import { pushToGoalSolves, singleBombShortcuts, wanderSolves } from './rig';

// Slow by design: every walkable tile x every kit bomb x drop/throw x 4 directions
describe('Dungeon 999: no trial falls to a single bomb', () => {
  const world = campaignWorld();
  const trials = DUNGEON_999_ROOMS.filter((r) => (r.rx !== 0 || r.ry !== 0) && r.kit?.bombs.length);
  it.each(trials.map((r) => [r.name, r.rx, r.ry] as const))(
    '%s',
    (_name, rx, ry) => {
      expect(singleBombShortcuts(world, rx, ry)).toEqual([]);
    },
    60_000,
  );

  it.each(trials.map((r) => [r.name, r.rx, r.ry] as const))(
    '%s: no walker without bombs solves it, wandering or pushing for the plate',
    (_name, rx, ry) => {
      for (const seed of [1, 2, 3])
        expect(wanderSolves(world, rx, ry, seed), `seed ${seed}`).toBe(false);
      expect(pushToGoalSolves(world, rx, ry), 'pushing toward the plate').toBe(false);
    },
    60_000,
  );
});
