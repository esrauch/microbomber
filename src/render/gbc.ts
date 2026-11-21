/**
 * 4-Pass Pure-2D Game Boy Color renderer (`ASSETS.md` §1–§4):
 * - Pass 1 & 2 (`roomLayer`): Seamless 8x8 blob ground, curved waterbanks, pit rims,
 *   2-tile mitered Shrine walls, 2-tall cliffs, 2x2 trees, connected props & building bases.
 * - Pass 3: Y-sorted 6-colour actors (Pip 16x18, Villagers, Bombs, 24x24 Wickgeist, 32x32 Cinderhull).
 * - Pass 4 (`canopyLayer`): Overhead roof eaves, tree crowns & north doorway arch lintels,
 *   chimney puffs, airborne bombs, connected '+' cross explosions, and Bayer lantern mask.
 */
import type { BlastShape, Bomb, Enemy, NpcSpec, PickupKind, ZoneId } from '../game/types';
import {
  LIFT_DELAY,
  ROLL_DURATION,
  ROOM_H,
  ROOM_W,
  type State,
  type World,
  computeThrowTarget,
  currentRoom,
  isRoomLit,
  tileAt,
} from '../game/world';
import { BG, type BgTile, OBJ, type ObjSprite, type ObjSpriteName } from './gbcArt';
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

export interface GbcView {
  rebuild(world: World, s: State): void;
  sync(world: World, s: State, time: number): void;
  resize(stageWidth: number, stageHeight: number): void;
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
  kind: 'powder' | 'ember';
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
  kind: 'powder' | 'ember';
}

