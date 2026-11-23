/**
 * HD-2D lite presentation layer on WebGL via PixiJS (`GAME.md` §10, ROADMAP Phase 5 & §6.3).
 *
 * The Canvas2D renderer (`gbc.ts`) still composes each frame at native resolution: that is
 * the albedo pass, plus a sprite G-buffer (`gbcAux.ts`). This view takes both as textures
 * and adds what the GBC never could:
 *
 * 1. Lighting: normal-mapped point lights, ambient and directional sun (`lights.ts`), soft
 *    wall-base & silhouette contact shadows, and chromatic GBC zone-ink shadow depth.
 * 2. Emissive-driven bloom: extracts only G-buffer emissive pixels (flames, blasts, sparks,
 *    fuse tips, Cinder Core) and active warp/seal pads, blurred at native resolution so
 *    sunlit grass and paths stay razor-sharp.
 * 3. Particles (`particles.ts`) at full integer-scaled screen resolution.
 * 4. Room slides with an eased push and subtle parallax cloud shadows.
 *
 * If WebGL is unavailable `createHdView` rejects, and the game keeps the Canvas2D renderer.
 */
import {
  Application,
  BlurFilter,
  CanvasSource,
  Container,
  Filter,
  GlProgram,
  RenderTexture,
  Sprite,
  Texture,
  TilingSprite,
  UniformGroup,
} from 'pixi.js';
import type { State, Tile, World } from '../../game/types';
import { currentRoom, enemyGrow, tileAt } from '../../game/world';
import { type GbcView, NATIVE_H, NATIVE_W, TILE_PX, computeGbcCanvasSize, roomScale } from '../gbc';
import { type Flash, MAX_LIGHTS, computeLighting } from './lights';
import { ParticleSystem } from './particles';

const DEFAULT_UP = 4;
const MAX_EMISSIVE_PADS = 4;
const MAX_SHOCKWAVES = 4;
const MAX_SHADOW_ACTORS = 12;
export const SLIDE_SECONDS = 0.32;

export interface HdView {
  /** Present the frame `gbc` just composed. */
  render(world: World, s: State, time: number, dt: number): void;
  resize(stageWidth: number, stageHeight: number): void;
  /** Set integer device-pixel scale (`1..8`) and CSS presentation size (`ROADMAP.md` §6.1). */
  setScale(deviceScale: number, cssWidth: number, cssHeight: number): void;
  /** Keep the last frame and push it out as the next room slides in from `(dx, dy)`. */
  beginRoomSlide(dx: number, dy: number, time: number): void;
  readonly canvas: HTMLCanvasElement;
}

const FILTER_VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const WATER_MIRROR = `
// Water reflections mirror across the real waterline: march up from a water pixel to the first
// non-water pixel above (a shore, or an actor standing in the water) and reflect across it.
// Returns the mirrored pixel and, in z, the depth below the line (-1: no waterline in reach).
vec3 waterMirror(vec2 px) {
    for (int k = 1; k <= 40; k++) {
        float y = px.y - float(k);
        if (y < 0.5) break;
        if (!isWaterAux(texture(uAux, vec2(px.x, y) / uFrameSize))) {
            float edge = y + 0.5;
            float d = px.y - edge;
            float ripple = sin(px.y * 1.15 + uTime * 5.5 + px.x * 0.25) * min(1.2, d / 5.0);
            return vec3(clamp(vec2(px.x + ripple, edge - d), vec2(0.5), uFrameSize - 0.5), d);
        }
    }
    return vec3(px, -1.0);
}
`;

