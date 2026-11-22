import { describe, expect, it } from 'vitest';
import {
  FIXED_DT,
  ROOM_H,
  ROOM_W,
  campaignWorld,
  grandmaAdvice,
  isShallowWaterTile,
  isTileSolidForWalk,
  newState,
  roomKey,
  tick,
} from '../src/game/world';

const VALID_TILES = new Set([
  '.',
  ',',
  ':',
  '_',
  '#',
  'Y',
  '%',
  '~',
  ';',
  '1',
  '2',
  '3',
  '4',
  '^',
  '=',
  'B',
  'W',
  'R',
  'U',
  'C',
  'T',
  'D',
  'K',
  'S',
  'O',
  '!',
  '>',
  'P',
  'n',
  's',
  'e',
  'w',
]);

const isWallBorder = (ch: string | undefined): boolean => ch === '#' || ch === 'Y';

describe('vertical slice campaign integrity (Prologue + Ice Cave)', () => {
  const world = campaignWorld();

  it('has 19 rooms (9 Overworld + 10 Ice Cave), all exactly ROOM_W × ROOM_H with valid tiles', () => {
    const rooms = [...world.rooms.values()];
    expect(rooms.filter((r) => r.zone === 'overworld')).toHaveLength(9);
    expect(rooms.filter((r) => r.zone === 'ice-cave')).toHaveLength(10);

    for (const r of rooms) {
      expect(r.rows, r.name).toHaveLength(ROOM_H);
      for (const [y, row] of r.rows.entries()) {
        expect(row, `${r.name} row ${y}`).toHaveLength(ROOM_W);
        for (const ch of row) {
          expect(VALID_TILES.has(ch), `${r.name} invalid tile '${ch}'`).toBe(true);
        }
      }
    }
  });

  it('aligns every open room-edge tile with a non-wall tile in the neighbouring room', () => {
    for (const r of world.rooms.values()) {
      // North / South edges
      const north = world.rooms.get(roomKey(r.zone, r.rx, r.ry - 1));
      if (north) {
        for (let x = 0; x < ROOM_W; x++) {
          const hereOpen = !isWallBorder(r.rows[0]![x]);
          const thereOpen = !isWallBorder(north.rows[ROOM_H - 1]![x]);
          expect(hereOpen, `${r.name} N col ${x} vs ${north.name} S`).toBe(thereOpen);
        }
      }
      // West / East edges
      const west = world.rooms.get(roomKey(r.zone, r.rx - 1, r.ry));
      if (west) {
        for (let y = 0; y < ROOM_H; y++) {
          const hereOpen = !isWallBorder(r.rows[y]![0]);
          const thereOpen = !isWallBorder(west.rows[y]![ROOM_W - 1]);
          expect(hereOpen, `${r.name} W row ${y} vs ${west.name} E`).toBe(thereOpen);
        }
      }
    }
  });

  it('links every portal and torch to valid tile coordinates and balances dungeon keys', () => {
    let lockedDoors = 0;
    let bossDoors = 0;
    let smallKeys = 0;
    let bossKeys = 0;
    const pickupIds = new Set<string>();

    for (const r of world.rooms.values()) {
      for (const row of r.rows) {
        for (const ch of row) {
          if (ch === 'D') lockedDoors++;
          if (ch === 'K') bossDoors++;
        }
      }
      for (const t of r.torches ?? []) {
        expect(r.rows[t.y]?.[t.x], `${r.name} torch (${t.x},${t.y})`).toBe('T');
      }
      for (const p of r.portals ?? []) {
        expect(r.rows[p.y]?.[p.x], `${r.name} portal (${p.x},${p.y})`).toBe('>');
        const dest = world.rooms.get(roomKey(p.targetZone, p.targetRx, p.targetRy));
        expect(dest, `${r.name} portal target`).toBeDefined();
        for (const dp of dest?.portals ?? []) {
          expect(
            Math.hypot(p.targetX - (dp.x + 0.5), p.targetY - (dp.y + 0.5)),
            `${r.name} portal lands off ${dest?.name} portal (${dp.x},${dp.y})`,
          ).toBeGreaterThanOrEqual(0.8);
        }
      }
      for (const pk of r.pickups ?? []) {
        expect(pickupIds.has(pk.id), `duplicate pickup id ${pk.id}`).toBe(false);
        pickupIds.add(pk.id);
        if (pk.kind === 'small-key') smallKeys++;
        if (pk.kind === 'boss-key') bossKeys++;
      }
    }

    expect(lockedDoors).toBe(2);
    expect(smallKeys).toBe(2);
    expect(bossDoors).toBe(1);
    expect(bossKeys).toBe(1);
    expect(pickupIds.has('crypt-ember-bomb')).toBe(true);
    expect(pickupIds.has('boss-cinder-core')).toBe(true);
    expect(pickupIds.has('boss-heart-container')).toBe(true);
  });

  it('includes systemic dry grass, directional water current, and breeze flavour in Overworld rooms', () => {
    const millbrookNorth = world.rooms.get(roomKey('overworld', 3, 1));
    expect(millbrookNorth?.wind).toEqual({ dx: 0.35, dy: 0 });
    expect(millbrookNorth?.rows[6]?.[8]).toBe('2');

    const brambleWoods = world.rooms.get(roomKey('overworld', 3, 3));
    expect(brambleWoods?.rows[5]?.[6]).toBe(',');
    expect(brambleWoods?.rows[3]?.[6]).toBe(',');
    expect(brambleWoods?.rows[3]?.[7]).toBe('B');

    const millbrookSquare = world.rooms.get(roomKey('overworld', 3, 2));
    expect(millbrookSquare?.rows[6]?.[7]).toBe(';');
    expect(millbrookSquare?.rows[6]?.[8]).toBe(';');
    expect(isShallowWaterTile(';')).toBe(true);
    expect(isTileSolidForWalk(';', 'red')).toBe(false);

    const s = newState(world, 'overworld', 3, 2, 6.5, 6.5);
    for (let i = 0; i < 30; i++) {
      tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    }
    expect(s.x).toBeGreaterThan(7.4);
  });
});

describe('crypt lighting', () => {
  it('starts every crypt room with a lit torch, except the dark boss sanctum', () => {
    const world = campaignWorld();
    for (const room of world.rooms.values()) {
      if (room.zone !== 'ice-cave') continue;
      const s = newState(world, room.zone, room.rx, room.ry);
      const lit = s.torches.some((t) => t.lit);
      expect(lit, room.name).toBe(room.condition !== 'boss');
    }
  });
});

describe('Grandma, the only voice', () => {
  it('is the only character who speaks, at the Mouse House', () => {
    const world = campaignWorld();
    const speakers = [...world.rooms.values()].flatMap((r) =>
      (r.npcs ?? []).map((n) => `${r.name}:${n.id}`),
    );
    expect(speakers).toEqual(['Mouse House:grandma']);
  });

  it('points Pip at the next goal as the story moves on', () => {
    const world = campaignWorld();
    const s = newState(world);
    expect(grandmaAdvice(s)).toMatch(/Orchard Gate/);
    s.unlockedBombs.push('fire');
    expect(grandmaAdvice(s)).toMatch(/Ice Cave/);
    s.cores.push('cinder');
    expect(grandmaAdvice(s)).toMatch(/Tower Courtyard/);
    s.spireCinderSlotted = true;
    expect(grandmaAdvice(s)).toMatch(/three to go/);
  });
});
