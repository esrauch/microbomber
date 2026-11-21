/**
 * Pure multi-tile & 8x8 blob room layout resolver (`ASSETS.md` §2 & §4).
 *
 * Maps any 11x13 `RoomSpec` + live `State` into:
 * - `ground`:   11x13 base terrain BgTiles (grass, curved paths, waterbanks, pit rims,
 *               recessed dungeon floor trim, 2x2 floor medallions, bridge decks)
 * - `props`:    optional overlay BgTiles drawn with index 0 transparent so ground shows
 *               cleanly underneath (crates, fences, balustrades, brambles, braziers,
 *               crystal switches/barriers, buttons, spikes, stairs, landmark walls)
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
  PIT_BLOB,
  STAMP_DEFS,
  WATER_BLOB,
  resolveBlobTile,
} from './gbcArt';
import type { BgPaletteId } from './gbcPalette';

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

  // Authentic LADX / Oracle 2-wide vertical column-run tree tiling (`Top -> Ovl* -> Bot`):
  // Any contiguous vertical run of 2-wide 'YY' rows (height 2, 3, 4, 5...) renders one unbroken
  // canopy stack with a rounded top crown, 0+ overlapping middle crowns, and a rooted trunk base—
  // never leaving a truncated 1-row orphan tree top!
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
      at(x, y) === 'Y';

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
          continue; // 1-row孤立 cells fall back to sculpted mossy boulders
        }
        for (let ry = yStart; ry <= yEnd; ry++) {
          claimedCol.add(`${x},${ry}`);
          claimedCol.add(`${x + 1},${ry}`);
          if (ry === yStart) {
            const northWalkable = ry > 0 && at(x, ry - 1) !== 'Y' && at(x, ry - 1) !== '#';
            treeMap.set(`${x},${ry}`, { tile: BG.treeNW, overhead: northWalkable });
            treeMap.set(`${x + 1},${ry}`, { tile: BG.treeNE, overhead: northWalkable });
          } else if (ry < yEnd) {
            treeMap.set(`${x},${ry}`, { tile: BG.treeOvlW, overhead: false });
            treeMap.set(`${x + 1},${ry}`, { tile: BG.treeOvlE, overhead: false });
          } else {
            treeMap.set(`${x},${ry}`, { tile: BG.treeSW, overhead: false });
            treeMap.set(`${x + 1},${ry}`, { tile: BG.treeSE, overhead: false });
          }
        }
      }
    }
  }

  const ground: PlacedTile[] = [];
  const props: PlacedTile[] = [];
  const overhead: PlacedTile[] = [];
  const ceiling: PlacedTile[] = [];
  const interiorWater: Array<[number, number]> = [];
  const warpPads: Array<{ x: number; y: number; active: boolean }> = [];

  const isWaterCell = (t: Tile): boolean =>
    t === '~' || t === '1' || t === '2' || t === '3' || t === '4';

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

  const isTallCaster = (t: Tile): boolean =>
    t === '#' || t === '%' || t === 'D' || t === 'K' || t === 'S';

  // =========================================================================
  // Pass 1 & 2: Per-Cell Terrain, Mitered Walls, Cliffs, Trees & Props
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
        if (t === '~' && nb.n && nb.s && nb.e && nb.w && nb.nw && nb.ne && nb.sw && nb.se) {
          interiorWater.push([x, y]);
        }
      } else if (isPitLike(x, y)) {
        const nb = makeMask((dx, dy) => isPitLike(x + dx, y + dy));
        ground.push({ x, y, tile: resolveBlobTile(PIT_BLOB, nb) });
      } else if (isCrypt) {
        const inTunnel = x <= 1 || x >= ROOM_W - 2 || y <= 1 || y >= ROOM_H - 2;
        if (inTunnel && t !== '#') {
          const ns = y <= 1 || y >= ROOM_H - 2;
          let tunnelTile = BG.archFloorNS;
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
          ground.push({
            x,
            y,
            tile: resolveBlobTile(CRYPT_FLOOR_BLOB, nb),
            topShadow: castShadow,
          });
        }
      } else {
        // Overworld meadow + organic path blobs
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
      }

      // --- 2. Bridge Decks (`_`) ---
      if (t === '_') {
        const hasW = at(x - 1, y) === '_';
        const hasE = at(x + 1, y) === '_';
        const bTile = !hasW && hasE ? BG.bridgeV_W : hasW && !hasE ? BG.bridgeV_E : BG.bridgeV_Mid;
        props.push({ x, y, tile: bTile, transparentZero: true });
        continue;
      }

      // Skip underlying '#' / 'Y' where a bespoke landmark stamp owns the visual
      if (stampedSolid.has(key) && (t === '#' || t === 'Y')) {
        continue;
      }

      // --- 3. Trees (`Y`) ---
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

      // --- 5. Cracked Walls (`%`), Connected Props & Doors ---
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
        props.push({
          x,
          y,
          tile: recolorQuads(raised ? BG.barrierUp : BG.barrierDown, [col, col, col, col]),
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
        props.push({ x, y, tile: solved ? BG.buttonDown : BG.buttonUp, transparentZero: true });
      } else if (t === '!') {
        props.push({ x, y, tile: BG.spikes, transparentZero: true });
      } else if (t === ',') {
        props.push({ x, y, tile: BG.dryGrass, transparentZero: true, topShadow: castShadow });
      } else if (t === '1' || t === '2' || t === '3' || t === '4') {
        const currentTile =
          t === '1' ? BG.currentN : t === '2' ? BG.currentS : t === '3' ? BG.currentE : BG.currentW;
        props.push({ x, y, tile: currentTile, transparentZero: true });
      } else if (t === 'n' || t === 's' || t === 'e' || t === 'w') {
        const slopeTile =
          t === 'n' ? BG.slopeN : t === 's' ? BG.slopeS : t === 'e' ? BG.slopeE : BG.slopeW;
        props.push({ x, y, tile: slopeTile, topShadow: castShadow });
      } else if (t === '>') {
        const pSpec = room?.portals?.find((p) => p.x === x && p.y === y);
        const midpoint = Boolean(pSpec?.requiresWarpUnlock);
        if (midpoint) {
          const active = s.cryptWarpUnlocked;
          props.push({ x, y, tile: active ? BG.warp0 : BG.warpOff, transparentZero: true });
          warpPads.push({ x, y, active });
        } else {
          props.push({ x, y, tile: BG.stairs, transparentZero: true });
        }
      }
    }
  }

  // --- 6. Centered Shrine Seal Ring on (5, 6) in Open Chambers ---
  if (isCrypt && at(5, 6) === '.' && !room?.portals?.some((p) => p.x === 5 && p.y === 6)) {
    props.push({ x: 5, y: 6, tile: BG.sealRingCenter, transparentZero: true });
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
      } else {
        props.push({ x: tx, y: ty, tile, transparentZero: st.id !== 'spire-gate' });
      }
    }
  }

  return { ground, props, overhead, ceiling, interiorWater, warpPads, chimneys };
}
