/**
 * HD-2D lighting model (`GAME.md` §10, ROADMAP Phase 5 & §6.3): turns game state into an
 * ambient term, a directional sun, chromatic zone shadow ink, and point lights in native pixels.
 * Pure (no DOM or WebGL) so it is testable; `hdView.ts` feeds the result to the lighting shader.
 */
import type { State, World, ZoneId } from '../../game/types';
import { currentRoom, isRoomLit } from '../../game/world';

const TILE = 16;

/** Most point lights the shader takes in one frame (the nearest to Pip win). */
export const MAX_LIGHTS = 24;

export type Rgb3 = readonly [number, number, number];

export interface PointLight {
  /** Native-pixel position, and height above the floor in pixels. */
  x: number;
  y: number;
  z: number;
  /** Reach in native pixels (light falls to zero there). */
  radius: number;
  color: Rgb3;
  intensity: number;
}

export interface Lighting {
  ambient: Rgb3;
  /** Direction toward the sun (x right, y down the screen, z up out of it) and its colour. */
  sunDir: Rgb3;
  sunColor: Rgb3;
  /** Chromatic GBC shadow ink colour for the active zone (never neutral grey). */
  shadowInk: Rgb3;
  lights: PointLight[];
}

/** A blast flash still glowing, from the frame it went off. */
export interface Flash {
  x: number;
  y: number;
  kind: 'powder' | 'ember';
  born: number;
}

export const FLASH_SECONDS = 0.32;

const WARM: Rgb3 = [1.0, 0.62, 0.3];
const FIRE: Rgb3 = [1.0, 0.5, 0.2];
const SPARK: Rgb3 = [1.0, 0.86, 0.45];
const CYAN: Rgb3 = [0.45, 0.85, 1.0];
/** Clean moon-ivory lantern pool so dark-room violet flagstones keep their true hues. */
const LANTERN: Rgb3 = [0.96, 0.94, 0.98];

/** Deep chromatic GBC shadow ink per zone (forest-pine teal outdoors, plum-indigo in shrines). */
export function zoneShadowInk(zone: ZoneId): Rgb3 {
  return zone === 'ember-crypt' ? [0.07, 0.05, 0.14] : [0.06, 0.12, 0.16];
}

/** Deterministic flicker in roughly [0.85, 1.1] that differs per light. */
function flicker(time: number, seed: number): number {
  return 0.97 + 0.08 * Math.sin(time * 17 + seed * 3.1) + 0.05 * Math.sin(time * 41 + seed * 7.3);
}

export function computeLighting(
  world: World,
  s: State,
  time: number,
  flashes: readonly Flash[],
): Lighting {
  const room = currentRoom(world, s);
  const crypt = s.zone === 'ember-crypt';
  const darkUnlit = Boolean(room?.dark) && !isRoomLit(world, s);

  // Flat surfaces land near 1.0 outdoors (the art as authored), ~0.65 in the crypt so torch
  // pools read as the light, and near black in an unlit dark room
  const ambient: Rgb3 = darkUnlit
    ? [0.08, 0.08, 0.13]
    : crypt
      ? [0.6, 0.56, 0.68]
      : [0.8, 0.82, 0.84];
  const sunColor: Rgb3 = crypt || darkUnlit ? [0.08, 0.07, 0.1] : [0.32, 0.3, 0.26];
  const sunDir: Rgb3 = crypt || darkUnlit ? [-0.45, -0.62, 0.64] : [-0.52, -0.64, 0.56];
  const shadowInk = zoneShadowInk(s.zone);

  const lights: PointLight[] = [];
  const add = (l: PointLight): void => {
    if (l.intensity > 0.01) lights.push(l);
  };

  for (const t of s.torches) {
    if (!t.lit) {
      // In a dark room an unlit brazier keeps a faint ember glow, so the targets are findable
      if (room?.dark) {
        add({
          x: (t.x + 0.5) * TILE,
          y: (t.y + 0.4) * TILE,
          z: 10,
          radius: 30,
          color: FIRE,
          intensity: 0.85 + 0.15 * Math.sin(time * 2.4 + t.x + t.y),
        });
      }
      continue;
    }
    add({
      x: (t.x + 0.5) * TILE,
      y: (t.y + 0.2) * TILE,
      z: 18,
      radius: crypt ? 92 : 56,
      color: WARM,
      intensity: (crypt ? 0.95 : 0.6) * flicker(time, t.x * 13 + t.y),
    });
  }
  for (const f of s.fires) {
    add({
      x: (f.x + 0.5) * TILE,
      y: (f.y + 0.5) * TILE,
      z: 8,
      radius: 46,
      color: FIRE,
      intensity: Math.min(1, f.remaining * 1.5) * flicker(time, f.x * 7 + f.y * 11),
    });
  }
  for (const b of s.bombs) {
    const x = b.x * TILE;
    const y = (b.y - b.z) * TILE;
    if (b.kind === 'ember') {
      add({ x, y, z: 8, radius: 30, color: FIRE, intensity: 0.75 * flicker(time, b.id) });
    } else {
      // The fuse spark brightens as it burns down
      const urgency = 1 - Math.max(0, Math.min(1, b.fuse / 1.5));
      add({
        x,
        y: y - 6,
        z: 10,
        radius: 16 + urgency * 10,
        color: SPARK,
        intensity: (0.45 + urgency * 0.5) * flicker(time, b.id),
      });
    }
  }
  for (const fl of flashes) {
    const age = time - fl.born;
    if (age < 0 || age > FLASH_SECONDS) continue;
    const k = 1 - age / FLASH_SECONDS;
    add({
      x: fl.x * TILE,
      y: fl.y * TILE,
      z: 22,
      radius: 70,
      color: fl.kind === 'ember' ? FIRE : SPARK,
      intensity: 1.8 * k * k,
    });
  }
  for (const pr of s.projectiles) {
    add({ x: pr.x * TILE, y: pr.y * TILE, z: 8, radius: 18, color: FIRE, intensity: 0.6 });
  }
  for (const e of s.enemies) {
    if (e.kind === 'cinderhull' && !e.armored) {
      add({
        x: e.x * TILE,
        y: e.y * TILE,
        z: 14,
        radius: 52,
        color: FIRE,
        intensity: 0.9 * flicker(time, e.id),
      });
    }
  }
  if (s.cryptWarpUnlocked) {
    for (const p of room?.portals ?? []) {
      if (!p.requiresWarpUnlock) continue;
      add({
        x: (p.x + 0.5) * TILE,
        y: (p.y + 0.5) * TILE,
        z: 6,
        radius: 34,
        color: CYAN,
        intensity: 0.7 + 0.15 * Math.sin(time * 3),
      });
    }
  }
  if (room?.dark) {
    // Pip's lantern: a clean moon-ivory pool so dark-room flagstones keep their true hues
    add({ x: s.x * TILE, y: s.y * TILE - 4, z: 20, radius: 58, color: LANTERN, intensity: 1.05 });
  }

  // Keep the lights nearest Pip when there are too many for the shader
  if (lights.length > MAX_LIGHTS) {
    const px = s.x * TILE;
    const py = s.y * TILE;
    lights.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    lights.length = MAX_LIGHTS;
  }

  return { ambient, sunDir, sunColor, shadowInk, lights };
}
