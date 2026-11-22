/**
 * 4-Pass Pure-2D Game Boy Color renderer (`ASSETS.md` §1–§4):
 * - Pass 1 & 2 (`roomLayer`): Seamless 8x8 blob ground, curved waterbanks, pit rims,
 *   2-tile mitered Shrine walls, 2-tall cliffs, 2x2 trees, connected props & building bases.
 * - Pass 3: Y-sorted 6-colour actors (Pip 16x18, Villagers, Bombs, 24x24 Wickgeist, 32x32 Cinderhull).
 * - Pass 4 (`canopyLayer`): Overhead roof eaves, tree crowns & north doorway arch lintels,
 *   chimney puffs, airborne bombs, connected '+' cross explosions, and Bayer lantern mask.
 */
import type { BlastShape, Bomb, Enemy, NpcSpec, PickupKind, WindGust, ZoneId } from '../game/types';
import {
  ROLL_DURATION,
  ROOM_H,
  ROOM_W,
  type State,
  type World,
  currentRoom,
  isShallowWaterTile,
  isWaterTile,
  tileAt,
  windVectorAt,
} from '../game/world';
import { BG, type BgTile, OBJ, type ObjSprite, type ObjSpriteName } from './gbcArt';
import { bakeAux, bakeTileEmissiveAux } from './gbcAux';
import { CROWN_H, CROWN_VARIANTS, CROWN_W } from './thicketCrowns';
import { type PlacedTile, type RoomRenderPlan, buildRoomLayout } from './gbcAutotile';
import {
  BG_PALETTES,
  type BgPaletteId,
  INK_RGB,
  OBJ_PALETTES,
  type ObjPaletteId,
  cssRgb,
} from './gbcPalette';

export const TILE_PX = 16;
export const NATIVE_W = ROOM_W * TILE_PX; // 176 px (11 tiles)
export const NATIVE_H = ROOM_H * TILE_PX; // 208 px (13 tiles)

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

export type DepthActorKind =
  | 'pip'
  | 'slime'
  | 'mini-slime'
  | 'bat'
  | 'shielder'
  | 'wickgeist'
  | 'cinderhull'
  | 'bomb'
  | 'pickup'
  | 'npc'
  | 'block'
  | 'prop'
  | 'torchFlame'
  | 'overhead'
  | 'microVfx';

export interface DepthSortable {
  footY: number;
  orderTie: number;
}

/**
 * Ground-contact Y (in tiles) used to depth-sort actors, bombs, and 3/4 props.
 * Always uses the entity's ground footprint `(x, y)` rather than airborne `y - z` so
 * a bomb or enemy north of Pip never sorts on top of Pip's head mid-hop.
 */
export function actorFootY(kind: DepthActorKind, y: number): number {
  switch (kind) {
    case 'mini-slime':
      return y + 0.32;
    case 'pickup':
      return y + 0.34;
    case 'bat':
      return y + 0.35;
    case 'bomb':
    case 'slime':
      return y + 0.36;
    case 'pip':
    case 'shielder':
    case 'npc':
      return y + 0.38;
    case 'wickgeist':
      return y + 0.42;
    case 'cinderhull':
      return y + 0.85;
    case 'microVfx':
      return y + 0.3;
    case 'prop':
      return y + 0.9;
    case 'torchFlame':
      return y + 0.91;
    case 'block':
      return y + 0.92;
    case 'overhead':
      return y + 0.99;
  }
}

/** Deterministic foot-position depth sort (`6.4`). */
export function sortDepthItems<T extends DepthSortable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.footY - b.footY || a.orderTie - b.orderTie);
}

/**
 * Height-aware contact shadow metrics (`6.4`): shrinks and softens smoothly as an actor
 * or hopping bomb rises above the floor (`heightTiles >= 0`).
 */
export function computeShadowMetrics(
  baseRadiusPx: number,
  heightTiles: number,
): { rx: number; ry: number; alpha: number } {
  const h = Math.max(0, heightTiles);
  const scale = 1 / (1 + h * 1.35);
  return {
    rx: Math.max(2, Math.round(baseRadiusPx * scale)),
    ry: Math.max(1, Math.round(baseRadiusPx * 0.46 * scale)),
    alpha: Math.max(0.14, 0.44 * scale),
  };
}

/**
 * Composes each frame offscreen at native resolution: the albedo pass and its sprite
 * G-buffer. The PixiJS view (`hd/hdView.ts`) lights and presents them.
 */
export interface GbcView {
  rebuild(world: World, s: State): void;
  sync(world: World, s: State, time: number): void;
  /** The native-resolution composed frame (albedo). */
  readonly frame: HTMLCanvasElement;
  /** The matching sprite G-buffer (`gbcAux.ts`): hero heights, emissive, occluders. */
  readonly aux: HTMLCanvasElement;
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** Bake an indexed 6-colour sprite with its palette (or an override palette for hit/swell flashes). */
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
      const col = idx >= 1 && idx <= 6 ? pal[idx - 1] : undefined;
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

/** Bake a 16x16 background tile for a zone, one 4-colour palette per 8x8 quarter. */
function bakeBg(
  tile: BgTile,
  zone: ZoneId,
  transparentZero = false,
  topShadow = false,
): HTMLCanvasElement {
  const [c, ctx] = canvasOf(TILE_PX, TILE_PX);
  if (!ctx) return c;
  const pals = BG_PALETTES[zone];
  const img = ctx.createImageData(TILE_PX, TILE_PX);
  for (let y = 0; y < TILE_PX; y++) {
    const line = tile.rows[y] ?? '';
    for (let x = 0; x < TILE_PX; x++) {
      const idx = Number(line[x] ?? 0);
      if (transparentZero && idx === 0) continue;
      const palId: BgPaletteId = tile.quads[(y >> 3) * 2 + (x >> 3)] ?? tile.quads[0];
      const shadeIdx = topShadow && y < 2 && idx < 3 ? Math.min(3, idx + 1) : idx;
      const col = pals[palId][shadeIdx] ?? pals[palId][0];
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

const hudUrlCache = new Map<string, string>();

/** Bake a crisp nearest-neighbour PNG data URL from any OBJ sprite for HUD & control buttons. */
export function hudIconDataUrl(name: ObjSpriteName, scale = 2): string {
  const key = `${name}@${scale}`;
  const cached = hudUrlCache.get(key);
  if (cached) return cached;
  const base = bakeObj(OBJ[name]);
  const [c, ctx] = canvasOf(base.width * scale, base.height * scale);
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, c.width, c.height);
  const url = c.toDataURL();
  hudUrlCache.set(key, url);
  return url;
}

interface BlastInstance {
  x: number;
  y: number;
  kind: 'bomb' | 'fire';
  shape: BlastShape;
  born: number;
}

interface BlockTween {
  targetX: number;
  targetY: number;
  fromX: number;
  fromY: number;
  startTime: number;
}

interface DoorTween {
  x: number;
  y: number;
  tile: 'D' | 'K' | 'S';
  startTime: number;
}

interface BombKinSnapshot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  shoveCount: number;
  kind: 'bomb' | 'fire';
}

interface MicroVfxInstance {
  kind: 'splash' | 'swallow';
  bombKind: 'bomb' | 'fire';
  x: number;
  y: number;
  born: number;
}

function easeOutCubic(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return 1 - (1 - u) ** 3;
}

function easeOutBack(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
}

const INK_CSS = cssRgb(INK_RGB);
const FIRE_WHITE = cssRgb(OBJ_PALETTES.fire[0]);
const FIRE_LIGHT = cssRgb(OBJ_PALETTES.fire[1]);

export function makeGbcView(): GbcView {
  const [frameBuf, mainCtx] = canvasOf(NATIVE_W, NATIVE_H);
  const [roomLayer, rctx] = canvasOf(NATIVE_W, NATIVE_H);
  const [canopyLayer, cctx] = canvasOf(NATIVE_W, NATIVE_H);
  if (!mainCtx || !rctx || !cctx) {
    throw new Error('2D offscreen canvas context unavailable');
  }
  mainCtx.imageSmoothingEnabled = false;
  rctx.imageSmoothingEnabled = false;
  cctx.imageSmoothingEnabled = false;

  // Sprite G-buffer for HD-2D lighting, drawn in step with mainCtx (`gbcAux.ts`)
  const [auxBuf, maybeAuxCtx] = canvasOf(NATIVE_W, NATIVE_H);
  if (!maybeAuxCtx) {
    throw new Error('2D aux canvas context unavailable');
  }
  const auxCtx = maybeAuxCtx;
  auxCtx.imageSmoothingEnabled = false;
  const auxCache = new Map<ObjSpriteName, HTMLCanvasElement>();
  const iceAux = bakeTileEmissiveAux('ice');
  const getAux = (name: ObjSpriteName): HTMLCanvasElement => {
    let c = auxCache.get(name);
    if (!c) {
      c = bakeAux(name);
      auxCache.set(name, c);
    }
    return c;
  };

  // Sprite & tile caches
  const objCache = new Map<string, HTMLCanvasElement>();
  const getObj = (name: ObjSpriteName, pal?: ObjPaletteId): HTMLCanvasElement => {
    const key = `${name}|${pal ?? ''}`;
    let c = objCache.get(key);
    if (!c) {
      c = bakeObj(OBJ[name], pal);
      objCache.set(key, c);
    }
    return c;
  };

  // Tiles are looked up by object first (props and overheads are drawn every frame), and only
  // on a miss by content, so freshly composed blob tiles with the same pixels share one bake
  const bgCache = new Map<string, HTMLCanvasElement>();
  const bgByTile = new WeakMap<BgTile, Map<ZoneId, HTMLCanvasElement[]>>();
  const getPlacedBg = (zone: ZoneId, p: PlacedTile): HTMLCanvasElement => {
    const variant = (p.transparentZero ? 1 : 0) + (p.topShadow ? 2 : 0);
    let byZone = bgByTile.get(p.tile);
    if (!byZone) {
      byZone = new Map();
      bgByTile.set(p.tile, byZone);
    }
    let variants = byZone.get(zone);
    if (!variants) {
      variants = [];
      byZone.set(zone, variants);
    }
    const hit = variants[variant];
    if (hit) return hit;
    const sig = `${zone}|${p.tile.quads.join(',')}|${variant}|${p.tile.rows.join('')}`;
    let c = bgCache.get(sig);
    if (!c) {
      c = bakeBg(p.tile, zone, Boolean(p.transparentZero), Boolean(p.topShadow));
      bgCache.set(sig, c);
    }
    variants[variant] = c;
    return c;
  };

  // Thicket crowns baked per zone from indexed art (`thicketCrowns.ts`), '.' transparent
  const crownCache = new Map<string, HTMLCanvasElement>();
  const getCrown = (zone: ZoneId, variant: number): HTMLCanvasElement => {
    const key = `${zone}|${variant}`;
    let c = crownCache.get(key);
    if (!c) {
      const rows = CROWN_VARIANTS[variant] ?? CROWN_VARIANTS[0] ?? [];
      const [canvasEl, ctx] = canvasOf(CROWN_W, CROWN_H);
      if (ctx) {
        const pal = BG_PALETTES[zone].foliage;
        const img = ctx.createImageData(CROWN_W, CROWN_H);
        rows.forEach((row, y) => {
          [...row].forEach((ch, x) => {
            if (ch === '.') return;
            const col = pal[Number(ch)];
            if (!col) return;
            const i = (y * CROWN_W + x) * 4;
            img.data[i] = col[0];
            img.data[i + 1] = col[1];
            img.data[i + 2] = col[2];
            img.data[i + 3] = 255;
          });
        });
        ctx.putImageData(img, 0, 0);
      }
      c = canvasEl;
      crownCache.set(key, c);
    }
    return c;
  };

  let plan: RoomRenderPlan = {
    crowns: [],
    ground: [],
    decals: [],
    props: [],
    overhead: [],
    ceiling: [],
    interiorWater: [],
    warpPads: [],
    chimneys: [],
  };

  // Animation & snappy motion trackers
  let activeRoomKey = '';
  let prevX = -1;
  let prevY = -1;
  let prevTime = 0;
  let lastMoveTime = -1;
  let moveStartTime = 0;
  let isMoving = false;
  let isPushingBlock = false;
  // Fuse mouse posture: was he galloping last frame, and until when he crouches
  let mouseWasMoving = false;
  let mouseCrouchUntil = 0;
  let throwAnimUntil = 0;
  let crouchAnimUntil = 0;
  let wasRolling = false;
  let rollLandUntil = 0;
  let fallAnimUntil = 0;
  let holdAnimUntil = 0;
  let warpAnimUntil = 0;
  let iceStormUntil = 0;
  let heldKind: PickupKind = 'fire-bomb';
  let activeBlasts: BlastInstance[] = [];
  let activeScorches: Array<{ x: number; y: number; born: number }> = [];
  let activeMicroVfx: MicroVfxInstance[] = [];
  const bombLandUntil = new Map<number, number>();
  const bombPrevKin = new Map<number, BombKinSnapshot>();
  const bombRollPhase = new Map<number, number>();
  const blockTweens = new Map<number, BlockTween>();
  const pickupSpawnTime = new Map<string, number>();
  const pickupPrevPos = new Map<string, { x: number; y: number }>();
  const closedDoors = new Map<string, { x: number; y: number; tile: 'D' | 'K' | 'S' }>();
  let openingDoors: DoorTween[] = [];
  let lastBurnedCount = -1;
  // Room facts the frame loop needs, gathered on rebuild (tiles only change through a rebuild)
  // Water cells with their G-buffer tag rect: flush against water neighbours so reflections
  // see one continuous surface, inset 2 px on shore sides to spare the bank's rim
  let waterCells: {
    x: number;
    y: number;
    shallow: boolean;
    rect: [number, number, number, number];
  }[] = [];
  let groundedProps: PlacedTile[] = [];
  let lastBrokenCount = -1;

  function syncDoorState(world: World, s: State, reset: boolean): void {
    if (reset) {
      closedDoors.clear();
      openingDoors = [];
    } else {
      for (const [key, d] of closedDoors) {
        const nowTile = tileAt(world, s, s.zone, s.rx, s.ry, d.x, d.y);
        if (nowTile !== d.tile) {
          closedDoors.delete(key);
          openingDoors.push({ x: d.x, y: d.y, tile: d.tile, startTime: -1 });
        }
      }
    }
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const t = tileAt(world, s, s.zone, s.rx, s.ry, x, y);
        if (t === 'D' || t === 'K' || t === 'S') {
          closedDoors.set(`${x},${y}`, { x, y, tile: t });
        }
      }
    }
  }

