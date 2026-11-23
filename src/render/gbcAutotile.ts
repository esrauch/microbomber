/**
 * Pure multi-tile & 8x8 blob room layout resolver (`ASSETS.md` §2 & §4).
 *
 * Maps any 11x13 `RoomSpec` + live `State` into:
 * - `ground`:   11x13 base terrain BgTiles (grass, curved paths, waterbanks, pit rims,
 *               recessed dungeon floor trim, flagstone variants, walls, cliffs & locked doors)
 * - `decals`:   flat floor overlays drawn directly over `ground` and ALWAYS below ground actors
 *               (medallions, Fourfold Tower seal, carved stone chutes, bridges, buttons, spikes,
 *               stairs, warps, lowered barriers, crypt floor decals, forest-edge trims, building aprons)
 * - `props`:    raised 3D obstacle/wall BgTiles Y-sorted with actors by foot position
 *               (crates, fences, balustrades, brambles, braziers, crystal switches, raised barriers,
 *               shutters, cracked walls, building walls, lower tree trunks & boulders)
 * - `overhead`: 3/4 vertical overlap tiles Y-sorted with actors at `footY = y + 0.99`
 *               (workshop/smithy roof eaves, mausoleum arch pediment, upper tree crowns) so
 *               actors north of the tile tuck behind it while actors/flames south draw in front
 * - `ceiling`:  Pass-4 walk-under ceiling tiles drawn AFTER all actors (north doorway lintels)
 */
import { type State, type Tile, type World, currentRoom, roomKey, tileAt } from '../game/world';
import {
  BG,
  type BgTile,
  CRYPT_FLOOR_BLOB,
  type NeighbourMask,
  PATH_BLOB,
  THICKET_BLOB,
  PIT_BLOB,
  STAMP_DEFS,
  WATER_BLOB,
  resolveBlobTile,
} from './gbcArt';
import { type LedgeDrops, hasLevels, ledgeDrops } from '../game/elevation';
import type { BgPaletteId } from './gbcPalette';
import { type Crown, placeCrowns } from './thicketCrowns';

export interface PlacedTile {
  x: number;
  y: number;
  tile: BgTile;
  /** If true, colour index 0 is transparent (reveals ground or actors underneath). */
  transparentZero?: boolean;
  /** Shade top 2px when directly south of a tall wall/cliff. */
  topShadow?: boolean;
  /** Drawn this many times its size from its tile's top-left (2 for trees and braziers on doubled screens). */
  scale?: number;
}

export interface RoomRenderPlan {
  ground: PlacedTile[];
  /** Flat floor inlays, trims, chutes, bridges, buttons, spikes, stairs & warps drawn below actors. */
  decals: PlacedTile[];
  /** Raised 3D obstacles & building walls Y-sorted with ground actors. */
  props: PlacedTile[];
  /** 3/4 overlap tiles Y-sorted with actors at `footY = y + 0.99`. */
  overhead: PlacedTile[];
  /** True walk-under ceiling lintels drawn above all ground actors. */
  ceiling: PlacedTile[];
  /** Pure interior water cells that cycle 3-frame ripple tiles each sync. */
  interiorWater: Array<[number, number]>;
  /** Midpoint warp cells that pulse when unlocked. */
  warpPads: Array<{ x: number; y: number; active: boolean }>;
  /** Optional chimney smoke emitter pixel positions `(px, py)`. */
  chimneys: Array<[number, number]>;
  /** Thicket crowns, top to bottom, drawn over the thicket backdrop (`thicketCrowns.ts`). */
  crowns: Crown[];
}

function recolorQuads(
  tile: BgTile,
  quads: readonly [BgPaletteId, BgPaletteId, BgPaletteId, BgPaletteId],
): BgTile {
  return { quads, rows: tile.rows };
}

function makeMask(pred: (dx: number, dy: number) => boolean): NeighbourMask {
  return {
    n: pred(0, -1),
    ne: pred(1, -1),
    e: pred(1, 0),
    se: pred(1, 1),
    s: pred(0, 1),
    sw: pred(-1, 1),
    w: pred(-1, 0),
    nw: pred(-1, -1),
  };
}