const LIGHT_FRAGMENT = `in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uAux;
uniform sampler2D uWall;
// highp to match the vertex shader: mobile drivers refuse to link a shared uniform whose
// precision differs between stages (PixiJS defaults fragment shaders to mediump)
uniform highp vec4 uInputSize;

uniform vec2 uFrameSize;
uniform float uTime;
uniform vec3 uAmbient;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShadowInk;
uniform vec4 uGrade;
uniform vec3 uTint;
uniform int uLightCount;
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec4 uLightColor[${MAX_LIGHTS}];
uniform int uPadCount;
uniform vec4 uEmissivePads[${MAX_EMISSIVE_PADS}];
uniform int uShockCount;
uniform vec4 uShockwaves[${MAX_SHOCKWAVES}];
uniform int uActorCount;
uniform vec4 uActors[${MAX_SHADOW_ACTORS}];

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec4 auxAt(vec2 px) {
    vec2 p = clamp(px, vec2(0.5), uFrameSize - 0.5);
    return texture(uAux, p / uFrameSize);
}

bool isWaterAux(vec4 a) {
    return a.a > 0.5 && abs(a.b - 0.25) < 0.08;
}
${WATER_MIRROR}
// Height at native pixel px: hand-tuned when B >= 128, else albedo luminance (ink = low edge)
float heightAt(vec2 px) {
    vec2 p = clamp(px, vec2(0.5), uFrameSize - 0.5);
    vec4 aux = texture(uAux, p / uFrameSize);
    float autoH = luma(texture(uTexture, p * uInputSize.zw).rgb);
    return aux.a > 0.5 && aux.b > 0.49 ? aux.r : autoH;
}

float wallAt(vec2 px) {
    vec2 p = clamp(px, vec2(0.5), uFrameSize - 0.5);
    return texture(uWall, p / uFrameSize).r;
}

void main(void)
{
    vec2 rawPx = vTextureCoord * uInputSize.xy;
    vec2 shockOffset = vec2(0.0);
    float shockRim = 0.0;
    for (int i = 0; i < ${MAX_SHOCKWAVES}; i++) {
        if (i >= uShockCount) break;
        vec4 sw = uShockwaves[i];
        vec2 diff = rawPx - sw.xy;
        float dist = length(diff);
        float band = 1.0 - smoothstep(0.0, 5.5, abs(dist - sw.z));
        if (band > 0.0 && dist > 0.5) {
            vec2 dir = diff / dist;
            shockOffset += dir * band * 1.5 * sw.w;
            shockRim = max(shockRim, band * sw.w);
        }
    }
    vec2 px = clamp(rawPx - shockOffset, vec2(0.5), uFrameSize - 0.5);
    vec4 albedo = texture(uTexture, px * uInputSize.zw);
    vec4 aux = auxAt(px);

    bool isWater = isWaterAux(aux);
    float waterEmissive = 0.0;
    if (isWater) {
        vec3 m = waterMirror(px);
        vec4 mAux = auxAt(m.xy);
        if (m.z >= 0.0 && !isWaterAux(mAux)) {
            vec3 reflRgb = texture(uTexture, m.xy * uInputSize.zw).rgb;
            // A clear mirror at the waterline, fading with depth below it
            float k = mix(0.72, 0.38, clamp(m.z / 32.0, 0.0, 1.0));
            albedo.rgb = mix(albedo.rgb, reflRgb * vec3(0.82, 0.94, 1.06), k);
            if (mAux.a > 0.5) waterEmissive = mAux.g * 0.62;
        }
    }

    // Normals only where hand-tuned (heroes): tiles and props keep their own pixel shading,
    // so luminance noise is never re-lit into mud
    bool hero = aux.a > 0.5 && aux.b > 0.49;
    vec3 n = vec3(0.0, 0.0, 1.0);
    float h0 = 0.0;
    if (hero) {
        h0 = heightAt(px);
        float hl = heightAt(px + vec2(-1.0, 0.0));
        float hr = heightAt(px + vec2(1.0, 0.0));
        float hu = heightAt(px + vec2(0.0, -1.0));
        float hd = heightAt(px + vec2(0.0, 1.0));
        n = normalize(vec3((hl - hr) * 2.2, (hu - hd) * 2.2, 1.0));
    }
    vec3 surface = vec3(px, h0 * 6.0);
    bool onWall = wallAt(px) > 0.5;
    float waveGlint = isWater
        ? smoothstep(0.64, 0.96, sin(px.y * 1.55 + uTime * 6.0 + sin(px.x * 0.45 + uTime * 2.4) * 2.1))
        : 0.0;

    vec3 light = uAmbient + uSunColor * max(dot(n, normalize(uSunDir)), 0.0) + uSunColor * waveGlint * 0.24;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;
        vec4 lp = uLightPos[i];
        vec4 lc = uLightColor[i];
        vec3 toLight = lp.xyz - surface;
        float dist2D = length(toLight.xy);
        float att = clamp(1.0 - dist2D / lp.w, 0.0, 1.0);
        if (att <= 0.0) continue;
        att *= att;

        // Outward fixed-stride raymarch from lp.xy along rayDir: sample points depend ONLY on
        // ray angle (never scaled by dist2D), so shadows are pure radial cones with zero rings
        float shadow = 1.0;
        vec2 rayDir = dist2D > 0.5 ? (px - lp.xy) / dist2D : vec2(0.0, 1.0);
        if (!onWall && dist2D > 14.0) {
            vec2 lightTile = floor(lp.xy / 16.0);
            vec2 pxTile = floor(px / 16.0);
            for (int s = 0; s < 24; s++) {
                float d = 12.0 + float(s) * 4.5;
                if (d >= dist2D - 4.0) break;
                vec2 sp = lp.xy + rayDir * d;
                vec2 sTile = floor(sp / 16.0);
                if (sTile != lightTile && sTile != pxTile && wallAt(sp) > 0.5) {
                    vec2 local = abs(sp - (sTile + 0.5) * 16.0);
                    float box = max(local.x, local.y);
                    if (box < 7.0) {
                        shadow = min(shadow, mix(0.2, 0.65, smoothstep(5.2, 7.0, box)));
                        if (shadow <= 0.21) break;
                    }
                }
            }
        }
        // Analytical ray-circle directional shadows cast by Pip, enemies, bosses, and NPCs
        if (!onWall && aux.a < 0.5 && dist2D > 4.0 && shadow > 0.21) {
            for (int j = 0; j < ${MAX_SHADOW_ACTORS}; j++) {
                if (j >= uActorCount) break;
                vec4 act = uActors[j];
                vec2 toAct = act.xy - lp.xy;
                float dLA = length(toAct);
                if (dLA <= act.z + 2.0) continue;
                float tProj = dot(toAct, rayDir);
                float along = dist2D - tProj;
                if (tProj > 0.0 && along > 0.0 && along < act.w) {
                    float coneR = act.z * clamp(dist2D / max(tProj, 8.0), 1.0, 1.45);
                    float perp = length(toAct - rayDir * tProj);
                    if (perp < coneR) {
                        float edge = smoothstep(coneR * 0.6, coneR, perp);
                        float fade = smoothstep(act.w, act.w * 0.2, along);
                        shadow = min(shadow, mix(1.0, 0.18, (1.0 - edge) * fade));
                    }
                }
            }
        }

        float diffuse = hero ? max(dot(n, normalize(toLight)), 0.0) * 0.75 + 0.25 : 1.0;
        vec3 contrib = lc.rgb * lc.a * att * diffuse * shadow;
        if (isWater && shadow > 0.4) {
            contrib += lc.rgb * lc.a * att * waveGlint * 0.48;
        }
        light += contrib;
    }

    // Angled directional moonlight / shrine shadows behind walls, trees, cottages, and blocks
    float shade = 1.0;
    if (onWall && !hero) {
        shade = uGrade.w;
    } else if (!onWall && !hero) {
        for (int s = 1; s <= 4; s++) {
            if (wallAt(px + vec2(-0.68, -0.78) * float(s) * 1.25) > 0.5) {
                shade = mix(0.58, 0.76, float(s - 1) / 3.0);
                break;
            }
        }
    }

    // Flames, blasts, sparks, fuse tips, reflected water flames, and unlocked warp/seal pads emit light
    float emissive = (aux.a > 0.5 && !isWater) ? aux.g : waterEmissive;
    if (aux.a < 0.5) {
        for (int i = 0; i < ${MAX_EMISSIVE_PADS}; i++) {
            if (i >= uPadCount) break;
            vec4 pad = uEmissivePads[i];
            float d = length(px - pad.xy);
            float ring = smoothstep(pad.z, pad.z * 0.25, d);
            emissive = max(emissive, ring * pad.w * smoothstep(0.22, 0.62, luma(albedo.rgb)));
        }
    }
    shade = mix(shade, 1.0, emissive);
    light = max(light, vec3(1.15 * emissive)) + vec3(1.0, 0.86, 0.55) * shockRim * 0.45;

    // Plain multiply keeps the art's own colours; only near-black gets a faint zone-ink lift
    vec3 c = albedo.rgb * light * shade;
    c += uShadowInk * 0.14 * (1.0 - clamp(luma(light), 0.0, 1.0));

    float l = luma(c);
    c = mix(vec3(l), c, uGrade.x);
    c = (c - 0.5) * uGrade.y + 0.5;
    c = mix(c, c * uTint, uGrade.z);
    finalColor = vec4(clamp(c, 0.0, 1.0), albedo.a);
}
`;

