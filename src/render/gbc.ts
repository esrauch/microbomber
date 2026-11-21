/**
 * Pure-2D Game Boy Color (GBC) pixel-art renderer inspired by
 * Zelda: Oracle of Ages / Link's Awakening DX.
 *
 * Renders the 9x11 tile room at native 16x16 pixels per tile (144x176 logical px).
 * Every pixel comes from the indexed art in `gbcArt.ts` baked with a palette from
 * `gbcPalette.ts`, so the screen obeys GBC colour rules: 3 colours per sprite, 4 per
 * background quarter-tile, RGB555 throughout.
 */
import type { Bomb, Enemy, NpcSpec, PickupKind, ZoneId } from '../game/types';
import {
  ROOM_H,
  ROOM_W,
  type State,
  type Tile,
  type World,
  computeGhostTargets,
  currentRoom,
  isRoomLit,
  roomKey,
  tileAt,
} from '../game/world';
import { BG, type BgTile, OBJ, type ObjSprite } from './gbcArt';
import {
  BG_PALETTES,
  type BgPaletteId,
  INK_RGB,
  OBJ_PALETTES,
  type ObjPaletteId,
  cssRgb,
} from './gbcPalette';

export const TILE_PX = 16;
export const NATIVE_W = ROOM_W * TILE_PX; // 144 px
export const NATIVE_H = ROOM_H * TILE_PX; // 176 px

export function computeGbcCanvasSize(
  stageWidth: number,
  stageHeight: number,
): { width: number; height: number } {
  const pad = 6;
  const availW = Math.max(NATIVE_W, stageWidth - pad * 2);
  const availH = Math.max(NATIVE_H, stageHeight - pad * 2);
  const fitScale = Math.min(availW / NATIVE_W, availH / NATIVE_H);
  return {
    width: Math.floor(NATIVE_W * fitScale),
    height: Math.floor(NATIVE_H * fitScale),
  };
}

export interface GbcView {
  rebuild(world: World, s: State): void;
  sync(world: World, s: State, time: number): void;
  resize(stageWidth: number, stageHeight: number): void;
}