interface MicroVfxInstance {
  kind: 'splash' | 'swallow';
  bombKind: 'powder' | 'ember';
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

const UPSCALE = 4;
const INK_CSS = cssRgb(INK_RGB);
const FIRE_WHITE = cssRgb(OBJ_PALETTES.fire[0]);
const FIRE_LIGHT = cssRgb(OBJ_PALETTES.fire[1]);
const FIRE_MID = cssRgb(OBJ_PALETTES.fire[2]);

export function makeGbcView(canvas: HTMLCanvasElement): GbcView {
  canvas.width = NATIVE_W * UPSCALE;
  canvas.height = NATIVE_H * UPSCALE;
  const displayCtx = canvas.getContext('2d');
  if (!displayCtx) {
    throw new Error('2D display canvas context unavailable');
  }
  displayCtx.imageSmoothingEnabled = false;

  const [frameBuf, mainCtx] = canvasOf(NATIVE_W, NATIVE_H);
  const [roomLayer, rctx] = canvasOf(NATIVE_W, NATIVE_H);
  const [canopyLayer, cctx] = canvasOf(NATIVE_W, NATIVE_H);
  if (!mainCtx || !rctx || !cctx) {
    throw new Error('2D offscreen canvas context unavailable');
  }
  mainCtx.imageSmoothingEnabled = false;
  rctx.imageSmoothingEnabled = false;
  cctx.imageSmoothingEnabled = false;

  const [darkLayer, darkCtx] = canvasOf(NATIVE_W, NATIVE_H);
  const darkImg = darkCtx ? darkCtx.createImageData(NATIVE_W, NATIVE_H) : null;

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

  const bgCache = new Map<string, HTMLCanvasElement>();
  const getPlacedBg = (zone: ZoneId, p: PlacedTile): HTMLCanvasElement => {
    const sig = `${zone}|${p.tile.quads.join(',')}|${p.transparentZero ? 1 : 0}|${p.topShadow ? 1 : 0}|${p.tile.rows.join('')}`;
    let c = bgCache.get(sig);
    if (!c) {
      c = bakeBg(p.tile, zone, Boolean(p.transparentZero), Boolean(p.topShadow));
      bgCache.set(sig, c);
    }
    return c;
  };

  let plan: RoomRenderPlan = {
    ground: [],
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
  let walkCycle = 0;
  let throwAnimUntil = 0;
  let crouchAnimUntil = 0;
  let liftPopUntil = 0;
  let wasRolling = false;
  let rollLandUntil = 0;
  let fallAnimUntil = 0;
  let holdAnimUntil = 0;
  let heldKind: PickupKind = 'ember-bomb';
  let activeBlasts: BlastInstance[] = [];
  let activeMicroVfx: MicroVfxInstance[] = [];
  const bombLandUntil = new Map<number, number>();
  const bombPrevKin = new Map<number, BombKinSnapshot>();
  const bombRollPhase = new Map<number, number>();
  const blockTweens = new Map<number, BlockTween>();
  const pickupSpawnTime = new Map<string, number>();
  const pickupPrevPos = new Map<string, { x: number; y: number }>();
  const closedDoors = new Map<string, { x: number; y: number; tile: 'D' | 'K' | 'S' }>();
  let openingDoors: DoorTween[] = [];

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

  function drawObjSprite(
    ctx: CanvasRenderingContext2D,
    name: ObjSpriteName,
    dx: number,
    dy: number,
    flipX = false,
    pal?: ObjPaletteId,
  ): void {
    const sp = getObj(name, pal);
    if (!flipX) {
      ctx.drawImage(sp, dx, dy);
    } else {
      ctx.save();
      ctx.translate(dx + sp.width, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sp, 0, 0);
      ctx.restore();
    }
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
    const sp = getObj(name, pal);
    const pivotX = dx + sp.width * 0.5;
    const pivotY = dy + sp.height;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(pivotX, pivotY);
    if (tiltRad !== 0) ctx.rotate(tiltRad);
    ctx.scale(flipX ? -sx : sx, sy);
    ctx.drawImage(sp, -sp.width * 0.5, -sp.height);
    ctx.restore();
  }

  function drawRotatedObj(
    ctx: CanvasRenderingContext2D,
    name: ObjSpriteName,
    dx: number,
    dy: number,
    quarterTurns: number,
  ): void {
    const sp = getObj(name);
    if (quarterTurns === 0) {
      ctx.drawImage(sp, dx, dy);
      return;
    }
    ctx.save();
    ctx.translate(dx + 8, dy + 8);
    ctx.rotate((quarterTurns * Math.PI) / 2);
    ctx.drawImage(sp, -8, -8);
    ctx.restore();
  }

  const LANDING_RING_OFFSETS: ReadonlyArray<readonly [number, number]> = [
    [-1, -2],
    [0, -2],
    [1, -2],
    [-2, -1],
    [2, -1],
    [-3, 0],
    [3, 0],
    [-2, 1],
    [2, 1],
    [-1, 2],
    [0, 2],
    [1, 2],
  ];

  function drawThrowArcPreview(
    ctx: CanvasRenderingContext2D,
    s: State,
    targetX: number,
    targetY: number,
    isEmber: boolean,
    time: number,
  ): void {
    const dotColor = isEmber ? FIRE_MID : FIRE_LIGHT;
    const txPx = Math.round(targetX * TILE_PX);
    const tyPx = Math.round(targetY * TILE_PX);

    // 7x5 crisp pixel landing ring / target shadow with 1px ink outline
    ctx.fillStyle = INK_CSS;
    for (const [ox, oy] of LANDING_RING_OFFSETS) {
      ctx.fillRect(txPx + ox - 1, tyPx + oy, 3, 1);
      ctx.fillRect(txPx + ox, tyPx + oy - 1, 1, 3);
    }
    ctx.fillStyle = dotColor;
    for (const [ox, oy] of LANDING_RING_OFFSETS) {
      ctx.fillRect(txPx + ox, tyPx + oy, 1, 1);
    }
    if (Math.floor(time * 6) % 2 === 0) {
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(txPx - 1, tyPx, 3, 1);
      ctx.fillRect(txPx, tyPx - 1, 1, 3);
      ctx.fillStyle = FIRE_WHITE;
      ctx.fillRect(txPx, tyPx, 1, 1);
    }

    // Dotted parabolic arc from Pip's overhead hands to landing target
    const startX = s.x * TILE_PX;
    const startY = s.y * TILE_PX - 14;
    const endX = targetX * TILE_PX;
    const endY = targetY * TILE_PX;
    const march = (time * 3.2) % 1;
    const dotCount = 8;

    for (let i = 0; i < dotCount; i++) {
      const u = (i + march) / dotCount;
      const px = Math.round(startX + (endX - startX) * u);
      const py = Math.round(startY + (endY - startY) * u - 4 * 14 * u * (1 - u));
      const big = u >= 0.14 && u <= 0.86;
      if (big) {
        ctx.fillStyle = INK_CSS;
        ctx.fillRect(px - 2, py - 1, 4, 2);
        ctx.fillRect(px - 1, py - 2, 2, 4);
        ctx.fillStyle = dotColor;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      } else {
        ctx.fillStyle = INK_CSS;
        ctx.fillRect(px - 1, py, 3, 1);
        ctx.fillRect(px, py - 1, 1, 3);
        ctx.fillStyle = dotColor;
        ctx.fillRect(px, py, 1, 1);
      }
    }
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

  const pickupMap: Record<Exclude<PickupKind, 'ember-bomb'>, ObjSpriteName> = {
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
    if (kind === 'ember-bomb' || kind === 'cinder-core') {
      if (Math.floor(time * 6) % 2 === 0) {
        drawScaledSprite(ctx, 'SPARKLE_CELL', dx, dy, sx, sy, false, undefined, tiltRad);
      }
    }
    if (kind === 'ember-bomb') {
      drawScaledSprite(
        ctx,
        Math.floor(time * 5) % 2 === 0 ? 'EMBER_1' : 'EMBER_2',
        dx,
        dy,
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
    const idx =
      b.fuse > 0.55
        ? Math.floor(time * 10) % 2
        : b.fuse > 0.2
          ? 1 + (Math.floor(time * 16) % 2)
          : 2 + (Math.floor(time * 24) % 2);
    const powderFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
      'POWDER_1',
      'POWDER_2',
      'POWDER_3',
      'POWDER_4',
    ];
    const emberFrames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
      'EMBER_1',
      'EMBER_2',
      'EMBER_3',
      'EMBER_4',
    ];
    const list = b.kind === 'ember' ? emberFrames : powderFrames;
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
      fx.bombKind === 'ember' ? cssRgb(OBJ_PALETTES.fire[3]) : cssRgb(OBJ_PALETTES.powder[4]);
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

  function drawNpc(ctx: CanvasRenderingContext2D, npc: NpcSpec, time: number): void {
    const dx = Math.round(npc.x * TILE_PX - 8);
    if (npc.id === 'spire-plaque') {
      drawObjSprite(ctx, 'NPC_PLAQUE', dx, Math.round(npc.y * TILE_PX - 11));
      return;
    }
    const bob = Math.floor(time * 2.2) % 2;
    const dy = Math.round(npc.y * TILE_PX - 12) + bob;
    drawObjSprite(ctx, 'SHADOW_CELL', dx, Math.round(npc.y * TILE_PX - 8));
    if (npc.id === 'fern') {
      drawObjSprite(ctx, 'NPC_FERN', dx, dy);
    } else if (npc.id === 'hal') {
      drawObjSprite(ctx, 'NPC_HAL', dx, dy);
    } else {
      drawObjSprite(ctx, 'NPC_BRAM', dx, dy);
    }
  }

  function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
    const hitFlash = e.invulnTimer > 0 && Math.floor(time * 24) % 2 === 0;
    const flashPal: ObjPaletteId | undefined = hitFlash ? 'crimson' : undefined;

    if (e.kind === 'slime') {
      const f = Math.floor(time * 6 + e.id) % 3;
      const name: ObjSpriteName = f === 0 ? 'SLIME_1' : f === 1 ? 'SLIME_2' : 'SLIME_3';
      drawObjSprite(
        ctx,
        name,
        Math.round(e.x * TILE_PX - 8),
        Math.round(e.y * TILE_PX - 9),
        false,
        flashPal,
      );
    } else if (e.kind === 'bat') {
      const flap = Math.floor(time * 12 + e.id) % 2;
      const bob = Math.round(Math.sin(time * 8 + e.id) * 1.5);
      const dx = Math.round(e.x * TILE_PX - 8);
      drawObjSprite(ctx, 'SHADOW_CELL', dx, Math.round(e.y * TILE_PX - 7));
      drawObjSprite(
        ctx,
        flap === 0 ? 'BAT_1' : 'BAT_2',
        dx,
        Math.round(e.y * TILE_PX - 11 + bob),
        false,
        flashPal,
      );
    } else if (e.kind === 'shielder') {
      const step = Math.floor(time * 6 + e.id) % 2;
      const dx = Math.round(e.x * TILE_PX - 8);
      const dy = Math.round(e.y * TILE_PX - 10);
      drawObjSprite(ctx, 'SHADOW_CELL', dx, dy + 2);
      drawObjSprite(ctx, step === 0 ? 'SHIELDER_1' : 'SHIELDER_2', dx, dy, false, flashPal);
      if (e.armored) {
        if (Math.abs(e.fx) > Math.abs(e.fy)) {
          const sx = e.fx > 0 ? dx + 11 : dx - 1;
          drawObjSprite(ctx, 'WOOD_SHIELD_V', sx, dy + 3);
        } else {
          const sy = e.fy > 0 ? dy + 9 : dy - 1;
          drawObjSprite(ctx, 'WOOD_SHIELD_H', dx + 2, sy);
        }
      }
    } else if (e.kind === 'wickgeist') {
      const bob = Math.round(Math.sin(time * 5) * 2);
      const dx = Math.round(e.x * TILE_PX - 12);
      const dy = Math.round(e.y * TILE_PX - 14) + bob;
      drawObjSprite(ctx, e.armored ? 'WICKGEIST_DARK' : 'WICKGEIST_LIT', dx, dy, false, flashPal);
    } else if (e.kind === 'cinderhull') {
      // Full 32x32 (2x2 tile) Oracle Shrine Boss!
      const beat = Math.floor(time * (e.armored ? 4 : 8)) % 2;
      const dx = Math.round(e.x * TILE_PX - 16);
      const dy = Math.round(e.y * TILE_PX - 15);
      const name: ObjSpriteName = e.armored
        ? beat === 0
          ? 'CINDERHULL_ARMORED_1'
          : 'CINDERHULL_ARMORED_2'
        : beat === 0
          ? 'CINDERHULL_EXPOSED_1'
          : 'CINDERHULL_EXPOSED_2';
      const warnRegrow = !e.armored && e.exposedTimer > 0 && e.exposedTimer < 1.2 && beat === 1;
      drawObjSprite(ctx, name, dx, dy, false, flashPal ?? (warnRegrow ? 'green' : undefined));
    }
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
        rem > 0.24 ? 'PIP_FALL_1' : rem > 0.12 ? 'PIP_FALL_2' : 'PIP_FALL_3';
      drawObjSprite(ctx, fall, dx, dy);
      return;
    }

    drawObjSprite(ctx, 'SHADOW_CELL', dx, Math.round(s.y * TILE_PX - 8));

    if (time < holdAnimUntil) {
      drawObjSprite(ctx, 'PIP_GET', dx, dy);
      drawPickup(ctx, heldKind, dx, dy - 12, time);
      return;
    }

    if (s.rollTimer > 0) {
      const u = Math.max(0, Math.min(1, 1 - s.rollTimer / ROLL_DURATION));
      const rDir =
        Math.abs(s.rollDirX) > Math.abs(s.rollDirY) ? 'EAST' : s.rollDirY < 0 ? 'NORTH' : 'SOUTH';
      const rFlip = rDir === 'EAST' && s.rollDirX < 0;
      const phase = Math.min(3, Math.floor(u * 4));
      const rollSprite: ObjSpriteName =
        phase % 2 === 0 ? `PIP_${rDir}_ROLL_1` : `PIP_${rDir}_ROLL_2`;
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
    const stepIdx = Math.floor(walkCycle) % 4; // 4-beat: idle, step L, idle, step R
    const moving = walkCycle > 0;

    const carried = s.bombs.find((b) => Boolean(b.carried));
    if (carried) {
      let liftSx = baseSx;
      let liftSy = baseSy;
      if (time < liftPopUntil) {
        const e = easeOutCubic(1 - (liftPopUntil - time) / 0.14);
        liftSx *= 0.9 + (1 - 0.9) * e;
        liftSy *= 1.14 + (1 - 1.14) * e;
      }
      const second = moving && stepIdx >= 2;
      draw(second ? `PIP_${dir}_CARRY_2` : `PIP_${dir}_CARRY_1`, liftSx, liftSy);
      const bombOffsetY = (second ? 10 : 11) + Math.round((liftSy - 1) * 12);
      drawBomb(ctx, carried, dx, dy - bombOffsetY, time, liftSx, liftSy);
      return;
    }

    if (s.pullHoldTime > 0 && s.pullHoldTime < LIFT_DELAY) {
      draw(`PIP_${dir}_LIFT`, 1.12, 0.88);
      return;
    }
    if (time < crouchAnimUntil) {
      draw(`PIP_${dir}_LIFT`, 1.08, 0.92);
      return;
    }
    if (time < throwAnimUntil) {
      draw(`PIP_${dir}_THROW`);
      return;
    }
    if (s.blocks.some((b) => b.pushCharge > 0.04)) {
      draw(stepIdx < 2 ? `PIP_${dir}_PUSH_1` : `PIP_${dir}_PUSH_2`);
      return;
    }
    if (moving) {
      draw(
        stepIdx === 1
          ? `PIP_${dir}_WALK_L`
          : stepIdx === 3
            ? `PIP_${dir}_WALK_R`
            : `PIP_${dir}_IDLE`,
      );
      return;
    }
    // Standing still: the hood point sways every second or so
    draw(time % 1.3 > 1.0 ? `PIP_${dir}_IDLE_B` : `PIP_${dir}_IDLE`);
  }

  function drawBlastSegment(ctx: CanvasRenderingContext2D, bl: BlastInstance, age: number): void {
    const dx = Math.round(bl.x * TILE_PX - 8);
    const dy = Math.round(bl.y * TILE_PX - 8);
    const stage = Math.min(3, Math.floor((age / 0.28) * 4));

    if (bl.shape === 'single' || bl.kind === 'ember' || stage >= 2) {
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

  function applyDarkRoomMask(ctx: CanvasRenderingContext2D, s: State): void {
    if (!darkCtx || !darkImg) return;
    const lights: Array<{ x: number; y: number; r: number }> = [
      { x: s.x * TILE_PX, y: s.y * TILE_PX - 2, r: 34 },
    ];
    for (const f of s.fires) {
      lights.push({ x: (f.x + 0.5) * TILE_PX, y: (f.y + 0.5) * TILE_PX, r: 28 });
    }
    for (const b of s.bombs) {
      if (b.kind === 'ember') {
        lights.push({ x: b.x * TILE_PX, y: (b.y - b.z) * TILE_PX, r: 22 });
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
        let ink = true;
        if (minRatio < 0.78) {
          ink = false;
        } else if (minRatio < 1.02) {
          ink = (px + py) % 2 === 0 && (px & 1) === 0;
        } else if (minRatio < 1.24) {
          ink = (px + py) % 2 === 0;
        }
        const idx = (py * NATIVE_W + px) * 4;
        data[idx] = INK_RGB[0];
        data[idx + 1] = INK_RGB[1];
        data[idx + 2] = INK_RGB[2];
        data[idx + 3] = ink ? 255 : 0;
      }
    }
    darkCtx.putImageData(darkImg, 0, 0);
    ctx.drawImage(darkLayer, 0, 0);
  }

  return {
    rebuild(world: World, s: State): void {
      const rk = `${s.zone}:${s.rx},${s.ry}`;
      const roomChanged = rk !== activeRoomKey || s.events.includes('player-respawn');
      activeRoomKey = rk;

      if (roomChanged) {
        activeBlasts = [];
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

      plan = buildRoomLayout(world, s);

      rctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
      cctx.clearRect(0, 0, NATIVE_W, NATIVE_H);

      for (const g of plan.ground) {
        rctx.drawImage(getPlacedBg(s.zone, g), g.x * TILE_PX, g.y * TILE_PX);
      }
      for (const p of plan.props) {
        rctx.drawImage(getPlacedBg(s.zone, p), p.x * TILE_PX, p.y * TILE_PX);
      }
      for (const c of plan.ceiling) {
        cctx.drawImage(getPlacedBg(s.zone, c), c.x * TILE_PX, c.y * TILE_PX);
      }
    },

    sync(world: World, s: State, time: number): void {
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
      if (movedDist > 0.004 && movedDist < 1.2) {
        walkCycle += movedDist * 5.2;
      } else if (s.blocks.some((b) => b.pushCharge > 0.04)) {
        walkCycle += dt * 9;
      } else {
        walkCycle = 0;
      }

      for (const ev of s.events) {
        if (ev === 'bomb-throw') {
          throwAnimUntil = time + 0.16;
        } else if (ev === 'bomb-lift') {
          liftPopUntil = time + 0.14;
        } else if (ev === 'bomb-drop') {
          crouchAnimUntil = time + 0.1;
        } else if (ev === 'door-unlock' || ev === 'room-solved') {
          syncDoorState(world, s, false);
        } else if (ev === 'pit-fall') {
          fallAnimUntil = time + 0.36;
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

      const resolveHazardSpot = (
        targetTile: '~' | '^',
      ): { x: number; y: number; bombKind: 'powder' | 'ember' } => {
        for (let i = 0; i < vanishedBombs.length; i++) {
          const cand = vanishedBombs[i];
          if (!cand) continue;
          const px = cand.x + cand.vx * dt;
          const py = cand.y + cand.vy * dt;
          const cx = Math.floor(px);
          const cy = Math.floor(py);
          if (tileAt(world, s, s.zone, s.rx, s.ry, cx, cy) === targetTile) {
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
            if (tileAt(world, s, s.zone, s.rx, s.ry, nx, ny) === targetTile) {
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
        const fallbackKind: 'powder' | 'ember' = s.equipped ?? 'powder';
        for (const dist of [0.65, 1.15, 1.8, 2.4, 3.0]) {
          const sx = s.x + s.aimX * dist;
          const sy = s.y + s.aimY * dist;
          const tx = Math.floor(sx);
          const ty = Math.floor(sy);
          if (tileAt(world, s, s.zone, s.rx, s.ry, tx, ty) === targetTile) {
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
        if (!b.carried && prev) {
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
        if (!b.carried && planarSpeed > 0.35) {
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
          if (!b.carried) {
            bombLandUntil.set(b.id, time + 0.14);
          }
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
      }
      activeBlasts = activeBlasts.filter((b) => time - b.born < 0.28);

      // 1. Pass 1 & 2: Static terrain + animated interior water, warp runes & retracting doors
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.drawImage(roomLayer, 0, 0);

      const waterFrame = Math.floor(time * 2.6) % 3;
      const waterTile =
        waterFrame === 0 ? BG.waterAnim0 : waterFrame === 1 ? BG.waterAnim1 : BG.waterAnim2;
      for (const [wx, wy] of plan.interiorWater) {
        mainCtx.drawImage(
          getPlacedBg(s.zone, { x: wx, y: wy, tile: waterTile }),
          wx * TILE_PX,
          wy * TILE_PX,
        );
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
      }
      for (const d of openingDoors) {
        drawOpeningDoor(mainCtx, s.zone, d, Math.max(0, time - d.startTime));
      }

      // 2. Burning Ember hearth patches (4-frame fire)
      const fireNames: readonly [ObjSpriteName, ObjSpriteName, ObjSpriteName, ObjSpriteName] = [
        'FIRE_1',
        'FIRE_2',
        'FIRE_3',
        'FIRE_4',
      ];
      for (const f of s.fires) {
        const fIdx = Math.floor(time * 12 + f.x * 3 + f.y * 5) % 4;
        drawObjSprite(mainCtx, fireNames[fIdx] ?? 'FIRE_1', f.x * TILE_PX, f.y * TILE_PX);
      }

      // 3. Pass 3: Y-sorted ground actors
      interface Drawable {
        footY: number;
        draw: () => void;
      }
      const actors: Drawable[] = [];
      const room = currentRoom(world, s);

      for (const o of plan.overhead) {
        actors.push({
          footY: o.y + 0.99,
          draw: () => mainCtx.drawImage(getPlacedBg(s.zone, o), o.x * TILE_PX, o.y * TILE_PX),
        });
      }

      for (const npc of room?.npcs ?? []) {
        actors.push({
          footY: npc.y,
          draw: () => drawNpc(mainCtx, npc, time),
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
        actors.push({
          footY: visY + 0.5,
          draw: () =>
            mainCtx.drawImage(
              getPlacedBg(s.zone, {
                x: blk.x,
                y: blk.y,
                tile: BG.pushBlock,
                transparentZero: true,
              }),
              px,
              py,
            ),
        });
      }

      for (const t of s.torches) {
        if (!t.lit) continue;
        const fast = Boolean(t.timedSeconds && !s.roomSolved && t.timer < 2.0);
        const rate = fast ? 20 : 11;
        const fIdx = Math.floor(time * rate + t.x * 2 + t.y) % 4;
        actors.push({
          footY: t.y + 0.55,
          draw: () => {
            if (fast && Math.floor(time * 16) % 4 === 0) return;
            drawObjSprite(mainCtx, fireNames[fIdx] ?? 'FIRE_1', t.x * TILE_PX, t.y * TILE_PX - 5);
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
        actors.push({
          footY: p.y,
          draw: () => {
            drawObjSprite(mainCtx, 'SHADOW_CELL', dx, Math.round(p.y * TILE_PX - 8));
            drawPickup(mainCtx, p.kind, dx, dy, time, sx, sy, tiltRad);
          },
        });
      }

      for (const fx of activeMicroVfx) {
        actors.push({
          footY: fx.y - 0.05,
          draw: () => drawMicroVfx(mainCtx, s.zone, fx, Math.max(0, time - fx.born)),
        });
      }

      for (const b of s.bombs) {
        if (b.carried || b.z > 0.08) continue;
        const { sx, sy, tiltRad } = computeBombDeform(b, time);
        const gx = Math.round(b.x * TILE_PX - 8);
        const gy = Math.round(b.y * TILE_PX - 8);
        const elevPx = Math.round(b.z * TILE_PX);
        actors.push({
          footY: b.y,
          draw: () => {
            drawObjSprite(mainCtx, 'SHADOW_CELL', gx, gy);
            drawBomb(mainCtx, b, gx, gy - 1 - elevPx, time, sx, sy, tiltRad);
          },
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

      // 4. Pass 4: Overhead roof eaves, tree crowns, north arch lintels & chimney smoke!
      mainCtx.drawImage(canopyLayer, 0, 0);
      for (const [cx, cy] of plan.chimneys) {
        const rise = Math.floor((time * 7) % 10);
        const sway = Math.round(Math.sin(time * 4) * 1.5);
        drawObjSprite(mainCtx, 'CHIMNEY_PUFF', cx + sway, Math.max(0, cy - rise));
      }

      // 5. Dotted 360° throw arc preview while carrying a bomb
      const carried = s.bombs.find((b) => Boolean(b.carried));
      if (carried) {
        const { targetX, targetY } = computeThrowTarget(world, s);
        drawThrowArcPreview(mainCtx, s, targetX, targetY, carried.kind === 'ember', time);
      }

      // 6. Airborne bombs (`!b.carried && b.z > 0.08`)
      const airborneBombs = s.bombs.filter((b) => !b.carried && b.z > 0.08);
      airborneBombs.sort((a, b) => a.y - b.y);
      for (const b of airborneBombs) {
        const { sx, sy, tiltRad } = computeBombDeform(b, time);
        const gx = Math.round(b.x * TILE_PX - 8);
        const gy = Math.round(b.y * TILE_PX - 8);
        const elevPx = Math.round(b.z * TILE_PX);
        drawObjSprite(mainCtx, 'SHADOW_CELL', gx, gy);
        drawBomb(mainCtx, b, gx, gy - 1 - elevPx, time, sx, sy, tiltRad);
      }

      // 7. Enemy projectiles
      for (const pr of s.projectiles) {
        drawObjSprite(
          mainCtx,
          'PROJ_1',
          Math.round(pr.x * TILE_PX - 4),
          Math.round(pr.y * TILE_PX - 4),
        );
      }

      // 8. Connected '+' Cross & Radial Explosions
      for (const bl of activeBlasts) {
        drawBlastSegment(mainCtx, bl, time - bl.born);
      }

      // 9. Dark-room Bayer-dithered lantern mask (`Lantern Hall`)
      if (room?.dark && !isRoomLit(world, s)) {
        applyDarkRoomMask(mainCtx, s);
      }

      // 10. Crisp 4x nearest-neighbour blit to display canvas
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
