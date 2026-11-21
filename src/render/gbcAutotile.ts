/**
 * Pure multi-tile & 8x8 blob room layout resolver (`ASSETS.md` §2 & §4).
 *
 * Maps any 11x13 `RoomSpec` + live `State` into:
 * - `ground`:   11x13 base terrain BgTiles (grass, curved paths, waterbanks, pit rims,
 *               recessed dungeon floor trim, flagstone variants, walls, cliffs & locked doors)
 * - `decals`:   flat floor overlays drawn directly over `ground` and ALWAYS below ground actors
 *               (medallions, Fourfold Spire seal, carved stone chutes, bridges, buttons, spikes,
 *               stairs, warps, lowered barriers, crypt floor decals, forest-edge trims, building aprons)
 * - `props`:    raised 3D obstacle/wall BgTiles Y-sorted with actors by foot position
 *               (crates, fences, balustrades, brambles, braziers, crystal switches, raised barriers,
 *               shutters, cracked walls, building walls, lower tree trunks & boulders)
 * - `overhead`: 3/4 vertical overlap tiles Y-sorted with actors at `footY = y + 0.99`
 *               (workshop/smithy roof eaves, mausoleum arch pediment, upper tree crowns) so
 *               actors north of the tile tuck behind it while actors/flames south draw in front
 * - `ceiling`:  Pass-4 walk-under ceiling tiles drawn AFTER all actors (north doorway lintels)
 */
