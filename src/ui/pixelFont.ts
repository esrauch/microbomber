/**
 * In-repo authored `8 × 8` Game Boy Color / Oracle-style bitmap pixel font (`ROADMAP.md` §6.2),
 * compiled at runtime into a standards-compliant binary TrueType (`sfnt` `0x00010000`) font
 * with zero external font dependencies or network fetches.
 *
 * Metrics:
 * - `unitsPerEm = 1024` (`128` font units per art pixel).
 * - Rows `0..6` sit above the baseline (`y = 896` down to `0`), and row `7` is the `1px`
 *   descender row (`y = -128..0`) for `g, j, p, q, y` and descending punctuation.
 * - Every glyph advance width is an exact whole multiple of `128` units, so `8px`, `16px`,
 *   and `24px` font sizes land on exact integer pixel boundaries.
 */

export const PIXEL_FONT_FAMILY = 'CinderholmPixel';

const PIXEL_UNITS = 128;
const UNITS_PER_EM = 8 * PIXEL_UNITS; // 1024
const ASCENDER = 7 * PIXEL_UNITS; // 896
const DESCENDER = -1 * PIXEL_UNITS; // -128

/** Convert an 8-char `'.'` / `'#'` visual string into an 8-bit row byte (MSB = col 0). */
function r(bits: string): number {
  let out = 0;
  for (let i = 0; i < 8; i++) {
    if (bits[i] === '#') out |= 0x80 >> i;
  }
  return out;
}

function g(
  ...rows: [string, string, string, string, string, string, string, string]
): readonly number[] {
  return rows.map(r);
}

/**
 * `8 × 8` bitmap glyph table keyed by Unicode codepoint (`8` bytes per glyph, MSB = col 0).
 * Covers printable ASCII `0x20..0x7E` plus all HUD & dialogue glyphs used in `microbomber`.
 */