const BRIGHT_FRAGMENT = `in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uAux;
uniform highp vec4 uInputSize;
uniform vec2 uFrameSize;
uniform float uTime;
uniform int uPadCount;
uniform vec4 uEmissivePads[${MAX_EMISSIVE_PADS}];

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

bool isWaterAux(vec4 a) {
    return a.a > 0.5 && abs(a.b - 0.25) < 0.08;
}
${WATER_MIRROR}
void main(void)
{
    vec3 lit = texture(uTexture, vTextureCoord).rgb;
    vec2 px = clamp(vTextureCoord * uInputSize.xy, vec2(0.5), uFrameSize - 0.5);
    vec4 aux = texture(uAux, px / uFrameSize);

    // Emissive-driven bloom: G-buffer emissives, reflected water flames/blasts, & active warp/seal runes glow
    bool isWater = isWaterAux(aux);
    float em = (!isWater && aux.a > 0.5 && aux.g > 0.05) ? aux.g : 0.0;
    if (isWater) {
        vec3 m = waterMirror(px);
        vec4 mAux = texture(uAux, m.xy / uFrameSize);
        if (m.z >= 0.0 && !isWaterAux(mAux) && mAux.a > 0.5) em = max(em, mAux.g * 0.6);
    }
    if (aux.a < 0.5) {
        for (int i = 0; i < ${MAX_EMISSIVE_PADS}; i++) {
            if (i >= uPadCount) break;
            vec4 pad = uEmissivePads[i];
            float d = length(px - pad.xy);
            float ring = smoothstep(pad.z, pad.z * 0.25, d);
            em = max(em, ring * pad.w * smoothstep(0.22, 0.62, luma(lit)));
        }
    }

    finalColor = vec4(lit * em * 0.95, 1.0);
}
`;