  /** Overhead art drawn over actors hides them from the G-buffer too. */
  function eraseAux(img: HTMLCanvasElement, dx: number, dy: number): void {
    auxCtx.save();
    auxCtx.globalCompositeOperation = 'destination-out';
    auxCtx.drawImage(img, dx, dy);
    auxCtx.restore();
  }

  function drawObjSprite(
    ctx: CanvasRenderingContext2D,
    name: ObjSpriteName,
    dx: number,
    dy: number,
    flipX = false,
    pal?: ObjPaletteId,
  ): void {
    const blit = (c: CanvasRenderingContext2D, img: HTMLCanvasElement): void => {
      if (!flipX) {
        c.drawImage(img, dx, dy);
      } else {
        c.save();
        c.translate(dx + img.width, dy);
        c.scale(-1, 1);
        c.drawImage(img, 0, 0);
        c.restore();
      }
    };
    blit(ctx, getObj(name, pal));
    if (ctx === mainCtx) blit(auxCtx, getAux(name));
  }

  function drawScaledSprite(
    ctx: CanvasRenderingContext2D,
    name: ObjSpriteName,
    dx: number,
    dy: number,
    sx: number,
    sy: number,
    flipX = false,
    pal?: ObjPaletteId,
    tiltRad = 0,
  ): void {
    if (Math.abs(sx - 1) < 0.005 && Math.abs(sy - 1) < 0.005 && Math.abs(tiltRad) < 0.005) {
      drawObjSprite(ctx, name, dx, dy, flipX, pal);
      return;
    }
    const blit = (c: CanvasRenderingContext2D, img: HTMLCanvasElement): void => {
      c.save();
      c.imageSmoothingEnabled = false;
      c.translate(dx + img.width * 0.5, dy + img.height);
      if (tiltRad !== 0) c.rotate(tiltRad);
      c.scale(flipX ? -sx : sx, sy);
      c.drawImage(img, -img.width * 0.5, -img.height);
      c.restore();
    };
    blit(ctx, getObj(name, pal));
    if (ctx === mainCtx) blit(auxCtx, getAux(name));
  }

  function drawRotatedObj(
    ctx: CanvasRenderingContext2D,
    name: ObjSpriteName,
    dx: number,
    dy: number,
    quarterTurns: number,
  ): void {
    const blit = (c: CanvasRenderingContext2D, img: HTMLCanvasElement): void => {
      if (quarterTurns === 0) {
        c.drawImage(img, dx, dy);
        return;
      }
      c.save();
      c.translate(dx + 8, dy + 8);
      c.rotate((quarterTurns * Math.PI) / 2);
      c.drawImage(img, -8, -8);
      c.restore();
    };
    blit(ctx, getObj(name));
    if (ctx === mainCtx) blit(auxCtx, getAux(name));
  }

  function drawOpeningDoor(
    ctx: CanvasRenderingContext2D,
    zone: ZoneId,
    d: DoorTween,
    age: number,
  ): void {
    const t = easeOutCubic(age / 0.18);
    const split = Math.min(8, Math.round(t * 8));
    const keep = 8 - split;
    if (keep <= 0) return;

    const ew = d.tile === 'S' && (d.x === 0 || d.x === ROOM_W - 1);
    const bgTile: BgTile =
      d.tile === 'D'
        ? BG.doorKeyNS
        : d.tile === 'K'
          ? BG.doorBossNS
          : ew
            ? BG.shutterEW
            : BG.shutterNS;
    const sp = getPlacedBg(zone, {
      x: d.x,
      y: d.y,
      tile: bgTile,
      transparentZero: d.tile === 'S',
    });
    const dx = d.x * TILE_PX;
    const dy = d.y * TILE_PX;

    if (ew) {
      ctx.drawImage(sp, 0, split, TILE_PX, keep, dx, dy, TILE_PX, keep);
      ctx.drawImage(sp, 0, 8, TILE_PX, keep, dx, dy + 8 + split, TILE_PX, keep);
    } else {
      ctx.drawImage(sp, split, 0, keep, TILE_PX, dx, dy, keep, TILE_PX);
      ctx.drawImage(sp, 8, 0, keep, TILE_PX, dx + 8 + split, dy, keep, TILE_PX);
    }

    if ((d.tile === 'D' || d.tile === 'K') && age < 0.06) {
      ctx.fillStyle = FIRE_LIGHT;
      ctx.fillRect(dx + 7, dy + 7, 2, 2);
    }
  }

  const pickupMap: Record<Exclude<PickupKind, 'fire-bomb'>, ObjSpriteName> = {
    'small-key': 'PICKUP_SMALL_KEY',
    'boss-key': 'PICKUP_BOSS_KEY',
    'heart-shard': 'PICKUP_HEART_SHARD',
    'heart-drop': 'PICKUP_HEART_FULL',
    'heart-container': 'PICKUP_HEART_CONTAINER',
    'satchel-upgrade': 'PICKUP_SATCHEL',
    'cinder-core': 'PICKUP_CINDER_CORE',
  };

  function drawPickup(
    ctx: CanvasRenderingContext2D,
    kind: PickupKind,
    dx: number,
    dy: number,
    time: number,
    sx = 1,
    sy = 1,
    tiltRad = 0,
  ): void {
    if (kind === 'fire-bomb' || kind === 'cinder-core') {
      if (Math.floor(time * 6) % 2 === 0) {
        drawScaledSprite(ctx, 'SPARKLE_CELL', dx, dy, sx, sy, false, undefined, tiltRad);
      }
    }
    if (kind === 'fire-bomb') {
      drawScaledSprite(
        ctx,
        Math.floor(time * 5) % 2 === 0 ? 'FIREBOMB_1' : 'FIREBOMB_2',
        dx + 3,
        dy + 3,
        sx,
        sy,
        false,
        undefined,
        tiltRad,
      );
      return;
    }
    drawScaledSprite(ctx, pickupMap[kind], dx, dy, sx, sy, false, undefined, tiltRad);
  }

  const MOUSE_GALLOP = ['RUN_1', 'RUN_2', 'RUN_3', 'RUN_4'] as const;

