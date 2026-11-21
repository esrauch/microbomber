/**
 * Game Boy Color palette rules, as Oracle of Ages used them (`GAME.md` art direction).
 *
 * - Colours are 15-bit RGB555: 5 bits per channel.
 * - Sprites (OBJ): 8 palettes of 3 colours plus transparent. Every sprite (each 8px
 *   column of a wide one) uses exactly one of them; damage flashes and enemy variants
 *   are palette swaps, never new art.
 * - Background (BG): 8 palettes of 4 opaque colours per zone. Each 8x8 quarter of a
 *   16x16 tile uses exactly one of them.
 *
 * Index order follows the hardware convention: higher index = darker. Sprite pixels
 * are '.' (transparent) or '1'..'3'; background pixels are '0'..'3'.
 */
import type { ZoneId } from '../game/types';

export type Rgb = readonly [number, number, number];

/** Snap an 8-bit channel triple to the nearest RGB555 colour, expanded back to 8 bits. */
export function rgb555(r: number, g: number, b: number): Rgb {
  const q = (v: number): number => {
    const five = Math.max(0, Math.min(31, Math.round(v / 8.225)));
    return (five << 3) | (five >> 2);
  };
  return [q(r), q(g), q(b)];
}

/** True if `c` is exactly representable on GBC hardware. */
export function isRgb555(c: Rgb): boolean {
  const [r, g, b] = rgb555(...c);
  return r === c[0] && g === c[1] && b === c[2];
}

const INK = rgb555(24, 20, 32);

export const OBJ_PALETTE_IDS = [
  'pip',
  'slate',
  'fire',
  'red',
  'green',
  'violet',
  'gold',
  'spectral',
] as const;
export type ObjPaletteId = (typeof OBJ_PALETTE_IDS)[number];

/** The 8 sprite palettes: [light, mid, dark] for indices 1..3 (index 0 is transparent). */
export const OBJ_PALETTES: Record<ObjPaletteId, readonly [Rgb, Rgb, Rgb]> = {
  pip: [rgb555(248, 208, 160), rgb555(48, 120, 232), INK],
  slate: [rgb555(232, 240, 248), rgb555(96, 112, 160), INK],
  fire: [rgb555(248, 232, 96), rgb555(240, 120, 32), rgb555(136, 24, 24)],
  red: [rgb555(248, 192, 184), rgb555(224, 48, 48), INK],
  green: [rgb555(168, 240, 112), rgb555(48, 168, 64), INK],
  violet: [rgb555(216, 176, 248), rgb555(136, 72, 200), INK],
  gold: [rgb555(248, 216, 88), rgb555(168, 96, 40), INK],
  spectral: [rgb555(232, 248, 248), rgb555(96, 192, 240), rgb555(24, 56, 120)],
};

export const BG_PALETTE_IDS = [
  'floor',
  'wall',
  'water',
  'wood',
  'bramble',
  'red',
  'blue',
  'steel',
] as const;
export type BgPaletteId = (typeof BG_PALETTE_IDS)[number];

type BgPalette = readonly [Rgb, Rgb, Rgb, Rgb];

/**
 * Object palettes start with the zone's floor colour at index 0, the way Oracle seats
 * pots and blocks on the floor: the object gets 3 shades, the floor shows through.
 */
function zonePalettes(
  floor: BgPalette,
  wall: BgPalette,
  water: BgPalette,
): Record<BgPaletteId, BgPalette> {
  const base = floor[1];
  return {
    floor,
    wall,
    water,
    wood: [base, rgb555(232, 168, 72), rgb555(152, 88, 32), INK],
    bramble: [base, rgb555(176, 176, 64), rgb555(88, 104, 32), INK],
    red: [base, rgb555(248, 152, 152), rgb555(216, 40, 40), INK],
    blue: [base, rgb555(152, 216, 248), rgb555(40, 120, 232), INK],
    steel: [base, rgb555(200, 208, 224), rgb555(112, 120, 144), INK],
  };
}

export const BG_PALETTES: Record<ZoneId, Record<BgPaletteId, BgPalette>> = {
  overworld: zonePalettes(
    [rgb555(176, 232, 112), rgb555(104, 184, 72), rgb555(48, 120, 40), INK],
    [rgb555(200, 216, 152), rgb555(136, 152, 104), rgb555(72, 88, 64), INK],
    [rgb555(232, 248, 248), rgb555(96, 176, 248), rgb555(32, 104, 184), rgb555(16, 48, 112)],
  ),
  'ember-crypt': zonePalettes(
    [rgb555(120, 104, 144), rgb555(88, 72, 112), rgb555(64, 52, 88), INK],
    [rgb555(128, 112, 152), rgb555(80, 64, 104), rgb555(48, 36, 64), INK],
    [rgb555(200, 232, 248), rgb555(72, 144, 216), rgb555(32, 80, 160), rgb555(16, 32, 88)],
  ),
};

/** Ink used for the dark-room mask and UI outlines (a palette colour, not a blend). */
export const INK_RGB = INK;

export function cssRgb(c: Rgb): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
