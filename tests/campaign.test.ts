import { describe, expect, it } from 'vitest';
import { ROOM_H, ROOM_W, campaignWorld, roomKey } from '../src/game/world';

const VALID_TILES = new Set([
  '.',
  '#',
  '%',
  '~',
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
]);

describe('vertical slice campaign integrity (Prologue + Ember Crypt)', () => {
  const world = campaignWorld();

  it('has 19 rooms (9 Overworld + 10 Ember Crypt), all exactly ROOM_W × ROOM_H with valid tiles', () => {
    const rooms = [...world.rooms.values()];
    expect(rooms.filter((r) => r.zone === 'overworld')).toHaveLength(9);
    expect(rooms.filter((r) => r.zone === 'ember-crypt')).toHaveLength(10);

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
          const hereOpen = r.rows[0]![x] !== '#';
          const thereOpen = north.rows[ROOM_H - 1]![x] !== '#';
          expect(hereOpen, `${r.name} N col ${x} vs ${north.name} S`).toBe(thereOpen);
        }
      }
      // West / East edges
      const west = world.rooms.get(roomKey(r.zone, r.rx - 1, r.ry));
      if (west) {
        for (let y = 0; y < ROOM_H; y++) {
          const hereOpen = r.rows[y]![0] !== '#';
          const thereOpen = west.rows[y]![ROOM_W - 1] !== '#';
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
});