/** True when tile `t` is a raised wall, cliff, tree, door, or solid prop that casts base shadow. */
function isShadowCasterTile(t: Tile, crystalColor: 'red' | 'blue'): boolean {
  if (
    t === '#' ||
    t === 'Y' ||
    t === '%' ||
    t === '=' ||
    t === 'B' ||
    t === 'W' ||
    t === 'C' ||
    t === 'D' ||
    t === 'K' ||
    t === 'S' ||
    t === 'G' ||
    t === 'H'
  ) {
    return true;
  }
  if (t === 'R') return crystalColor === 'red';
  if (t === 'U') return crystalColor === 'blue';
  return false;
}

/**
 * Compile and link a vertex/fragment pair the way PixiJS will (GLSL ES 3.0, highp vertex,
 * mediump fragment) and throw with the driver's log if this device rejects it, so the game
 * falls back to the Canvas2D renderer instead of drawing nothing.
 */
function assertShaderLinks(
  gl: WebGL2RenderingContext,
  name: string,
  vertex: string,
  fragment: string,
): void {
  const compile = (type: number, src: string): WebGLShader => {
    const sh = gl.createShader(type);
    if (!sh) throw new Error(`${name}: createShader failed`);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) ?? '';
      gl.deleteShader(sh);
      throw new Error(
        `${name} ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${log}`,
      );
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, `#version 300 es\nprecision highp float;\n${vertex}`);
  const fs = compile(gl.FRAGMENT_SHADER, `#version 300 es\nprecision mediump float;\n${fragment}`);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  const ok = Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
  const log = gl.getProgramInfoLog(program) ?? '';
  gl.deleteProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!ok) throw new Error(`${name} shader failed to link: ${log || '(no driver log)'}`);
}

function canvasTexture(canvas: HTMLCanvasElement, scaleMode: 'nearest' | 'linear'): Texture {
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode }) });
}

/** Soft cloud shadows for the overworld's parallax layer, drawn once. */
function makeCloudCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 9; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 60 + rand() * 90;
    for (const [ox, oy] of [
      [0, 0],
      [512, 0],
      [-512, 0],
      [0, 512],
      [0, -512],
    ] as const) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, 'rgba(10, 16, 30, 0.9)');
      g.addColorStop(1, 'rgba(10, 16, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return c;
}