function cellHash(x: number, y: number, rx: number, ry: number): number {
  let h = (x * 374761393 + y * 668265263 + rx * 2147483647 + ry * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function buildRoomLayout(world: World, s: State): RoomRenderPlan {
  const room = currentRoom(world, s);
  const isCrypt = s.zone === 'ice-cave' || s.zone === 'basement' || s.zone === 'dungeon-999';
  const isIceCave = s.zone === 'ice-cave';
  const solved = s.roomSolved || s.solvedRooms.has(roomKey(s.zone, s.rx, s.ry));

  const grid: Tile[][] = [];
  for (let y = 0; y < s.roomH; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < s.roomW; x++) {
      row.push(tileAt(world, s, s.zone, s.rx, s.ry, x, y));
    }
    grid.push(row);
  }

  const at = (x: number, y: number): Tile => {
    const cx = Math.max(0, Math.min(s.roomW - 1, x));
    const cy = Math.max(0, Math.min(s.roomH - 1, y));
    return grid[cy]?.[cx] ?? '#';
  };

  // Where a tile sits in the room's wall ring, as if on an 11 x 13 screen (`GAME.md` §1.1).
  // A doubled screen's wall is 4 tiles deep: the outer three read as its cap, the fourth as
  // its face, and anything inside as the interior.
  const big = s.roomW > 11;
  const RW = 11;
  const RH = 13;
  const ring = (v: number, size: number, small: number): number => {
    if (!big) return v;
    if (v <= 2) return 0;
    if (v === 3) return 1;
    if (v >= size - 3) return small - 1;
    if (v === size - 4) return small - 2;
    return Math.max(2, Math.min(small - 3, v - 2));
  };
  const rgx = (x: number): number => ring(x, s.roomW, RW);
  // The top-left tile of a 2 x 2 block of `ch`, which draws the whole piece at 2x
  const isBlockTopLeft = (x: number, y: number, ch: Tile): boolean =>
    (x === 0 || at(x - 1, y) !== ch || (x >= 2 && at(x - 2, y) === ch)) &&
    (y === 0 || at(x, y - 1) !== ch || (y >= 2 && at(x, y - 2) === ch));
  const rgy = (y: number): number => ring(y, s.roomH, RH);

  // Track cells claimed by multi-tile landmark stamps so walls/trees don't overwrite them
  const stampedSolid = new Set<string>();
  const chimneys: Array<[number, number]> = [];
  for (const st of room?.stamps ?? []) {
    const defs = STAMP_DEFS[st.id];
    for (const d of defs) {
      if (st.id !== 'spire-seal' && st.id !== 'crypt-mausoleum') {
        stampedSolid.add(`${st.x + d.dx},${st.y + d.dy}`);
      }
    }
    if (st.id === 'mouse-house') {
      chimneys.push([(st.x + 2) * 16 + 7, st.y * 16 - 4]);
    }
  }

  // Authentic LADX / Oracle 2-wide vertical column-run tree tiling (`Top -> Ovl* -> Bot`)
  // with deterministic canopy & gnarled root-flare variants so tree borders never rubber-stamp!
  // Oracle-style forest walls: trees in the two-column side borders render as one seamless
  // thicket; round trees are kept for the top, bottom and interior
  const isSideBandCell = (x: number, y: number): boolean =>
    y >= 0 && y < s.roomH && at(x, y) === 'Y' && !stampedSolid.has(`${x},${y}`);
  const isSideThicket = (x: number, y: number): boolean => {
    if (isCrypt || x < 0 || x >= s.roomW || y < 0 || y >= s.roomH) return false;
    const band = big ? 4 : 2;
    if (x < band) {
      return Array.from({ length: band }, (_, i) => i).every((i) => isSideBandCell(i, y));
    }
    if (x >= s.roomW - band) {
      return Array.from({ length: band }, (_, i) => s.roomW - 1 - i).every((i) =>
        isSideBandCell(i, y),
      );
    }
    return false;
  };

  // On a doubled screen a tree covers 4 x 4 tiles: pair 2 x 2 cells as one tile each and
  // draw the tree's art at 2x from each cell's top-left tile (`GAME.md` §1.1)
  const ts = big ? 2 : 1;
  const treeMap = new Map<
    string,
    { tile: BgTile; overhead: boolean; scale: number } | { covered: true }
  >();
  if (!isCrypt) {
    const claimedCol = new Set<string>();
    const isFreeTreeTile = (x: number, y: number): boolean =>
      x >= 0 &&
      x < s.roomW &&
      y >= 0 &&
      y < s.roomH &&
      !stampedSolid.has(`${x},${y}`) &&
      !isSideThicket(x, y) &&
      at(x, y) === 'Y';
    const isFreeTree = (cx: number, cy: number): boolean => {
      if (claimedCol.has(`${cx},${cy}`)) return false;
      for (let j = 0; j < ts; j++) {
        for (let i = 0; i < ts; i++) if (!isFreeTreeTile(cx * ts + i, cy * ts + j)) return false;
      }
      return true;
    };
    const place = (cx: number, cy: number, tile: BgTile, overhead: boolean): void => {
      for (let j = 0; j < ts; j++) {
        for (let i = 0; i < ts; i++) {
          treeMap.set(
            `${cx * ts + i},${cy * ts + j}`,
            i === 0 && j === 0 ? { tile, overhead, scale: ts } : { covered: true },
          );
        }
      }
    };

    const topCrowns = [
      [BG.treeNW, BG.treeNE],
      [BG.treeNW_B, BG.treeNE_B],
      [BG.treeNW_C, BG.treeNE_C],
    ] as const;
    const midCrowns = [
      [BG.treeOvlW, BG.treeOvlE],
      [BG.treeOvlW_B, BG.treeOvlE_B],
      [BG.treeOvlW_C, BG.treeOvlE_C],
    ] as const;
    const trunkBases = [
      [BG.treeSW, BG.treeSE],
      [BG.treeSW_B, BG.treeSE_B],
    ] as const;

    const cellsW = Math.floor(s.roomW / ts);
    const cellsH = Math.floor(s.roomH / ts);
    for (let x = 0; x < cellsW - 1; x++) {
      let y = 0;
      while (y < cellsH) {
        if (!isFreeTree(x, y) || !isFreeTree(x + 1, y)) {
          y++;
          continue;
        }
        const yStart = y;
        while (y < cellsH && isFreeTree(x, y) && isFreeTree(x + 1, y)) {
          y++;
        }
        const yEnd = y - 1;
        if (yEnd - yStart + 1 < 2) {
          continue; // 1-row standalone cells fall back to sculpted mossy boulders
        }
        const colIdx = Math.floor(x / 2);
        for (let ry = yStart; ry <= yEnd; ry++) {
          claimedCol.add(`${x},${ry}`);
          claimedCol.add(`${x + 1},${ry}`);
          if (ry === yStart) {
            const above = at(x * ts, ry * ts - 1);
            const northWalkable = ry > 0 && above !== 'Y' && above !== '#';
            const rowSeed = cellHash(0, ry, s.rx, s.ry);
            const step = 1 + (rowSeed & 1); // coprime to 3 so adjacent 2x2 trees never repeat
            const pair = topCrowns[((rowSeed >>> 2) + colIdx * step) % 3] ?? topCrowns[0];
            place(x, ry, pair[0], northWalkable);
            place(x + 1, ry, pair[1], northWalkable);
          } else if (ry < yEnd) {
            const rowSeed = cellHash(1, ry, s.rx, s.ry);
            const step = 1 + (rowSeed & 1);
            const pair =
              midCrowns[((rowSeed >>> 2) + colIdx * step + (ry - yStart)) % 3] ?? midCrowns[0];
            place(x, ry, pair[0], false);
            place(x + 1, ry, pair[1], false);
          } else {
            const trunkIdx = (colIdx + (cellHash(x >> 2, ry, s.rx, s.ry) & 1)) % 2;
            const pair = trunkBases[trunkIdx] ?? trunkBases[0];
            place(x, ry, pair[0], false);
            place(x + 1, ry, pair[1], false);
          }
        }
      }
    }
  }

  const isThicket = (x: number, y: number): boolean => {
    if (isCrypt) return false;
    if (x < 0 || x >= s.roomW || y < 0 || y >= s.roomH) return true; // continues off-screen
    if (at(x, y) !== 'Y' || stampedSolid.has(`${x},${y}`)) return false;
    return isSideThicket(x, y) || !treeMap.has(`${x},${y}`);
  };

  const ground: PlacedTile[] = [];
  const decals: PlacedTile[] = [];
  const props: PlacedTile[] = [];
  const overhead: PlacedTile[] = [];
  const ceiling: PlacedTile[] = [];
  const interiorWater: Array<[number, number]> = [];
  const warpPads: Array<{ x: number; y: number; active: boolean }> = [];

  const isTallCaster = (t: Tile): boolean =>
    t === '#' || t === '%' || t === 'D' || t === 'K' || t === 'S' || t === 'H';

  // Grounded cobble foundations (`st.y + 1`) and welcoming doorstep aprons (`st.y + 2`)
  // under the Mouse House & the Old Smithy
  const apronCells = new Set<string>();
  const plinthTiles = [BG.buildingPlinthW, BG.buildingPlinthM, BG.buildingPlinthE] as const;
  const apronTiles = [BG.buildingApronW, BG.buildingApronDoor, BG.buildingApronE] as const;
  for (const st of room?.stamps ?? []) {
    if (st.id !== 'mouse-house' && st.id !== 'smithy') continue;
    const fy = st.y + 1;
    if (fy >= 0 && fy < s.roomH) {
      for (let dx = 0; dx < 3; dx++) {
        const fx = st.x + dx;
        const pTile = plinthTiles[dx];
        if (fx >= 0 && fx < s.roomW && pTile) {
          decals.push({ x: fx, y: fy, tile: pTile, transparentZero: true });
        }
      }
    }
    const ay = st.y + 2;
    if (ay >= 0 && ay < s.roomH) {
      for (let dx = 0; dx < 3; dx++) {
        const ax = st.x + dx;
        const aTile = apronTiles[dx];
        if (ax < 0 || ax >= s.roomW || !aTile) continue;
        const wt = at(ax, ay);
        if (wt === '.' || wt === ':' || wt === ',' || wt === '>') {
          const castShadow = ay > 0 && isTallCaster(at(ax, ay - 1)) && !isTallCaster(wt);
          decals.push({
            x: ax,
            y: ay,
            tile: aTile,
            transparentZero: true,
            topShadow: castShadow,
          });
          apronCells.add(`${ax},${ay}`);
        }
      }
    }
  }

  const isWaterCell = (t: Tile): boolean =>
    t === '~' || t === ';' || t === '1' || t === '2' || t === '3' || t === '4';

  const isWaterLike = (x: number, y: number): boolean => {
    const t = at(x, y);
    return (
      isWaterCell(t) ||
      (t === '_' &&
        (isWaterCell(at(x - 1, y)) ||
          isWaterCell(at(x + 1, y)) ||
          isWaterCell(at(x, y - 1)) ||
          isWaterCell(at(x, y + 1))))
    );
  };

  const isPitLike = (x: number, y: number): boolean => {
    const t = at(x, y);
    return t === '^' || (t === '_' && (at(x - 1, y) === '^' || at(x + 1, y) === '^'));
  };

  const isPathLike = (x: number, y: number): boolean => {
    const t = at(x, y);
    return t === ':' || t === '_' || t === '>' || t === 'S' || t === 'D' || t === 'K';
  };

  const isCryptChamber = (x: number, y: number): boolean => {
    const ux = rgx(x);
    const uy = rgy(y);
    if (ux <= 1 || ux >= RW - 2 || uy <= 1 || uy >= RH - 2) {
      if (big || x <= 1 || x >= s.roomW - 2 || y <= 1 || y >= s.roomH - 2) return false;
    }
    return at(x, y) !== '#';
  };

  const isRealTree = (tx: number, ty: number): boolean =>
    tx >= 0 &&
    tx < s.roomW &&
    ty >= 0 &&
    ty < s.roomH &&
    !stampedSolid.has(`${tx},${ty}`) &&
    at(tx, ty) === 'Y';

  // =========================================================================
  // Pass 1 & 2: Per-Cell Terrain, Decals, Mitered Walls, Cliffs, Trees & Props
  // =========================================================================
  for (let y = 0; y < s.roomH; y++) {
    for (let x = 0; x < s.roomW; x++) {
      const t = at(x, y);
      const key = `${x},${y}`;
      const castShadow =
        y > 0 && isTallCaster(at(x, y - 1)) && room?.rows[y - 1]?.[x] !== 'L' && !isTallCaster(t);

      // --- 1. Base Ground Layer ---
      if (isWaterLike(x, y)) {
        const nb = makeMask((dx, dy) => isWaterLike(x + dx, y + dy));
        ground.push({ x, y, tile: resolveBlobTile(WATER_BLOB, nb) });
        const pureInterior =
          t === '~' && nb.n && nb.s && nb.e && nb.w && nb.nw && nb.ne && nb.sw && nb.se;
        // Shorelines stay calm (no shimmer decals): only the open interior animates
        if (pureInterior) {
          interiorWater.push([x, y]);
        }
      } else if (isPitLike(x, y)) {
        const nb = makeMask((dx, dy) => isPitLike(x + dx, y + dy));
        ground.push({ x, y, tile: resolveBlobTile(PIT_BLOB, nb) });
      } else if (isCrypt) {
        const ux = big ? rgx(x) : x;
        const uy = big ? rgy(y) : y;
        const uw = big ? RW : s.roomW;
        const uh = big ? RH : s.roomH;
        const inTunnel = ux <= 1 || ux >= uw - 2 || uy <= 1 || uy >= uh - 2;
        if (inTunnel && t !== '#') {
          const ns = uy <= 1 || uy >= uh - 2;
          let tunnelTile: BgTile = BG.archFloorNS;
          if (!ns) {
            const openN = y > 0 && at(x, y - 1) !== '#';
            const openS = y < s.roomH - 1 && at(x, y + 1) !== '#';
            tunnelTile =
              openN && openS
                ? BG.archFloorEW_Open
                : !openN && openS
                  ? BG.archFloorEW_Top
                  : openN && !openS
                    ? BG.archFloorEW_Bot
                    : BG.archFloorEW_Top;
          }
          ground.push({
            x,
            y,
            tile: tunnelTile,
            topShadow: castShadow,
          });
          if (uy === 0 && (big ? y === 0 : true) && (t === '.' || t === ',')) {
            ceiling.push({ x, y, tile: BG.archLintelN, transparentZero: true });
          }
        } else {
          const nb = makeMask((dx, dy) => isCryptChamber(x + dx, y + dy));
          const fullInterior = nb.n && nb.s && nb.e && nb.w && nb.nw && nb.ne && nb.sw && nb.se;
          let floorTile = resolveBlobTile(CRYPT_FLOOR_BLOB, nb);
          if (fullInterior && t !== '#') {
            const fh = cellHash(x, y, s.rx, s.ry) & 7;
            if (fh === 1 || fh === 5) {
              floorTile = BG.cryptFloorVarA;
            } else if (fh === 3 || fh === 6) {
              floorTile = BG.cryptFloorVarB;
            }
          }
          ground.push({
            x,
            y,
            tile: floorTile,
            topShadow: castShadow,
          });
        }
      } else {
        // Overworld meadow + organic path blobs + forest-edge fern/clover/root trims
        if (t === ':') {
          const nb = makeMask((dx, dy) => isPathLike(x + dx, y + dy));
          ground.push({ x, y, tile: resolveBlobTile(PATH_BLOB, nb), topShadow: castShadow });
        } else {
          const hash = (x * 43 + y * 97 + s.rx * 13 + s.ry * 29) & 31;
          const baseGrass =
            t === '.' && hash === 3
              ? BG.grassDaisy
              : t === '.' && hash === 9
                ? BG.grassClover
                : t === '.' && hash < 6
                  ? BG.grassTuftA
                  : BG.grassOpen;
          ground.push({ x, y, tile: baseGrass, topShadow: castShadow });
        }

        if (t === '.' && !apronCells.has(key)) {
          // The thicket has its own rim; only round trees get meadow trims
          if (isRealTree(x, y - 1) && !isThicket(x, y - 1)) {
            decals.push({
              x,
              y,
              tile: BG.forestEdgeN,
              transparentZero: true,
              topShadow: castShadow,
            });
          }
          if (isRealTree(x - 1, y) && !isThicket(x - 1, y)) {
            decals.push({ x, y, tile: BG.forestEdgeW, transparentZero: true });
          }
          if (isRealTree(x + 1, y) && !isThicket(x + 1, y)) {
            decals.push({ x, y, tile: BG.forestEdgeE, transparentZero: true });
          }
        }
      }

      // --- 1b. Atmospheric Crypt Chamber Floor Decals (never overlapping portals/buttons/tracks) ---
      if (
        isCrypt &&
        x >= 2 &&
        x <= s.roomW - 3 &&
        y >= 2 &&
        y <= s.roomH - 3 &&
        t === '.' &&
        (room?.rows[y]?.[x] ?? '.') === '.' &&
        !(x === 5 && y === 6) &&
        !room?.portals?.some((p) => p.x === x && p.y === y) &&
        !s.blocks.some((b) => Math.round(b.x) === x && Math.round(b.y) === y)
      ) {
        const dh = cellHash(x + 11, y + 23, s.rx, s.ry) & 31;
        const nearWall = x === 2 || x === s.roomW - 3 || y === 2 || y === s.roomH - 3;
        const nearCorner = (x === 2 || x === s.roomW - 3) && (y === 2 || y === s.roomH - 3);

        // No scorch decals: at this size they read as dirt or spiders, not burns
        if (nearCorner && (dh & 1) === 0) {
          decals.push({
            x,
            y,
            tile: BG.cryptDecalMoss,
            transparentZero: true,
            topShadow: castShadow,
          });
        } else if (nearWall && dh < 3) {
          decals.push({
            x,
            y,
            tile: BG.cryptDecalMoss,
            transparentZero: true,
            topShadow: castShadow,
          });
        } else if (!nearWall && x === 5 && (y === 3 || y === 9) && ((s.rx + s.ry + y) & 1) === 0) {
          decals.push({ x, y, tile: BG.cryptDecalRug, transparentZero: true });
        } else if (!nearWall && (dh === 5 || dh === 19)) {
          decals.push({ x, y, tile: BG.cryptDecalCrack, transparentZero: true });
        }
      }

      // --- 2. Bridge Decks (`_`) ---
      if (t === '_') {
        const hasW = at(x - 1, y) === '_';
        const hasE = at(x + 1, y) === '_';
        const bTile = !hasW && hasE ? BG.bridgeV_W : hasW && !hasE ? BG.bridgeV_E : BG.bridgeV_Mid;
        decals.push({ x, y, tile: bTile, transparentZero: true });
        continue;
      }

      // Skip underlying '#' / 'Y' where a bespoke landmark stamp owns the visual
      if (stampedSolid.has(key) && (t === '#' || t === 'Y')) {
        continue;
      }

      // --- 3. Trees (`Y`) ---
      if (t === 'Y' && isThicket(x, y)) {
        const nb = makeMask((dx, dy) => isThicket(x + dx, y + dy));
        ground.push({ x, y, tile: resolveBlobTile(THICKET_BLOB, nb) });
        continue;
      }
      if (t === 'Y') {
        const paired = treeMap.get(key);
        if (paired && 'covered' in paired) {
          continue; // drawn by its cell's top-left tile at 2x
        } else if (paired) {
          const placed = { x, y, tile: paired.tile, transparentZero: true, scale: paired.scale };
          if (paired.overhead) {
            // Paint grass underneath, then draw crown on Pass 4 so Pip tucks behind it!
            overhead.push(placed);
          } else {
            props.push(placed);
          }
        } else {
          props.push({ x, y, tile: BG.boulderOw, transparentZero: true });
        }
        continue;
      }

      // --- 4. Walls & Cliffs (`#`) ---
      if (t === '#') {
        if (isCrypt) {
          // On a doubled screen, read the 4-deep wall as the 2-deep one it stands for
          const wx = rgx(x);
          const wy = rgy(y);
          const ww = big ? RW : s.roomW;
          const wh = big ? RH : s.roomH;
          const isOuter = wx === 0 || wx === ww - 1 || wy === 0 || wy === wh - 1;
          if (isOuter) {
            const cap =
              wx === 0 && wy === 0
                ? BG.cryptCapNW
                : wx === ww - 1 && wy === 0
                  ? BG.cryptCapNE
                  : wx === 0 && wy === wh - 1
                    ? BG.cryptCapSW
                    : wx === ww - 1 && wy === wh - 1
                      ? BG.cryptCapSE
                      : BG.cryptCap;
            ground.push({ x, y, tile: cap });
          } else if (wx === 1 && wy === 1) {
            ground.push({ x, y, tile: BG.cryptCornerNW });
          } else if (wx === ww - 2 && wy === 1) {
            ground.push({ x, y, tile: BG.cryptCornerNE });
          } else if (wx === 1 && wy === wh - 2) {
            ground.push({ x, y, tile: BG.cryptCornerSW });
          } else if (wx === ww - 2 && wy === wh - 2) {
            ground.push({ x, y, tile: BG.cryptCornerSE });
          } else if (wy === 1) {
            ground.push({ x, y, tile: x % 2 === 0 ? BG.cryptWallN_A : BG.cryptWallN_B });
          } else if (wy === wh - 2) {
            ground.push({ x, y, tile: BG.cryptWallS_A });
          } else if (wx === 1) {
            ground.push({ x, y, tile: BG.cryptWallW_A });
          } else if (wx === ww - 2) {
            ground.push({ x, y, tile: BG.cryptWallE_A });
          } else {
            ground.push({ x, y, tile: BG.cryptPillar });
          }
        } else {
          // Overworld 2-tall layered escarpment cliffs (or standalone carved stone pillar)
          const hasOrthoCliff =
            (y > 0 && at(x, y - 1) === '#') ||
            (y < s.roomH - 1 && at(x, y + 1) === '#') ||
            (x > 0 && at(x - 1, y) === '#') ||
            (x < s.roomW - 1 && at(x + 1, y) === '#');
          if (!hasOrthoCliff) {
            ground.push({ x, y, tile: BG.cryptPillar });
          } else {
            const south = y < s.roomH - 1 ? at(x, y + 1) : '#';
            const south2 = y < s.roomH - 2 ? at(x, y + 2) : '#';
            if (south !== '#' && south !== '%') {
              ground.push({ x, y, tile: (x + y) % 2 === 0 ? BG.cliffFaceA : BG.cliffFaceB });
            } else if (south2 !== '#') {
              ground.push({ x, y, tile: BG.cliffBrowS });
            } else if (x > 0 && at(x - 1, y) !== '#') {
              ground.push({ x, y, tile: BG.cliffEdgeW });
            } else if (x < s.roomW - 1 && at(x + 1, y) !== '#') {
              ground.push({ x, y, tile: BG.cliffEdgeE });
            } else {
              ground.push({ x, y, tile: BG.cliffPlateau });
            }
          }
        }
        continue;
      }

      // --- 5. Cracked Walls (`%`), Connected Props, Flat Decals & Doors ---
      if (t === '%') {
        props.push({ x, y, tile: BG.crackedWall, transparentZero: true });
      } else if (t === '=') {
        const hasW = x > 0 && at(x - 1, y) === '=';
        const hasE = x < s.roomW - 1 && at(x + 1, y) === '=';
        if (isIceCave) {
          const bt =
            hasW && hasE
              ? BG.balusterMidH
              : !hasW && hasE
                ? BG.balusterEndW
                : hasW && !hasE
                  ? BG.balusterEndE
                  : BG.balusterSingle;
          props.push({ x, y, tile: bt, transparentZero: true });
        } else {
          const ft =
            hasW && hasE
              ? BG.fenceMidH
              : !hasW && hasE
                ? BG.fenceEndW
                : hasW && !hasE
                  ? BG.fenceEndE
                  : BG.fenceSingle;
          props.push({ x, y, tile: ft, transparentZero: true });
        }
      } else if (t === 'B' && isIceCave) {
        // In the Ice Cave the meltable obstacle is a single block of ice
        props.push({ x, y, tile: BG.iceBlock, transparentZero: true });
      } else if (t === 'B') {
        const connV = (y > 0 && at(x, y - 1) === 'B') || (y < s.roomH - 1 && at(x, y + 1) === 'B');
        props.push({
          x,
          y,
          tile: connV ? BG.brambleConnectV : BG.brambleSingle,
          transparentZero: true,
        });
      } else if (t === 'W') {
        props.push({ x, y, tile: BG.crate, transparentZero: true });
      } else if (t === 'R' || t === 'U') {
        const raised =
          (t === 'R' && s.crystalColor === 'red') || (t === 'U' && s.crystalColor === 'blue');
        const col: BgPaletteId = t === 'R' ? 'red' : 'blue';
        if (raised) {
          props.push({
            x,
            y,
            tile: recolorQuads(BG.barrierUp, [col, col, col, col]),
            transparentZero: true,
          });
        } else {
          decals.push({
            x,
            y,
            tile: recolorQuads(BG.barrierDown, [col, col, col, col]),
            transparentZero: true,
          });
        }
      } else if (t === 'G' || (t === '.' && room?.rows[y]?.[x] === 'G')) {
        // Iron gate: the crystal barrier art in steel, flat while every 'Q' switch is held
        const tile = t === 'G' ? BG.barrierUp : BG.barrierDown;
        const steel = recolorQuads(tile, ['steel', 'steel', 'steel', 'steel']);
        if (t === 'G') {
          props.push({ x, y, tile: steel, transparentZero: true });
        } else {
          decals.push({ x, y, tile: steel, transparentZero: true });
        }
      } else if (t === 'Q') {
        const tile = s.gatesOpen ? BG.buttonDown : BG.buttonUp;
        decals.push({
          x,
          y,
          tile: recolorQuads(tile, ['steel', 'steel', 'steel', 'steel']),
          transparentZero: true,
        });
      } else if (t === 'C') {
        const col: BgPaletteId = s.crystalColor === 'red' ? 'red' : 'blue';
        props.push({
          x,
          y,
          tile: recolorQuads(BG.switchOrb, [col, col, 'steel', 'steel']),
          transparentZero: true,
        });
      } else if (t === 'T' && big && !isBlockTopLeft(x, y, 'T')) {
        // Part of a 2x brazier drawn from its top-left tile
      } else if (t === 'T') {
        const spec = room?.torches?.find((ts) => ts.x === x && ts.y === y);
        const bt =
          spec?.order === 1
            ? BG.brazier1
            : spec?.order === 2
              ? BG.brazier2
              : spec?.order === 3
                ? BG.brazier3
                : BG.brazier0;
        props.push({ x, y, tile: bt, transparentZero: true, ...(big ? { scale: 2 } : {}) });
      } else if ((t === 'D' || t === 'K' || t === 'S') && big && !isBlockTopLeft(x, y, t)) {
        // Part of a door filling a doubled opening, drawn from its top-left tile
      } else if ((t === 'D' || t === 'K') && big) {
        const tile = t === 'D' ? BG.doorKeyNS : BG.doorBossNS;
        decals.push({ x, y, tile, scale: 2 });
      } else if (t === 'D') {
        ground.push({ x, y, tile: BG.doorKeyNS });
      } else if (t === 'K') {
        ground.push({ x, y, tile: BG.doorBossNS });
      } else if (t === 'S') {
        const ew = rgx(x) === 0 || rgx(x) === (big ? RW : s.roomW) - 1;
        props.push({
          x,
          y,
          tile: ew ? BG.shutterEW : BG.shutterNS,
          transparentZero: true,
          ...(big ? { scale: 2 } : {}),
        });
      } else if (t === 'O') {
        decals.push({ x, y, tile: solved ? BG.buttonDown : BG.buttonUp, transparentZero: true });
      } else if (t === '!') {
        decals.push({ x, y, tile: BG.spikes, transparentZero: true });
      } else if (t === '.' && room?.rows[y]?.[x] === 'X') {
        decals.push({ x, y, tile: BG.spikesSunk, transparentZero: true });
      } else if (t === ',') {
        decals.push({ x, y, tile: BG.dryGrass, transparentZero: true, topShadow: castShadow });
      } else if (t === '1' || t === '2' || t === '3' || t === '4') {
        const currentTile =
          t === '1' ? BG.currentN : t === '2' ? BG.currentS : t === '3' ? BG.currentE : BG.currentW;
        decals.push({ x, y, tile: currentTile, transparentZero: true });
      } else if (room?.rows[y]?.[x] === 'L') {
        // A pillar's socket; the pillar itself is drawn live as it rises and sinks
        decals.push({ x, y, tile: BG.liftDown });
      } else if (t === 'H' && room?.rows[y + 1]?.[x] !== 'L') {
        decals.push({ x, y, tile: ledgeTile(ledgeDrops(room, s, x, y)) });
      } else if ((t === 'n' || t === 's' || t === 'e' || t === 'w') && hasLevels(room)) {
        // In a room with floor levels a slope is a ramp; the letter is the way it runs down
        const rampTile =
          t === 's' ? BG.rampN : t === 'n' ? BG.rampS : t === 'e' ? BG.rampW : BG.rampE;
        decals.push({ x, y, tile: rampTile });
      } else if (t === 'n' || t === 's' || t === 'e' || t === 'w') {
        const slopeTile =
          t === 'n' ? BG.slopeN : t === 's' ? BG.slopeS : t === 'e' ? BG.slopeE : BG.slopeW;
        decals.push({ x, y, tile: slopeTile, topShadow: castShadow });
      } else if (t === '>') {
        const pSpec = room?.portals?.find((p) => p.x === x && p.y === y);
        const midpoint = Boolean(pSpec?.requiresWarpUnlock);
        if (midpoint) {
          const active = s.cryptWarpUnlocked;
          decals.push({ x, y, tile: active ? BG.warp0 : BG.warpOff, transparentZero: true });
          warpPads.push({ x, y, active });
        } else if (big && !isBlockTopLeft(x, y, '>')) {
          // Part of a 2x flight of stairs drawn from its top-left tile
        } else if (!apronCells.has(key)) {
          // A lone stair tile on a doubled screen (the Mouse House door) stays 1x
          const flight = big && at(x + 1, y) === '>' && at(x, y + 1) === '>';
          decals.push({
            x,
            y,
            tile: BG.stairs,
            transparentZero: true,
            ...(flight ? { scale: 2 } : {}),
          });
        }
      }
    }
  }

  // --- 6. Centered Item-Unlock Pedestal Ring on (5, 6) (omitted on boss room & non-item rooms) ---
  const hasCenterItemUnlock =
    room?.condition !== 'boss' &&
    Boolean(room?.pickups?.some((p) => Math.floor(p.x) === 5 && Math.floor(p.y) === 6));
  if (isCrypt && hasCenterItemUnlock && at(5, 6) === '.') {
    decals.push({ x: 5, y: 6, tile: BG.sealRingCenter, transparentZero: true });
  }

  // --- 7. Bespoke Multi-Tile Landmark Stamps (`mouse-house`, `smithy`, `crypt-mausoleum`, `spire-gate`, `spire-seal`) ---
  const cinderLit = s.spireCinderSlotted || s.cores.includes('cinder');
  for (const st of room?.stamps ?? []) {
    // The dungeon entrance's arch is drawn at 2x on doubled screens, like its stairs
    const k = big && st.id === 'crypt-mausoleum' ? 2 : 1;
    for (const cell of STAMP_DEFS[st.id]) {
      const tx = st.x + k * cell.dx;
      const ty = st.y + k * cell.dy;
      if (tx < 0 || ty < 0 || tx >= s.roomW || ty >= s.roomH) continue;
      const tileName =
        st.id === 'spire-seal' && cell.dx === 0 && cell.dy === 0 && cinderLit
          ? 'sealSocketLit'
          : cell.tile;
      const tile = BG[tileName];
      if (cell.overhead) {
        overhead.push({
          x: tx,
          y: ty,
          tile,
          transparentZero: st.id !== 'crypt-mausoleum',
          ...(k > 1 ? { scale: k } : {}),
        });
      } else if (st.id === 'spire-seal') {
        decals.push({ x: tx, y: ty, tile, transparentZero: true });
      } else {
        props.push({ x: tx, y: ty, tile, transparentZero: st.id !== 'spire-gate' });
      }
    }
  }

  const crowns = isCrypt ? [] : placeCrowns(isThicket, s.rx * 31 + s.ry * 17 + 5, s.roomW, s.roomH);
  return { ground, decals, props, overhead, ceiling, interiorWater, warpPads, chimneys, crowns };
}

/** The ledge edge art for the sides of a tile that drop away (`ELEVATION.md`). */
function ledgeTile(d: LedgeDrops | null): BgTile {
  if (!d) return BG.ledgeS;
  if (d.lower) return d.e ? BG.ledgeFaceLowerE : d.w ? BG.ledgeFaceLowerW : BG.ledgeFaceLower;
  if (d.s && d.e) return BG.ledgeSE;
  if (d.s && d.w) return BG.ledgeSW;
  if (d.n && d.e) return BG.ledgeNE;
  if (d.n && d.w) return BG.ledgeNW;
  if (d.s) return BG.ledgeS;
  if (d.e) return BG.ledgeE;
  if (d.w) return BG.ledgeW;
  if (d.n) return BG.ledgeN;
  if (d.se) return BG.ledgeInnerSE;
  if (d.sw) return BG.ledgeInnerSW;
  if (d.ne) return BG.ledgeInnerNE;
  return BG.ledgeInnerNW;
}
