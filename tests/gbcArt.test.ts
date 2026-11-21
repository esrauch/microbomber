import { describe, expect, it } from 'vitest';
import { BG, OBJ } from '../src/render/gbcArt';
import {
  BG_PALETTES,
  BG_PALETTE_IDS,
  OBJ_PALETTES,
  OBJ_PALETTE_IDS,
  isRgb555,
} from '../src/render/gbcPalette';

describe('GBC colour rules', () => {
  it('has at most 8 sprite palettes of 3 colours, and 8 background palettes of 4 per zone', () => {
    expect(OBJ_PALETTE_IDS.length).toBeLessThanOrEqual(8);
    for (const id of OBJ_PALETTE_IDS) expect(OBJ_PALETTES[id]).toHaveLength(3);
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

  it.each(Object.entries(OBJ))('sprite %s is rectangular, 3 colours plus transparent', (_, s) => {
    const w = s.rows[0]?.length ?? 0;
    for (const row of s.rows) {
      expect(row).toHaveLength(w);
      expect(row).toMatch(/^[.123]*$/);
    }
    expect(OBJ_PALETTE_IDS).toContain(s.pal);
  });

  it.each(Object.entries(BG))('tile %s is 16x16 with one 4-colour palette per quarter', (_, t) => {
    expect(t.rows).toHaveLength(16);
    for (const row of t.rows) expect(row).toMatch(/^[0-3]{16}$/);
    expect(t.quads).toHaveLength(4);
    for (const q of t.quads) expect(BG_PALETTE_IDS).toContain(q);
  });
});
