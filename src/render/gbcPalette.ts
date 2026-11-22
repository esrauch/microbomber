/**
 * Game Boy Color palette rules (`ASSETS.md` §1.3):
 *
 * - Colours are 15-bit RGB555: 5 bits per channel (`isRgb555`).
 * - Background (BG): 8 palettes of 4 opaque colours per zone. Each 8x8 quarter of a
 *   16x16 tile uses one BG palette (`quads: [TL, TR, BL, BR]`), with chromatic darks
 *   on terrain so ink-outlined sprites pop cleanly off painted rooms.
 * - Sprites (OBJ): 8 palettes of 6 colours plus transparent ('.' transparent, '1'..'6').
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
  'mouse',
  'powder',
  'fire',
  'green',
  'violet',
  'spectral',
  'villager',
  'crimson',
] as const;
export type ObjPaletteId = (typeof OBJ_PALETTE_IDS)[number];

export type ObjPalette = readonly [Rgb, Rgb, Rgb, Rgb, Rgb, Rgb];

/** 8 sprite palettes of 6 RGB555 colours each (indices '1'..'6'; '.' is transparent). */
export const OBJ_PALETTES: Record<ObjPaletteId, ObjPalette> = {
  mouse: [
    rgb555(248, 224, 72), // 1: live fuse spark
    rgb555(248, 152, 160), // 2: pink ears, paws, nose
    rgb555(216, 184, 144), // 3: fawn fur (warm, so he stands off cool crypt floors)
    rgb555(152, 112, 80), // 4: brown shade & fuse cord
    rgb555(232, 232, 240), // 5: white belly / white-hot spark
    INK, // 6: ink outline
  ],
  powder: [
    rgb555(248, 248, 240), // 1: white-hot spark & specular
    rgb555(248, 176, 48), // 2: live gold fuse spark
    rgb555(168, 184, 208), // 3: steel fuse collar
    rgb555(80, 96, 144), // 4: slate iron sheen
    rgb555(40, 48, 72), // 5: cast-iron bomb body
    INK, // 6: ink outline
  ],
  fire: [
    rgb555(248, 248, 240), // 1: incandescent white core
    rgb555(248, 224, 72), // 2: bright flame yellow
    rgb555(248, 136, 32), // 3: blaze orange
    rgb555(224, 48, 40), // 4: ruby flask / hot red
    rgb555(136, 24, 32), // 5: deep ember shadow
    INK, // 6: ink outline
  ],
  green: [
    rgb555(248, 248, 240), // 1: specular glint
    rgb555(184, 240, 96), // 2: sunlit lime / thorn tip
    rgb555(64, 192, 80), // 3: emerald slime / vine
    rgb555(40, 112, 48), // 4: deep briar moss
    rgb555(224, 64, 48), // 5: glowing boss eye / berry accent
    INK, // 6: ink outline
  ],
  violet: [
    rgb555(248, 248, 240), // 1: white highlight
    rgb555(248, 216, 72), // 2: glowing amber eye
    rgb555(208, 152, 248), // 3: pale lavender
    rgb555(136, 64, 208), // 4: royal phantom violet
    rgb555(72, 32, 120), // 5: deep crypt plum
    INK, // 6: ink outline
  ],
  spectral: [
    rgb555(240, 248, 248), // 1: ghostly white
    rgb555(248, 216, 88), // 2: eerie lantern eye
    rgb555(120, 224, 248), // 3: ice wraith cyan
    rgb555(56, 144, 208), // 4: shadow azure
    rgb555(32, 64, 128), // 5: midnight cloak
    INK, // 6: ink outline
  ],
  villager: [
    rgb555(248, 248, 240), // 1: white beard / steel glint
    rgb555(248, 208, 72), // 2: brass / gold key
    rgb555(248, 208, 160), // 3: peach skin
    rgb555(192, 112, 56), // 4: oak shield / leather apron
    rgb555(88, 112, 104), // 5: sage / iron-guard tunic
    INK, // 6: ink outline
  ],
  crimson: [
    rgb555(248, 248, 240), // 1: specular white
    rgb555(248, 216, 72), // 2: gold trim / boss-key crown
    rgb555(248, 136, 144), // 3: rose highlight
    rgb555(232, 40, 48), // 4: ruby heart red
    rgb555(136, 16, 32), // 5: deep garnet shadow
    INK, // 6: ink outline
  ],
};

