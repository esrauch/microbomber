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
  ROOM_H,
  ROOM_W,
  type State,
  type World,
  computeGhostTargets,
  currentRoom,
  isRoomLit,
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

const UPSCALE = 4;
const INK_CSS = cssRgb(INK_RGB);
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

  // Animation trackers
  let prevX = -1;
  let prevY = -1;
  let prevTime = 0;
  let walkCycle = 0;
  let throwAnimUntil = 0;
  let crouchAnimUntil = 0;
  let fallAnimUntil = 0;
  let holdAnimUntil = 0;
  let heldKind: PickupKind = 'ember-bomb';
  let activeBlasts: BlastInstance[] = [];

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

  function drawReticle(
    ctx: CanvasRenderingContext2D,
    tx: number,
    ty: number,
    color: string,
    dropMode: boolean,
    pulsePhase: number,
  ): void {
    const px = tx * TILE_PX + (pulsePhase ? 1 : 0);
    const py = ty * TILE_PX + (pulsePhase ? 1 : 0);
    const size = pulsePhase ? 14 : 16;
    const corners: Array<[number, number]> = [
      [px, py],
      [px + size - 4, py],
      [px, py + size - 4],
      [px + size - 4, py + size - 4],
    ];
    ctx.fillStyle = INK_CSS;
    for (const [cx, cy] of corners) {
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
    if (!dropMode) {
      ctx.fillStyle = INK_CSS;
      ctx.fillRect(tx * TILE_PX + 6, ty * TILE_PX + 6, 4, 4);
      ctx.fillStyle = color;
      ctx.fillRect(tx * TILE_PX + 7, ty * TILE_PX + 7, 2, 2);
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
  ): void {
    if (kind === 'ember-bomb' || kind === 'cinder-core') {
      if (Math.floor(time * 6) % 2 === 0) {
        drawObjSprite(ctx, 'SPARKLE_CELL', dx, dy);
      }
    }
    if (kind === 'ember-bomb') {
      drawObjSprite(ctx, Math.floor(time * 5) % 2 === 0 ? 'EMBER_1' : 'EMBER_2', dx, dy);
      return;
    }
    drawObjSprite(ctx, pickupMap[kind], dx, dy);
  }

  function drawBomb(
    ctx: CanvasRenderingContext2D,
    b: Bomb,
    dx: number,
    dy: number,
    time: number,
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
    drawObjSprite(ctx, list[idx] ?? list[0], dx, dy);
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
    // Getting hit is the i-frame blink only (no hurt frame), as in Oracle
    if (s.invulnTimer > 0 && time >= fallAnimUntil && Math.floor(time * 18) % 2 === 0) return;

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

    // Facing: south / north / east, with west drawn as east flipped
    const dir = s.aimX !== 0 ? 'EAST' : s.aimY < 0 ? 'NORTH' : 'SOUTH';
    const flip = s.aimX < 0;
    const draw = (name: ObjSpriteName): void => drawObjSprite(ctx, name, dx, dy, flip);
    const stepIdx = Math.floor(walkCycle) % 4; // 4-beat: idle, step L, idle, step R
    const moving = walkCycle > 0;

    if (time < crouchAnimUntil) {
      draw(`PIP_${dir}_LIFT`);
      return;
    }
    const carried = s.bombs.find((b) => b.carriedBy !== undefined);
    if (carried) {
      const second = moving && stepIdx >= 2;
      draw(second ? `PIP_${dir}_CARRY_2` : `PIP_${dir}_CARRY_1`);
      drawBomb(ctx, carried, dx, dy - (second ? 10 : 11), time);
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
        lights.push({ x: b.x * TILE_PX, y: b.y * TILE_PX, r: 22 });
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
      activeBlasts = [];
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
        } else if (ev === 'bomb-drop' || ev === 'bomb-lift') {
          crouchAnimUntil = time + 0.12;
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

      // 1. Pass 1 & 2: Static terrain + animated interior water & warp runes
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

      // 2. Ghost Drop & Throw landing reticles (`GAME.md` §2)
      const { dropTile, throwTile } = computeGhostTargets(world, s);
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

      // 3. Burning Ember hearth patches (4-frame fire)
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

      // 4. Pass 3: Y-sorted ground actors
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

      for (const blk of s.blocks) {
        const nudge = blk.pushCharge > 0.05 ? 1 : 0;
        const px = blk.x * TILE_PX + blk.pushDirX * nudge;
        const py = blk.y * TILE_PX + blk.pushDirY * nudge;
        actors.push({
          footY: blk.y + 0.5,
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
        const bob = Math.round(Math.sin(time * 4.5 + p.x) * 1.5);
        const dx = Math.round(p.x * TILE_PX - 8);
        const dy = Math.round(p.y * TILE_PX - 9) + bob;
        actors.push({
          footY: p.y,
          draw: () => {
            drawObjSprite(mainCtx, 'SHADOW_CELL', dx, Math.round(p.y * TILE_PX - 8));
            drawPickup(mainCtx, p.kind, dx, dy, time);
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

      // 5. Pass 4: Overhead roof eaves, tree crowns, north arch lintels & chimney smoke!
      mainCtx.drawImage(canopyLayer, 0, 0);
      for (const [cx, cy] of plan.chimneys) {
        const rise = Math.floor((time * 7) % 10);
        const sway = Math.round(Math.sin(time * 4) * 1.5);
        drawObjSprite(mainCtx, 'CHIMNEY_PUFF', cx + sway, Math.max(0, cy - rise));
      }

      // 6. Airborne thrown bombs
      for (const b of s.bombs) {
        if (!b.flight) continue;
        const u = Math.min(1, b.flight.elapsed / b.flight.duration);
        const arcPx = Math.round(4 * 14 * u * (1 - u));
        const gx = Math.round(b.x * TILE_PX - 8);
        const gy = Math.round(b.y * TILE_PX - 8);
        drawObjSprite(mainCtx, 'SHADOW_CELL', gx, gy);
        drawBomb(mainCtx, b, gx, gy - 1 - arcPx, time);
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
