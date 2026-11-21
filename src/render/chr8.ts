/**
 * 8x8 quarter-tile (`CHR8`) composer and 47-state seamless blob autotile resolver.
 *
 * Just like Game Boy Color VRAM, every 16x16 background tile is composed from four 8x8
 * quadrants `[TL, TR, BL, BR]`, with horizontal/vertical flip symmetry (`fH`, `fV`, `fHV`)
 * so corners and edges join seamlessly without duplicate art.
 */
import type { BgPaletteId } from './gbcPalette';

export type Chr8 = readonly [string, string, string, string, string, string, string, string];

export interface BgTile {
  quads: readonly [BgPaletteId, BgPaletteId, BgPaletteId, BgPaletteId];
  rows: readonly string[];
}

export function fH(q: Chr8): Chr8 {
  return q.map((r) => [...r].reverse().join('')) as unknown as Chr8;
}

export function fV(q: Chr8): Chr8 {
  return [...q].reverse() as unknown as Chr8;
}

export function fHV(q: Chr8): Chr8 {
  return fV(fH(q));
}

export function composeBg(
  quarters: readonly [Chr8, Chr8, Chr8, Chr8],
  quads: BgTile['quads'],
): BgTile {
  const [tl, tr, bl, br] = quarters;
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) {
    rows.push(`${tl[y]}${tr[y]}`);
  }
  for (let y = 0; y < 8; y++) {
    rows.push(`${bl[y]}${br[y]}`);
  }
  return { quads, rows };
}

/**
 * Five 8x8 subtiles defined for the North-West quadrant (top-left) suffice to generate
 * all 47 8-neighbour blob shapes via quadrant mirroring:
 * - `full`:    both orthogonal neighbours + diagonal are same terrain
 * - `edgeH`:   North differs, West matches (horizontal top rim)
 * - `edgeV`:   West differs, North matches (vertical left rim)
 * - `outerNW`: both North and West differ (rounded outer convex corner)
 * - `innerNW`: North and West match, but North-West diagonal differs (concave bend)
 */
export interface BlobKit {
  pal: BgPaletteId;
  full: Chr8;
  edgeH: Chr8;
  edgeV: Chr8;
  outerNW: Chr8;
  innerNW: Chr8;
  /** Optional symmetric flip override when shading has a top-down light direction:
   *  if provided, South edges use `edgeS` / `outerSW` / `innerSW` instead of `fV(edgeH)`. */
  edgeS?: Chr8;
  outerSW?: Chr8;
  innerSW?: Chr8;
}

export interface NeighbourMask {
  n: boolean;
  ne: boolean;
  e: boolean;
  se: boolean;
  s: boolean;
  sw: boolean;
  w: boolean;
  nw: boolean;
}

export function resolveBlobTile(kit: BlobKit, nb: NeighbourMask): BgTile {
  // Top-left quadrant (N, W, NW)
  const tl: Chr8 =
    !nb.n && !nb.w
      ? kit.outerNW
      : !nb.n && nb.w
        ? kit.edgeH
        : nb.n && !nb.w
          ? kit.edgeV
          : !nb.nw
            ? kit.innerNW
            : kit.full;

  // Top-right quadrant (N, E, NE) — horizontal mirror of NW logic
  const tr: Chr8 =
    !nb.n && !nb.e
      ? fH(kit.outerNW)
      : !nb.n && nb.e
        ? fH(kit.edgeH)
        : nb.n && !nb.e
          ? fH(kit.edgeV)
          : !nb.ne
            ? fH(kit.innerNW)
            : fH(kit.full);

  // Bottom-left quadrant (S, W, SW) — uses dedicated south shading if provided
  const edgeS = kit.edgeS ?? fV(kit.edgeH);
  const outerSW = kit.outerSW ?? fV(kit.outerNW);
  const innerSW = kit.innerSW ?? fV(kit.innerNW);
  const bl: Chr8 =
    !nb.s && !nb.w
      ? outerSW
      : !nb.s && nb.w
        ? edgeS
        : nb.s && !nb.w
          ? fV(kit.edgeV)
          : !nb.sw
            ? innerSW
            : fV(kit.full);

  // Bottom-right quadrant (S, E, SE)
  const br: Chr8 =
    !nb.s && !nb.e
      ? fH(outerSW)
      : !nb.s && nb.e
        ? fH(edgeS)
        : nb.s && !nb.e
          ? fHV(kit.edgeV)
          : !nb.se
            ? fH(innerSW)
            : fHV(kit.full);

  return composeBg([tl, tr, bl, br], [kit.pal, kit.pal, kit.pal, kit.pal]);
}
