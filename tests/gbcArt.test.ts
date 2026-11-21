import { describe, expect, it } from 'vitest';
import { campaignWorld, newState } from '../src/game/world';
import {
  BG,
  CRYPT_FLOOR_BLOB,
  OBJ,
  PATH_BLOB,
  PIT_BLOB,
  STAMP_DEFS,
  WATER_BLOB,
  resolveBlobTile,
} from '../src/render/gbcArt';
import { buildRoomLayout } from '../src/render/gbcAutotile';
import {
  BG_PALETTES,
  BG_PALETTE_IDS,
  OBJ_PALETTES,
  OBJ_PALETTE_IDS,
  isRgb555,
} from '../src/render/gbcPalette';

describe('GBC colour and multi-tile rules', () => {
  it('has at most 8 sprite palettes of 6 colours, and 8 background palettes of 4 per zone', () => {
    expect(OBJ_PALETTE_IDS.length).toBeLessThanOrEqual(8);
    for (const id of OBJ_PALETTE_IDS) expect(OBJ_PALETTES[id]).toHaveLength(6);
    expect(BG_PALETTE_IDS.length).toBeLessThanOrEqual(8);
    for (const zone of Object.values(BG_PALETTES)) {
      expect(Object.keys(zone)).toHaveLength(BG_PALETTE_IDS.length);
      for (const id of BG_PALETTE_IDS) expect(zone[id]).toHaveLength(4);
    }
  });

  it('uses only colours the GBC can show (RGB555)', () => {
    const all = [
      ...Object.values(OBJ_PALETTES).flat(),
      ...Object.values(BG_PALETTES).flatMap((z) => Object.values(z).flat()),
    ];
    for (const c of all) expect(isRgb555(c), `${c.join(',')}`).toBe(true);
  });

  it.each(Object.entries(OBJ))('sprite %s is rectangular, ≤6 colours plus transparent', (_, s) => {
    const w = s.rows[0]?.length ?? 0;
    expect(w).toBeGreaterThan(0);
    for (const row of s.rows) {
      expect(row).toHaveLength(w);
      expect(row).toMatch(/^[.1-6]*$/);
    }
    expect(OBJ_PALETTE_IDS).toContain(s.pal);
  });

  it.each(Object.entries(BG))('tile %s is 16x16 with one 4-colour palette per quarter', (_, t) => {
    expect(t.rows).toHaveLength(16);
    for (const row of t.rows) expect(row).toMatch(/^[0-3]{16}$/);
    expect(t.quads).toHaveLength(4);
    for (const q of t.quads) expect(BG_PALETTE_IDS).toContain(q);
  });

  it('generates valid 16x16 tiles across all 256 8-neighbour blob masks', () => {
    for (const kit of [WATER_BLOB, PIT_BLOB, PATH_BLOB, CRYPT_FLOOR_BLOB]) {
      for (let mask = 0; mask < 256; mask++) {
        const t = resolveBlobTile(kit, {
          n: Boolean(mask & 1),
          ne: Boolean(mask & 2),
          e: Boolean(mask & 4),
          se: Boolean(mask & 8),
          s: Boolean(mask & 16),
          sw: Boolean(mask & 32),
          w: Boolean(mask & 64),
          nw: Boolean(mask & 128),
        });
        expect(t.rows).toHaveLength(16);
        for (const r of t.rows) expect(r).toMatch(/^[0-3]{16}$/);
      }
    }
  });

  it('links every landmark stamp cell to a defined BG tile', () => {
    for (const [id, cells] of Object.entries(STAMP_DEFS)) {
      expect(cells.length, id).toBeGreaterThan(0);
      for (const c of cells) {
        expect(BG[c.tile], `${id} -> ${c.tile}`).toBeDefined();
      }
    }
  });

  it('Y-sorts 3/4 overhead tiles behind southern braziers while keeping north doorway lintels on ceiling', () => {
    const world = campaignWorld();

    // Ember Crypt Arch: crypt-mausoleum at y=4 sorts behind lit braziers at y=5
    const archState = newState(world, 'overworld', 3, 5, 5.5, 8.0);
    const archPlan = buildRoomLayout(world, archState);
    expect(archPlan.ceiling).toHaveLength(0);
    const mausoleum = archPlan.overhead.filter((o) => o.y === 4 && o.x >= 4 && o.x <= 6);
    expect(mausoleum).toHaveLength(3);
    for (const m of mausoleum) {
      expect(m.transparentZero).toBe(false);
      for (const t of archState.torches) {
        expect(m.y + 0.99).toBeLessThan(t.y + 0.55);
      }
    }

    // Crystal Crossroads: open north tunnel (5,0) puts archLintelN on the walk-under ceiling layer
    const cryptState = newState(world, 'ember-crypt', 1, 2, 5.5, 6.5);
    const cryptPlan = buildRoomLayout(world, cryptState);
    expect(cryptPlan.ceiling).toEqual([
      { x: 5, y: 0, tile: BG.archLintelN, transparentZero: true },
    ]);
  });

  it('defines distinct directional stone slope tiles (slopeN/S/E/W) and maps n/s/e/w cells in buildRoomLayout', () => {
    const patterns = new Set([
      BG.slopeN.rows.join(''),
      BG.slopeS.rows.join(''),
      BG.slopeE.rows.join(''),
      BG.slopeW.rows.join(''),
    ]);
    expect(patterns.size).toBe(4);

    const world = campaignWorld();
    world.rooms.set('ember-crypt:9,9', {
      zone: 'ember-crypt',
      rx: 9,
      ry: 9,
      name: 'Slope Test Chamber',
      rows: [
        '###########',
        '###########',
        '##.......##',
        '##...n...##',
        '##..w.e..##',
        '##...s...##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '###########',
        '###########',
      ],
    });
    const st = newState(world, 'ember-crypt', 9, 9, 5.5, 8.5);
    const plan = buildRoomLayout(world, st);
    expect(plan.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 5, y: 3, tile: BG.slopeN }),
        expect.objectContaining({ x: 5, y: 5, tile: BG.slopeS }),
        expect.objectContaining({ x: 6, y: 4, tile: BG.slopeE }),
        expect.objectContaining({ x: 4, y: 4, tile: BG.slopeW }),
      ]),
    );
  });
});