/** Particle dots are one baked white disc, tinted and scaled per particle. */
const DOT_PX = 64;
function makeDotCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = DOT_PX;
  c.height = DOT_PX;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(DOT_PX / 2, DOT_PX / 2, DOT_PX / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export async function createHdView(host: HTMLElement, gbc: GbcView): Promise<HdView> {
  let upScale = DEFAULT_UP;
  const app = new Application();
  await app.init({
    width: NATIVE_W * upScale,
    height: NATIVE_H * upScale,
    preference: 'webgl',
    backgroundAlpha: 0,
    antialias: false,
    autoStart: false,
    resolution: 1,
  });
  app.ticker.stop();
  const renderer = app.renderer;
  const gl = (renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
  if (!gl) throw new Error('HD-2D needs a WebGL2 renderer');
  try {
    assertShaderLinks(gl, 'hd-light', FILTER_VERTEX, LIGHT_FRAGMENT);
    assertShaderLinks(gl, 'hd-bright', FILTER_VERTEX, BRIGHT_FRAGMENT);
  } catch (err) {
    app.destroy(true);
    throw err;
  }
  const canvas = app.canvas;
  canvas.id = 'game-hd';
  canvas.style.imageRendering = 'pixelated';

  // One mask cell per 16 frame pixels; a room drawn at 2x fills 2 x 2 cells per tile
  const wallCols = NATIVE_W / TILE_PX;
  const wallRows = NATIVE_H / TILE_PX;
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = wallCols;
  wallCanvas.height = wallRows;
  const wallCtx = wallCanvas.getContext('2d');
  const wallImg = wallCtx ? wallCtx.createImageData(wallCols, wallRows) : null;

  const albedoTex = canvasTexture(gbc.frame, 'nearest');
  const auxTex = canvasTexture(gbc.aux, 'nearest');
  const wallTex = canvasTexture(wallCanvas, 'nearest');

  const padArray = new Float32Array(MAX_EMISSIVE_PADS * 4);
  const shockArray = new Float32Array(MAX_SHOCKWAVES * 4);
  const actorArray = new Float32Array(MAX_SHADOW_ACTORS * 4);

  const lightUniforms = new UniformGroup({
    uFrameSize: { value: new Float32Array([NATIVE_W, NATIVE_H]), type: 'vec2<f32>' },
    uTime: { value: 0, type: 'f32' },
    uAmbient: { value: new Float32Array(3), type: 'vec3<f32>' },
    uSunDir: { value: new Float32Array(3), type: 'vec3<f32>' },
    uSunColor: { value: new Float32Array(3), type: 'vec3<f32>' },
    uShadowInk: { value: new Float32Array(3), type: 'vec3<f32>' },
    uGrade: { value: new Float32Array(4), type: 'vec4<f32>' },
    uTint: { value: new Float32Array(3), type: 'vec3<f32>' },
    uLightCount: { value: 0, type: 'i32' },
    uLightPos: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
    uLightColor: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
    uPadCount: { value: 0, type: 'i32' },
    uEmissivePads: {
      value: new Float32Array(MAX_EMISSIVE_PADS * 4),
      type: 'vec4<f32>',
      size: MAX_EMISSIVE_PADS,
    },
    uShockCount: { value: 0, type: 'i32' },
    uShockwaves: {
      value: new Float32Array(MAX_SHOCKWAVES * 4),
      type: 'vec4<f32>',
      size: MAX_SHOCKWAVES,
    },
    uActorCount: { value: 0, type: 'i32' },
    uActors: {
      value: new Float32Array(MAX_SHADOW_ACTORS * 4),
      type: 'vec4<f32>',
      size: MAX_SHADOW_ACTORS,
    },
  });
  const lightFilter = new Filter({
    glProgram: GlProgram.from({
      vertex: FILTER_VERTEX,
      fragment: LIGHT_FRAGMENT,
      name: 'hd-light',
    }),
    resources: {
      lightUniforms,
      uAux: auxTex.source,
      uAuxSampler: auxTex.source.style,
      uWall: wallTex.source,
      uWallSampler: wallTex.source.style,
    },
  });

  const brightUniforms = new UniformGroup({
    uFrameSize: { value: new Float32Array([NATIVE_W, NATIVE_H]), type: 'vec2<f32>' },
    uTime: { value: 0, type: 'f32' },
    uPadCount: { value: 0, type: 'i32' },
    uEmissivePads: {
      value: new Float32Array(MAX_EMISSIVE_PADS * 4),
      type: 'vec4<f32>',
      size: MAX_EMISSIVE_PADS,
    },
  });
  const brightFilter = new Filter({
    glProgram: GlProgram.from({
      vertex: FILTER_VERTEX,
      fragment: BRIGHT_FRAGMENT,
      name: 'hd-bright',
    }),
    resources: {
      brightUniforms,
      uAux: auxTex.source,
      uAuxSampler: auxTex.source.style,
    },
  });

  // Native-resolution passes (extract emissives unpadded first, then blur into bloomRT)
  const albedoSprite = new Sprite(albedoTex);
  albedoSprite.filters = [lightFilter];
  const litScene = new Container();
  litScene.addChild(albedoSprite);

  let litRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'nearest' });
  let prevRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'nearest' });
  const brightRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'linear' });
  const bloomRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'linear' });

  const brightSprite = new Sprite(litRT);
  brightSprite.filters = [brightFilter];
  const brightScene = new Container();
  brightScene.addChild(brightSprite);

  const blurSprite = new Sprite(brightRT);
  blurSprite.filters = [new BlurFilter({ strength: 3, quality: 3 })];
  const blurScene = new Container();
  blurScene.addChild(blurSprite);

  // Display stage
  const worldLayer = new Container();
  const prevSprite = new Sprite(prevRT);
  const litSprite = new Sprite(litRT);
  const bloomSprite = new Sprite(bloomRT);
  for (const sp of [prevSprite, litSprite, bloomSprite]) sp.scale.set(upScale);
  bloomSprite.blendMode = 'add';
  bloomSprite.alpha = 0.65;
  prevSprite.visible = false;
  worldLayer.addChild(prevSprite, litSprite, bloomSprite);

  const clouds = new TilingSprite({
    texture: canvasTexture(makeCloudCanvas(), 'linear'),
    width: NATIVE_W * upScale,
    height: NATIVE_H * upScale,
  });
  clouds.alpha = 0.1;

  // Particles reuse pooled sprites of one dot texture: only position, size, tint and alpha
  // change per frame, so bursts never rebuild geometry
  const dotTex = canvasTexture(makeDotCanvas(), 'linear');
  const solidParticles = new Container();
  const glowParticles = new Container();
  const solidPool: Sprite[] = [];
  const glowPool: Sprite[] = [];
  app.stage.addChild(worldLayer, clouds, solidParticles, glowParticles);

  function pooledDot(pool: Sprite[], layer: Container, i: number, glow: boolean): Sprite {
    let sp = pool[i];
    if (!sp) {
      sp = new Sprite(dotTex);
      sp.anchor.set(0.5);
      if (glow) sp.blendMode = 'add';
      pool.push(sp);
      layer.addChild(sp);
    }
    sp.visible = true;
    return sp;
  }

  const particles = new ParticleSystem(1234);
  const flashes: Flash[] = [];
  let slide: { dx: number; dy: number; start: number } | null = null;

  // The mask only changes with the room, its tiles, the crystal colour, the gates or a push
  // block, so it is rebuilt and uploaded when that signature changes rather than every frame
  let wallSig = '';
  function syncWallMask(world: World, s: State): void {
    if (!wallCtx || !wallImg) return;
    let sig = `${s.zone}${s.rx},${s.ry}|${s.crystalColor}|${s.gatesOpen ? 1 : 0}|${s.brokenTiles.size}|${s.burnedTiles.size}|${s.openedDoors.size}|${s.roomSolved ? 1 : 0}`;
    for (const blk of s.blocks) sig += `|${Math.round(blk.x)},${Math.round(blk.y)}`;
    if (sig === wallSig) return;
    wallSig = sig;
    const data = wallImg.data;
    const room = currentRoom(world, s);
    const k = roomScale(s);
    for (let my = 0; my < wallRows; my++) {
      for (let mx = 0; mx < wallCols; mx++) {
        const x = Math.floor(mx / k);
        const y = Math.floor(my / k);
        const t = tileAt(world, s, s.zone, s.rx, s.ry, x, y);
        const isPillar = room?.rows[y]?.[x] === 'L';
        const solid = !isPillar && isShadowCasterTile(t, s.crystalColor) ? 255 : 0;
        const i = (my * wallCols + mx) * 4;
        data[i] = solid;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    for (const blk of s.blocks) {
      const bx = Math.round(blk.x);
      const by = Math.round(blk.y);
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const mx = bx * k + dx;
          const my = by * k + dy;
          if (mx >= 0 && mx < wallCols && my >= 0 && my < wallRows) {
            data[(my * wallCols + mx) * 4] = 255;
          }
        }
      }
    }
    wallCtx.putImageData(wallImg, 0, 0);
    wallTex.source.update();
  }

  function collectEmissivePads(world: World, s: State, time: number): number {
    const tilePx = TILE_PX * roomScale(s);
    padArray.fill(0);
    let count = 0;
    const room = currentRoom(world, s);
    if (s.cryptWarpUnlocked) {
      for (const p of room?.portals ?? []) {
        if (!p.requiresWarpUnlock || count >= MAX_EMISSIVE_PADS) continue;
        padArray.set(
          [(p.x + 0.5) * tilePx, (p.y + 0.5) * tilePx, 8.5, 0.85 + 0.12 * Math.sin(time * 3)],
          count * 4,
        );
        count++;
      }
    }
    if (s.spireCinderSlotted || s.cores.includes('cinder')) {
      for (const st of room?.stamps ?? []) {
        if (st.id !== 'spire-seal' || count >= MAX_EMISSIVE_PADS) continue;
        padArray.set(
          [(st.x + 0.5) * tilePx, (st.y + 0.5) * tilePx, 8.0, 0.85 + 0.1 * Math.sin(time * 3.5)],
          count * 4,
        );
        count++;
      }
    }
    return count;
  }

  const view: HdView = {
    canvas,

    render(world: World, s: State, time: number, dt: number): void {
      const tilePx = TILE_PX * roomScale(s);
      // 1. Upload this frame's albedo, sprite G-buffer, and wall shadow-caster mask
      albedoTex.source.update();
      auxTex.source.update();
      syncWallMask(world, s);

      // 2. Lights, shockwaves & active emissive floor pads, from state and fresh blast flashes
      for (const bl of s.blasts) {
        if (!bl.shape || bl.shape === 'hub' || bl.shape === 'single') {
          flashes.push({ x: bl.x, y: bl.y, kind: bl.kind, born: time });
        }
      }
      while (flashes.length > 0 && time - (flashes[0]?.born ?? time) > 0.45) flashes.shift();
      const lighting = computeLighting(world, s, time, flashes);
      const padCount = collectEmissivePads(world, s, time);

      shockArray.fill(0);
      let shockCount = 0;
      for (let i = flashes.length - 1; i >= 0 && shockCount < MAX_SHOCKWAVES; i--) {
        const fl = flashes[i];
        if (!fl) continue;
        const age = time - fl.born;
        if (age < 0 || age > 0.28) continue;
        const k = 1 - age / 0.28;
        shockArray.set([fl.x * tilePx, fl.y * tilePx, 4 + age * 150, k * k], shockCount * 4);
        shockCount++;
      }

      actorArray.fill(0);
      // 1. Pip (the fuse mouse) casts a directional shadow from every torch, fire, and bomb blast
      actorArray.set([s.x * tilePx, s.y * tilePx + 2, 4.4, 30], 0);
      let actorCount = 1;
      // 2. Enemies & Bosses
      for (const e of s.enemies) {
        if (actorCount >= MAX_SHADOW_ACTORS) break;
        const rad =
          e.kind === 'cinderhull'
            ? 12.5
            : e.kind === 'wickgeist'
              ? 8.0
              : e.kind === 'slime' && e.splitGen
                ? 4.0
                : 5.5;
        const reach = e.kind === 'cinderhull' ? 56 : e.kind === 'wickgeist' ? 44 : 34;
        const footOff = e.kind === 'slime' ? 1 : 2;
        // 2x creatures on doubled screens cast 2x shadows
        const k = enemyGrow(s) > 0 ? 2 : 1;
        actorArray.set(
          [e.x * tilePx, e.y * tilePx + footOff * k, rad * k, reach * k],
          actorCount * 4,
        );
        actorCount++;
      }
      // 3. NPCs
      const room = currentRoom(world, s);
      for (const npc of room?.npcs ?? []) {
        if (actorCount >= MAX_SHADOW_ACTORS) break;
        actorArray.set([npc.x * tilePx, npc.y * tilePx + 2, 5.5, 34], actorCount * 4);
        actorCount++;
      }

      const u = lightUniforms.uniforms as {
        uTime: number;
        uAmbient: Float32Array;
        uSunDir: Float32Array;
        uSunColor: Float32Array;
        uShadowInk: Float32Array;
        uGrade: Float32Array;
        uTint: Float32Array;
        uLightCount: number;
        uLightPos: Float32Array;
        uLightColor: Float32Array;
        uPadCount: number;
        uEmissivePads: Float32Array;
        uShockCount: number;
        uShockwaves: Float32Array;
        uActorCount: number;
        uActors: Float32Array;
      };
      u.uTime = time;
      u.uAmbient.set(lighting.ambient);
      u.uSunDir.set(lighting.sunDir);
      u.uSunColor.set(lighting.sunColor);
      u.uShadowInk.set(lighting.shadowInk);
      const indoor = s.zone === 'ice-cave' || s.zone === 'basement' || s.zone === 'dungeon-999';
      // saturation, contrast, tint mix, wall shade
      u.uGrade.set(indoor ? [1.06, 1.03, 0.35, 0.72] : [1.08, 1.03, 0.3, 0.82]);
      u.uTint.set(
        s.zone === 'basement'
          ? [1.04, 0.99, 0.92]
          : s.zone === 'ice-cave' || s.zone === 'dungeon-999'
            ? [0.94, 0.99, 1.08]
            : [0.94, 0.98, 1.08],
      );
      u.uLightCount = lighting.lights.length;
      lighting.lights.forEach((l, i) => {
        u.uLightPos.set([l.x, l.y, l.z, l.radius], i * 4);
        u.uLightColor.set([l.color[0], l.color[1], l.color[2], l.intensity], i * 4);
      });
      u.uPadCount = padCount;
      u.uEmissivePads.set(padArray);
      u.uShockCount = shockCount;
      u.uShockwaves.set(shockArray);
      u.uActorCount = actorCount;
      u.uActors.set(actorArray);
      lightUniforms.update();

      const bu = brightUniforms.uniforms as {
        uTime: number;
        uPadCount: number;
        uEmissivePads: Float32Array;
      };
      bu.uTime = time;
      bu.uPadCount = padCount;
      bu.uEmissivePads.set(padArray);
      brightUniforms.update();

      // 3. Lit frame and emissive-only bloom, at native resolution
      renderer.render({ container: litScene, target: litRT, clear: true });
      brightSprite.texture = litRT;
      renderer.render({ container: brightScene, target: brightRT, clear: true });
      renderer.render({ container: blurScene, target: bloomRT, clear: true });

      // 4. Particles in integer-scaled screen space (sparks bounce off solid wall tiles)
      if (!slide) {
        particles.spawnFromFrame(s, s.events, s.blasts);
        particles.emitAmbient(s, dt);
      }
      particles.update(dt, (px, py) => {
        const tx = Math.floor(px / TILE_PX);
        const ty = Math.floor(py / TILE_PX);
        if (tx < 0 || tx >= wallCols || ty < 0 || ty >= wallRows) return true;
        return (wallImg?.data[(ty * wallCols + tx) * 4] ?? 0) > 128;
      });
      let solidN = 0;
      let glowN = 0;
      for (const p of particles.particles) {
        const k = Math.max(0, p.life / p.maxLife);
        const sp = p.glow
          ? pooledDot(glowPool, glowParticles, glowN++, true)
          : pooledDot(solidPool, solidParticles, solidN++, false);
        const size = p.size * upScale * (p.kind === 'smoke' ? 1.6 - k * 0.6 : 1);
        sp.position.set(p.x * upScale, p.y * upScale);
        sp.scale.set(size / DOT_PX);
        sp.tint = p.color;
        sp.alpha = p.kind === 'smoke' ? 0.35 * k : p.glow ? k : Math.min(1, k * 2);
      }
      solidPool.forEach((sp, i) => (sp.visible = i < solidN));
      glowPool.forEach((sp, i) => (sp.visible = i < glowN));

      // 5. Room slide and parallax clouds
      const dw = NATIVE_W * upScale;
      const dh = NATIVE_H * upScale;
      let offX = 0;
      let offY = 0;
      if (slide) {
        const t = Math.min(1, (time - slide.start) / SLIDE_SECONDS);
        const e = easeInOutCubic(t);
        offX = slide.dx * (1 - e) * dw;
        offY = slide.dy * (1 - e) * dh;
        prevSprite.visible = t < 1;
        prevSprite.position.set(offX - slide.dx * dw, offY - slide.dy * dh);
        if (t >= 1) slide = null;
      } else {
        prevSprite.visible = false;
      }
      litSprite.position.set(offX, offY);
      bloomSprite.position.set(offX, offY);
      solidParticles.position.set(offX, offY);
      glowParticles.position.set(offX, offY);
      clouds.visible = s.zone === 'overworld';
      const cloudScale = upScale / DEFAULT_UP;
      clouds.tilePosition.set(
        time * 7 * cloudScale + offX * 1.35,
        time * 3 * cloudScale + offY * 1.35,
      );

      renderer.render(app.stage);
    },

    resize(stageWidth: number, stageHeight: number): void {
      const { width, height } = computeGbcCanvasSize(stageWidth, stageHeight);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.imageRendering = 'pixelated';
    },

    setScale(deviceScale: number, cssWidth: number, cssHeight: number): void {
      const nextScale = Math.max(1, Math.min(8, Math.round(deviceScale)));
      if (nextScale !== upScale) {
        upScale = nextScale;
        const dw = NATIVE_W * upScale;
        const dh = NATIVE_H * upScale;
        renderer.resize(dw, dh);
        prevSprite.scale.set(upScale);
        litSprite.scale.set(upScale);
        bloomSprite.scale.set(upScale);
        clouds.width = dw;
        clouds.height = dh;
      }
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.style.imageRendering = 'pixelated';
    },

    beginRoomSlide(dx: number, dy: number, time: number): void {
      // The frame on screen becomes the outgoing room; new frames render to the other target
      [litRT, prevRT] = [prevRT, litRT];
      prevSprite.texture = prevRT;
      litSprite.texture = litRT;
      particles.clear();
      flashes.length = 0;
      slide = { dx, dy, start: time };
    },
  };

  host.appendChild(canvas);
  return view;
}
