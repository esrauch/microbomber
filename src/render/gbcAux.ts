/**
 * Sprite G-buffer for the HD-2D lighting pass (ROADMAP Phase 5). Every sprite drawn into the
 * frame also draws its "aux" image into a parallel canvas the lighting shader reads:
 *
 * - R: hand-tuned height (0..1) for hero sprites, where B = 255 flags a hero pixel
 * - G: emissive (flames, blasts, sparks glow at full strength in the dark)
 * - opaque black: any other sprite, so it covers a hero or flame drawn behind it
 *
 * Everything not drawn into aux (tiles, props) gets auto-generated normals from the albedo's
 * luminance in the shader (lighter = raised, ink = edge).
 */
import { OBJ, type ObjSpriteName } from './gbcArt';

export type AuxKind = 'hero' | 'emissive' | 'plain';

const EMISSIVE_PREFIXES = ['BLAST_', 'FIRE_', 'SPARKLE_', 'PROJ_', 'PICKUP_CINDER_CORE'];

export function auxKind(name: string): AuxKind {
  if (name.startsWith('PIP_') || name.startsWith('CINDERHULL_') || name.startsWith('WICKGEIST_')) {
    return 'hero';
  }
  if (EMISSIVE_PREFIXES.some((p) => name.startsWith(p))) return 'emissive';
  return 'plain';
}

/**
 * Hand-tuned height per palette index ('1'..'6') for each hero, so lighting reads their
 * forms: Pip's hood sits proud of the face and tunic, the ink outline sinks to an edge.
 */
const HERO_HEIGHTS: Record<'pip' | 'cinderArmored' | 'cinderExposed' | 'wickgeist', number[]> = {
  // peach skin, amber hood, cobalt tunic, brown, deep blue, ink
  pip: [0.72, 0.92, 0.62, 0.48, 0.4, 0.12],
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
  return HERO_HEIGHTS.pip;
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

/** Bake a sprite's aux image (same size as the sprite, transparent where it is). */
export function bakeAux(name: ObjSpriteName): HTMLCanvasElement {
  const sprite = OBJ[name];
  const h = sprite.rows.length;
  const w = sprite.rows[0]?.length ?? 16;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const img = ctx.createImageData(w, h);
  const kind = auxKind(name);
  for (let y = 0; y < h; y++) {
    const row = sprite.rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      const i = (y * w + x) * 4;
      if (kind === 'hero') {
        img.data[i] = Math.round(heroHeight(name, Number(ch), x, y, w, h) * 255);
        img.data[i + 2] = 255;
      } else if (kind === 'emissive') {
        // Ink and the darkest shade stay unlit so a flame keeps its outline
        img.data[i + 1] = Number(ch) >= 5 ? 0 : 255;
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