import {
  ROOM_H,
  ROOM_W,
  type State,
  type Tile,
  type World,
  currentRoom,
  roomKey,
  tileAt,
} from '../game/world';
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
  const isCrypt = s.zone === 'ember-crypt';
  const solved = s.roomSolved || s.solvedRooms.has(roomKey(s.zone, s.rx, s.ry));

  const grid: Tile[][] = [];
  for (let y = 0; y < ROOM_H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < ROOM_W; x++) {
      row.push(tileAt(world, s, s.zone, s.rx, s.ry, x, y));
    }
    grid.push(row);
  }

  const at = (x: number, y: number): Tile => {
    const cx = Math.max(0, Math.min(ROOM_W - 1, x));
    const cy = Math.max(0, Math.min(ROOM_H - 1, y));
    return grid[cy]?.[cx] ?? '#';
  };

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
    if (st.id === 'bram-workshop') {
      chimneys.push([(st.x + 2) * 16 + 7, st.y * 16 - 4]);
    }
  }

  // Authentic LADX / Oracle 2-wide vertical column-run tree tiling (`Top -> Ovl* -> Bot`)
  // with deterministic canopy & gnarled root-flare variants so tree borders never rubber-stamp!
  // Oracle-style forest walls: trees in the two-column side borders render as one seamless
  // thicket; round trees are kept for the top, bottom and interior
  const isSideBandCell = (x: number, y: number): boolean =>
    y >= 0 && y < ROOM_H && at(x, y) === 'Y' && !stampedSolid.has(`${x},${y}`);
  const isSideThicket = (x: number, y: number): boolean => {
    if (isCrypt || x < 0 || x >= ROOM_W || y < 0 || y >= ROOM_H) return false;
    if (x <= 1) return isSideBandCell(0, y) && isSideBandCell(1, y);
    if (x >= ROOM_W - 2) return isSideBandCell(ROOM_W - 2, y) && isSideBandCell(ROOM_W - 1, y);
    return false;
  };

  const treeMap = new Map<string, { tile: BgTile; overhead: boolean }>();
  if (!isCrypt) {
    const claimedCol = new Set<string>();
    const isFreeTree = (x: number, y: number): boolean =>
      x >= 0 &&
      x < ROOM_W &&
      y >= 0 &&
      y < ROOM_H &&
      !claimedCol.has(`${x},${y}`) &&
      !stampedSolid.has(`${x},${y}`) &&
      !isSideThicket(x, y) &&
      at(x, y) === 'Y';

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

    for (let x = 0; x < ROOM_W - 1; x++) {
      let y = 0;
      while (y < ROOM_H) {
        if (!isFreeTree(x, y) || !isFreeTree(x + 1, y)) {
          y++;
          continue;
        }
        const yStart = y;
        while (y < ROOM_H && isFreeTree(x, y) && isFreeTree(x + 1, y)) {
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
            const northWalkable = ry > 0 && at(x, ry - 1) !== 'Y' && at(x, ry - 1) !== '#';
            const rowSeed = cellHash(0, ry, s.rx, s.ry);
            const step = 1 + (rowSeed & 1); // coprime to 3 so adjacent 2x2 trees never repeat
            const pair = topCrowns[((rowSeed >>> 2) + colIdx * step) % 3] ?? topCrowns[0];
            treeMap.set(`${x},${ry}`, { tile: pair[0], overhead: northWalkable });
            treeMap.set(`${x + 1},${ry}`, { tile: pair[1], overhead: northWalkable });
          } else if (ry < yEnd) {
            const rowSeed = cellHash(1, ry, s.rx, s.ry);
            const step = 1 + (rowSeed & 1);
            const pair =
              midCrowns[((rowSeed >>> 2) + colIdx * step + (ry - yStart)) % 3] ?? midCrowns[0];
            treeMap.set(`${x},${ry}`, { tile: pair[0], overhead: false });
            treeMap.set(`${x + 1},${ry}`, { tile: pair[1], overhead: false });
          } else {
            const trunkIdx = (colIdx + (cellHash(x >> 2, ry, s.rx, s.ry) & 1)) % 2;
            const pair = trunkBases[trunkIdx] ?? trunkBases[0];
            treeMap.set(`${x},${ry}`, { tile: pair[0], overhead: false });
            treeMap.set(`${x + 1},${ry}`, { tile: pair[1], overhead: false });
          }
        }
      }
    }
  }

  const isThicket = (x: number, y: number): boolean => {
    if (isCrypt) return false;
    if (x < 0 || x >= ROOM_W || y < 0 || y >= ROOM_H) return true; // continues off-screen
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
    t === '#' || t === '%' || t === 'D' || t === 'K' || t === 'S';

  // Grounded cobble foundations (`st.y + 1`) and welcoming doorstep aprons (`st.y + 2`)
  // under Bram's Workshop & the Rusted Smithy
  const apronCells = new Set<string>();
  const plinthTiles = [BG.buildingPlinthW, BG.buildingPlinthM, BG.buildingPlinthE] as const;
  const apronTiles = [BG.buildingApronW, BG.buildingApronDoor, BG.buildingApronE] as const;
  for (const st of room?.stamps ?? []) {
    if (st.id !== 'bram-workshop' && st.id !== 'rusted-smithy') continue;
    const fy = st.y + 1;
    if (fy >= 0 && fy < ROOM_H) {
      for (let dx = 0; dx < 3; dx++) {
        const fx = st.x + dx;
        const pTile = plinthTiles[dx];
        if (fx >= 0 && fx < ROOM_W && pTile) {
          decals.push({ x: fx, y: fy, tile: pTile, transparentZero: true });
        }
      }
    }
    const ay = st.y + 2;
    if (ay >= 0 && ay < ROOM_H) {
      for (let dx = 0; dx < 3; dx++) {
        const ax = st.x + dx;
        const aTile = apronTiles[dx];
        if (ax < 0 || ax >= ROOM_W || !aTile) continue;
        const wt = at(ax, ay);
        if (wt === '.' || wt === ':' || wt === ',') {
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
    if (x <= 1 || x >= ROOM_W - 2 || y <= 1 || y >= ROOM_H - 2) return false;
    return at(x, y) !== '#';
  };

  const isRealTree = (tx: number, ty: number): boolean =>
    tx >= 0 &&
    tx < ROOM_W &&
    ty >= 0 &&
    ty < ROOM_H &&
    !stampedSolid.has(`${tx},${ty}`) &&
    at(tx, ty) === 'Y';

  // =========================================================================
  // Pass 1 & 2: Per-Cell Terrain, Decals, Mitered Walls, Cliffs, Trees & Props
  // =========================================================================
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const t = at(x, y);
      const key = `${x},${y}`;
      const castShadow = y > 0 && isTallCaster(at(x, y - 1)) && !isTallCaster(t);

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
        const inTunnel = x <= 1 || x >= ROOM_W - 2 || y <= 1 || y >= ROOM_H - 2;
        if (inTunnel && t !== '#') {
          const ns = y <= 1 || y >= ROOM_H - 2;
          let tunnelTile: BgTile = BG.archFloorNS;
          if (!ns) {
            const openN = y > 0 && at(x, y - 1) !== '#';
            const openS = y < ROOM_H - 1 && at(x, y + 1) !== '#';
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
          if (y === 0 && (t === '.' || t === ',')) {
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
        x <= ROOM_W - 3 &&
        y >= 2 &&
        y <= ROOM_H - 3 &&
        t === '.' &&
        (room?.rows[y]?.[x] ?? '.') === '.' &&
        !(x === 5 && y === 6) &&
        !room?.portals?.some((p) => p.x === x && p.y === y) &&
        !s.blocks.some((b) => Math.round(b.x) === x && Math.round(b.y) === y)
      ) {
        const dh = cellHash(x + 11, y + 23, s.rx, s.ry) & 31;
        const nearWall = x === 2 || x === ROOM_W - 3 || y === 2 || y === ROOM_H - 3;
        const nearCorner = (x === 2 || x === ROOM_W - 3) && (y === 2 || y === ROOM_H - 3);

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
        if (paired) {
          if (paired.overhead) {
            // Paint grass underneath, then draw crown on Pass 4 so Pip tucks behind it!
            overhead.push({ x, y, tile: paired.tile, transparentZero: true });
          } else {
            props.push({ x, y, tile: paired.tile, transparentZero: true });
          }
        } else {
          props.push({ x, y, tile: BG.boulderOw, transparentZero: true });
        }
        continue;
      }

      // --- 4. Walls & Cliffs (`#`) ---
      if (t === '#') {
        if (isCrypt) {
          const isOuter = x === 0 || x === ROOM_W - 1 || y === 0 || y === ROOM_H - 1;
          if (isOuter) {
            const cap =
              x === 0 && y === 0
                ? BG.cryptCapNW
                : x === ROOM_W - 1 && y === 0
                  ? BG.cryptCapNE
                  : x === 0 && y === ROOM_H - 1
                    ? BG.cryptCapSW
                    : x === ROOM_W - 1 && y === ROOM_H - 1
                      ? BG.cryptCapSE
                      : BG.cryptCap;
            ground.push({ x, y, tile: cap });
          } else if (x === 1 && y === 1) {
            ground.push({ x, y, tile: BG.cryptCornerNW });
          } else if (x === ROOM_W - 2 && y === 1) {
            ground.push({ x, y, tile: BG.cryptCornerNE });
          } else if (x === 1 && y === ROOM_H - 2) {
            ground.push({ x, y, tile: BG.cryptCornerSW });
          } else if (x === ROOM_W - 2 && y === ROOM_H - 2) {
            ground.push({ x, y, tile: BG.cryptCornerSE });
          } else if (y === 1) {
            ground.push({ x, y, tile: x % 2 === 0 ? BG.cryptWallN_A : BG.cryptWallN_B });
          } else if (y === ROOM_H - 2) {
            ground.push({ x, y, tile: BG.cryptWallS_A });
          } else if (x === 1) {
            ground.push({ x, y, tile: BG.cryptWallW_A });
          } else if (x === ROOM_W - 2) {
            ground.push({ x, y, tile: BG.cryptWallE_A });
          } else {
            ground.push({ x, y, tile: BG.cryptPillar });
          }
        } else {
          // Overworld 2-tall layered escarpment cliffs (or standalone carved stone pillar)
          const hasOrthoCliff =
            (y > 0 && at(x, y - 1) === '#') ||
            (y < ROOM_H - 1 && at(x, y + 1) === '#') ||
            (x > 0 && at(x - 1, y) === '#') ||
            (x < ROOM_W - 1 && at(x + 1, y) === '#');
          if (!hasOrthoCliff) {
            ground.push({ x, y, tile: BG.cryptPillar });
          } else {
            const south = y < ROOM_H - 1 ? at(x, y + 1) : '#';
            const south2 = y < ROOM_H - 2 ? at(x, y + 2) : '#';
            if (south !== '#' && south !== '%') {
              ground.push({ x, y, tile: (x + y) % 2 === 0 ? BG.cliffFaceA : BG.cliffFaceB });
            } else if (south2 !== '#') {
              ground.push({ x, y, tile: BG.cliffBrowS });
            } else if (x > 0 && at(x - 1, y) !== '#') {
              ground.push({ x, y, tile: BG.cliffEdgeW });
            } else if (x < ROOM_W - 1 && at(x + 1, y) !== '#') {
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
        const hasE = x < ROOM_W - 1 && at(x + 1, y) === '=';
        if (isCrypt) {
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
      } else if (t === 'B') {
        const connV = (y > 0 && at(x, y - 1) === 'B') || (y < ROOM_H - 1 && at(x, y + 1) === 'B');
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
      } else if (t === 'C') {
        const col: BgPaletteId = s.crystalColor === 'red' ? 'red' : 'blue';
        props.push({
          x,
          y,
          tile: recolorQuads(BG.switchOrb, [col, col, 'steel', 'steel']),
          transparentZero: true,
        });
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
        props.push({ x, y, tile: bt, transparentZero: true });
      } else if (t === 'D') {
        ground.push({ x, y, tile: BG.doorKeyNS });
      } else if (t === 'K') {
        ground.push({ x, y, tile: BG.doorBossNS });
      } else if (t === 'S') {
        const ew = x === 0 || x === ROOM_W - 1;
        props.push({ x, y, tile: ew ? BG.shutterEW : BG.shutterNS, transparentZero: true });
      } else if (t === 'O') {
        decals.push({ x, y, tile: solved ? BG.buttonDown : BG.buttonUp, transparentZero: true });
      } else if (t === '!') {
        decals.push({ x, y, tile: BG.spikes, transparentZero: true });
      } else if (t === ',') {
        decals.push({ x, y, tile: BG.dryGrass, transparentZero: true, topShadow: castShadow });
      } else if (t === '1' || t === '2' || t === '3' || t === '4') {
        const currentTile =
          t === '1' ? BG.currentN : t === '2' ? BG.currentS : t === '3' ? BG.currentE : BG.currentW;
        decals.push({ x, y, tile: currentTile, transparentZero: true });
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
        } else {
          decals.push({ x, y, tile: BG.stairs, transparentZero: true });
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

  // --- 7. Bespoke Multi-Tile Landmark Stamps (`bram-workshop`, `rusted-smithy`, `crypt-mausoleum`, `spire-gate`, `spire-seal`) ---
  const cinderLit = s.spireCinderSlotted || s.cores.includes('cinder');
  for (const st of room?.stamps ?? []) {
    for (const cell of STAMP_DEFS[st.id]) {
      const tx = st.x + cell.dx;
      const ty = st.y + cell.dy;
      if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
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
        });
      } else if (st.id === 'spire-seal') {
        decals.push({ x: tx, y: ty, tile, transparentZero: true });
      } else {
        props.push({ x: tx, y: ty, tile, transparentZero: st.id !== 'spire-gate' });
      }
    }
  }

  const crowns = isCrypt ? [] : placeCrowns(isThicket, s.rx * 31 + s.ry * 17 + 5);
  return { ground, decals, props, overhead, ceiling, interiorWater, warpPads, chimneys, crowns };
}
