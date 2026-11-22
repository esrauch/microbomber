/**
 * Sprite G-buffer for the HD-2D lighting pass (ROADMAP Phase 5 & §6.3). Every sprite drawn into
 * the frame also draws its "aux" image into a parallel canvas the lighting & bloom shaders read:
 *
 * - R: hand-tuned height (0..255) when B >= 128
 * - G: emissive intensity (0..255; > 0 ONLY on flames, blasts, sparks, fuse tips, Cinder Core,
 *      and active warp/seal pads — 0 on ground, walls, heroes, and plain sprite bodies)
 * - B: 255 flags custom hero height in R
 * - opaque black (0, 0, 0, 255): any non-emissive plain sprite pixel, so it occludes behind it
 *
 * Everything not drawn into aux (tiles, props) gets auto-generated normals from the albedo's
 * luminance in the shader (lighter = raised, ink = edge).
 */
import { BG, OBJ, type ObjSpriteName } from './gbcArt';

export type AuxKind = 'hero' | 'emissive' | 'plain';

export interface AuxImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export const EMISSIVE_PREFIXES = [
  'BLAST_',
  'FIRE_',
  'SPARKLE_',
  'PROJ_',
  'PICKUP_CINDER_CORE',
] as const;

export function auxKind(name: string): AuxKind {
  if (
    name.startsWith('MOUSE_') ||
    name.startsWith('CINDERHULL_') ||
    name.startsWith('WICKGEIST_')
  ) {
    return 'hero';
  }
  if (EMISSIVE_PREFIXES.some((p) => name.startsWith(p))) return 'emissive';
  return 'plain';
}

function isBombWithGlowingCore(name: string): boolean {
  return name.startsWith('BOMB_') || name.startsWith('FIREBOMB_');
}

/**
 * Hand-tuned height per palette index ('1'..'6') for each hero, so lighting reads their
 * forms: the fuse mouse's spark and ears sit proud of the fawn fur, and the ink outline sinks to an edge.
 */
const HERO_HEIGHTS: Record<'mouse' | 'cinderArmored' | 'cinderExposed' | 'wickgeist', number[]> = {
  // spark, pink ears & paws, fawn fur, brown shade, white belly, ink
  mouse: [0.95, 0.85, 0.62, 0.45, 0.7, 0.12],
  // specular, lime thorn tips, emerald vine, deep moss, red eye, ink
  cinderArmored: [0.95, 0.88, 0.7, 0.5, 0.78, 0.15],
  // white core, yellow, orange, red, deep ember, ink
  cinderExposed: [1.0, 0.9, 0.75, 0.55, 0.4, 0.15],
  // white, eye, pale robe, mid robe, deep robe, ink
  wickgeist: [0.9, 0.82, 0.75, 0.55, 0.4, 0.12],
};

function heightTable(name: string): number[] {
  if (name.startsWith('CINDERHULL_ARMORED')) return HERO_HEIGHTS.cinderArmored;
  if (name.startsWith('CINDERHULL_')) return HERO_HEIGHTS.cinderExposed;
  if (name.startsWith('WICKGEIST_')) return HERO_HEIGHTS.wickgeist;
  return HERO_HEIGHTS.mouse;
}

/**
 * Height (0..1) of hero pixel `(x, y)` in a `w × h` sprite with palette index `idx`:
 * the per-index table plus a gentle dome so the whole figure reads as rounded.
 */
export function heroHeight(
  name: string,
  idx: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const base = heightTable(name)[idx - 1] ?? 0.5;
  const nx = (x + 0.5) / w - 0.5;
  const ny = (y + 0.5) / h - 0.55;
  const r2 = Math.min(1, (nx * nx + ny * ny) * 4);
  return Math.max(0, Math.min(1, base * 0.8 + (1 - r2) * 0.25));
}

function toAuxCanvas(aux: AuxImageData): HTMLCanvasElement {
  const { width, height, data } = aux;
  if (typeof document === 'undefined') {
    return {
      width,
      height,
      getContext: () => ({
        getImageData: () => ({ width, height, data }),
      }),
    } as unknown as HTMLCanvasElement;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const img = ctx.createImageData(width, height);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Pure RGBA pixel data for a sprite's aux G-buffer image (DOM-free for headless testing). */
export function bakeAuxData(name: ObjSpriteName): AuxImageData {
  const sprite = OBJ[name];
  const height = sprite.rows.length;
  const width = sprite.rows[0]?.length ?? 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const kind = auxKind(name);
  const bombCore = isBombWithGlowingCore(name);

  for (let y = 0; y < height; y++) {
    const row = sprite.rows[y] ?? '';
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      const idx = Number(ch);
      const i = (y * width + x) * 4;
      if (kind === 'hero') {
        data[i] = Math.round(heroHeight(name, idx, x, y, width, height) * 255);
        data[i + 2] = 255;
      } else if (kind === 'emissive') {
        // Ink and darkest ember shade stay non-emissive so flames & blasts keep crisp outlines
        data[i + 1] = idx <= 4 ? 255 : 0;
      } else if (bombCore && (idx === 1 || idx === 2)) {
        // Live fuse spark (BOMB_*) and incandescent Fire flask core (FIREBOMB_*) glow & bloom
        data[i + 1] = 220;
      }
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Bake a sprite's aux image (same size as the sprite, transparent where it is). */
export function bakeAux(name: ObjSpriteName): HTMLCanvasElement {
  return toAuxCanvas(bakeAuxData(name));
}

/** Pure RGBA pixel data for an emissive background tile (`warp` rune or `sealLit` Cinder socket). */
export function bakeTileEmissiveAuxData(kind: 'warp' | 'sealLit' | 'ice'): AuxImageData {
  const tile = kind === 'warp' ? BG.warp0 : kind === 'ice' ? BG.iceBlock : BG.sealSocketLit;
  const height = tile.rows.length;
  const width = tile.rows[0]?.length ?? 16;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = tile.rows[y] ?? '';
    for (let x = 0; x < width; x++) {
      const idx = Number(row[x] ?? 0);
      if (idx === 0) continue;
      const i = (y * width + x) * 4;
      // Ice only catches the light faintly; runes and seals glow
      data[i + 1] =
        kind === 'ice'
          ? idx === 1
            ? 120
            : idx === 2
              ? 70
              : 0
          : idx === 1
            ? 230
            : idx === 2
              ? 140
              : 0;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Bake a 16x16 emissive G-buffer tile mask for active warp pads and lit Tower seal sockets. */
export function bakeTileEmissiveAux(kind: 'warp' | 'sealLit' | 'ice'): HTMLCanvasElement {
  return toAuxCanvas(bakeTileEmissiveAuxData(kind));
}