type ObjName = keyof typeof OBJ;
type BgName = keyof typeof BG;
type Quads = BgTile['quads'];

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** Bake an indexed sprite with one sprite palette (its own unless swapped). */
function bakeObj(sprite: ObjSprite, palId: ObjPaletteId = sprite.pal): HTMLCanvasElement {
  const h = sprite.rows.length;
  const w = sprite.rows[0]?.length ?? 16;
  const [c, ctx] = canvasOf(w, h);
  if (!ctx) return c;
  const pal = OBJ_PALETTES[palId];
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const line = sprite.rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const idx = Number(line[x]);
      const col = idx >= 1 && idx <= 3 ? pal[idx - 1] : undefined;
      if (!col) continue;
      const i = (y * w + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Bake a 16x16 background tile for a zone, one palette per 8x8 quarter. */
function bakeBg(tile: BgTile, zone: ZoneId, quads: Quads = tile.quads): HTMLCanvasElement {
  const [c, ctx] = canvasOf(TILE_PX, TILE_PX);
  if (!ctx) return c;
  const pals = BG_PALETTES[zone];
  const img = ctx.createImageData(TILE_PX, TILE_PX);
  for (let y = 0; y < TILE_PX; y++) {
    const line = tile.rows[y] ?? '';
    for (let x = 0; x < TILE_PX; x++) {
      const palId: BgPaletteId = quads[(y >> 3) * 2 + (x >> 3)] ?? quads[0];
      const col = pals[palId][Number(line[x] ?? 0)] ?? pals[palId][0];
      const i = (y * TILE_PX + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** A floor tile in the shade of a wall above it: its top two rows drop to the dark index. */
function shadowed(tile: BgTile): BgTile {
  return { quads: tile.quads, rows: tile.rows.map((r, y) => (y < 2 ? '2'.repeat(r.length) : r)) };
}

interface BlastInstance {
  x: number;
  y: number;
  kind: 'powder' | 'ember';
  born: number;
}

const UPSCALE = 4;
const INK_CSS = cssRgb(INK_RGB);
const FIRE_LIGHT = cssRgb(OBJ_PALETTES.fire[0]);
const FIRE_MID = cssRgb(OBJ_PALETTES.fire[1]);

export function makeGbcView(canvas: HTMLCanvasElement): GbcView {
  canvas.width = NATIVE_W * UPSCALE;
  canvas.height = NATIVE_H * UPSCALE;
  const displayCtx = canvas.getContext('2d');
  if (!displayCtx) {
    throw new Error('2D display canvas context unavailable');
  }
  displayCtx.imageSmoothingEnabled = false;

  // 144x176 native GBC frame buffer (blitted 4x nearest-neighbor onto display canvas)
  const frameBuf = document.createElement('canvas');
  frameBuf.width = NATIVE_W;
  frameBuf.height = NATIVE_H;
  const mainCtx = frameBuf.getContext('2d');
  if (!mainCtx) {
    throw new Error('2D frame buffer context unavailable');
  }
  mainCtx.imageSmoothingEnabled = false;

  // Static room tile layer (rebuilt on room cuts or tile mutations)
  const roomLayer = document.createElement('canvas');
  roomLayer.width = NATIVE_W;
  roomLayer.height = NATIVE_H;
  const rctx = roomLayer.getContext('2d');
  if (!rctx) {
    throw new Error('2D offscreen room context unavailable');
  }
  rctx.imageSmoothingEnabled = false;

  // Water animation cache so water ripples animate smoothly even between room rebuilds
  let waterCells: Array<[number, number]> = [];
  let warpCells: Array<{ x: number; y: number; active: boolean; midpoint: boolean }> = [];

  // Baked sprite and tile caches (palette swaps bake once per palette)
  const objCache = new Map<string, HTMLCanvasElement>();
  const obj = (name: ObjName, pal?: ObjPaletteId): HTMLCanvasElement => {
    const key = `${name}|${pal ?? ''}`;
    let c = objCache.get(key);
    if (!c) {
      c = bakeObj(OBJ[name], pal);
      objCache.set(key, c);
    }
    return c;
  };
  const bgCache = new Map<string, HTMLCanvasElement>();
  const bgTile = (
    zone: ZoneId,
    name: BgName,
    opts: { quads?: Quads; shade?: boolean } = {},
  ): HTMLCanvasElement => {
    const key = `${zone}|${name}|${opts.quads?.join(',') ?? ''}|${opts.shade ? 1 : 0}`;
    let c = bgCache.get(key);
    if (!c) {
      const tile = opts.shade ? shadowed(BG[name]) : BG[name];
      c = bakeBg(tile, zone, opts.quads);
      bgCache.set(key, c);
    }
    return c;
  };
  const quads = (p: BgPaletteId, bottom: BgPaletteId = p): Quads => [p, p, bottom, bottom];

  const pickupSprite: Record<Exclude<PickupKind, 'ember-bomb'>, ObjName> = {
    'small-key': 'PICKUP_SMALL_KEY',
    'boss-key': 'PICKUP_BOSS_KEY',
    'heart-shard': 'PICKUP_HEART_SHARD',
    'heart-drop': 'PICKUP_HEART_FULL',
    'heart-container': 'PICKUP_HEART_CONTAINER',
    'satchel-upgrade': 'PICKUP_SATCHEL',
    'cinder-core': 'PICKUP_CINDER_CORE',
  };

  // Reusable dark-room lantern pixel mask buffer
  const darkLayer = document.createElement('canvas');
  darkLayer.width = NATIVE_W;
  darkLayer.height = NATIVE_H;
  const darkCtx = darkLayer.getContext('2d');
  const darkImg = darkCtx ? darkCtx.createImageData(NATIVE_W, NATIVE_H) : null;

  // Animation trackers
  let prevX = -1;
  let prevY = -1;
  let prevTime = 0;
  let walkCycle = 0;
  let throwAnimUntil = 0;
  let hurtAnimUntil = 0;
  let holdAnimUntil = 0;
  let heldKind: PickupKind = 'ember-bomb';
  let activeBlasts: BlastInstance[] = [];

  // Sheet layout kept from the original spritesheet, now baked from `gbcArt.ts`
  const SHEET: ObjName[][] = [
    [
      'PIP_SOUTH_IDLE',
      'PIP_SOUTH_WALK1',
      'PIP_SOUTH_WALK2',
      'PIP_SOUTH_THROW',
      'PIP_NORTH_IDLE',
      'PIP_NORTH_WALK1',
      'PIP_NORTH_WALK2',
      'PIP_NORTH_THROW',
    ],
    [
      'PIP_EAST_IDLE',
      'PIP_EAST_WALK1',
      'PIP_EAST_WALK2',
      'PIP_EAST_THROW',
      'PIP_HURT',
      'PIP_HOLD',
      'PIP_EAST_PUSH',
      'SPARKLE_CELL',
    ],
    ['POWDER_1', 'POWDER_2', 'POWDER_3', 'POWDER_4', 'EMBER_1', 'EMBER_2', 'EMBER_3', 'EMBER_4'],
    ['BLAST_1', 'BLAST_2', 'BLAST_3', 'BLAST_4', 'FIRE_1', 'FIRE_2', 'FIRE_3', 'SHADOW'],
  ];

  function drawSheetCell(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    dx: number,
    dy: number,
    flipX = false,
    pal?: ObjPaletteId,
  ): void {
    const name = SHEET[row]?.[col];
    if (!name) return;
    const img = obj(name, pal);
    if (!flipX) {
      ctx.drawImage(img, dx, dy);
    } else {
      ctx.save();
      ctx.translate(dx + TILE_PX, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  }

  /** Background tile for room cell `(x, y)`, with any palette swap it needs. */
  function staticTile(
    world: World,
    s: State,
    x: number,
    y: number,
    solved: boolean,
  ): HTMLCanvasElement {
    const zone = s.zone;
    const isCrypt = zone === 'ember-crypt';
    const room = currentRoom(world, s);
    const t: Tile = tileAt(world, s, zone, s.rx, s.ry, x, y);
    const tall = (v: Tile): boolean =>
      v === '#' || v === '%' || v === 'D' || v === 'K' || v === 'S';

    switch (t) {
      case '~':
        return bgTile(zone, 'water0');
      case '^':
        return bgTile(zone, 'pit');
      case '#': {
        const south = y + 1 < ROOM_H ? tileAt(world, s, zone, s.rx, s.ry, x, y + 1) : '#';
        const open = south !== '#';
        return bgTile(
          zone,
          isCrypt ? (open ? 'wallCrOpen' : 'wallCr') : open ? 'wallOwOpen' : 'wallOw',
        );
      }
      case '%':
        return bgTile(zone, 'cracked');
      case '=':
        return bgTile(zone, 'fence');
      case 'B':
        return bgTile(zone, 'bramble');
      case 'W':
        return bgTile(zone, 'crate');
      case 'R':
      case 'U': {
        const raised = (t === 'R') === (s.crystalColor === 'red');
        return bgTile(zone, raised ? 'barrierUp' : 'barrierDown', {
          quads: quads(t === 'R' ? 'red' : 'blue'),
        });
      }
      case 'C':
        return bgTile(zone, 'switch', {
          quads: quads(s.crystalColor === 'red' ? 'red' : 'blue', 'steel'),
        });
      case 'T': {
        const order = room?.torches?.find((ts) => ts.x === x && ts.y === y)?.order ?? 0;
        return bgTile(
          zone,
          order === 1
            ? 'brazier1'
            : order === 2
              ? 'brazier2'
              : order >= 3
                ? 'brazier3'
                : 'brazier0',
        );
      }
      case 'D':
        return bgTile(zone, 'doorKey');
      case 'K':
        return bgTile(zone, 'doorBoss');
      case 'S':
        return bgTile(zone, 'shutter');
      case 'O':
        return bgTile(zone, solved ? 'buttonDown' : 'buttonUp');
      case '!':
        return bgTile(zone, 'spikes');
      case '>': {
        const pSpec = room?.portals?.find((p) => p.x === x && p.y === y);
        if (!pSpec?.requiresWarpUnlock) return bgTile(zone, 'stairs');
        return s.cryptWarpUnlocked
          ? bgTile(zone, 'warp0')
          : bgTile(zone, 'warp0', { quads: quads('steel') });
      }
      default: {
        const hash = (x * 37 + y * 91) & 15;
        const name: BgName = isCrypt
          ? hash < 4
            ? 'flagCrack'
            : 'flagPlain'
          : hash < 5
            ? 'grassTuft'
            : hash === 7
              ? 'grassFlower'
              : 'grassPlain';
        const shade = y > 0 && tall(tileAt(world, s, zone, s.rx, s.ry, x, y - 1));
        return bgTile(zone, name, { shade });
      }
    }
  }

  function drawReticle(
    ctx: CanvasRenderingContext2D,
    tx: number,
    ty: number,
    color: string,
    dashed: boolean,
    pulsePhase: number,
  ): void {
    const px = tx * TILE_PX + (pulsePhase ? 1 : 0);
    const py = ty * TILE_PX + (pulsePhase ? 1 : 0);
    const size = pulsePhase ? 14 : 16;
    ctx.fillStyle = INK_CSS;
    // Corner brackets with 1px dark outline for readability on any tile
    const corners: Array<[number, number]> = [
      [px, py],
      [px + size - 4, py],
      [px, py + size - 4],
      [px + size - 4, py + size - 4],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(cx, cy, 4, 4);
    }
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, 3, 1);
    ctx.fillRect(px + 1, py + 1, 1, 3);
    ctx.fillRect(px + size - 4, py + 1, 3, 1);
    ctx.fillRect(px + size - 2, py + 1, 1, 3);
    ctx.fillRect(px + 1, py + size - 2, 3, 1);
    ctx.fillRect(px + 1, py + size - 4, 1, 3);
    ctx.fillRect(px + size - 4, py + size - 2, 3, 1);
    ctx.fillRect(px + size - 2, py + size - 4, 1, 3);
    if (!dashed) {
      // Throw landing crosshair center dot
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(tx * TILE_PX + 6, ty * TILE_PX + 6, 4, 4);
      ctx.fillStyle = color;
      ctx.fillRect(tx * TILE_PX + 7, ty * TILE_PX + 7, 2, 2);
    }
  }

  function drawNpc(ctx: CanvasRenderingContext2D, npc: NpcSpec, time: number): void {
    const dx = Math.round(npc.x * TILE_PX - 8);
    const bob = npc.id === 'spire-plaque' ? 0 : Math.floor(time * 2) % 2;
    const dy = Math.round(npc.y * TILE_PX - 10) + bob;
    const name: ObjName =
      npc.id === 'spire-plaque' ? 'NPC_PLAQUE' : npc.id.includes('mira') ? 'NPC_MIRA' : 'NPC_ELDER';
    ctx.drawImage(obj(name), dx, dy);
  }

  function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
    // Hit flash is a palette swap, as on the GBC: alternate frames in the red palette
    const pal: ObjPaletteId | undefined =
      e.invulnTimer > 0 && Math.floor(time * 20) % 2 === 0 ? 'red' : undefined;
    const frame = Math.floor(time * 6 + e.id) % 2;
    if (e.kind === 'slime') {
      const img = obj(frame ? 'SLIME_2' : 'SLIME_1', pal);
      ctx.drawImage(img, Math.round(e.x * TILE_PX - 8), Math.round(e.y * TILE_PX - 8));
    } else if (e.kind === 'bat') {
      const flap = Math.floor(time * 12 + e.id) % 2;
      const bob = Math.round(Math.sin(time * 8 + e.id) * 1.5);
      const img = obj(flap ? 'BAT_2' : 'BAT_1', pal);
      ctx.drawImage(img, Math.round(e.x * TILE_PX - 8), Math.round(e.y * TILE_PX - 10 + bob));
    } else if (e.kind === 'shielder') {
      const dx = Math.round(e.x * TILE_PX - 8);
      const dy = Math.round(e.y * TILE_PX - 9);
      ctx.drawImage(obj(frame ? 'SHIELDER_2' : 'SHIELDER_1', pal), dx, dy);
      if (e.armored) {
        if (Math.abs(e.fx) > Math.abs(e.fy)) {
          const sx = e.fx > 0 ? dx + 11 : dx - 1;
          ctx.drawImage(obj('WOOD_SHIELD_V', pal), sx, dy + 3);
        } else {
          const sy = e.fy > 0 ? dy + 9 : dy - 1;
          ctx.drawImage(obj('WOOD_SHIELD_H', pal), dx + 2, sy);
        }
      }
    } else if (e.kind === 'wickgeist') {
      const bob = Math.round(Math.sin(time * 5) * 2);
      const dx = Math.round(e.x * TILE_PX - 12);
      const dy = Math.round(e.y * TILE_PX - 13) + bob;
      ctx.drawImage(obj(e.armored ? 'WICKGEIST_DARK' : 'WICKGEIST_LIT', pal), dx, dy);
    } else if (e.kind === 'cinderhull') {
      const dx = Math.round(e.x * TILE_PX - 12);
      const dy = Math.round(e.y * TILE_PX - 12);
      ctx.drawImage(obj(e.armored ? 'CINDERHULL_ARMORED' : 'CINDERHULL_EXPOSED', pal), dx, dy);
    }
  }

  function drawPickupSprite(
    ctx: CanvasRenderingContext2D,
    kind: PickupKind,
    dx: number,
    dy: number,
    time: number,
  ): void {
    if (kind === 'ember-bomb' || kind === 'cinder-core') {
      if (Math.floor(time * 6) % 2 === 0) {
        drawSheetCell(ctx, 7, 1, dx, dy);
      }
    }
    if (kind === 'ember-bomb') {
      drawSheetCell(ctx, 4 + (Math.floor(time * 5) % 2), 2, dx, dy);
      return;
    }
    ctx.drawImage(obj(pickupSprite[kind]), dx, dy);
  }

  /** A live bomb's fuse frame; Blackpowder's last-second swell flashes red (a palette swap). */
  function drawBomb(
    ctx: CanvasRenderingContext2D,
    b: Bomb,
    dx: number,
    dy: number,
    time: number,
  ): void {
    const frame =
      b.fuse > 0.55
        ? Math.floor(time * 10) % 2
        : b.fuse > 0.2
          ? 1 + (Math.floor(time * 16) % 2)
          : 2 + (Math.floor(time * 24) % 2);
    const pal = b.kind === 'powder' && frame === 2 ? 'red' : undefined;
    drawSheetCell(ctx, (b.kind === 'ember' ? 4 : 0) + frame, 2, dx, dy, false, pal);
  }

  function drawPip(ctx: CanvasRenderingContext2D, s: State, time: number): void {
    if (s.invulnTimer > 0 && Math.floor(time * 18) % 2 === 0) return;

    const dx = Math.round(s.x * TILE_PX - 8);
    const dy = Math.round(s.y * TILE_PX - 10);
    // Subtle ground shadow under Pip
    drawSheetCell(ctx, 7, 3, dx, dy + 1);

    if (time < holdAnimUntil) {
      drawSheetCell(ctx, 5, 1, dx, dy);
      drawPickupSprite(ctx, heldKind, dx, dy - 13, time);
      return;
    }
    if (time < hurtAnimUntil) {
      drawSheetCell(ctx, 4, 1, dx, dy);
      return;
    }
    // Holding a bomb overhead, Zelda-style, until its button is released
    const carried = s.bombs.find((b) => b.carriedBy !== undefined);
    if (carried) {
      drawSheetCell(ctx, 5, 1, dx, dy);
      drawBomb(ctx, carried, dx, dy - 12, time);
      return;
    }

    const pushing = s.blocks.some((b) => b.pushCharge > 0.04);
    const throwing = time < throwAnimUntil;
    const stepIdx = Math.floor(walkCycle) % 4; // 0: idle, 1: walk1, 2: idle, 3: walk2
    const frameOffset = throwing ? 3 : stepIdx === 1 ? 1 : stepIdx === 3 ? 2 : 0;

    if (s.aimX !== 0) {
      const flipWest = s.aimX < 0;
      if (pushing && !throwing) {
        drawSheetCell(ctx, 6, 1, dx, dy, flipWest);
      } else {
        drawSheetCell(ctx, frameOffset, 1, dx, dy, flipWest);
      }
    } else if (s.aimY < 0) {
      drawSheetCell(ctx, 4 + frameOffset, 0, dx, dy);
    } else {
      drawSheetCell(ctx, frameOffset, 0, dx, dy);
    }
  }

  function applyDarkRoomMask(ctx: CanvasRenderingContext2D, s: State): void {
    if (!darkCtx || !darkImg) return;
    const lights: Array<{ x: number; y: number; r: number }> = [
      { x: s.x * TILE_PX, y: s.y * TILE_PX - 2, r: 30 },
    ];
    for (const f of s.fires) {
      lights.push({ x: (f.x + 0.5) * TILE_PX, y: (f.y + 0.5) * TILE_PX, r: 26 });
    }
    for (const b of s.bombs) {
      if (b.kind === 'ember') {
        lights.push({ x: b.x * TILE_PX, y: b.y * TILE_PX, r: 20 });
      }
    }

    const data = darkImg.data;
    for (let py = 0; py < NATIVE_H; py++) {
      for (let px = 0; px < NATIVE_W; px++) {
        let minRatio = 99;
        for (const l of lights) {
          const d = Math.hypot(px - l.x, py - l.y) / l.r;
          if (d < minRatio) minRatio = d;
        }
        // Opaque ink dither only: the GBC has no alpha blending
        let ink = true;
        if (minRatio < 0.78) {
          ink = false;
        } else if (minRatio < 1.02) {
          ink = (px + py) % 2 === 0 && (px & 1) === 0; // sparse 1-in-4 dither ring
        } else if (minRatio < 1.24) {
          ink = (px + py) % 2 === 0; // checkerboard
        }
        const alpha = ink ? 255 : 0;
        const idx = (py * NATIVE_W + px) * 4;
        data[idx] = INK_RGB[0];
        data[idx + 1] = INK_RGB[1];
        data[idx + 2] = INK_RGB[2];
        data[idx + 3] = alpha;
      }
    }
    darkCtx.putImageData(darkImg, 0, 0);
    ctx.drawImage(darkLayer, 0, 0);
  }

  return {
    rebuild(world: World, s: State): void {
      waterCells = [];
      warpCells = [];
      activeBlasts = [];
      const room = currentRoom(world, s);
      const solved = s.roomSolved || s.solvedRooms.has(roomKey(s.zone, s.rx, s.ry));

      for (let y = 0; y < ROOM_H; y++) {
        for (let x = 0; x < ROOM_W; x++) {
          const t = tileAt(world, s, s.zone, s.rx, s.ry, x, y);
          if (t === '~') waterCells.push([x, y]);
          if (t === '>') {
            const pSpec = room?.portals?.find((p) => p.x === x && p.y === y);
            const midpoint = Boolean(pSpec?.requiresWarpUnlock);
            warpCells.push({
              x,
              y,
              midpoint,
              active: !midpoint || s.cryptWarpUnlocked,
            });
          }
          rctx.drawImage(staticTile(world, s, x, y, solved), x * TILE_PX, y * TILE_PX);
        }
      }
    },

    sync(world: World, s: State, time: number): void {
      const dt = prevTime > 0 ? Math.min(0.05, Math.max(0, time - prevTime)) : 0.016;
      prevTime = time;

      // Advance Pip walk animation from actual position delta
      const movedDist = prevX >= 0 ? Math.hypot(s.x - prevX, s.y - prevY) : 0;
      prevX = s.x;
      prevY = s.y;
      if (movedDist > 0.004 && movedDist < 1.2) {
        walkCycle += movedDist * 5.2;
      } else if (s.blocks.some((b) => b.pushCharge > 0.04)) {
        walkCycle += dt * 9;
      } else {
        walkCycle = 0;
      }

      // Trigger one-shot Pip pose reactions from simulation frame events
      for (const ev of s.events) {
        if (ev === 'bomb-drop' || ev === 'bomb-throw') {
          throwAnimUntil = time + 0.16;
        } else if (ev === 'player-hit' || ev === 'pit-fall') {
          hurtAnimUntil = time + 0.28;
        } else if (
          ev === 'pickup-ember-bomb' ||
          ev === 'pickup-boss-key' ||
          ev === 'pickup-heart-container' ||
          ev === 'pickup-satchel-upgrade' ||
          ev === 'pickup-cinder-core'
        ) {
          holdAnimUntil = time + 0.85;
          heldKind = ev.replace('pickup-', '') as PickupKind;
        }
      }

      // Spawn new GBC explosion puffs
      for (const b of s.blasts) {
        activeBlasts.push({ x: b.x, y: b.y, kind: b.kind, born: time });
      }
      activeBlasts = activeBlasts.filter((b) => time - b.born < 0.28);

      // 1. Blit static room tiles + animated water/warp tiles
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.drawImage(roomLayer, 0, 0);
      const waterPhase = Math.floor(time * 2.2) % 2;
      for (const [wx, wy] of waterCells) {
        mainCtx.drawImage(
          bgTile(s.zone, waterPhase ? 'water1' : 'water0'),
          wx * TILE_PX,
          wy * TILE_PX,
        );
      }
      for (const wc of warpCells) {
        if (wc.midpoint && wc.active) {
          mainCtx.drawImage(
            bgTile(s.zone, waterPhase ? 'warp1' : 'warp0'),
            wc.x * TILE_PX,
            wc.y * TILE_PX,
          );
        }
      }

      // 2. Ghost Drop & Throw landing reticles (`GAME.md` §2)
      const { dropTile, throwTile } = computeGhostTargets(world, s);
      // The drop marker always shows; the throw marker only while a bomb is held overhead
      const carried = s.bombs.find((b) => b.carriedBy !== undefined);
      const isEmber = carried?.kind === 'ember';
      const pulse = Math.floor(time * 5) % 2;
      if (!carried) drawReticle(mainCtx, dropTile[0], dropTile[1], FIRE_LIGHT, true, pulse);
      if (carried && (throwTile[0] !== dropTile[0] || throwTile[1] !== dropTile[1])) {
        drawReticle(
          mainCtx,
          throwTile[0],
          throwTile[1],
          isEmber ? FIRE_MID : FIRE_LIGHT,
          false,
          pulse,
        );
      }

      // 3. Burning Ember hearth patches (drawn on floor before Y-sorted actors)
      for (const f of s.fires) {
        const fIdx = Math.floor(time * 12 + f.x * 3 + f.y * 5) % 3;
        drawSheetCell(mainCtx, 4 + fIdx, 3, f.x * TILE_PX, f.y * TILE_PX);
      }

      // 4. Y-sorted ground actors (NPCs, PushBlocks, Lit Brazier Flames, Pickups, Grounded Bombs, Enemies, Pip)
      interface Drawable {
        footY: number;
        draw: () => void;
      }
      const actors: Drawable[] = [];
      const room = currentRoom(world, s);

      for (const npc of room?.npcs ?? []) {
        actors.push({
          footY: npc.y,
          draw: () => drawNpc(mainCtx, npc, time),
        });
      }

      for (const blk of s.blocks) {
        const nudge = blk.pushCharge > 0.05 ? 1 : 0;
        const px = blk.x * TILE_PX + blk.pushDirX * nudge;
        const py = blk.y * TILE_PX + blk.pushDirY * nudge;
        actors.push({
          footY: blk.y + 0.5,
          draw: () => mainCtx.drawImage(bgTile(s.zone, 'pushBlock'), px, py),
        });
      }

      for (const t of s.torches) {
        if (!t.lit) continue;
        const fast = Boolean(t.timedSeconds && !s.roomSolved && t.timer < 2.0);
        const rate = fast ? 20 : 11;
        const fIdx = Math.floor(time * rate + t.x * 2 + t.y) % 3;
        actors.push({
          footY: t.y + 0.55,
          draw: () => {
            if (fast && Math.floor(time * 16) % 4 === 0) return;
            drawSheetCell(mainCtx, 4 + fIdx, 3, t.x * TILE_PX, t.y * TILE_PX - 5);
          },
        });
      }

      for (const p of s.pickups) {
        const bob = Math.round(Math.sin(time * 4.5 + p.x) * 1.5);
        const dx = Math.round(p.x * TILE_PX - 8);
        const dy = Math.round(p.y * TILE_PX - 9) + bob;
        actors.push({
          footY: p.y,
          draw: () => {
            drawSheetCell(mainCtx, 7, 3, dx, Math.round(p.y * TILE_PX - 8));
            drawPickupSprite(mainCtx, p.kind, dx, dy, time);
          },
        });
      }

      for (const b of s.bombs) {
        if (b.flight || b.carriedBy !== undefined) continue;
        actors.push({
          footY: b.y,
          draw: () =>
            drawBomb(
              mainCtx,
              b,
              Math.round(b.x * TILE_PX - 8),
              Math.round(b.y * TILE_PX - 9),
              time,
            ),
        });
      }

      for (const e of s.enemies) {
        actors.push({
          footY: e.y,
          draw: () => drawEnemy(mainCtx, e, time),
        });
      }

      actors.push({
        footY: s.y,
        draw: () => drawPip(mainCtx, s, time),
      });

      actors.sort((a, b) => a.footY - b.footY);
      for (const a of actors) a.draw();

      // 5. Airborne thrown bombs (shadow on ground + parabolic sprite arc overhead)
      for (const b of s.bombs) {
        if (!b.flight) continue;
        const u = Math.min(1, b.flight.elapsed / b.flight.duration);
        const arcPx = Math.round(4 * 14 * u * (1 - u));
        const gx = Math.round(b.x * TILE_PX - 8);
        const gy = Math.round(b.y * TILE_PX - 8);
        drawSheetCell(mainCtx, 7, 3, gx, gy);
        const baseCol = b.kind === 'ember' ? 4 : 0;
        const frame = Math.floor(time * 12) % 2;
        drawSheetCell(mainCtx, baseCol + frame, 2, gx, gy - 1 - arcPx);
      }

      // 6. Enemy projectiles
      for (const pr of s.projectiles) {
        mainCtx.drawImage(
          obj('PROJ_1'),
          Math.round(pr.x * TILE_PX - 4),
          Math.round(pr.y * TILE_PX - 4),
        );
      }

      // 7. GBC 4-frame explosion puffs
      for (const bl of activeBlasts) {
        const age = time - bl.born;
        const frame = Math.min(3, Math.floor((age / 0.28) * 4));
        drawSheetCell(
          mainCtx,
          frame,
          3,
          Math.round(bl.x * TILE_PX - 8),
          Math.round(bl.y * TILE_PX - 8),
        );
      }

      // 8. Dark-room Bayer-dithered lantern mask (`Lantern Hall` / `Wickgeist`)
      if (room?.dark && !isRoomLit(world, s)) {
        applyDarkRoomMask(mainCtx, s);
      }

      // 9. Crisp 4x nearest-neighbor blit to display canvas
      displayCtx.imageSmoothingEnabled = false;
      displayCtx.clearRect(0, 0, canvas.width, canvas.height);
      displayCtx.drawImage(frameBuf, 0, 0, canvas.width, canvas.height);
    },

    resize(stageWidth: number, stageHeight: number): void {
      const { width, height } = computeGbcCanvasSize(stageWidth, stageHeight);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    },
  };
}