export const BG_PALETTE_IDS = [
  'floor',
  'wall',
  'foliage',
  'water',
  'wood',
  'red',
  'blue',
  'steel',
] as const;
export type BgPaletteId = (typeof BG_PALETTE_IDS)[number];

export type BgPalette = readonly [Rgb, Rgb, Rgb, Rgb];

/**
 * Prop/edge palettes start with the zone's open floor base at index 0, just as Oracle
 * seats trees, shores, pots, and blocks seamlessly onto the ground.
 */
function makeZoneBgPalettes(
  floor: BgPalette,
  wall: BgPalette,
  foliage: BgPalette,
): Record<BgPaletteId, BgPalette> {
  const base = floor[1];
  return {
    floor,
    wall,
    foliage,
    water: [base, rgb555(232, 248, 248), rgb555(64, 152, 240), rgb555(24, 72, 152)],
    wood: [base, rgb555(232, 176, 88), rgb555(160, 96, 40), INK],
    red: [base, rgb555(248, 152, 136), rgb555(208, 48, 48), INK],
    blue: [base, rgb555(152, 216, 248), rgb555(48, 112, 216), INK],
    steel: [base, rgb555(208, 216, 232), rgb555(112, 120, 144), INK],
  };
}

const OW_GRASS_BASE = rgb555(96, 184, 64);
// Grandma's House & Cellar: warm hearth stone & timber so Pip and brass keys read cozily
const BASEMENT_FLOOR_BASE = rgb555(136, 112, 88);
// Ice Cave: pale glacier stone, so the warm mouse and fire light both stand off it
const CRYPT_FLOOR_BASE = rgb555(112, 136, 160);

export const BG_PALETTES: Record<ZoneId, Record<BgPaletteId, BgPalette>> = {
  overworld: makeZoneBgPalettes(
    // 0: sunlit grass tuft, 1: meadow base, 2: warm cobble/dirt path, 3: deep pine rim
    // The path is a quiet, desaturated earth so Pip's amber hood stands out on it
    [rgb555(168, 232, 96), OW_GRASS_BASE, rgb555(196, 172, 132), rgb555(40, 104, 40)],
    // 0: sunlit limestone brow, 1: highland cliff face, 2: rock shadow, 3: deep umber crease
    [rgb555(216, 200, 152), rgb555(152, 136, 96), rgb555(96, 80, 56), rgb555(40, 32, 28)],
    // 0: grass ground, 1: sunlit tree crown, 2: rich canopy leaf, 3: deep forest bark/pine
    // Canopy sits below the grass in value, so tree walls frame the playfield instead of
    // out-shouting it
    [OW_GRASS_BASE, rgb555(88, 152, 72), rgb555(40, 108, 56), rgb555(20, 48, 36)],
  ),
  basement: makeZoneBgPalettes(
    // 0: warm flagstone highlight, 1: cellar stone floor, 2: recessed mortar trim, 3: deep seam
    [rgb555(192, 168, 136), BASEMENT_FLOOR_BASE, rgb555(88, 68, 52), rgb555(40, 28, 24)],
    // 0: hearth timber highlight, 1: warm cellar masonry, 2: aged oak cap, 3: deep timber joint
    [rgb555(208, 176, 128), rgb555(144, 104, 64), rgb555(88, 60, 40), rgb555(36, 24, 20)],
    // 0: stone base, 1: brass gilt highlight, 2: warm amber inlay, 3: ink
    [BASEMENT_FLOOR_BASE, rgb555(232, 200, 128), rgb555(168, 128, 72), INK],
  ),
  'ice-cave': makeZoneBgPalettes(
    // 0: frost highlight, 1: glacier stone floor, 2: recessed trim, 3: deep crevasse
    [rgb555(176, 200, 216), CRYPT_FLOOR_BASE, rgb555(64, 84, 112), rgb555(24, 32, 56)],
    // 0: frosted rim, 1: blue ice-rock wall, 2: outer cap stone, 3: deep ice joint
    [rgb555(200, 224, 240), rgb555(80, 112, 152), rgb555(44, 64, 100), rgb555(20, 28, 52)],
    // 0: stone base, 1: icicle white / gilt, 2: glacier blue (ice blocks), 3: ink
    [CRYPT_FLOOR_BASE, rgb555(232, 240, 248), rgb555(136, 184, 216), INK],
  ),
};

/** Ink used for the dark-room mask and UI outlines (a palette colour, not a blend). */
export const INK_RGB = INK;

export function cssRgb(c: Rgb): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
