import { describe, expect, it } from 'vitest';
import { DUNGEON_999_ROOMS } from '../src/game/dungeon999';
import { campaignWorld } from '../src/game/world';
import { singleBombShortcuts } from './rig';

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
});