export const GLYPH_BITMAPS: Readonly<Record<number, readonly number[]>> = {
  // 0x20 Space
  0x0020: g(
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),
  // 0x21 !
  0x0021: g(
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '........',
    '#.......',
    '........',
  ),
  // 0x22 "
  0x0022: g(
    '#.#.....',
    '#.#.....',
    '#.#.....',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),
  // 0x23 #
  0x0023: g(
    '.#.#....',
    '#####...',
    '.#.#....',
    '.#.#....',
    '#####...',
    '.#.#....',
    '........',
    '........',
  ),
  // 0x24 $
  0x0024: g(
    '..#.....',
    '.####...',
    '#.#.....',
    '.###....',
    '..#.#...',
    '####....',
    '..#.....',
    '........',
  ),
  // 0x25 %
  0x0025: g(
    '##..#...',
    '##.#....',
    '..#.....',
    '.#......',
    '#.##....',
    '....##..',
    '....##..',
    '........',
  ),
  // 0x26 &
  0x0026: g(
    '.##.....',
    '#..#....',
    '.##.....',
    '#..#.#..',
    '#...#...',
    '.###.#..',
    '........',
    '........',
  ),
  // 0x27 '
  0x0027: g(
    '#.......',
    '#.......',
    '#.......',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),
  // 0x28 (
  0x0028: g(
    '..#.....',
    '.#......',
    '#.......',
    '#.......',
    '#.......',
    '.#......',
    '..#.....',
    '........',
  ),
  // 0x29 )
  0x0029: g(
    '#.......',
    '.#......',
    '..#.....',
    '..#.....',
    '..#.....',
    '.#......',
    '#.......',
    '........',
  ),
  // 0x2A *
  0x002a: g(
    '........',
    '..#.....',
    '#.#.#...',
    '.###....',
    '#.#.#...',
    '..#.....',
    '........',
    '........',
  ),
  // 0x2B +
  0x002b: g(
    '........',
    '..#.....',
    '..#.....',
    '#####...',
    '..#.....',
    '..#.....',
    '........',
    '........',
  ),
  // 0x2C ,
  0x002c: g(
    '........',
    '........',
    '........',
    '........',
    '........',
    '.#......',
    '.#......',
    '#.......',
  ),
  // 0x2D -
  0x002d: g(
    '........',
    '........',
    '........',
    '####....',
    '........',
    '........',
    '........',
    '........',
  ),
  // 0x2E .
  0x002e: g(
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '#.......',
    '........',
  ),
  // 0x2F /
  0x002f: g(
    '....#...',
    '...#....',
    '..#.....',
    '..#.....',
    '.#......',
    '#.......',
    '#.......',
    '........',
  ),

  // Digits 0..9 (uniform 5px glyph + 1px advance = 6px tabular width)
  0x0030: g(
    '.###....',
    '#...#...',
    '#..##...',
    '#.#.#...',
    '##..#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0031: g(
    '..#.....',
    '.##.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '.###....',
    '........',
  ),
  0x0032: g(
    '.###....',
    '#...#...',
    '....#...',
    '..##....',
    '.#......',
    '#.......',
    '#####...',
    '........',
  ),
  0x0033: g(
    '####....',
    '....#...',
    '..##....',
    '....#...',
    '....#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0034: g(
    '...#....',
    '..##....',
    '.#.#....',
    '#..#....',
    '#####...',
    '...#....',
    '...#....',
    '........',
  ),
  0x0035: g(
    '#####...',
    '#.......',
    '####....',
    '....#...',
    '....#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0036: g(
    '.###....',
    '#.......',
    '####....',
    '#...#...',
    '#...#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0037: g(
    '#####...',
    '....#...',
    '...#....',
    '..#.....',
    '..#.....',
    '.#......',
    '.#......',
    '........',
  ),
  0x0038: g(
    '.###....',
    '#...#...',
    '#...#...',
    '.###....',
    '#...#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0039: g(
    '.###....',
    '#...#...',
    '#...#...',
    '.####...',
    '....#...',
    '....#...',
    '.###....',
    '........',
  ),

  // 0x3A..0x40 : ; < = > ? @
  0x003a: g(
    '........',
    '........',
    '#.......',
    '........',
    '........',
    '#.......',
    '........',
    '........',
  ),
  0x003b: g(
    '........',
    '........',
    '.#......',
    '........',
    '........',
    '.#......',
    '.#......',
    '#.......',
  ),
  0x003c: g(
    '...#....',
    '..#.....',
    '.#......',
    '#.......',
    '.#......',
    '..#.....',
    '...#....',
    '........',
  ),
  0x003d: g(
    '........',
    '........',
    '####....',
    '........',
    '####....',
    '........',
    '........',
    '........',
  ),
  0x003e: g(
    '#.......',
    '.#......',
    '..#.....',
    '...#....',
    '..#.....',
    '.#......',
    '#.......',
    '........',
  ),
  0x003f: g(
    '.###....',
    '#...#...',
    '....#...',
    '..##....',
    '..#.....',
    '........',
    '..#.....',
    '........',
  ),
  0x0040: g(
    '.###....',
    '#...#...',
    '#.###...',
    '#.#.#...',
    '#.###...',
    '#.......',
    '.####...',
    '........',
  ),

  // Uppercase A..Z
  0x0041: g(
    '.###....',
    '#...#...',
    '#...#...',
    '#####...',
    '#...#...',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x0042: g(
    '####....',
    '#...#...',
    '#...#...',
    '####....',
    '#...#...',
    '#...#...',
    '####....',
    '........',
  ),
  0x0043: g(
    '.####...',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '.####...',
    '........',
  ),
  0x0044: g(
    '####....',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '####....',
    '........',
  ),
  0x0045: g(
    '#####...',
    '#.......',
    '#.......',
    '####....',
    '#.......',
    '#.......',
    '#####...',
    '........',
  ),
  0x0046: g(
    '#####...',
    '#.......',
    '#.......',
    '####....',
    '#.......',
    '#.......',
    '#.......',
    '........',
  ),
  0x0047: g(
    '.####...',
    '#.......',
    '#.......',
    '#..##...',
    '#...#...',
    '#...#...',
    '.####...',
    '........',
  ),
  0x0048: g(
    '#...#...',
    '#...#...',
    '#...#...',
    '#####...',
    '#...#...',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x0049: g(
    '###.....',
    '.#......',
    '.#......',
    '.#......',
    '.#......',
    '.#......',
    '###.....',
    '........',
  ),
  0x004a: g(
    '..###...',
    '...#....',
    '...#....',
    '...#....',
    '...#....',
    '#..#....',
    '.##.....',
    '........',
  ),
  0x004b: g(
    '#...#...',
    '#..#....',
    '#.#.....',
    '##......',
    '#.#.....',
    '#..#....',
    '#...#...',
    '........',
  ),
  0x004c: g(
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#####...',
    '........',
  ),
  0x004d: g(
    '#...#...',
    '##.##...',
    '#.#.#...',
    '#.#.#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x004e: g(
    '#...#...',
    '##..#...',
    '#.#.#...',
    '#..##...',
    '#...#...',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x004f: g(
    '.###....',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0050: g(
    '####....',
    '#...#...',
    '#...#...',
    '####....',
    '#.......',
    '#.......',
    '#.......',
    '........',
  ),
  0x0051: g(
    '.###....',
    '#...#...',
    '#...#...',
    '#...#...',
    '#.#.#...',
    '#..#....',
    '.##.#...',
    '........',
  ),
  0x0052: g(
    '####....',
    '#...#...',
    '#...#...',
    '####....',
    '#.#.....',
    '#..#....',
    '#...#...',
    '........',
  ),
  0x0053: g(
    '.####...',
    '#.......',
    '#.......',
    '.###....',
    '....#...',
    '....#...',
    '####....',
    '........',
  ),
  0x0054: g(
    '#####...',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '........',
  ),
  0x0055: g(
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0056: g(
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '.#.#....',
    '.#.#....',
    '..#.....',
    '........',
  ),
  0x0057: g(
    '#...#...',
    '#...#...',
    '#...#...',
    '#.#.#...',
    '#.#.#...',
    '##.##...',
    '#...#...',
    '........',
  ),
  0x0058: g(
    '#...#...',
    '#...#...',
    '.#.#....',
    '..#.....',
    '.#.#....',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x0059: g(
    '#...#...',
    '#...#...',
    '.#.#....',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '........',
  ),
  0x005a: g(
    '#####...',
    '....#...',
    '...#....',
    '..#.....',
    '.#......',
    '#.......',
    '#####...',
    '........',
  ),

  // 0x5B..0x60 [ \ ] ^ _ `
  0x005b: g(
    '###.....',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '###.....',
    '........',
  ),
  0x005c: g(
    '#.......',
    '#.......',
    '.#......',
    '..#.....',
    '..#.....',
    '...#....',
    '....#...',
    '........',
  ),
  0x005d: g(
    '###.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '###.....',
    '........',
  ),
  0x005e: g(
    '..#.....',
    '.#.#....',
    '#...#...',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),
  0x005f: g(
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '#####...',
    '........',
  ),
  0x0060: g(
    '#.......',
    '.#......',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),

  // Lowercase a..z (with 1px descender row 7 on g, j, p, q, y)
  0x0061: g(
    '........',
    '........',
    '.###....',
    '....#...',
    '.####...',
    '#...#...',
    '.####...',
    '........',
  ),
  0x0062: g(
    '#.......',
    '#.......',
    '####....',
    '#...#...',
    '#...#...',
    '#...#...',
    '####....',
    '........',
  ),
  0x0063: g(
    '........',
    '........',
    '.####...',
    '#.......',
    '#.......',
    '#.......',
    '.####...',
    '........',
  ),
  0x0064: g(
    '....#...',
    '....#...',
    '.####...',
    '#...#...',
    '#...#...',
    '#...#...',
    '.####...',
    '........',
  ),
  0x0065: g(
    '........',
    '........',
    '.###....',
    '#...#...',
    '#####...',
    '#.......',
    '.####...',
    '........',
  ),
  0x0066: g(
    '..##....',
    '.#......',
    '####....',
    '.#......',
    '.#......',
    '.#......',
    '.#......',
    '........',
  ),
  0x0067: g(
    '........',
    '........',
    '.####...',
    '#...#...',
    '#...#...',
    '.####...',
    '....#...',
    '.###....',
  ),
  0x0068: g(
    '#.......',
    '#.......',
    '####....',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x0069: g(
    '#.......',
    '........',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '........',
  ),
  0x006a: g(
    '..#.....',
    '........',
    '..#.....',
    '..#.....',
    '..#.....',
    '..#.....',
    '#.#.....',
    '.#......',
  ),
  0x006b: g(
    '#.......',
    '#.......',
    '#..#....',
    '#.#.....',
    '##......',
    '#.#.....',
    '#..#....',
    '........',
  ),
  0x006c: g(
    '##......',
    '.#......',
    '.#......',
    '.#......',
    '.#......',
    '.#......',
    '.##.....',
    '........',
  ),
  0x006d: g(
    '........',
    '........',
    '##.#....',
    '#.#.#...',
    '#.#.#...',
    '#.#.#...',
    '#...#...',
    '........',
  ),
  0x006e: g(
    '........',
    '........',
    '####....',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '........',
  ),
  0x006f: g(
    '........',
    '........',
    '.###....',
    '#...#...',
    '#...#...',
    '#...#...',
    '.###....',
    '........',
  ),
  0x0070: g(
    '........',
    '........',
    '####....',
    '#...#...',
    '#...#...',
    '####....',
    '#.......',
    '#.......',
  ),
  0x0071: g(
    '........',
    '........',
    '.####...',
    '#...#...',
    '#...#...',
    '.####...',
    '....#...',
    '....#...',
  ),
  0x0072: g(
    '........',
    '........',
    '#.##....',
    '##..#...',
    '#.......',
    '#.......',
    '#.......',
    '........',
  ),
  0x0073: g(
    '........',
    '........',
    '.####...',
    '#.......',
    '.###....',
    '....#...',
    '####....',
    '........',
  ),
  0x0074: g(
    '.#......',
    '.#......',
    '####....',
    '.#......',
    '.#......',
    '.#......',
    '..##....',
    '........',
  ),
  0x0075: g(
    '........',
    '........',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '.####...',
    '........',
  ),
  0x0076: g(
    '........',
    '........',
    '#...#...',
    '#...#...',
    '#...#...',
    '.#.#....',
    '..#.....',
    '........',
  ),
  0x0077: g(
    '........',
    '........',
    '#...#...',
    '#.#.#...',
    '#.#.#...',
    '#.#.#...',
    '.#.#....',
    '........',
  ),
  0x0078: g(
    '........',
    '........',
    '#...#...',
    '.#.#....',
    '..#.....',
    '.#.#....',
    '#...#...',
    '........',
  ),
  0x0079: g(
    '........',
    '........',
    '#...#...',
    '#...#...',
    '#...#...',
    '.####...',
    '....#...',
    '.###....',
  ),
  0x007a: g(
    '........',
    '........',
    '#####...',
    '...#....',
    '..#.....',
    '.#......',
    '#####...',
    '........',
  ),

  // 0x7B..0x7E { | } ~
  0x007b: g(
    '..##....',
    '.#......',
    '.#......',
    '#.......',
    '.#......',
    '.#......',
    '..##....',
    '........',
  ),
  0x007c: g(
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '........',
  ),
  0x007d: g(
    '##......',
    '.#......',
    '.#......',
    '..#.....',
    '.#......',
    '.#......',
    '##......',
    '........',
  ),
  0x007e: g(
    '........',
    '........',
    '.##.#...',
    '#..#....',
    '........',
    '........',
    '........',
    '........',
  ),

  // Special HUD & dialogue glyphs used across `microbomber`
  // '·' (U+00B7) middle dot
  0x00b7: g(
    '........',
    '........',
    '........',
    '##......',
    '##......',
    '........',
    '........',
    '........',
  ),
  // '½' (U+00BD) one-half fraction
  0x00bd: g(
    '.#...#..',
    '##..#...',
    '.#.#....',
    '..#.###.',
    '.#....#.',
    '#...###.',
    '....#...',
    '....####',
  ),
  // '×' (U+00D7) multiplication cross
  0x00d7: g(
    '........',
    '#...#...',
    '.#.#....',
    '..#.....',
    '.#.#....',
    '#...#...',
    '........',
    '........',
  ),
  // '–' (U+2013) en-dash
  0x2013: g(
    '........',
    '........',
    '........',
    '#####...',
    '........',
    '........',
    '........',
    '........',
  ),
  // '—' (U+2014) em-dash
  0x2014: g(
    '........',
    '........',
    '........',
    '#######.',
    '........',
    '........',
    '........',
    '........',
  ),
  // '‘' (U+2018) left single quotation mark
  0x2018: g(
    '.#......',
    '#.......',
    '##......',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),
  // '’' (U+2019) right single quotation mark / apostrophe
  0x2019: g(
    '##......',
    '.#......',
    '#.......',
    '........',
    '........',
    '........',
    '........',
    '........',
  ),
  // '→' (U+2192) rightwards arrow
  0x2192: g(
    '........',
    '....#...',
    '.....#..',
    '#######.',
    '.....#..',
    '....#...',
    '........',
    '........',
  ),
  // '↷' (U+21B7) clockwise top semicircle arrow (roll fallback)
  0x21b7: g(
    '..###...',
    '.#...#..',
    '#....###',
    '#.....#.',
    '.#......',
    '........',
    '........',
    '........',
  ),
  // '↺' (U+21BA) anticlockwise open circle arrow (reset save)
  0x21ba: g(
    '..####..',
    '.#....#.',
    '###...#.',
    '.#....#.',
    '......#.',
    '.#...#..',
    '..###...',
    '........',
  ),
  // '▶' (U+25B6) black right-pointing triangle (resume button)
  0x25b6: g(
    '#.......',
    '##......',
    '###.....',
    '####....',
    '###.....',
    '##......',
    '#.......',
    '........',
  ),
  // '▸' (U+25B8) black right-pointing small triangle (prompt arrow)
  0x25b8: g(
    '........',
    '#.......',
    '##......',
    '###.....',
    '##......',
    '#.......',
    '........',
    '........',
  ),
  // '○' (U+25CB) white circle (spent satchel pip)
  0x25cb: g(
    '.#####..',
    '#.....#.',
    '#.....#.',
    '#.....#.',
    '#.....#.',
    '#.....#.',
    '.#####..',
    '........',
  ),
  // '●' (U+25CF) black circle (ready satchel pip)
  0x25cf: g(
    '.#####..',
    '#######.',
    '#######.',
    '#######.',
    '#######.',
    '#######.',
    '.#####..',
    '........',
  ),
  // '★' (U+2605) black star
  0x2605: g(
    '...#....',
    '..###...',
    '#######.',
    '.#####..',
    '..###...',
    '.##.##..',
    '#.....#.',
    '........',
  ),
  // '⚠' (U+26A0) warning sign
  0x26a0: g(
    '...#....',
    '..###...',
    '..#.#...',
    '.##.##..',
    '.#####..',
    '###.###.',
    '#######.',
    '........',
  ),
};

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface CompiledGlyph {
  codepoint: number;
  advanceWidth: number;
  lsb: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  rects: Rect[];
  glyfBytes: Uint8Array;
}

class BinWriter {
  private buf: number[] = [];

  get length(): number {
    return this.buf.length;
  }

  u8(v: number): void {
    this.buf.push(v & 0xff);
  }

  u16(v: number): void {
    this.buf.push((v >>> 8) & 0xff, v & 0xff);
  }

  i16(v: number): void {
    this.u16(v < 0 ? 0x10000 + v : v);
  }

  u32(v: number): void {
    this.buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }

  tag(s: string): void {
    for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i));
  }

  bytes(arr: Uint8Array): void {
    for (let i = 0; i < arr.length; i++) this.buf.push(arr[i] ?? 0);
  }

  pad4(): void {
    while (this.buf.length % 4 !== 0) this.buf.push(0);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

/** Merge contiguous set bits per row into clockwise TrueType contour rectangles. */
function bitmapToRects(rows: readonly number[]): Rect[] {
  const rects: Rect[] = [];
  for (let row = 0; row < 8; row++) {
    const mask = rows[row] ?? 0;
    if (mask === 0) continue;
    const y1 = (7 - row) * PIXEL_UNITS;
    const y0 = y1 - PIXEL_UNITS;
    let col = 0;
    while (col < 8) {
      if ((mask & (0x80 >> col)) === 0) {
        col++;
        continue;
      }
      const startCol = col;
      while (col < 8 && (mask & (0x80 >> col)) !== 0) col++;
      rects.push({
        x0: startCol * PIXEL_UNITS,
        y0,
        x1: col * PIXEL_UNITS,
        y1,
      });
    }
  }
  return rects;
}

function advancePixelsFor(codepoint: number, rows: readonly number[]): number {
  if (codepoint === 0x0020) return 4;
  // Digits stay tabular (6px) so HUD counters never shift horizontally.
  if (codepoint >= 0x0030 && codepoint <= 0x0039) return 6;
  let maxCol = 0;
  for (let row = 0; row < 8; row++) {
    const mask = rows[row] ?? 0;
    for (let col = 0; col < 8; col++) {
      if ((mask & (0x80 >> col)) !== 0 && col + 1 > maxCol) {
        maxCol = col + 1;
      }
    }
  }
  return Math.min(8, Math.max(2, maxCol + 1));
}

function encodeSimpleGlyph(rects: Rect[]): {
  bytes: Uint8Array;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
} {
  if (rects.length === 0) {
    return { bytes: new Uint8Array(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  }
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  const xs: number[] = [];
  const ys: number[] = [];

  for (const rc of rects) {
    if (rc.x0 < xMin) xMin = rc.x0;
    if (rc.y0 < yMin) yMin = rc.y0;
    if (rc.x1 > xMax) xMax = rc.x1;
    if (rc.y1 > yMax) yMax = rc.y1;
    // Clockwise outer contour in TrueType Y-up coordinates: BL -> TL -> TR -> BR
    xs.push(rc.x0, rc.x0, rc.x1, rc.x1);
    ys.push(rc.y0, rc.y1, rc.y1, rc.y0);
  }

  const w = new BinWriter();
  w.i16(rects.length);
  w.i16(xMin);
  w.i16(yMin);
  w.i16(xMax);
  w.i16(yMax);
  for (let i = 0; i < rects.length; i++) {
    w.u16(i * 4 + 3); // endPtsOfContours
  }
  w.u16(0); // instructionLength = 0

  const numPts = xs.length;
  for (let i = 0; i < numPts; i++) {
    w.u8(0x01); // ON_CURVE_POINT, int16 deltas
  }

  let prevX = 0;
  for (let i = 0; i < numPts; i++) {
    const cur = xs[i] ?? 0;
    w.i16(cur - prevX);
    prevX = cur;
  }

  let prevY = 0;
  for (let i = 0; i < numPts; i++) {
    const cur = ys[i] ?? 0;
    w.i16(cur - prevY);
    prevY = cur;
  }

  w.pad4();
  return { bytes: w.toUint8Array(), xMin, yMin, xMax, yMax };
}

function compileGlyph(
  codepoint: number,
  rows: readonly number[],
  forceAdvancePx?: number,
): CompiledGlyph {
  const rects = bitmapToRects(rows);
  const encoded = encodeSimpleGlyph(rects);
  const advPx = forceAdvancePx ?? advancePixelsFor(codepoint, rows);
  return {
    codepoint,
    advanceWidth: advPx * PIXEL_UNITS,
    lsb: rects.length > 0 ? encoded.xMin : 0,
    xMin: encoded.xMin,
    yMin: encoded.yMin,
    xMax: encoded.xMax,
    yMax: encoded.yMax,
    rects,
    glyfBytes: encoded.bytes,
  };
}

function tableChecksum(bytes: Uint8Array): number {
  let sum = 0;
  const len = bytes.length;
  for (let i = 0; i < len; i += 4) {
    const word =
      (((bytes[i] ?? 0) << 24) |
        ((bytes[i + 1] ?? 0) << 16) |
        ((bytes[i + 2] ?? 0) << 8) |
        (bytes[i + 3] ?? 0)) >>>
      0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}

function buildCmapTable(glyphs: readonly CompiledGlyph[]): Uint8Array {
  // Group sorted codepoints (glyph indices 1..N-1) into contiguous segments for Format 4
  interface Segment {
    startCode: number;
    endCode: number;
    idDelta: number;
  }
  const segs: Segment[] = [];
  for (let gid = 1; gid < glyphs.length; gid++) {
    const gl = glyphs[gid];
    if (!gl) continue;
    const cp = gl.codepoint;
    const delta = (gid - cp) & 0xffff;
    const prev = segs[segs.length - 1];
    if (prev && cp === prev.endCode + 1 && delta === prev.idDelta) {
      prev.endCode = cp;
    } else {
      segs.push({ startCode: cp, endCode: cp, idDelta: delta });
    }
  }
  segs.push({ startCode: 0xffff, endCode: 0xffff, idDelta: 1 });

  const segCount = segs.length;
  const segCountX2 = segCount * 2;
  const maxPow2 = 1 << Math.floor(Math.log2(segCount));
  const searchRange = 2 * maxPow2;
  const entrySelector = Math.floor(Math.log2(segCount));
  const rangeShift = segCountX2 - searchRange;

  const sub = new BinWriter();
  sub.u16(4); // format 4
  sub.u16(16 + segCount * 8); // length
  sub.u16(0); // language
  sub.u16(segCountX2);
  sub.u16(searchRange);
  sub.u16(entrySelector);
  sub.u16(rangeShift);
  for (const s of segs) sub.u16(s.endCode);
  sub.u16(0); // reservedPad
  for (const s of segs) sub.u16(s.startCode);
  for (const s of segs) sub.u16(s.idDelta);
  for (let i = 0; i < segCount; i++) sub.u16(0); // idRangeOffset

  const subBytes = sub.toUint8Array();
  const w = new BinWriter();
  w.u16(0); // version
  w.u16(2); // numTables: Unicode (0,3) & Windows BMP (3,1) sharing the Format 4 subtable
  w.u16(0);
  w.u16(3);
  w.u32(20);
  w.u16(3);
  w.u16(1);
  w.u32(20);
  w.bytes(subBytes);
  return w.toUint8Array();
}

function encodeUtf16Be(str: string): Uint8Array {
  const out = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i * 2] = (code >>> 8) & 0xff;
    out[i * 2 + 1] = code & 0xff;
  }
  return out;
}

function buildNameTable(family: string): Uint8Array {
  const entries: Array<[number, string]> = [
    [1, family],
    [2, 'Regular'],
    [3, `${family}-1.0`],
    [4, family],
    [5, 'Version 1.0'],
    [6, `${family}-Regular`],
  ];
  const encoded = entries.map(([nameId, val]) => ({
    nameId,
    bytes: encodeUtf16Be(val),
  }));

  const count = encoded.length;
  const stringOffset = 6 + count * 12;
  const w = new BinWriter();
  w.u16(0); // format
  w.u16(count);
  w.u16(stringOffset);

  let curOffset = 0;
  for (const rec of encoded) {
    w.u16(3); // platformID = Windows
    w.u16(1); // encodingID = Unicode BMP
    w.u16(0x0409); // languageID = en-US
    w.u16(rec.nameId);
    w.u16(rec.bytes.length);
    w.u16(curOffset);
    curOffset += rec.bytes.length;
  }
  for (const rec of encoded) {
    w.bytes(rec.bytes);
  }
  return w.toUint8Array();
}

/**
 * Compile `GLYPH_BITMAPS` into a valid binary TrueType (`sfnt` `0x00010000`) font file.
 */
export function buildPixelFontTtf(): Uint8Array {
  const notdefRows = g(
    '######..',
    '#....#..',
    '#.##.#..',
    '#.##.#..',
    '#.##.#..',
    '#....#..',
    '######..',
    '........',
  );
  const codepoints = Object.keys(GLYPH_BITMAPS)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  const glyphs: CompiledGlyph[] = [compileGlyph(0, notdefRows, 7)];
  for (const cp of codepoints) {
    const rows = GLYPH_BITMAPS[cp];
    if (rows) glyphs.push(compileGlyph(cp, rows));
  }

  const numGlyphs = glyphs.length;

  // Build `glyf` and `loca` (long uint32 offsets)
  const glyfWriter = new BinWriter();
  const locaWriter = new BinWriter();
  let globalXMin = Infinity;
  let globalYMin = Infinity;
  let globalXMax = -Infinity;
  let globalYMax = -Infinity;
  let maxAdvance = 0;
  let minLsb = Infinity;
  let minRsb = Infinity;
  let maxExtent = -Infinity;
  let maxPoints = 0;
  let maxContours = 0;
  let sumAdvance = 0;

  for (const gl of glyphs) {
    locaWriter.u32(glyfWriter.length);
    glyfWriter.bytes(gl.glyfBytes);
    if (gl.advanceWidth > maxAdvance) maxAdvance = gl.advanceWidth;
    sumAdvance += gl.advanceWidth;

    if (gl.rects.length > 0) {
      if (gl.xMin < globalXMin) globalXMin = gl.xMin;
      if (gl.yMin < globalYMin) globalYMin = gl.yMin;
      if (gl.xMax > globalXMax) globalXMax = gl.xMax;
      if (gl.yMax > globalYMax) globalYMax = gl.yMax;
      if (gl.lsb < minLsb) minLsb = gl.lsb;
      const rsb = gl.advanceWidth - gl.lsb - (gl.xMax - gl.xMin);
      if (rsb < minRsb) minRsb = rsb;
      const ext = gl.lsb + (gl.xMax - gl.xMin);
      if (ext > maxExtent) maxExtent = ext;
      if (gl.rects.length > maxContours) maxContours = gl.rects.length;
      if (gl.rects.length * 4 > maxPoints) maxPoints = gl.rects.length * 4;
    }
  }
  locaWriter.u32(glyfWriter.length);

  if (!Number.isFinite(globalXMin)) {
    globalXMin = 0;
    globalYMin = 0;
    globalXMax = UNITS_PER_EM;
    globalYMax = ASCENDER;
    minLsb = 0;
    minRsb = 0;
    maxExtent = UNITS_PER_EM;
  }

  // `hmtx`
  const hmtxWriter = new BinWriter();
  for (const gl of glyphs) {
    hmtxWriter.u16(gl.advanceWidth);
    hmtxWriter.i16(gl.lsb);
  }

  // `head` (54 bytes; checkSumAdjustment at offset 8 patched after assembling full font)
  const headWriter = new BinWriter();
  headWriter.u16(1);
  headWriter.u16(0);
  headWriter.u32(0x00010000); // fontRevision 1.0
  headWriter.u32(0); // checkSumAdjustment placeholder
  headWriter.u32(0x5f0f3cf5); // magicNumber
  headWriter.u16(0x000b); // flags: y=0 baseline, lsb=xMin, integer ppem
  headWriter.u16(UNITS_PER_EM);
  headWriter.u32(0);
  headWriter.u32(0xdc6b9a80); // created
  headWriter.u32(0);
  headWriter.u32(0xdc6b9a80); // modified
  headWriter.i16(globalXMin);
  headWriter.i16(globalYMin);
  headWriter.i16(globalXMax);
  headWriter.i16(globalYMax);
  headWriter.u16(0); // macStyle
  headWriter.u16(8); // lowestRecPPEM
  headWriter.i16(2); // fontDirectionHint
  headWriter.i16(1); // indexToLocFormat = 1 (uint32 loca)
  headWriter.i16(0); // glyphDataFormat

  // `hhea` (36 bytes)
  const hheaWriter = new BinWriter();
  hheaWriter.u16(1);
  hheaWriter.u16(0);
  hheaWriter.i16(ASCENDER);
  hheaWriter.i16(DESCENDER);
  hheaWriter.i16(0); // lineGap
  hheaWriter.u16(maxAdvance);
  hheaWriter.i16(minLsb);
  hheaWriter.i16(minRsb);
  hheaWriter.i16(maxExtent);
  hheaWriter.i16(1); // caretSlopeRise
  hheaWriter.i16(0); // caretSlopeRun
  hheaWriter.i16(0); // caretOffset
  hheaWriter.i16(0);
  hheaWriter.i16(0);
  hheaWriter.i16(0);
  hheaWriter.i16(0);
  hheaWriter.i16(0); // metricDataFormat
  hheaWriter.u16(numGlyphs);

  // `maxp` v1.0 (32 bytes)
  const maxpWriter = new BinWriter();
  maxpWriter.u32(0x00010000);
  maxpWriter.u16(numGlyphs);
  maxpWriter.u16(maxPoints);
  maxpWriter.u16(maxContours);
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(1); // maxZones
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(0);
  maxpWriter.u16(0);

  // `OS/2` v4 (96 bytes)
  const avgWidth = Math.round(sumAdvance / numGlyphs);
  const firstChar = codepoints[0] ?? 0x0020;
  const lastChar = Math.min(0xffff, codepoints[codepoints.length - 1] ?? 0x007e);
  const os2Writer = new BinWriter();
  os2Writer.u16(4); // version
  os2Writer.i16(avgWidth);
  os2Writer.u16(400); // usWeightClass = Regular
  os2Writer.u16(5); // usWidthClass = Medium
  os2Writer.u16(0); // fsType = Installable
  os2Writer.i16(512);
  os2Writer.i16(512);
  os2Writer.i16(0);
  os2Writer.i16(128);
  os2Writer.i16(512);
  os2Writer.i16(512);
  os2Writer.i16(0);
  os2Writer.i16(512);
  os2Writer.i16(128);
  os2Writer.i16(384);
  os2Writer.i16(0); // sFamilyClass
  const panose = [2, 0, 5, 3, 0, 0, 0, 0, 0, 0];
  for (const p of panose) os2Writer.u8(p);
  os2Writer.u32(0x00000003); // ulUnicodeRange1
  os2Writer.u32(0x00000000);
  os2Writer.u32(0x00000000);
  os2Writer.u32(0x00000000);
  os2Writer.tag('CIND'); // achVendID
  os2Writer.u16(0x00c0); // REGULAR | USE_TYPO_METRICS
  os2Writer.u16(firstChar);
  os2Writer.u16(lastChar);
  os2Writer.i16(ASCENDER);
  os2Writer.i16(DESCENDER);
  os2Writer.i16(0); // sTypoLineGap
  os2Writer.u16(ASCENDER); // usWinAscent
  os2Writer.u16(-DESCENDER); // usWinDescent
  os2Writer.u32(0x00000001); // ulCodePageRange1
  os2Writer.u32(0x00000000);
  os2Writer.i16(5 * PIXEL_UNITS); // sxHeight
  os2Writer.i16(ASCENDER); // sCapHeight
  os2Writer.u16(0); // usDefaultChar
  os2Writer.u16(0x0020); // usBreakChar
  os2Writer.u16(0); // usMaxContext

  // `post` v3.0 (32 bytes)
  const postWriter = new BinWriter();
  postWriter.u32(0x00030000);
  postWriter.u32(0); // italicAngle
  postWriter.i16(-PIXEL_UNITS); // underlinePosition
  postWriter.i16(PIXEL_UNITS); // underlineThickness
  postWriter.u32(0); // isFixedPitch
  postWriter.u32(0);
  postWriter.u32(0);
  postWriter.u32(0);
  postWriter.u32(0);

  // Assemble SFNT tables sorted strictly by 4-byte ASCII tag
  const tables: Array<{ tag: string; data: Uint8Array }> = [
    { tag: 'OS/2', data: os2Writer.toUint8Array() },
    { tag: 'cmap', data: buildCmapTable(glyphs) },
    { tag: 'glyf', data: glyfWriter.toUint8Array() },
    { tag: 'head', data: headWriter.toUint8Array() },
    { tag: 'hhea', data: hheaWriter.toUint8Array() },
    { tag: 'hmtx', data: hmtxWriter.toUint8Array() },
    { tag: 'loca', data: locaWriter.toUint8Array() },
    { tag: 'maxp', data: maxpWriter.toUint8Array() },
    { tag: 'name', data: buildNameTable(PIXEL_FONT_FAMILY) },
    { tag: 'post', data: postWriter.toUint8Array() },
  ].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  const numTables = tables.length;
  const maxPow2 = 1 << Math.floor(Math.log2(numTables));
  const searchRange = maxPow2 * 16;
  const entrySelector = Math.floor(Math.log2(numTables));
  const rangeShift = numTables * 16 - searchRange;

  const sfnt = new BinWriter();
  sfnt.u32(0x00010000);
  sfnt.u16(numTables);
  sfnt.u16(searchRange);
  sfnt.u16(entrySelector);
  sfnt.u16(rangeShift);

  let offset = 12 + numTables * 16;
  let headOffset = 0;
  for (const t of tables) {
    if (t.tag === 'head') headOffset = offset;
    sfnt.tag(t.tag);
    sfnt.u32(tableChecksum(t.data));
    sfnt.u32(offset);
    sfnt.u32(t.data.length);
    offset += (t.data.length + 3) & ~3;
  }

  for (const t of tables) {
    sfnt.bytes(t.data);
    sfnt.pad4();
  }

  const out = sfnt.toUint8Array();
  const fullSum = tableChecksum(out);
  const adjustment = (0xb1b0afba - fullSum) >>> 0;
  out[headOffset + 8] = (adjustment >>> 24) & 0xff;
  out[headOffset + 9] = (adjustment >>> 16) & 0xff;
  out[headOffset + 10] = (adjustment >>> 8) & 0xff;
  out[headOffset + 11] = adjustment & 0xff;

  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

let cachedDataUrl: string | null = null;

/**
 * Compile (once) and inject `@font-face` for `CinderholmPixel` into `document.head`
 * when running in a browser DOM. Returns the `data:font/ttf;base64,...` URL.
 */
export function installPixelFont(): string {
  if (!cachedDataUrl) {
    cachedDataUrl = `data:font/ttf;base64,${bytesToBase64(buildPixelFontTtf())}`;
  }
  if (typeof document !== 'undefined' && document.head) {
    const styleId = 'cinderholm-pixel-font';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@font-face { font-family: '${PIXEL_FONT_FAMILY}'; src: url('${cachedDataUrl}') format('truetype'); font-weight: 400 900; font-style: normal; font-display: block; }`;
      document.head.appendChild(style);
    }
  }
  return cachedDataUrl;
}
