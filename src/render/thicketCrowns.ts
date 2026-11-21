/**
 * Overlapping crowns for the overworld thicket walls. The thicket tiles are only a dark
 * backdrop; depth comes from individual round crowns placed on a staggered, jittered
 * lattice that deliberately does not match the 16 px tile grid, drawn back to front so each
 * lower crown overlaps the ones above it. No straight dark line ever runs across the wall.
 *
 * Pure (no DOM): indexed art plus placement, so both are testable.
 */
import { ROOM_H, ROOM_W } from '../game/types';

const TILE = 16;
export const CROWN_W = 20;
export const CROWN_H = 18;

/** Vertical and horizontal lattice steps (px); neither divides 16, so rows never line up. */
const ROW_STEP = 10;
const COL_STEP = 13;

export interface Crown {
  /** Top-left in native pixels. */
  px: number;
  py: number;
  variant: number;
}

function hash(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Indexed crown art (`'.'` transparent, `'1'` sunlit leaf, `'2'` leaf, `'3'` deep shade):
 * a lumpy round crown lit from the top left, outlined, with a shaded underside.
 */
function makeCrown(variant: number): string[] {
  const rows: string[] = [];
  const phase = variant * 1.9;
  for (let y = 0; y < CROWN_H; y++) {
    let row = '';
    for (let x = 0; x < CROWN_W; x++) {
      const nx = (x - (CROWN_W - 1) / 2) / (CROWN_W / 2);
      const ny = (y - (CROWN_H - 1) / 2) / (CROWN_H / 2);
      const angle = Math.atan2(ny, nx);
      const r = (nx * nx + ny * ny) * (1 + 0.09 * Math.sin(angle * 5 + phase));
      if (r > 1) {
        row += '.';
        continue;
      }
      if (r > 0.8) {
        row += '3';
        continue;
      }
      const light = -(nx * 0.45 + ny * 0.9);
      const h = hash(x, y, variant + 7) % 9;
      let c: string;
      if (light > 0.55) c = h < 7 ? '1' : '2';
      else if (light > 0.3) c = (x + y) % 2 === 0 ? '1' : '2';
      else if (light < -0.5) c = (x + y) % 2 === 0 ? '3' : '2';
      else c = h === 0 ? '1' : h === 1 ? '3' : '2';
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

export const CROWN_VARIANTS: readonly string[][] = [0, 1, 2].map(makeCrown);

/**
 * Place crowns over every thicket cell, sorted top to bottom (draw in this order). A crown
 * may overhang the thicket's open edge by at most a few pixels.
 */
export function placeCrowns(isThicket: (tx: number, ty: number) => boolean, seed: number): Crown[] {
  const cellAt = (px: number, py: number): boolean =>
    isThicket(Math.floor(px / TILE), Math.floor(py / TILE));
  const crowns: Crown[] = [];
  const rows = Math.ceil((ROOM_H * TILE + 16) / ROW_STEP);
  for (let r = 0; r <= rows; r++) {
    const baseY = -8 + r * ROW_STEP;
    const offset = r % 2 === 0 ? 0 : COL_STEP / 2;
    for (let c = -1; c <= Math.ceil((ROOM_W * TILE) / COL_STEP) + 1; c++) {
      const h = hash(r, c, seed);
      const cx = Math.round(c * COL_STEP + offset + ((h % 5) - 2));
      const cy = Math.round(baseY + (((h >>> 4) % 5) - 2));
      // The centre must be a thicket cell inside the room (margins may run off-screen), and a
      // margin on each side must be thicket too, so the overhang into a clearing stays small
      if (cx < 0 || cy < 0 || cx >= ROOM_W * TILE || cy >= ROOM_H * TILE) continue;
      if (!cellAt(cx, cy) || !cellAt(cx - 6, cy) || !cellAt(cx + 6, cy)) continue;
      if (!cellAt(cx, cy - 5) || !cellAt(cx, cy + 5)) continue;
      crowns.push({
        px: cx - CROWN_W / 2,
        py: cy - CROWN_H / 2,
        variant: (h >>> 8) % CROWN_VARIANTS.length,
      });
    }
  }
  return crowns.sort((a, b) => a.py - b.py || a.px - b.px);
}