  function drawBomb(
    ctx: CanvasRenderingContext2D,
    b: Bomb,
    dx: number,
    dy: number,
    time: number,
    sx = 1,
    sy = 1,
    tiltRad = 0,
  ): void {
    const planarSpeed = Math.hypot(b.vx, b.vy);
    let idx: number;
    if (planarSpeed > 0.35 && b.z <= 0.08) {
      const phase = bombRollPhase.get(b.id) ?? 0;
      const dirSign = b.vx + b.vy >= 0 ? 1 : -1;
      idx = ((Math.floor(phase * 1.35 * dirSign) % 4) + 4) % 4;
    } else {
      const rate = b.fuse > 0.7 ? 8 : b.fuse > 0.35 ? 14 : 22;
      idx = Math.floor(time * rate + b.id) % 4;
    }
    const bombFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
      'BOMB_1',
      'BOMB_2',
      'BOMB_3',
      'BOMB_4',
    ];
    const fireFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
      'FIREBOMB_1',
      'FIREBOMB_2',
      'FIREBOMB_3',
      'FIREBOMB_4',
    ];
    const list = b.kind === 'fire' ? fireFrames : bombFrames;
    drawScaledSprite(ctx, list[idx] ?? list[0], dx, dy, sx, sy, false, undefined, tiltRad);
  }

  function computeBombDeform(b: Bomb, time: number): { sx: number; sy: number; tiltRad: number } {
    let sx = 1;
    let sy = 1;
    let tiltRad = 0;

    const landEnd = bombLandUntil.get(b.id) ?? 0;
    if (time < landEnd) {
      const e = easeOutCubic(1 - (landEnd - time) / 0.14);
      sx *= 1.24 + (1 - 1.24) * e;
      sy *= 0.78 + (1 - 0.78) * e;
    }

    const planarSpeed = Math.hypot(b.vx, b.vy);
    if (planarSpeed > 0.35 && b.z <= 0.08) {
      const phase = bombRollPhase.get(b.id) ?? 0;
      const rollStrength = Math.min(1, (planarSpeed - 0.35) / 3.0);
      const wobble = Math.cos(phase * 2) * 0.07 * rollStrength;
      sx *= 1 + wobble;
      sy *= 1 - wobble;
      tiltRad =
        Math.sin(phase) * (0.14 + 0.13 * rollStrength) + Math.sign(b.vx) * 0.05 * rollStrength;
    }

    if (b.fuse < 0.45) {
      const urgency = Math.max(0, Math.min(1, (0.45 - b.fuse) / 0.45));
      const swell = 1 + 0.18 * urgency;
      const pulse = Math.sin(time * (28 + urgency * 26)) * (0.08 + 0.1 * urgency);
      sx *= swell + pulse;
      sy *= swell - pulse * 0.85;
    }

    return { sx, sy, tiltRad };
  }

  const SPLASH_DROP_ANGLES: readonly [number, number, number, number] = [-2.35, -0.78, 0.78, 2.35];

  function drawMicroVfx(
    ctx: CanvasRenderingContext2D,
    zone: ZoneId,
    fx: MicroVfxInstance,
    age: number,
  ): void {
    const cx = Math.round(fx.x * TILE_PX);
    const cy = Math.round(fx.y * TILE_PX);

    if (fx.kind === 'splash') {
      const u = Math.max(0, Math.min(1, age / 0.26));
      const waterPal = BG_PALETTES[zone].water;
      const foamCss = cssRgb(waterPal[1]);
      const azureCss = cssRgb(waterPal[2]);
      const deepWaterCss = cssRgb(waterPal[3]);

      const rx = Math.round(2 + u * 6);
      const ry = Math.round(1 + u * 3);
      const dx = Math.max(1, Math.round(rx * 0.7));
      const dy = Math.max(1, Math.round(ry * 0.7));
      const ringPts: ReadonlyArray<readonly [number, number]> = [
        [-rx, 0],
        [rx, 0],
        [0, -ry],
        [0, ry],
        [-dx, -dy],
        [dx, -dy],
        [-dx, dy],
        [dx, dy],
      ];
      if (u < 0.9) {
        const ringCol = u < 0.45 ? foamCss : azureCss;
        for (let i = 0; i < ringPts.length; i++) {
          if (u > 0.7 && i >= 4 && i % 2 === 1) continue;
          const pt = ringPts[i];
          if (!pt) continue;
          const px = cx + pt[0];
          const py = cy + pt[1];
          ctx.fillStyle = deepWaterCss;
          ctx.fillRect(px, py + 1, 1, 1);
          ctx.fillStyle = ringCol;
          ctx.fillRect(px, py, 1, 1);
        }
      }

      if (u < 0.3) {
        const h = Math.max(1, Math.round((1 - u / 0.3) * 5));
        ctx.fillStyle = INK_CSS;
        ctx.fillRect(cx - 2, cy - h - 1, 4, h + 2);
        ctx.fillStyle = foamCss;
        ctx.fillRect(cx - 1, cy - h, 2, h);
      }

      if (u < 0.88) {
        const dropCol = u < 0.5 ? foamCss : azureCss;
        for (const a of SPLASH_DROP_ANGLES) {
          const ox = Math.round(Math.cos(a) * (1.5 + u * 5.5));
          const oy = Math.round(Math.sin(a) * (0.8 + u * 2.5) - 4 * 6 * u * (1 - u));
          const dpx = cx + ox;
          const dpy = cy + oy;
          ctx.fillStyle = INK_CSS;
          ctx.fillRect(dpx - 1, dpy, 3, 1);
          ctx.fillRect(dpx, dpy - 1, 1, 3);
          ctx.fillStyle = dropCol;
          ctx.fillRect(dpx, dpy, 1, 1);
        }
      }
      return;
    }

    // 'swallow': shrinking silhouette + inward abyss puff
    const u = Math.max(0, Math.min(1, age / 0.24));
    const rimLight = cssRgb(OBJ_PALETTES.powder[2]);
    const rimMid = cssRgb(OBJ_PALETTES.powder[3]);
    const bodyCol =
      fx.bombKind === 'fire' ? cssRgb(OBJ_PALETTES.fire[3]) : cssRgb(OBJ_PALETTES.powder[4]);
    const dropY = Math.round(u * 4);

    const r = Math.max(1, Math.round((1 - u) * 5));
    const moteCol = u < 0.45 ? rimLight : rimMid;
    for (const [mx, my] of [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
    ] as const) {
      const px = cx + mx;
      const py = cy + my + Math.round(dropY * 0.5);
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(px, py + 1, 1, 1);
      ctx.fillStyle = moteCol;
      ctx.fillRect(px, py, 1, 1);
    }

    if (u < 0.35) {
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(cx - 3, cy - 3 + dropY, 6, 6);
      ctx.fillStyle = bodyCol;
      ctx.fillRect(cx - 2, cy - 2 + dropY, 4, 4);
      ctx.fillStyle = FIRE_WHITE;
      ctx.fillRect(cx - 1, cy - 1 + dropY, 1, 1);
    } else if (u < 0.7) {
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(cx - 2, cy - 2 + dropY, 4, 4);
      ctx.fillStyle = bodyCol;
      ctx.fillRect(cx - 1, cy - 1 + dropY, 2, 2);
    } else if (u < 0.92) {
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(cx - 1, cy + dropY, 3, 1);
      ctx.fillRect(cx, cy - 1 + dropY, 1, 3);
      ctx.fillStyle = rimMid;
      ctx.fillRect(cx, cy + dropY, 1, 1);
    }

    if (u < 0.4) {
      ctx.fillStyle = FIRE_LIGHT;
      ctx.fillRect(cx, cy - 3 + dropY, 1, 1);
    }
  }

  function drawNpc(
    ctx: CanvasRenderingContext2D,
    npc: NpcSpec,
    pipX: number,
    pipY: number,
    time: number,
  ): void {
    const dx = Math.round(npc.x * TILE_PX - 8);
    const phase = Math.floor(time * 2.6 + npc.x * 1.7) % 3;
    const dy = Math.round(npc.y * TILE_PX - 12);
    const nearPip = Math.hypot(pipX - npc.x, pipY - npc.y) < 4.2;
    const flipX = nearPip && pipX < npc.x - 0.25;
    drawScaledSprite(ctx, phase === 2 ? 'NPC_GRANDMA_2' : 'NPC_GRANDMA', dx, dy, 1, 1, flipX);
  }

  /**
   * Draw a crisp pixel-stepped 2-ring GBC contact shadow in the zone's chromatic ink colour.
   * Drawn onto `mainCtx` before actors so shadows lie flat on floor/decals and never clobber `auxCtx`.
   */
  function drawContactShadow(
    ctx: CanvasRenderingContext2D,
    zone: ZoneId,
    cxPx: number,
    footYPx: number,
    baseRadiusPx: number,
    heightTiles: number,
  ): void {
    const { rx, ry, alpha } = computeShadowMetrics(baseRadiusPx, heightTiles);
    const rgb = zone === 'ice-cave' ? '12, 20, 44' : '14, 28, 32';
    const cx = Math.round(cxPx);
    const cy = Math.round(footYPx);

    ctx.fillStyle = `rgba(${rgb}, ${(alpha * 0.62).toFixed(3)})`;
    for (let dy = -ry; dy <= ry; dy++) {
      const ny = dy / Math.max(1, ry + 0.35);
      const span = Math.max(1, Math.round(rx * Math.sqrt(Math.max(0, 1 - ny * ny))));
      ctx.fillRect(cx - span, cy + dy, span * 2, 1);
    }
    if (rx >= 3) {
      const irx = Math.max(1, rx - 2);
      const iry = Math.max(1, ry - 1);
      ctx.fillStyle = `rgba(${rgb}, ${Math.min(0.56, alpha * 1.15).toFixed(3)})`;
      for (let dy = -iry; dy <= iry; dy++) {
        const ny = dy / Math.max(1, iry + 0.35);
        const span = Math.max(1, Math.round(irx * Math.sqrt(Math.max(0, 1 - ny * ny))));
        ctx.fillRect(cx - span, cy + dy, span * 2, 1);
      }
    }
  }

  const FLAT_DECAL_ROWS = new Set<string>([
    BG.sealRingCenter.rows.join(''),
    BG.sealSocketOff.rows.join(''),
    BG.sealSocketLit.rows.join(''),
    BG.slopeN.rows.join(''),
    BG.slopeS.rows.join(''),
    BG.slopeE.rows.join(''),
    BG.slopeW.rows.join(''),
    BG.bridgeV_W.rows.join(''),
    BG.bridgeV_Mid.rows.join(''),
    BG.bridgeV_E.rows.join(''),
    BG.buttonUp.rows.join(''),
    BG.buttonDown.rows.join(''),
    BG.spikes.rows.join(''),
    BG.stairs.rows.join(''),
    BG.warpOff.rows.join(''),
    BG.warp0.rows.join(''),
    BG.warp1.rows.join(''),
    BG.barrierDown.rows.join(''),
  ]);

  function isFlatFloorDecal(tile: BgTile): boolean {
    return FLAT_DECAL_ROWS.has(tile.rows.join(''));
  }

  function drawAlertBadge(
    ctx: CanvasRenderingContext2D,
    cx: number,
    headTopY: number,
    time: number,
  ): void {
    const pop = Math.round(Math.abs(Math.sin(time * 14)) * 1.5);
    const bx = Math.round(cx) - 1;
    const by = Math.round(headTopY) - 8 - pop;
    // Crisp 2x6 '!' badge with 1px dark ink outline
    ctx.fillStyle = INK_CSS;
    ctx.fillRect(bx - 1, by - 1, 4, 8);
    ctx.fillStyle = FIRE_WHITE;
    ctx.fillRect(bx, by, 2, 1);
    ctx.fillStyle = FIRE_LIGHT;
    ctx.fillRect(bx, by + 1, 2, 3);
    ctx.fillStyle = FIRE_WHITE;
    ctx.fillRect(bx, by + 5, 2, 1);
  }

  function drawFleeSweatDrop(
    ctx: CanvasRenderingContext2D,
    cx: number,
    headTopY: number,
    id: number,
    time: number,
  ): void {
    const dropOff = Math.floor((time * 9 + id) % 4);
    const sx = Math.round(cx) + 6;
    const sy = Math.round(headTopY) - 1 + dropOff;
    ctx.fillStyle = INK_CSS;
    ctx.fillRect(sx - 1, sy - 1, 3, 4);
    ctx.fillStyle = cssRgb(OBJ_PALETTES.spectral[0]);
    ctx.fillRect(sx, sy, 1, 1);
    ctx.fillStyle = cssRgb(OBJ_PALETTES.spectral[2]);
    ctx.fillRect(sx, sy + 1, 1, 1);
  }

  function drawFloatingWaterRing(
    ctx: CanvasRenderingContext2D,
    zone: ZoneId,
    cxPx: number,
    cyPx: number,
    id: number,
    time: number,
  ): void {
    const waterPal = BG_PALETTES[zone].water;
    const foamCss = cssRgb(waterPal[1]);
    const deepCss = cssRgb(waterPal[3]);
    const rx = 5 + (Math.floor(time * 4 + id) % 2);
    const ry = 2;
    const pts: ReadonlyArray<readonly [number, number]> = [
      [-rx, 0],
      [rx, 0],
      [-rx + 2, -ry],
      [0, -ry],
      [rx - 2, -ry],
      [-rx + 2, ry],
      [0, ry],
      [rx - 2, ry],
    ];
    for (const [ox, oy] of pts) {
      ctx.fillStyle = deepCss;
      ctx.fillRect(cxPx + ox, cyPx + oy + 1, 1, 1);
      ctx.fillStyle = foamCss;
      ctx.fillRect(cxPx + ox, cyPx + oy, 1, 1);
    }
  }

  function drawWindAndGusts(
    ctx: CanvasRenderingContext2D,
    zone: ZoneId,
    roomWind: { dx: number; dy: number } | undefined,
    gusts: readonly WindGust[],
    time: number,
  ): void {
    const streakTipCss = cssRgb(OBJ_PALETTES.spectral[0]);
    const streakBodyCss = cssRgb(OBJ_PALETTES.spectral[2]);

    // 1. Subtle drifting leaf / breeze motes in rooms with ambient room.wind
    if (roomWind && (Math.abs(roomWind.dx) > 0.01 || Math.abs(roomWind.dy) > 0.01)) {
      const leafGoldCss =
        zone === 'overworld'
          ? cssRgb(BG_PALETTES.overworld.wood[1])
          : cssRgb(BG_PALETTES['ice-cave'].floor[0]);
      const leafShadeCss =
        zone === 'overworld' ? cssRgb(BG_PALETTES.overworld.wood[2]) : streakBodyCss;
      const vxPx = roomWind.dx * TILE_PX * 1.9;
      const vyPx = roomWind.dy * TILE_PX * 1.9;
      for (let i = 0; i < 6; i++) {
        const seedX = (i * 37 + 19) % NATIVE_W;
        const seedY = (i * 53 + 29) % (NATIVE_H - 32);
        const mx = (((seedX + time * vxPx) % NATIVE_W) + NATIVE_W) % NATIVE_W;
        const flutter = Math.sin(time * 4.6 + i * 1.9) * 3.5;
        const my =
          16 +
          ((((seedY + time * vyPx + flutter) % (NATIVE_H - 32)) + (NATIVE_H - 32)) %
            (NATIVE_H - 32));
        const px = Math.round(mx);
        const py = Math.round(my);
        if (i % 3 === 0) {
          // Crisp 4px breeze hairline streak
          ctx.fillStyle = INK_CSS;
          ctx.fillRect(px, py + 1, 4, 1);
          ctx.fillStyle = streakBodyCss;
          ctx.fillRect(px, py, 3, 1);
          ctx.fillStyle = streakTipCss;
          ctx.fillRect(px + (roomWind.dx >= 0 ? 3 : -1), py, 1, 1);
        } else {
          // Tiny fluttering autumn leaf / ash mote
          const flipLeaf = Math.floor(time * 5 + i) % 2 === 0;
          ctx.fillStyle = INK_CSS;
          ctx.fillRect(px, py + 1, 2, 1);
          ctx.fillStyle = leafGoldCss;
          ctx.fillRect(px, py, 2, 1);
          ctx.fillStyle = leafShadeCss;
          ctx.fillRect(px + (flipLeaf ? 1 : 0), py - 1, 1, 1);
        }
      }
    }

    // 2. Crisp animated pixel wind-streak lines sweeping across active WindGust discs
    for (let gi = 0; gi < gusts.length; gi++) {
      const g = gusts[gi];
      if (!g || g.remaining <= 0) continue;
      const mag = Math.hypot(g.dx, g.dy);
      const ux = mag > 1e-4 ? g.dx / mag : 1;
      const uy = mag > 1e-4 ? g.dy / mag : 0;
      const rPx = Math.max(12, g.radius * TILE_PX);
      const gx = g.x * TILE_PX;
      const gy = g.y * TILE_PX;

      for (let i = 0; i < 5; i++) {
        const lat = (i - 2) * 0.36 * rPx;
        const u = (time * 4.2 + i * 0.21 + gi * 0.37) % 1;
        const along = (u * 1.5 - 0.75) * rPx;
        const baseLen = 6 + (i % 2) * 3;
        const taper = u < 0.16 ? u / 0.16 : u > 0.84 ? (1 - u) / 0.16 : 1;
        const len = Math.max(2, Math.round(baseLen * taper));
        for (let k = 0; k < len; k++) {
          const px = Math.round(gx + ux * (along + k) - uy * lat);
          const py = Math.round(gy + uy * (along + k) + ux * lat);
          ctx.fillStyle = INK_CSS;
          ctx.fillRect(px, py + 1, 1, 1);
          ctx.fillStyle = k >= len - 2 ? streakTipCss : streakBodyCss;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }

  function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
    const hitFlash = e.invulnTimer > 0 && Math.floor(time * 24) % 2 === 0;
    const windup = e.aiState === 'windup';
    const stumbled = e.stumbleTimer > 0;
    const fleeing = e.aiState === 'flee';
    const noticing = e.aiState === 'notice';

    let flashPal: ObjPaletteId | undefined;
    if (hitFlash) {
      flashPal = 'crimson';
    } else if (windup) {
      const beat = Math.floor(time * 22) % 3;
      flashPal = beat === 0 ? 'spectral' : beat === 1 ? 'crimson' : undefined;
    }

    let sx = 1;
    let sy = 1;
    let tiltRad = 0;
    let wobbleX = 0;
    if (windup) {
      sx *= 1.22;
      sy *= 0.78;
    }
    if (stumbled) {
      wobbleX = Math.round(Math.sin(time * 38 + e.id) * 2);
      sx *= 0.9;
      sy *= 1.08;
      tiltRad = Math.sin(time * 28 + e.id) * 0.12;
    }
    const rateMul = fleeing ? 2.4 : 1;
    let headTopY = Math.round(e.y * TILE_PX - 10);

    if (e.kind === 'slime') {
      const isMini = Boolean(e.splitGen && e.splitGen >= 1);
      const scale = isMini ? 0.74 : 1;
      const f = Math.floor(time * (isMini ? 10 : 7.5) * rateMul + e.id) % 4;
      const frames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'SLIME_1',
        'SLIME_4',
        'SLIME_2',
        'SLIME_3',
      ];
      const hopY = f === 2 ? -1 : 0;
      const noticeJiggle = noticing ? Math.round(Math.sin(time * 36 + e.id) * 1) : 0;
      drawScaledSprite(
        ctx,
        frames[f] ?? 'SLIME_1',
        Math.round(e.x * TILE_PX - 8) + wobbleX + noticeJiggle,
        Math.round(e.y * TILE_PX - 9) + hopY,
        sx * scale,
        sy * scale,
        false,
        flashPal,
        tiltRad,
      );
      headTopY = Math.round(e.y * TILE_PX - (isMini ? 7 : 9)) + hopY;
    } else if (e.kind === 'bat') {
      const flap = Math.floor(time * 11 * rateMul + e.id) % 4;
      const frames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'BAT_1',
        'BAT_3',
        'BAT_2',
        'BAT_4',
      ];
      const lift = flap === 1 ? -2 : flap === 0 ? -1 : flap === 2 ? 1 : 0;
      const bank = Math.max(-0.22, Math.min(0.22, e.vx * 0.08));
      const dx = Math.round(e.x * TILE_PX - 8);
      const dy = Math.round(e.y * TILE_PX - 11 + lift);
      drawScaledSprite(
        ctx,
        frames[flap] ?? 'BAT_1',
        dx + wobbleX,
        dy,
        sx,
        sy,
        false,
        flashPal,
        tiltRad + bank,
      );
      headTopY = dy;
    } else if (e.kind === 'shielder') {
      const cadence = e.armored ? 7.5 : 13.5;
      const step = Math.floor(time * cadence * rateMul + e.id) % 4;
      const frames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'SHIELDER_1',
        'SHIELDER_2',
        'SHIELDER_3',
        'SHIELDER_4',
      ];
      const dx = Math.round(e.x * TILE_PX - 8);
      const dy = Math.round(e.y * TILE_PX - 10);
      drawScaledSprite(
        ctx,
        frames[step] ?? 'SHIELDER_1',
        dx + wobbleX,
        dy,
        sx,
        sy,
        false,
        flashPal,
        tiltRad,
      );
      if (e.armored) {
        if (Math.abs(e.fx) > Math.abs(e.fy)) {
          const shX = (e.fx > 0 ? dx + 11 : dx - 1) + wobbleX;
          drawScaledSprite(ctx, 'WOOD_SHIELD_V', shX, dy + 3, sx, sy, false, undefined, tiltRad);
        } else {
          const shY = e.fy > 0 ? dy + 9 : dy - 1;
          drawScaledSprite(
            ctx,
            'WOOD_SHIELD_H',
            dx + 2 + wobbleX,
            shY,
            sx,
            sy,
            false,
            undefined,
            tiltRad,
          );
        }
      }
      headTopY = dy;
    } else if (e.kind === 'wickgeist') {
      const bob = Math.round(Math.sin(time * 5) * 2);
      const dx = Math.round(e.x * TILE_PX - 12);
      const dy = Math.round(e.y * TILE_PX - 14) + bob;
      const phase = Math.floor(time * 7 * rateMul + e.id) % 4;
      const darkFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'WICKGEIST_DARK',
        'WICKGEIST_DARK_2',
        'WICKGEIST_DARK_3',
        'WICKGEIST_DARK_4',
      ];
      const litFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'WICKGEIST_LIT',
        'WICKGEIST_LIT_2',
        'WICKGEIST_LIT_3',
        'WICKGEIST_LIT_4',
      ];
      const name: ObjSpriteName = windup
        ? e.armored
          ? 'WICKGEIST_DARK_CAST'
          : 'WICKGEIST_LIT_CAST'
        : e.armored
          ? (darkFrames[phase] ?? 'WICKGEIST_DARK')
          : (litFrames[phase] ?? 'WICKGEIST_LIT');
      if (e.armored && !hitFlash) {
        ctx.globalAlpha = 0.34 + 0.08 * Math.sin(time * 6);
      }
      drawScaledSprite(ctx, name, dx + wobbleX, dy, sx, sy, false, flashPal, tiltRad);
      ctx.globalAlpha = 1;
      if (time < iceStormUntil) {
        const u = Math.max(0, Math.min(1, 1 - (iceStormUntil - time) / 0.65));
        const cx = Math.round(e.x * TILE_PX);
        const cy = Math.round(e.y * TILE_PX);
        const r1 = 8 + u * 64;
        const r2 = 4 + u * 42;
        for (let k = 0; k < 8; k++) {
          const a1 = (k * Math.PI) / 4 + time * 11;
          const a2 = (k * Math.PI) / 4 - time * 14 + 0.4;
          const x1 = Math.round(cx + Math.cos(a1) * r1);
          const y1 = Math.round(cy + Math.sin(a1) * r1);
          const x2 = Math.round(cx + Math.cos(a2) * r2);
          const y2 = Math.round(cy + Math.sin(a2) * r2);
          ctx.fillStyle = cssRgb(OBJ_PALETTES.spectral[0]);
          ctx.fillRect(x1 - 1, y1, 3, 1);
          ctx.fillRect(x1, y1 - 1, 1, 3);
          ctx.fillStyle = cssRgb(OBJ_PALETTES.spectral[1]);
          ctx.fillRect(x2, y2, 2, 2);
        }
      }
      headTopY = dy;
    } else if (e.kind === 'cinderhull') {
      // Full 32x32 (2x2 tile) Oracle Shrine Boss!
      const beat = Math.floor(time * (e.armored ? 5.5 : 9.5) * rateMul) % 4;
      const dx = Math.round(e.x * TILE_PX - 16);
      const dy = Math.round(e.y * TILE_PX - 15);
      const armoredFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'CINDERHULL_ARMORED_1',
        'CINDERHULL_ARMORED_2',
        'CINDERHULL_ARMORED_3',
        'CINDERHULL_ARMORED_4',
      ];
      const exposedFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'CINDERHULL_EXPOSED_1',
        'CINDERHULL_EXPOSED_2',
        'CINDERHULL_EXPOSED_3',
        'CINDERHULL_EXPOSED_4',
      ];
      const name: ObjSpriteName = e.armored
        ? windup
          ? 'CINDERHULL_ARMORED_WINDUP'
          : (armoredFrames[beat] ?? 'CINDERHULL_ARMORED_1')
        : (exposedFrames[beat] ?? 'CINDERHULL_EXPOSED_1');
      const warnRegrow = !e.armored && e.exposedTimer > 0 && e.exposedTimer < 1.2 && beat % 2 === 1;
      drawScaledSprite(
        ctx,
        name,
        dx + wobbleX,
        dy,
        sx,
        sy,
        false,
        flashPal ?? (warnRegrow ? 'green' : undefined),
        tiltRad,
      );
      headTopY = dy;
    }

    if (noticing) {
      drawAlertBadge(ctx, e.x * TILE_PX + wobbleX, headTopY, time);
    }
    if (fleeing) {
      drawFleeSweatDrop(ctx, e.x * TILE_PX + wobbleX, headTopY, e.id, time);
    }
  }

  /** Pip's contact shadow; small when upright, and long under the side gallop. */
  function pipShadowRadius(s: State): number {
    const sideGallop = isMoving && s.rollTimer <= 0 && Math.abs(s.aimX) > Math.abs(s.aimY);
    return sideGallop ? 6.2 : 4.1;
  }

  function drawPip(ctx: CanvasRenderingContext2D, s: State, time: number): void {
    // Getting hit is the i-frame blink only (no hurt frame), as in Oracle (roll uses its own shimmer)
    if (
      s.rollTimer <= 0 &&
      s.invulnTimer > 0 &&
      time >= fallAnimUntil &&
      Math.floor(time * 18) % 2 === 0
    ) {
      return;
    }

    const dx = Math.round(s.x * TILE_PX - 8);
    const dy = Math.round(s.y * TILE_PX - 10);

    if (time < fallAnimUntil) {
      const rem = fallAnimUntil - time;
      const fall: ObjSpriteName =
        rem > 0.24 ? 'MOUSE_FALL_1' : rem > 0.12 ? 'MOUSE_FALL_2' : 'MOUSE_FALL_3';
      drawObjSprite(ctx, fall, dx, dy);
      return;
    }

    if (time < warpAnimUntil) {
      const u = Math.max(0, Math.min(1, 1 - (warpAnimUntil - time) / 0.55));
      const cx = Math.round(s.x * TILE_PX);
      const cy = Math.round(s.y * TILE_PX);
      const beamAlpha = Math.max(0, 1 - u);
      const beamW = Math.max(1, Math.round((1 - u) * 5));
      // Cyan teleport beam pillar & expanding floor rune ring
      ctx.fillStyle = `rgba(90, 230, 255, ${(beamAlpha * 0.75).toFixed(3)})`;
      ctx.fillRect(cx - beamW, Math.max(0, cy - 28), beamW * 2, 32);
      ctx.fillStyle = `rgba(235, 252, 255, ${(beamAlpha * 0.95).toFixed(3)})`;
      ctx.fillRect(
        cx - Math.max(1, beamW - 1),
        Math.max(0, cy - 28),
        Math.max(1, (beamW - 1) * 2),
        32,
      );
      const ringR = 3 + Math.round(u * 9);
      ctx.fillStyle = cssRgb(OBJ_PALETTES.spectral[1]);
      ctx.fillRect(cx - ringR, cy + 2, 2, 1);
      ctx.fillRect(cx + ringR - 1, cy + 2, 2, 1);
      ctx.fillRect(cx - 1, cy + 2 - Math.round(ringR * 0.45), 2, 1);
      ctx.fillRect(cx - 1, cy + 2 + Math.round(ringR * 0.45), 2, 1);
      if (u < 0.7 && Math.floor(time * 18) % 2 === 0) {
        drawScaledSprite(ctx, 'SPARKLE_CELL', dx, dy - 2, 1, 1, false, 'spectral');
      }
      // Rapid 4-direction spin while materializing from tall thin beam into landing pose
      const spinPhase = Math.floor(time * 28) % 4;
      const spinSprite: ObjSpriteName =
        spinPhase === 0
          ? 'MOUSE_SOUTH_IDLE'
          : spinPhase === 1
            ? 'MOUSE_EAST_IDLE'
            : spinPhase === 2
              ? 'MOUSE_NORTH_IDLE'
              : 'MOUSE_EAST_IDLE';
      const spinFlip = spinPhase === 3;
      const sx = 0.35 + 0.65 * easeOutBack(u);
      const sy = 1.7 - 0.7 * easeOutCubic(u);
      const flashPal: ObjPaletteId | undefined =
        u < 0.45 && Math.floor(time * 24) % 2 === 0 ? 'spectral' : undefined;
      drawScaledSprite(
        ctx,
        spinSprite,
        dx,
        dy - Math.round((1 - u) * 6),
        sx,
        sy,
        spinFlip,
        flashPal,
      );
      return;
    }

    if (time < holdAnimUntil) {
      drawObjSprite(ctx, 'MOUSE_GET', dx, dy);
      if (Math.floor(time * 8) % 2 === 0) {
        drawObjSprite(ctx, 'SPARKLE_CELL', dx, dy - 10);
      }
      drawPickup(ctx, heldKind, dx, dy - 10, time);
      return;
    }

    if (s.rollTimer > 0) {
      const u = Math.max(0, Math.min(1, 1 - s.rollTimer / ROLL_DURATION));
      const rDir =
        Math.abs(s.rollDirX) > Math.abs(s.rollDirY) ? 'EAST' : s.rollDirY < 0 ? 'NORTH' : 'SOUTH';
      const rFlip = rDir === 'EAST' && s.rollDirX < 0;
      const phase = Math.min(3, Math.floor(u * 4));
      const rollSprite: ObjSpriteName = phase % 2 === 0 ? 'MOUSE_ROLL_1' : 'MOUSE_ROLL_2';
      const hopPx = Math.round(4 * 2 * u * (1 - u));
      const shimmerPal: ObjPaletteId | undefined =
        u >= 0.2 && u <= 0.8 && Math.floor(time * 30) % 3 === 0 ? 'spectral' : undefined;
      drawObjSprite(ctx, rollSprite, dx, dy - hopPx, rFlip, shimmerPal);
      return;
    }

    // Facing from continuous 360° aim vector: dominant axis, west drawn as east flipped
    const dir = Math.abs(s.aimX) > Math.abs(s.aimY) ? 'EAST' : s.aimY < 0 ? 'NORTH' : 'SOUTH';
    const flip = dir === 'EAST' && s.aimX < 0;

    let baseSx = 1;
    let baseSy = 1;
    if (time < rollLandUntil) {
      const e = easeOutCubic(1 - (rollLandUntil - time) / 0.12);
      baseSx = 1.22 + (1 - 1.22) * e;
      baseSy = 0.8 + (1 - 0.8) * e;
    }

    const draw = (name: ObjSpriteName, sx = baseSx, sy = baseSy): void =>
      drawScaledSprite(ctx, name, dx, dy, sx, sy, flip);
    // Real-world clock aligned gallop at 11 fps (half the old ~22 fps distance-based rate)
    const elapsedMove = Math.max(0, time - moveStartTime);
    const stepIdx = Math.floor(elapsedMove * (isPushingBlock ? 4.5 : 11)) % 4;
    const moving = isMoving;

    if (s.heldBomb !== null) {
      const bob = moving ? (Math.floor(elapsedMove * 6) % 2 === 0 ? -1 : 0) : 0;
      draw(`MOUSE_${dir}_LIFT`, baseSx, baseSy);
      const heldFrame: ObjSpriteName =
        s.heldBomb === 'fire'
          ? Math.floor(time * 5) % 2 === 0
            ? 'FIREBOMB_1'
            : 'FIREBOMB_2'
          : Math.floor(time * 5) % 2 === 0
            ? 'BOMB_1'
            : 'BOMB_2';
      drawObjSprite(ctx, heldFrame, dx, dy - 7 + bob);
      return;
    }

    if (time < crouchAnimUntil) {
      draw(`MOUSE_${dir}_LIFT`, 1.08, 0.92);
      return;
    }
    if (time < throwAnimUntil) {
      draw(`MOUSE_${dir}_THROW`);
      return;
    }
    if (isPushingBlock) {
      draw(stepIdx < 2 ? `MOUSE_${dir}_RUN_1` : `MOUSE_${dir}_RUN_2`);
      return;
    }
    if (moving !== mouseWasMoving) {
      // Starting or stopping: crouch for a beat between standing and the gallop
      mouseWasMoving = moving;
      mouseCrouchUntil = time + 0.08;
    }
    if (time < mouseCrouchUntil) {
      draw(`MOUSE_${dir}_DROP`);
      return;
    }
    if (moving) {
      // The fuse mouse gallops on all four legs: one frame per beat
      draw(`MOUSE_${dir}_${MOUSE_GALLOP[stepIdx] ?? 'RUN_1'}`);
      return;
    }
    // Standing still: tail spark flickers and eyes blink
    draw(time % 1.3 > 1.0 ? `MOUSE_${dir}_IDLE_B` : `MOUSE_${dir}_IDLE`);
  }

  function drawBlastSegment(ctx: CanvasRenderingContext2D, bl: BlastInstance, age: number): void {
    const dx = Math.round(bl.x * TILE_PX - 8);
    const dy = Math.round(bl.y * TILE_PX - 8);
    const stage = Math.min(3, Math.floor((age / 0.28) * 4));

    if (bl.shape === 'single' || bl.kind === 'fire' || stage >= 2) {
      const radial: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'BLAST_1',
        'BLAST_2',
        'BLAST_3',
        'BLAST_4',
      ];
      drawObjSprite(ctx, radial[stage] ?? 'BLAST_4', dx, dy);
      return;
    }

    if (bl.shape === 'hub') {
      drawObjSprite(ctx, stage === 0 ? 'BLAST_HUB_1' : 'BLAST_HUB_2', dx, dy);
    } else if (bl.shape === 'armH') {
      drawObjSprite(ctx, stage === 0 ? 'BLAST_ARM_H_1' : 'BLAST_ARM_H_2', dx, dy);
    } else if (bl.shape === 'armV') {
      drawRotatedObj(ctx, stage === 0 ? 'BLAST_ARM_H_1' : 'BLAST_ARM_H_2', dx, dy, 1);
    } else {
      const turns = bl.shape === 'capE' ? 0 : bl.shape === 'capS' ? 1 : bl.shape === 'capW' ? 2 : 3;
      drawRotatedObj(ctx, stage === 0 ? 'BLAST_CAP_E_1' : 'BLAST_CAP_E_2', dx, dy, turns);
    }
  }

  return {
    rebuild(world: World, s: State): void {
      const rk = `${s.zone}:${s.rx},${s.ry}`;
      const roomChanged = rk !== activeRoomKey || s.events.includes('player-respawn');
      activeRoomKey = rk;

      if (roomChanged) {
        activeBlasts = [];
        activeScorches = [];
        activeMicroVfx = [];
        bombLandUntil.clear();
        bombPrevKin.clear();
        bombRollPhase.clear();
        blockTweens.clear();
        pickupSpawnTime.clear();
        pickupPrevPos.clear();
        wasRolling = false;
        for (const p of s.pickups) {
          pickupSpawnTime.set(p.id, -1);
          pickupPrevPos.set(p.id, { x: p.x, y: p.y });
        }
      }
      syncDoorState(world, s, roomChanged);
      lastBurnedCount = s.burnedTiles.size;
      lastBrokenCount = s.brokenTiles.size;

      plan = buildRoomLayout(world, s);
      const isWet = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= ROOM_W || y >= ROOM_H) return false;
        const t = tileAt(world, s, s.zone, s.rx, s.ry, x, y);
        return isWaterTile(t) || isShallowWaterTile(t);
      };
      waterCells = [];
      for (let y = 0; y < ROOM_H; y++) {
        for (let x = 0; x < ROOM_W; x++) {
          if (!isWet(x, y)) continue;
          const l = isWet(x - 1, y) ? 0 : 2;
          const r = isWet(x + 1, y) ? 0 : 2;
          const u = isWet(x, y - 1) ? 0 : 2;
          const d = isWet(x, y + 1) ? 0 : 2;
          waterCells.push({
            x,
            y,
            shallow: isShallowWaterTile(tileAt(world, s, s.zone, s.rx, s.ry, x, y)),
            rect: [x * TILE_PX + l, y * TILE_PX + u, TILE_PX - l - r, TILE_PX - u - d],
          });
        }
      }
      groundedProps = plan.props.filter((p) => {
        if (isFlatFloorDecal(p.tile)) return false;
        const t = tileAt(world, s, s.zone, s.rx, s.ry, p.x, p.y);
        return t === 'W' || t === 'T' || t === 'C';
      });

      rctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
      cctx.clearRect(0, 0, NATIVE_W, NATIVE_H);

      for (const g of plan.ground) {
        rctx.drawImage(getPlacedBg(s.zone, g), g.x * TILE_PX, g.y * TILE_PX);
      }
      for (const d of plan.decals) {
        rctx.drawImage(getPlacedBg(s.zone, d), d.x * TILE_PX, d.y * TILE_PX);
      }
      // Thicket crowns back to front: each lower crown overlaps the ones above it
      for (const cr of plan.crowns) {
        rctx.drawImage(getCrown(s.zone, cr.variant), cr.px, cr.py);
      }
      for (const p of plan.props) {
        if (isFlatFloorDecal(p.tile)) {
          rctx.drawImage(getPlacedBg(s.zone, p), p.x * TILE_PX, p.y * TILE_PX);
        }
      }
      for (const c of plan.ceiling) {
        cctx.drawImage(getPlacedBg(s.zone, c), c.x * TILE_PX, c.y * TILE_PX);
      }
    },

    sync(world: World, s: State, time: number): void {
      if (s.burnedTiles.size !== lastBurnedCount || s.brokenTiles.size !== lastBrokenCount) {
        this.rebuild(world, s);
      }
      const dt = prevTime > 0 ? Math.min(0.05, Math.max(0, time - prevTime)) : 0.016;
      prevTime = time;

      const isRolling = s.rollTimer > 0;
      if (wasRolling && !isRolling && time >= fallAnimUntil) {
        rollLandUntil = time + 0.12;
      }
      wasRolling = isRolling;

      const movedDist = prevX >= 0 ? Math.hypot(s.x - prevX, s.y - prevY) : 0;
      prevX = s.x;
      prevY = s.y;
      isPushingBlock = s.blocks.some((b) => b.pushCharge > 0.04);
      if ((movedDist > 0.001 && movedDist < 1.2) || isPushingBlock) {
        lastMoveTime = time;
      }
      // Hold moving true across intermediate sub-tick render frames (up to 50ms of wall-clock time)
      const nowMoving = isPushingBlock || (lastMoveTime >= 0 && time - lastMoveTime <= 0.05);
      if (nowMoving && !isMoving) {
        moveStartTime = time;
      }
      isMoving = nowMoving;

      for (const ev of s.events) {
        if (ev === 'bomb-kick' || ev === 'bomb-throw') {
          // The throw / kick uses the arms-forward throw frame
          throwAnimUntil = time + 0.16;
        } else if (ev === 'bomb-drop') {
          crouchAnimUntil = time + 0.1;
        } else if (ev === 'door-unlock' || ev === 'room-solved') {
          syncDoorState(world, s, false);
        } else if (ev === 'pit-fall') {
          fallAnimUntil = time + 0.36;
        } else if (ev === 'portal-warp') {
          warpAnimUntil = time + 0.55;
        } else if (ev === 'ice-storm') {
          iceStormUntil = time + 0.65;
        } else if (ev.startsWith('pickup-') && ev !== 'pickup-heart-drop') {
          const kind = ev.replace('pickup-', '') as PickupKind;
          holdAnimUntil = time + (kind === 'small-key' ? 0.45 : 1.25);
          heldKind = kind;
        }
      }

      // Track continuous z-height landings, bounce/kick/shove squash, rolling phase, and splash/swallow VFX
      const liveBombIds = new Set<number>();
      for (const b of s.bombs) {
        liveBombIds.add(b.id);
      }
      const vanishedBombs: BombKinSnapshot[] = [];
      for (const [id, prev] of bombPrevKin) {
        if (!liveBombIds.has(id)) {
          const blewUp = s.blasts.some(
            (bl) =>
              Math.floor(bl.x) === Math.floor(prev.x) && Math.floor(bl.y) === Math.floor(prev.y),
          );
          if (!blewUp) vanishedBombs.push(prev);
          bombPrevKin.delete(id);
          bombLandUntil.delete(id);
          bombRollPhase.delete(id);
        }
      }

      const matchesHazard = (t: ReturnType<typeof tileAt>, targetTile: '~' | '^'): boolean =>
        targetTile === '~' ? isWaterTile(t) : t === '^';

      const resolveHazardSpot = (
        targetTile: '~' | '^',
      ): { x: number; y: number; bombKind: 'bomb' | 'fire' } => {
        for (let i = 0; i < vanishedBombs.length; i++) {
          const cand = vanishedBombs[i];
          if (!cand) continue;
          const px = cand.x + cand.vx * dt;
          const py = cand.y + cand.vy * dt;
          const cx = Math.floor(px);
          const cy = Math.floor(py);
          if (matchesHazard(tileAt(world, s, s.zone, s.rx, s.ry, cx, cy), targetTile)) {
            vanishedBombs.splice(i, 1);
            return { x: px, y: py, bombKind: cand.kind };
          }
          for (const [ox, oy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nx = cx + ox;
            const ny = cy + oy;
            if (matchesHazard(tileAt(world, s, s.zone, s.rx, s.ry, nx, ny), targetTile)) {
              vanishedBombs.splice(i, 1);
              return {
                x: Math.max(nx + 0.25, Math.min(nx + 0.75, px)),
                y: Math.max(ny + 0.25, Math.min(ny + 0.75, py)),
                bombKind: cand.kind,
              };
            }
          }
        }
        const firstVanished = vanishedBombs.shift();
        if (firstVanished) {
          return {
            x: firstVanished.x + firstVanished.vx * dt,
            y: firstVanished.y + firstVanished.vy * dt,
            bombKind: firstVanished.kind,
          };
        }
        const fallbackKind: 'bomb' | 'fire' = s.equipped ?? 'bomb';
        for (const dist of [0.65, 1.15, 1.8, 2.4, 3.0]) {
          const sx = s.x + s.aimX * dist;
          const sy = s.y + s.aimY * dist;
          const tx = Math.floor(sx);
          const ty = Math.floor(sy);
          if (matchesHazard(tileAt(world, s, s.zone, s.rx, s.ry, tx, ty), targetTile)) {
            return { x: sx, y: sy, bombKind: fallbackKind };
          }
        }
        return { x: s.x + s.aimX * 0.75, y: s.y + s.aimY * 0.75, bombKind: fallbackKind };
      };

      for (const ev of s.events) {
        if (ev === 'bomb-splash') {
          const spot = resolveHazardSpot('~');
          activeMicroVfx.push({
            kind: 'splash',
            bombKind: spot.bombKind,
            x: spot.x,
            y: spot.y,
            born: time,
          });
        } else if (ev === 'bomb-swallow') {
          const spot = resolveHazardSpot('^');
          activeMicroVfx.push({
            kind: 'swallow',
            bombKind: spot.bombKind,
            x: spot.x,
            y: spot.y,
            born: time,
          });
        }
      }
      activeMicroVfx = activeMicroVfx.filter(
        (fx) => time - fx.born < (fx.kind === 'splash' ? 0.26 : 0.24),
      );

      const hasBounceLikeEvent = s.events.some(
        (ev) => ev === 'bomb-bounce' || ev === 'bomb-kick' || ev === 'bomb-shove',
      );
      let triggeredAnySquash = false;
      for (const b of s.bombs) {
        const prev = bombPrevKin.get(b.id);
        if (prev) {
          const landedZ = prev.z > 0.01 && b.z <= 0.01;
          const bouncedFloor = prev.vz < -0.05 && b.vz > 0;
          const shoved = b.shoveCount > prev.shoveCount;
          const impulseJump =
            hasBounceLikeEvent && Math.hypot(b.vx - prev.vx, b.vy - prev.vy) > 0.45;
          if (landedZ || bouncedFloor || shoved || impulseJump) {
            bombLandUntil.set(b.id, time + 0.14);
            triggeredAnySquash = true;
          }
        }
        const planarSpeed = Math.hypot(b.vx, b.vy);
        if (planarSpeed > 0.35) {
          const phase = (bombRollPhase.get(b.id) ?? b.id * 1.7) + planarSpeed * dt * 11;
          bombRollPhase.set(b.id, phase);
        }
        bombPrevKin.set(b.id, {
          x: b.x,
          y: b.y,
          z: b.z,
          vx: b.vx,
          vy: b.vy,
          vz: b.vz,
          shoveCount: b.shoveCount,
          kind: b.kind,
        });
      }
      if (hasBounceLikeEvent && !triggeredAnySquash) {
        for (const b of s.bombs) {
          bombLandUntil.set(b.id, time + 0.14);
        }
      }

      // Stamp startTime on newly opened doors/shutters and prune finished 0.18s tweens
      for (const d of openingDoors) {
        if (d.startTime < 0) d.startTime = time;
      }
      openingDoors = openingDoors.filter((d) => time - d.startTime < 0.18);

      for (const b of s.blasts) {
        activeBlasts.push({
          x: b.x,
          y: b.y,
          kind: b.kind,
          shape: b.shape ?? 'single',
          born: time,
        });
        if (!b.shape || b.shape === 'hub' || b.shape === 'single') {
          activeScorches.push({ x: b.x, y: b.y, born: time });
          if (activeScorches.length > 16) activeScorches.shift();
        }
      }
      activeBlasts = activeBlasts.filter((b) => time - b.born < 0.28);
      activeScorches = activeScorches.filter((sc) => time - sc.born < 3.5);

      // 1. Pass 1 & 2: Static terrain + animated interior water, warp runes & retracting doors
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.drawImage(roomLayer, 0, 0);
      auxCtx.clearRect(0, 0, NATIVE_W, NATIVE_H);

      const waterFrame = Math.floor(time * 2.6) % 3;
      const waterTile =
        waterFrame === 0 ? BG.waterAnim0 : waterFrame === 1 ? BG.waterAnim1 : BG.waterAnim2;
      auxCtx.fillStyle = 'rgba(0, 0, 64, 1)';
      for (const [wx, wy] of plan.interiorWater) {
        mainCtx.drawImage(
          getPlacedBg(s.zone, { x: wx, y: wy, tile: waterTile }),
          wx * TILE_PX,
          wy * TILE_PX,
        );
        auxCtx.fillRect(wx * TILE_PX, wy * TILE_PX, TILE_PX, TILE_PX);
      }
      // Tag all deep and shallow water cells in aux for reflections, and draw shallow ford pebbles/ripples
      const waterPal = BG_PALETTES[s.zone].water;
      const shallowFoamCss = cssRgb(waterPal[0]);
      const shallowMidCss = cssRgb(waterPal[1]);
      auxCtx.fillStyle = 'rgba(0, 0, 64, 1)';
      for (const { rect } of waterCells) auxCtx.fillRect(...rect);
      for (const { x: wx, y: wy, shallow } of waterCells) {
        if (!shallow) continue;
        const bx = wx * TILE_PX;
        const by = wy * TILE_PX;
        const shift = Math.floor(time * 3 + wx + wy) % 3;
        mainCtx.fillStyle = shallowMidCss;
        mainCtx.fillRect(bx + 4 + shift, by + 5, 3, 2);
        mainCtx.fillRect(bx + 9 - shift, by + 10, 3, 2);
        mainCtx.fillStyle = shallowFoamCss;
        mainCtx.fillRect(bx + 5 + shift, by + 5, 2, 1);
        mainCtx.fillRect(bx + 10 - shift, by + 10, 2, 1);
      }

      // Fading floor scorch craters from bomb detonations (drawn on ground below actors)
      for (const sc of activeScorches) {
        const age = Math.max(0, time - sc.born);
        const alpha = Math.max(0, Math.min(0.55, (1 - age / 3.5) * 0.55));
        const scx = Math.round(sc.x * TILE_PX);
        const scy = Math.round(sc.y * TILE_PX);
        mainCtx.fillStyle = `rgba(14, 12, 20, ${alpha.toFixed(3)})`;
        mainCtx.fillRect(scx - 5, scy - 2, 10, 4);
        mainCtx.fillRect(scx - 3, scy - 4, 6, 8);
      }
      const warpPhase = Math.floor(time * 3) % 2;
      for (const wp of plan.warpPads) {
        if (!wp.active) continue;
        mainCtx.drawImage(
          getPlacedBg(s.zone, {
            x: wp.x,
            y: wp.y,
            tile: warpPhase === 0 ? BG.warp0 : BG.warp1,
            transparentZero: true,
          }),
          wp.x * TILE_PX,
          wp.y * TILE_PX,
        );
        // Mark active warp runes emissive in aux so emissive-only bloom lights them up
        auxCtx.fillStyle = 'rgba(0, 235, 0, 1)';
        auxCtx.fillRect(wp.x * TILE_PX + 3, wp.y * TILE_PX + 3, 10, 10);
      }
      for (const d of openingDoors) {
        drawOpeningDoor(mainCtx, s.zone, d, Math.max(0, time - d.startTime));
      }

      // 2. Burning Fire hearth patches (4-frame fire leaning with wind)
      const fireNames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'FIRE_1',
        'FIRE_2',
        'FIRE_3',
        'FIRE_4',
      ];
      for (const f of s.fires) {
        const fIdx = Math.floor(time * 12 + f.x * 3 + f.y * 5) % 4;
        const wv = windVectorAt(world, s, f.x + 0.5, f.y + 0.5);
        const leanPx = Math.round(wv.dx * 2.5);
        const tilt = Math.max(-0.28, Math.min(0.28, wv.dx * 0.14));
        drawScaledSprite(
          mainCtx,
          fireNames[fIdx] ?? 'FIRE_1',
          f.x * TILE_PX + leanPx,
          f.y * TILE_PX,
          1,
          1,
          false,
          undefined,
          tilt,
        );
      }

      // 2.5. Ground Contact Shadows Pass (above ground & decals, strictly below all actors!)
      const room = currentRoom(world, s);
      for (const p of groundedProps) {
        drawContactShadow(mainCtx, s.zone, (p.x + 0.5) * TILE_PX, (p.y + 0.92) * TILE_PX, 6.5, 0);
      }
      for (const npc of room?.npcs ?? []) {
        drawContactShadow(mainCtx, s.zone, npc.x * TILE_PX, npc.y * TILE_PX + 4, 5.5, 0);
      }
      for (const p of s.pickups) {
        const born = pickupSpawnTime.get(p.id) ?? -1;
        let hopTiles: number;
        if (born >= 0 && time - born < 0.22) {
          const u = Math.max(0, Math.min(1, (time - born) / 0.22));
          hopTiles = (4 * 6 * u * (1 - u)) / TILE_PX;
        } else {
          hopTiles = Math.max(0, (1.5 - Math.sin(time * 4.5 + p.x) * 1.5) / TILE_PX);
        }
        drawContactShadow(mainCtx, s.zone, p.x * TILE_PX, p.y * TILE_PX + 5, 4.5, hopTiles);
      }
      for (const b of s.bombs) {
        const onWater =
          b.z <= 0.05 &&
          isWaterTile(tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(b.x), Math.floor(b.y)));
        if (!onWater) {
          drawContactShadow(mainCtx, s.zone, b.x * TILE_PX, b.y * TILE_PX + 5, 5.5 * 0.7, b.z);
        }
      }
      for (const e of s.enemies) {
        if (e.kind === 'cinderhull') {
          drawContactShadow(mainCtx, s.zone, e.x * TILE_PX, e.y * TILE_PX + 14, 13, 0);
        } else if (e.kind === 'wickgeist') {
          const hover = 0.24 - Math.sin(time * 5) * 0.08;
          drawContactShadow(mainCtx, s.zone, e.x * TILE_PX, e.y * TILE_PX + 6, 8.5, hover);
        } else if (e.kind === 'bat') {
          const flap = Math.floor(time * 11 * (e.aiState === 'flee' ? 2.4 : 1) + e.id) % 4;
          const flapH = 0.34 + (flap === 1 ? 0.08 : flap === 0 ? 0.04 : flap === 2 ? -0.05 : 0);
          drawContactShadow(mainCtx, s.zone, e.x * TILE_PX, e.y * TILE_PX + 5, 5, flapH);
        } else if (e.kind === 'slime') {
          const isMini = Boolean(e.splitGen && e.splitGen >= 1);
          const f =
            Math.floor(time * (isMini ? 10 : 7.5) * (e.aiState === 'flee' ? 2.4 : 1) + e.id) % 4;
          const hopH = f === 2 ? 0.08 : 0;
          drawContactShadow(
            mainCtx,
            s.zone,
            e.x * TILE_PX,
            e.y * TILE_PX + (isMini ? 1 : 2),
            isMini ? 4.2 : 6,
            hopH,
          );
        } else {
          drawContactShadow(mainCtx, s.zone, e.x * TILE_PX, e.y * TILE_PX + 5, 6, 0);
        }
      }
      if (time >= fallAnimUntil) {
        const rollU =
          s.rollTimer > 0 ? Math.max(0, Math.min(1, 1 - s.rollTimer / ROLL_DURATION)) : 0;
        const pipHopTiles = s.rollTimer > 0 ? (4 * 2 * rollU * (1 - rollU)) / TILE_PX : 0;
        drawContactShadow(
          mainCtx,
          s.zone,
          s.x * TILE_PX,
          s.y * TILE_PX + 5,
          pipShadowRadius(s),
          pipHopTiles,
        );
      }

      // 3. Pass 3: Unified Foot-Sorted Actors, All Bombs (Grounded & Hopping), 3D Props & Overheads
      interface Drawable extends DepthSortable {
        draw: () => void;
      }
      const rawActors: Drawable[] = [];
      let tieSeq = 0;

      for (const p of plan.props) {
        if (isFlatFloorDecal(p.tile)) continue;
        rawActors.push({
          footY: actorFootY('prop', p.y),
          orderTie: tieSeq++,
          draw: () => {
            const img = getPlacedBg(s.zone, p);
            mainCtx.drawImage(img, p.x * TILE_PX, p.y * TILE_PX);
            eraseAux(img, p.x * TILE_PX, p.y * TILE_PX);
            // Ice blocks catch the light, so they still read as ice in a dim cave
            if (p.tile === BG.iceBlock) auxCtx.drawImage(iceAux, p.x * TILE_PX, p.y * TILE_PX);
          },
        });
      }

      for (const o of plan.overhead) {
        rawActors.push({
          footY: actorFootY('overhead', o.y),
          orderTie: tieSeq++,
          draw: () => {
            const img = getPlacedBg(s.zone, o);
            mainCtx.drawImage(img, o.x * TILE_PX, o.y * TILE_PX);
            eraseAux(img, o.x * TILE_PX, o.y * TILE_PX);
          },
        });
      }

      for (const npc of room?.npcs ?? []) {
        rawActors.push({
          footY: actorFootY('npc', npc.y),
          orderTie: tieSeq++,
          draw: () => drawNpc(mainCtx, npc, s.x, s.y, time),
        });
      }

      for (const [i, blk] of s.blocks.entries()) {
        let tw = blockTweens.get(i);
        const curProgress =
          tw && tw.startTime >= 0 ? easeOutCubic((time - tw.startTime) / 0.14) : 1;
        const curX = tw ? tw.fromX + (tw.targetX - tw.fromX) * curProgress : blk.x;
        const curY = tw ? tw.fromY + (tw.targetY - tw.fromY) * curProgress : blk.y;

        if (!tw) {
          tw = { targetX: blk.x, targetY: blk.y, fromX: blk.x, fromY: blk.y, startTime: -1 };
          blockTweens.set(i, tw);
        } else if (tw.targetX !== blk.x || tw.targetY !== blk.y) {
          if (Math.hypot(blk.x - curX, blk.y - curY) <= 2.1) {
            tw = { targetX: blk.x, targetY: blk.y, fromX: curX, fromY: curY, startTime: time };
          } else {
            tw = { targetX: blk.x, targetY: blk.y, fromX: blk.x, fromY: blk.y, startTime: -1 };
          }
          blockTweens.set(i, tw);
        }

        const u = tw.startTime < 0 ? 1 : easeOutCubic((time - tw.startTime) / 0.14);
        const visX = tw.fromX + (tw.targetX - tw.fromX) * u;
        const visY = tw.fromY + (tw.targetY - tw.fromY) * u;
        const nudge = u >= 1 && blk.pushCharge > 0.05 ? 1 : 0;
        const px = Math.round(visX * TILE_PX + blk.pushDirX * nudge);
        const py = Math.round(visY * TILE_PX + blk.pushDirY * nudge);
        rawActors.push({
          footY: actorFootY('block', visY),
          orderTie: tieSeq++,
          draw: () => {
            drawContactShadow(mainCtx, s.zone, px + 8, py + 15, 7, 0);
            const img = getPlacedBg(s.zone, {
              x: blk.x,
              y: blk.y,
              tile: BG.pushBlock,
              transparentZero: true,
            });
            mainCtx.drawImage(img, px, py);
            eraseAux(img, px, py);
          },
        });
      }

      for (const t of s.torches) {
        if (!t.lit) continue;
        const fast = Boolean(t.timedSeconds && !s.roomSolved && t.timer < 2.0);
        const rate = fast ? 20 : 11;
        const fIdx = Math.floor(time * rate + t.x * 2 + t.y) % 4;
        const wv = windVectorAt(world, s, t.x + 0.5, t.y + 0.5);
        const leanPx = Math.round(wv.dx * 2.5);
        const tilt = Math.max(-0.28, Math.min(0.28, wv.dx * 0.14));
        rawActors.push({
          footY: actorFootY('torchFlame', t.y),
          orderTie: tieSeq++,
          draw: () => {
            if (fast && Math.floor(time * 16) % 4 === 0) return;
            drawScaledSprite(
              mainCtx,
              fireNames[fIdx] ?? 'FIRE_1',
              t.x * TILE_PX + leanPx,
              t.y * TILE_PX - 5,
              1,
              1,
              false,
              undefined,
              tilt,
            );
          },
        });
      }

      for (const p of s.pickups) {
        let born = pickupSpawnTime.get(p.id);
        if (born === undefined) {
          born = time;
          pickupSpawnTime.set(p.id, born);
        }
        let popScale = 1;
        let hopPx = 0;
        if (born >= 0 && time - born < 0.22) {
          const u = Math.max(0, Math.min(1, (time - born) / 0.22));
          popScale = Math.max(0.2, easeOutBack(u));
          hopPx = Math.round(4 * 6 * u * (1 - u));
        }

        const prevPos = pickupPrevPos.get(p.id);
        let sx = popScale;
        let sy = popScale;
        let tiltRad = 0;
        if (prevPos && dt > 0.001) {
          const vx = (p.x - prevPos.x) / dt;
          const vy = (p.y - prevPos.y) / dt;
          const speed = Math.hypot(vx, vy);
          if (speed > 0.8 && speed < 40) {
            const zip = Math.min(1, (speed - 0.8) / 5);
            sx *= 1 - 0.1 * zip;
            sy *= 1 + 0.16 * zip;
            tiltRad = Math.max(-0.28, Math.min(0.28, (vx / speed) * 0.24 * zip));
          }
        }
        pickupPrevPos.set(p.id, { x: p.x, y: p.y });

        const bob = hopPx > 0 ? 0 : Math.round(Math.sin(time * 4.5 + p.x) * 1.5);
        const dx = Math.round(p.x * TILE_PX - 8);
        const dy = Math.round(p.y * TILE_PX - 9) + bob - hopPx;
        rawActors.push({
          footY: actorFootY('pickup', p.y),
          orderTie: tieSeq++,
          draw: () => drawPickup(mainCtx, p.kind, dx, dy, time, sx, sy, tiltRad),
        });
      }

      for (const fx of activeMicroVfx) {
        rawActors.push({
          footY: actorFootY('microVfx', fx.y),
          orderTie: tieSeq++,
          draw: () => drawMicroVfx(mainCtx, s.zone, fx, Math.max(0, time - fx.born)),
        });
      }

      // ALL bombs (both grounded and mid-hop b.z > 0) sort by ground contact footY!
      for (const b of s.bombs) {
        const { sx, sy, tiltRad } = computeBombDeform(b, time);
        const gx = Math.round(b.x * TILE_PX - 8);
        const gy = Math.round(b.y * TILE_PX - 8);
        const elevPx = Math.round(b.z * TILE_PX);
        const floatingOnWater =
          b.z <= 0.05 &&
          isWaterTile(tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(b.x), Math.floor(b.y)));
        const waterBob = floatingOnWater ? Math.round(Math.sin(time * 6 + b.id) * 1.5) : 0;
        rawActors.push({
          footY: actorFootY('bomb', b.y),
          orderTie: tieSeq++,
          draw: () => {
            if (floatingOnWater) {
              drawFloatingWaterRing(
                mainCtx,
                s.zone,
                Math.round(b.x * TILE_PX),
                Math.round(b.y * TILE_PX) + 2,
                b.id,
                time,
              );
            }
            drawBomb(mainCtx, b, gx, gy - 1 - elevPx + waterBob, time, sx, sy, tiltRad);
          },
        });
      }

      for (const e of s.enemies) {
        const ek: DepthActorKind =
          e.kind === 'slime' && e.splitGen && e.splitGen >= 1 ? 'mini-slime' : e.kind;
        const enemyInShallow = isShallowWaterTile(
          tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(e.x), Math.floor(e.y)),
        );
        rawActors.push({
          footY: actorFootY(ek, e.y),
          orderTie: tieSeq++,
          draw: () => {
            if (enemyInShallow && e.kind !== 'bat' && e.kind !== 'wickgeist') {
              drawFloatingWaterRing(
                mainCtx,
                s.zone,
                Math.round(e.x * TILE_PX),
                Math.round(e.y * TILE_PX) + 3,
                e.id,
                time,
              );
            }
            drawEnemy(mainCtx, e, time);
          },
        });
      }

      const pipInShallow =
        s.rollTimer <= 0 &&
        isShallowWaterTile(tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(s.x), Math.floor(s.y)));
      rawActors.push({
        footY: actorFootY('pip', s.y),
        orderTie: tieSeq,
        draw: () => {
          if (pipInShallow) {
            drawFloatingWaterRing(
              mainCtx,
              s.zone,
              Math.round(s.x * TILE_PX),
              Math.round(s.y * TILE_PX) + 3,
              0,
              time,
            );
          }
          drawPip(mainCtx, s, time);
        },
      });

      const sortedActors = sortDepthItems(rawActors);
      for (const a of sortedActors) a.draw();

      // 4. Pass 4: True walk-under north doorway lintels, chimney smoke & wind!
      mainCtx.drawImage(canopyLayer, 0, 0);
      eraseAux(canopyLayer, 0, 0);
      for (const [cx, cy] of plan.chimneys) {
        const rise = Math.floor((time * 7) % 10);
        const sway = Math.round(Math.sin(time * 4) * 1.5);
        const wv = windVectorAt(world, s, cx / TILE_PX, Math.max(0.5, cy / TILE_PX));
        const windLean = Math.round(wv.dx * 2.5 * (1 + rise * 0.12));
        drawObjSprite(mainCtx, 'CHIMNEY_PUFF', cx + sway + windLean, Math.max(0, cy - rise));
      }
      drawWindAndGusts(mainCtx, s.zone, room?.wind, s.gusts, time);

      // 5. Enemy projectiles (4-frame spinning soul-fire / ember orb)
      const projFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'PROJ_1',
        'PROJ_2',
        'PROJ_3',
        'PROJ_4',
      ];
      for (const pr of s.projectiles) {
        const pIdx = Math.floor(time * 16 + pr.x * 2) % 4;
        drawObjSprite(
          mainCtx,
          projFrames[pIdx] ?? 'PROJ_1',
          Math.round(pr.x * TILE_PX - 4),
          Math.round(pr.y * TILE_PX - 4),
        );
      }

      // 8. Connected '+' Cross & Radial Explosions
      for (const bl of activeBlasts) {
        drawBlastSegment(mainCtx, bl, time - bl.born);
      }

      // 9. Dark-room Bayer-dithered lantern mask (`Lantern Hall`)

      // 10. Crisp 4x nearest-neighbour blit to display canvas
    },

    frame: frameBuf,
    aux: auxBuf,
  };
}
