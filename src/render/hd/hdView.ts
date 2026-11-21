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
  Graphics,
  RenderTexture,
  Sprite,
  Texture,
  TilingSprite,
  UniformGroup,
} from 'pixi.js';
import type { State, Tile, World } from '../../game/types';
import { ROOM_H, ROOM_W, currentRoom, tileAt } from '../../game/world';
import { type GbcView, NATIVE_H, NATIVE_W, TILE_PX, computeGbcCanvasSize } from '../gbc';
import { type Flash, MAX_LIGHTS, computeLighting } from './lights';
import { ParticleSystem } from './particles';

const DEFAULT_UP = 4;
const MAX_EMISSIVE_PADS = 4;
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

const LIGHT_FRAGMENT = `in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uAux;
uniform sampler2D uWall;
// highp to match the vertex shader: mobile drivers refuse to link a shared uniform whose
// precision differs between stages (PixiJS defaults fragment shaders to mediump)
uniform highp vec4 uInputSize;

uniform vec2 uFrameSize;
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

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec4 auxAt(vec2 px) {
    vec2 p = clamp(px, vec2(0.5), uFrameSize - 0.5);
    return texture(uAux, p / uFrameSize);
}

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
    vec4 albedo = texture(uTexture, vTextureCoord);
    vec2 px = vTextureCoord * uInputSize.xy;
    vec4 aux = auxAt(px);

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

    vec3 light = uAmbient + uSunColor * max(dot(n, normalize(uSunDir)), 0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;
        vec4 lp = uLightPos[i];
        vec4 lc = uLightColor[i];
        vec3 toLight = lp.xyz - surface;
        float att = clamp(1.0 - length(toLight.xy) / lp.w, 0.0, 1.0);
        att *= att;
        float diffuse = hero ? max(dot(n, normalize(toLight)), 0.0) * 0.75 + 0.25 : 1.0;
        light += lc.rgb * lc.a * att * diffuse;
    }

    // Crisp, sparse shadows: a hard 2 px strip on floor right under a wall base; walls a step
    // darker than floors; actors keep their own flat sprite blob shadows
    float shade = 1.0;
    bool onWall = wallAt(px) > 0.5;
    if (onWall && aux.a < 0.5) {
        shade = uGrade.w;
    } else if (aux.a < 0.5) {
        float ly = mod(px.y, 16.0);
        if (ly < 2.0 && wallAt(vec2(px.x, px.y - ly - 1.0)) > 0.5) shade = 0.72;
    }

    // Flames, blasts, sparks, fuse tips and unlocked warp/seal pads emit their own light
    float emissive = aux.a > 0.5 ? aux.g : 0.0;
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
    light = max(light, vec3(1.15 * emissive));

    // Plain multiply keeps the art's own colours; only near-black gets a faint zone-ink lift
    vec3 c = albedo.rgb * light * shade;
    c += uShadowInk * 0.12 * (1.0 - clamp(luma(light), 0.0, 1.0));

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
uniform int uPadCount;
uniform vec4 uEmissivePads[${MAX_EMISSIVE_PADS}];

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main(void)
{
    vec3 lit = texture(uTexture, vTextureCoord).rgb;
    vec2 px = clamp(vTextureCoord * uInputSize.xy, vec2(0.5), uFrameSize - 0.5);
    vec4 aux = texture(uAux, px / uFrameSize);

    // Emissive-driven bloom: only G-buffer emissives & active warp/seal runes glow
    float em = aux.a > 0.5 && aux.g > 0.05 ? aux.g : 0.0;
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
    t === 'T' ||
    t === 'D' ||
    t === 'K' ||
    t === 'S'
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

  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = ROOM_W;
  wallCanvas.height = ROOM_H;
  const wallCtx = wallCanvas.getContext('2d');
  const wallImg = wallCtx ? wallCtx.createImageData(ROOM_W, ROOM_H) : null;

  const albedoTex = canvasTexture(gbc.frame, 'nearest');
  const auxTex = canvasTexture(gbc.aux, 'nearest');
  const wallTex = canvasTexture(wallCanvas, 'nearest');

  const padArray = new Float32Array(MAX_EMISSIVE_PADS * 4);

  const lightUniforms = new UniformGroup({
    uFrameSize: { value: new Float32Array([NATIVE_W, NATIVE_H]), type: 'vec2<f32>' },
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

  const solidParticles = new Graphics();
  const glowParticles = new Graphics();
  glowParticles.blendMode = 'add';
  app.stage.addChild(worldLayer, clouds, solidParticles, glowParticles);

  const particles = new ParticleSystem(1234);
  const flashes: Flash[] = [];
  let slide: { dx: number; dy: number; start: number } | null = null;

  function syncWallMask(world: World, s: State): void {
    if (!wallCtx || !wallImg) return;
    const data = wallImg.data;
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const t = tileAt(world, s, s.zone, s.rx, s.ry, x, y);
        const solid = isShadowCasterTile(t, s.crystalColor) ? 255 : 0;
        const i = (y * ROOM_W + x) * 4;
        data[i] = solid;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    for (const blk of s.blocks) {
      const bx = Math.round(blk.x);
      const by = Math.round(blk.y);
      if (bx >= 0 && bx < ROOM_W && by >= 0 && by < ROOM_H) {
        data[(by * ROOM_W + bx) * 4] = 255;
      }
    }
    wallCtx.putImageData(wallImg, 0, 0);
    wallTex.source.update();
  }

  function collectEmissivePads(world: World, s: State, time: number): number {
    padArray.fill(0);
    let count = 0;
    const room = currentRoom(world, s);
    if (s.cryptWarpUnlocked) {
      for (const p of room?.portals ?? []) {
        if (!p.requiresWarpUnlock || count >= MAX_EMISSIVE_PADS) continue;
        padArray.set(
          [(p.x + 0.5) * TILE_PX, (p.y + 0.5) * TILE_PX, 8.5, 0.85 + 0.12 * Math.sin(time * 3)],
          count * 4,
        );
        count++;
      }
    }
    if (s.spireCinderSlotted || s.cores.includes('cinder')) {
      for (const st of room?.stamps ?? []) {
        if (st.id !== 'spire-seal' || count >= MAX_EMISSIVE_PADS) continue;
        padArray.set(
          [(st.x + 0.5) * TILE_PX, (st.y + 0.5) * TILE_PX, 8.0, 0.85 + 0.1 * Math.sin(time * 3.5)],
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
      // 1. Upload this frame's albedo, sprite G-buffer, and wall shadow-caster mask
      albedoTex.source.update();
      auxTex.source.update();
      syncWallMask(world, s);

      // 2. Lights & active emissive floor pads, from state and fresh blast flashes
      for (const bl of s.blasts) {
        if (!bl.shape || bl.shape === 'hub' || bl.shape === 'single') {
          flashes.push({ x: bl.x, y: bl.y, kind: bl.kind, born: time });
        }
      }
      while (flashes.length > 0 && time - (flashes[0]?.born ?? time) > 0.4) flashes.shift();
      const lighting = computeLighting(world, s, time, flashes);
      const padCount = collectEmissivePads(world, s, time);

      const u = lightUniforms.uniforms as {
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
      };
      u.uAmbient.set(lighting.ambient);
      u.uSunDir.set(lighting.sunDir);
      u.uSunColor.set(lighting.sunColor);
      u.uShadowInk.set(lighting.shadowInk);
      const crypt = s.zone === 'ember-crypt';
      // saturation, contrast (neutral), tint mix, wall shade
      u.uGrade.set(crypt ? [1.04, 1.0, 0.35, 0.74] : [1.06, 1.0, 0.35, 1.0]);
      u.uTint.set(crypt ? [0.95, 0.92, 1.08] : [1.05, 1.0, 0.92]);
      u.uLightCount = lighting.lights.length;
      lighting.lights.forEach((l, i) => {
        u.uLightPos.set([l.x, l.y, l.z, l.radius], i * 4);
        u.uLightColor.set([l.color[0], l.color[1], l.color[2], l.intensity], i * 4);
      });
      u.uPadCount = padCount;
      u.uEmissivePads.set(padArray);
      lightUniforms.update();

      const bu = brightUniforms.uniforms as {
        uPadCount: number;
        uEmissivePads: Float32Array;
      };
      bu.uPadCount = padCount;
      bu.uEmissivePads.set(padArray);
      brightUniforms.update();

      // 3. Lit frame and emissive-only bloom, at native resolution
      renderer.render({ container: litScene, target: litRT, clear: true });
      brightSprite.texture = litRT;
      renderer.render({ container: brightScene, target: brightRT, clear: true });
      renderer.render({ container: blurScene, target: bloomRT, clear: true });

      // 4. Particles in integer-scaled screen space
      if (!slide) {
        particles.spawnFromFrame(s, s.events, s.blasts);
        particles.emitAmbient(s, dt);
      }
      particles.update(dt);
      solidParticles.clear();
      glowParticles.clear();
      for (const p of particles.particles) {
        const k = Math.max(0, p.life / p.maxLife);
        const g = p.glow ? glowParticles : solidParticles;
        const size = p.size * upScale * (p.kind === 'smoke' ? 1.6 - k * 0.6 : 1);
        const alpha = p.kind === 'smoke' ? 0.35 * k : p.glow ? k : Math.min(1, k * 2);
        g.circle(p.x * upScale, p.y * upScale, size / 2).fill({ color: p.color, alpha });
      }

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
      clouds.visible = !crypt;
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
