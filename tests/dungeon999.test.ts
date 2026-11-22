import { describe, expect, it } from 'vitest';
import { DUNGEON_999_ENTRIES, DUNGEON_999_ROOMS } from '../src/game/dungeon999';
import {
  ALL_BOMBS,
  BOMB_FUSE,
  PILLAR_TRAVEL,
  BOMB_FUSES,
  WHIRLWIND_DURATION,
  type State,
  campaignWorld,
  currentRoom,
  enterDungeon999,
  enterRoom,
  isButtonPressed,
  newState,
  tick,
  tileAt,
} from '../src/game/world';
import { stepTicks } from './input';
import { arrive, standAt, useBomb, wait, walkPath, walkable } from './rig';

const TRIALS = DUNGEON_999_ROOMS.filter((r) => r.rx !== 0 || r.ry !== 0);

/** The trial room whose name starts with `n.` */
function trial(n: number): { rx: number; ry: number } {
  const room = TRIALS.find((r) => r.name.startsWith(`${n}.`));
  if (!room) throw new Error(`no trial ${n}`);
  return { rx: room.rx, ry: room.ry };
}

describe('Dungeon 999: the trial rooms', () => {
  const world = campaignWorld();
  const enter = (n: number): State => {
    const { rx, ry } = trial(n);
    return arrive(world, rx, ry);
  };

  it('the Lobby has a pad to every trial, landing on its arrival point, plus the exit', () => {
    const s = newState(world);
    enterDungeon999(world, s);
    const lobby = currentRoom(world, s)!;
    expect(s.unlockedBombs).toEqual([...ALL_BOMBS]);
    expect([s.maxBombs, s.blastRadius]).toEqual([4, 2]);
    for (const room of TRIALS) {
      const pad = lobby.portals!.find((p) => p.targetRx === room.rx && p.targetRy === room.ry)!;
      expect(pad.label).toBe(room.name);
      expect([pad.targetX, pad.targetY]).toEqual(DUNGEON_999_ENTRIES.get(`${room.rx},${room.ry}`));
      expect(tileAt(world, s, 'dungeon-999', 0, 0, pad.x, pad.y)).toBe('>');
    }
    expect(lobby.portals!.some((p) => p.targetZone === 'basement')).toBe(true);
  });

  it('every trial hands over its own campaign-sized kit, and its pad leads back', () => {
    for (const room of TRIALS) {
      const s = arrive(world, room.rx, room.ry);
      expect(s.unlockedBombs).toEqual(room.kit!.bombs);
      expect([s.maxBombs, s.blastRadius]).toEqual([2, 1]);
      expect(room.portals!.length).toBeGreaterThan(0);
      expect(room.portals!.every((p) => p.targetRx === 0 && p.targetRy === 0)).toBe(true);
    }
  });

  it('no trial can be solved by walking: no plate is reachable on foot, and standing anywhere solves nothing', () => {
    for (const room of TRIALS) {
      const base = arrive(world, room.rx, room.ry);
      const tiles = walkable(world, base);
      expect(tiles.length).toBeGreaterThan(5);
      for (const [x, y] of tiles) {
        expect(tileAt(world, base, base.zone, room.rx, room.ry, x, y)).not.toBe('O');
        const s = arrive(world, room.rx, room.ry);
        standAt(s, x, y, 0, -1);
        tick(world, s, { dx: 0, dy: 0 });
        expect(s.roomSolved, `${room.name} at (${x},${y})`).toBe(false);
      }
    }
  });

  it('a room resets when Pip leaves and comes back', () => {
    const { rx, ry } = trial(7);
    const s = enter(7);
    standAt(s, 2, 8, 0, -1);
    s.y = 8.2;
    useBomb(world, s, 'ice', 'drop', 0, -1);
    wait(world, s, BOMB_FUSES.ice + 0.3);
    expect(s.frozenTiles?.size).toBeGreaterThan(0);
    enterRoom(world, s, 'dungeon-999', 0, 0, 5.5, 6.5);
    enterRoom(world, s, 'dungeon-999', rx, ry, 5.5, 9.5);
    expect(s.frozenTiles?.size ?? 0).toBe(0);
    expect(s.roomSolved).toBe(false);
  });

  it('a gate is down exactly while every switch is weighted; a bomb holds a switch but not a plate', () => {
    const s = enter(2);
    const q1 = [2, 10] as const;
    const q2 = [5, 5] as const;
    expect(tileAt(world, s, s.zone, s.rx, s.ry, 5, 3)).toBe('G');
    standAt(s, ...q2, 0, -1);
    wait(world, s, 0.1);
    expect(isButtonPressed(world, s, ...q2)).toBe(true);
    expect(s.gatesOpen).toBe(false);
    standAt(s, ...q1, 0, -1);
    useBomb(world, s, 'bomb', 'drop', 0, -1);
    expect(isButtonPressed(world, s, ...q1)).toBe(true);
    wait(world, s, 0.1);
    expect(s.gatesOpen).toBe(false);
    standAt(s, ...q2, 0, -1);
    // The renderer redraws the room on these events, so the gate art follows the gate
    expect(stepTicks(world, s, 6)).toContain('gate-open');
    expect(s.gatesOpen).toBe(true);
    expect(tileAt(world, s, s.zone, s.rx, s.ry, 5, 3)).toBe('.');

    // A bomb sitting on the goal plate does not press it
    s.bombs.push({ ...s.bombs[0]!, id: 999, x: 5.5, y: 2.5, z: 0 });
    expect(isButtonPressed(world, s, 5, 2)).toBe(false);

    expect(stepTicks(world, s, Math.ceil((BOMB_FUSE + 0.2) * 60))).toContain('gate-close');
    expect(s.gatesOpen).toBe(false);
  });

  describe('1. A Delayed Flip', () => {
    it('solves when Pip throws from the top of the chute and reaches the pen before the flip', () => {
      const s = enter(1);
      standAt(s, 6, 6, 1, 0);
      useBomb(world, s, 'bomb', 'throw', 1, 0);
      expect(
        walkPath(world, s, [
          [5, 5],
          [5, 4],
          [5, 3],
          [5, 2],
        ]),
      ).toBe(true);
      expect(s.crystalColor).toBe('red');
      wait(world, s, BOMB_FUSE + 0.2);
      expect(s.crystalColor).toBe('blue');
      expect(
        walkPath(world, s, [
          [4, 2],
          [3, 2],
          [2, 2],
        ]),
      ).toBe(true);
      expect(s.roomSolved).toBe(true);
    });

    it('fails from the bottom of the chute: the flip raises U before Pip is inside', () => {
      const s = enter(1);
      standAt(s, 6, 10, 1, 0);
      useBomb(world, s, 'bomb', 'throw', 1, 0);
      const route: [number, number][] = [
        [2, 9],
        [2, 7],
        [5, 7],
        [5, 4],
        [5, 3],
        [5, 2],
      ];
      walkPath(world, s, route, BOMB_FUSE + 1);
      expect(s.crystalColor).toBe('blue');
      expect(Math.floor(s.y)).toBeGreaterThan(3);
      expect(walkPath(world, s, [[5, 3]], 2)).toBe(false);
    });
  });

  describe('2. Two Switches, One Breath', () => {
    const run = (first: [number, number], second: [number, number]): State => {
      const s = enter(2);
      standAt(s, first[0], first[1], 0, -1);
      useBomb(world, s, 'bomb', 'drop', 0, -1);
      walkPath(world, s, [second]);
      useBomb(world, s, 'bomb', 'drop', 0, -1);
      walkPath(
        world,
        s,
        [
          [5, 4],
          [5, 3],
          [5, 2],
        ],
        3,
      );
      return s;
    };
    it('solves with the far switch first', () => {
      expect(run([2, 10], [5, 5]).roomSolved).toBe(true);
    });
    it('fails with the near switch first: its bomb bursts before Pip reaches the gate', () => {
      expect(run([5, 5], [2, 10]).roomSolved).toBe(false);
    });
  });

  describe('3. Shove It Home', () => {
    it('solves with a dropped shove, a thrown shove, and a shove from the north', () => {
      const s = enter(3);
      const block = (): string => s.blocks.map((b) => `${b.x},${b.y}`).join(' ');
      standAt(s, 2, 4, 1, 0);
      useBomb(world, s, 'bomb', 'drop', 1, 0);
      walkPath(world, s, [[2, 6]]);
      wait(world, s, BOMB_FUSE + 0.2);
      expect(block()).toBe('5,4');
      walkPath(world, s, [[2, 4]]);
      useBomb(world, s, 'bomb', 'throw', 1, 0);
      walkPath(world, s, [[2, 8]]);
      wait(world, s, BOMB_FUSE + 0.2);
      expect(block()).toBe('6,4');
      walkPath(world, s, [
        [2, 2],
        [6, 2],
      ]);
      useBomb(world, s, 'bomb', 'drop', 0, 1);
      walkPath(world, s, [[8, 2]]);
      wait(world, s, BOMB_FUSE + 0.2);
      expect(block()).toBe('6,5');
      expect(s.roomSolved).toBe(true);
    });
  });

  describe('4. Long Fuse First', () => {
    const run = (headStart: number): State => {
      const s = enter(4);
      walkPath(world, s, [[6, 8]]);
      useBomb(world, s, 'fire', 'throw', 0, -1);
      walkPath(world, s, [[8, 8]]);
      wait(world, s, headStart);
      useBomb(world, s, 'fire', 'throw', 0, -1);
      wait(world, s, 12);
      return s;
    };
    it('solves when the long fuse gets a head start', () => {
      expect(run(3).roomSolved).toBe(true);
    });
    it('fails when both fuses are lit back to back: II catches first and the braziers sputter', () => {
      expect(run(0).roomSolved).toBe(false);
    });
  });

  describe('5. Pull of the Rail', () => {
    it('solves by reeling the block east along the top, then south onto the plate', () => {
      const s = enter(5);
      walkPath(world, s, [
        [8, 8],
        [8, 4],
      ]);
      useBomb(world, s, 'magnet', 'throw', -1, 0);
      wait(world, s, BOMB_FUSES.magnet + 0.2);
      expect(s.blocks.map((b) => [b.x, b.y])).toEqual([[6, 4]]);
      walkPath(world, s, [
        [8, 8],
        [6, 8],
      ]);
      useBomb(world, s, 'magnet', 'throw', 0, -1);
      wait(world, s, BOMB_FUSES.magnet + 0.2);
      expect(s.roomSolved).toBe(true);
    });
    it('cannot go the short way: the pit stops a pull south', () => {
      const s = enter(5);
      walkPath(world, s, [[4, 8]]);
      useBomb(world, s, 'magnet', 'throw', 0, -1);
      wait(world, s, BOMB_FUSES.magnet + 0.2);
      expect(s.blocks.map((b) => [b.x, b.y])).toEqual([[4, 4]]);
    });
  });

  describe('6. Mirror Steps', () => {
    const walkTiles = (s: State, tiles: [number, number][]): void => {
      for (const t of tiles) walkPath(world, s, [t], 2);
      wait(world, s, 0.5);
    };
    it('solves by pinning the Mimic against its walls to shift it into line', () => {
      const s = enter(6);
      walkTiles(s, [
        [3, 9],
        [2, 9],
        [2, 8],
        [2, 7],
        [3, 7],
        [3, 6],
        [3, 5],
        [2, 5],
        [2, 4],
        [2, 3],
        [2, 2],
        [3, 2],
        [4, 2],
        [4, 3],
        [4, 4],
        [4, 3],
        [4, 2],
      ]);
      expect(s.roomSolved).toBe(true);
    });
    it('fails walking straight up: the Mimic is stuck at the foot of its maze', () => {
      const s = enter(6);
      walkTiles(s, [
        [4, 8],
        [4, 2],
      ]);
      expect(s.roomSolved).toBe(false);
    });
  });

  describe('7. Bridge on the Race', () => {
    it('solves with one Ice patch on each current, letting each drift before it freezes', () => {
      const s = enter(7);
      standAt(s, 2, 8, 0, -1);
      s.y = 8.2;
      useBomb(world, s, 'ice', 'drop', 0, -1);
      wait(world, s, BOMB_FUSES.ice + 0.3);
      walkPath(world, s, [
        [6, 7],
        [7, 7],
        [7, 6],
      ]);
      s.y = 6.2;
      useBomb(world, s, 'ice', 'drop', 0, -1);
      wait(world, s, BOMB_FUSES.ice + 0.3);
      const path: [number, number][] = [
        [4, 6],
        [4, 5],
        [4, 4],
        [4, 3],
        [2, 2],
      ];
      expect(walkPath(world, s, path, 4)).toBe(true);
      expect(s.roomSolved).toBe(true);
    });
  });

  describe('8. Catch It in the Gale', () => {
    it('a Fire Bomb dropped under a brazier blows past it', () => {
      const s = enter(8);
      walkPath(world, s, [[5, 3]]);
      useBomb(world, s, 'fire', 'drop', 0, -1);
      wait(world, s, BOMB_FUSES.fire + 0.3);
      expect(s.torches.some((t) => t.lit)).toBe(false);
    });
    it('solves with a Rock block downwind of each brazier to catch the Fire Bomb', () => {
      const s = enter(8);
      walkPath(world, s, [[3, 3]]);
      useBomb(world, s, 'rock', 'drop', 1, 0);
      wait(world, s, BOMB_FUSES.rock + 0.1);
      walkPath(world, s, [
        [5, 4],
        [5, 3],
      ]);
      useBomb(world, s, 'fire', 'drop', 0, -1);
      wait(world, s, BOMB_FUSES.fire + 0.3);
      walkPath(world, s, [[3, 9]]);
      useBomb(world, s, 'rock', 'drop', 1, 0);
      wait(world, s, BOMB_FUSES.rock + 0.1);
      walkPath(world, s, [
        [5, 8],
        [5, 9],
      ]);
      useBomb(world, s, 'fire', 'drop', 0, 1);
      wait(world, s, BOMB_FUSES.fire + 0.3);
      expect(s.roomSolved).toBe(true);
    });
  });

  describe('9. Eye of the Gale', () => {
    const jumpTheFence = (s: State): void => {
      walkPath(world, s, [[6, 9]]);
      s.y = 9.2;
      useBomb(world, s, 'wind', 'drop', 0, -1);
      wait(world, s, BOMB_FUSES.wind + 0.2);
      expect([Math.floor(s.x), Math.floor(s.y)]).toEqual([6, 7]);
    };
    it('solves by jumping the fence, then catapulting a Bomb off a whirlwind into the crystal', () => {
      const s = enter(9);
      jumpTheFence(s);
      useBomb(world, s, 'wind', 'drop', 0, -1);
      walkPath(world, s, [[8, 7]]);
      tick(world, s, { dx: 0, dy: -1 });
      wait(world, s, BOMB_FUSES.wind);
      useBomb(world, s, 'bomb', 'throw', -1, 0);
      wait(world, s, BOMB_FUSE + 0.2);
      expect(s.crystalColor).toBe('blue');
      expect(
        walkPath(
          world,
          s,
          [
            [5, 7],
            [3, 7],
          ],
          3,
        ),
      ).toBe(true);
      expect(s.roomSolved).toBe(true);
    });
    it('a plain throw from the lip falls into the chasm', () => {
      const s = enter(9);
      jumpTheFence(s);
      wait(world, s, WHIRLWIND_DURATION);
      useBomb(world, s, 'bomb', 'throw', 0, -1);
      wait(world, s, BOMB_FUSE + 0.2);
      expect(s.crystalColor).toBe('red');
    });
  });

  describe('10. Follow the Chirp', () => {
    const chirp = (s: State, col: number): void => {
      walkPath(world, s, [[col, 8]]);
      useBomb(world, s, 'squeak', 'throw', 0, -1);
      wait(world, s, BOMB_FUSES.squeak + 0.3);
    };
    it('solves with a relay: one chirp to the middle, one at the plate', () => {
      const s = enter(10);
      chirp(s, 4);
      chirp(s, 8);
      expect(s.roomSolved).toBe(true);
    });
    it('a chirp at the plate alone is out of earshot of the beetle', () => {
      const s = enter(10);
      chirp(s, 8);
      expect(s.roomSolved).toBe(false);
    });
  });

  describe('11. Tortoise Time', () => {
    it('walking alone never gets through, however long Pip keeps at it', () => {
      // Two minutes of game time: wait at the corridor mouth and dash in every time the
      // Tortoise crosses the switch. The spikes rise under Pip before he reaches the end,
      // and send him back to the entrance.
      const s = enter(11);
      let spiked = 0;
      for (let t = 0; t < 120 && !s.roomSolved; t += 1 / 60) {
        const atMouth = Math.floor(s.x) === 7 && Math.floor(s.y) === 4;
        const inCorridor = Math.floor(s.x) === 8;
        const toward: [number, number] =
          inCorridor || (atMouth && s.gatesOpen) ? [8.5, 10.5] : [7.5, 4.5];
        const dx = toward[0] - s.x;
        const dy = toward[1] - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const input = len > 0.1 || inCorridor ? { dx: dx / len, dy: dy / len } : { dx: 0, dy: 0 };
        tick(world, s, inCorridor && Math.abs(dx) < 0.05 ? { dx: 0, dy: 1 } : input);
        if (s.events.includes('player-hurt')) spiked++;
      }
      expect(s.roomSolved).toBe(false);
      expect(spiked).toBeGreaterThan(3);
    });
    it('solves by freezing the Tortoise on its switch', () => {
      const s = enter(11);
      const tortoise = s.enemies[0]!;
      walkPath(world, s, [[5, 4]]);
      // Throw as it heads back west, about one Ice fuse's walk short of the switch
      for (let i = 0; i < 3000 && !(tortoise.fx < 0 && tortoise.x <= 8.25); i++) {
        wait(world, s, 1 / 60);
      }
      useBomb(world, s, 'ice', 'throw', 0, -1);
      walkPath(world, s, [[7, 4]]);
      wait(world, s, BOMB_FUSES.ice - 0.4);
      expect(s.gatesOpen).toBe(true);
      const corridor: [number, number][] = [
        [8, 4],
        [8, 10],
      ];
      expect(walkPath(world, s, corridor, 4)).toBe(true);
      expect(s.roomSolved).toBe(true);
    });
  });

  describe('12. Up and Over', () => {
    it('solves by throwing the Bomb off the ledge onto the switch while standing on the pillar', () => {
      const s = enter(12);
      walkPath(world, s, [
        [5, 4],
        [5, 3],
      ]);
      useBomb(world, s, 'bomb', 'throw', 0, 1);
      wait(world, s, 1 + PILLAR_TRAVEL);
      expect(s.gatesOpen).toBe(true);
      expect(
        walkPath(
          world,
          s,
          [
            [5, 2],
            [8, 2],
          ],
          3,
        ),
      ).toBe(true);
      expect(s.roomSolved).toBe(true);
    });
    it('fails dropping the Bomb on the switch by hand: the pillar rises without Pip, a wall to him', () => {
      const s = enter(12);
      walkPath(world, s, [[5, 5]]);
      for (let i = 0; i < 90 && (s.hop || Math.floor(s.y) < 7); i++) {
        tick(world, s, { dx: 0, dy: 1 });
      }
      expect(Math.floor(s.y)).toBe(7);
      walkPath(world, s, [[5, 7]]);
      useBomb(world, s, 'bomb', 'drop', 0, 1);
      const route: [number, number][] = [
        [7, 7],
        [7, 6],
        [7, 5],
        [5, 4],
        [5, 3],
        [5, 2],
        [8, 2],
      ];
      walkPath(world, s, route, 8);
      expect(s.roomSolved).toBe(false);
    });
  });
});
