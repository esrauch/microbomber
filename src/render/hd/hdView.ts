/**
 * HD-2D lite presentation layer on WebGL via PixiJS (`GAME.md` §10, ROADMAP Phase 5).
 *
 * The Canvas2D renderer (`gbc.ts`) still composes each frame at native resolution: that is
 * the albedo pass, plus a sprite G-buffer (`gbcAux.ts`). This view takes both as textures
 * and adds what the GBC never could:
 *
 * 1. Lighting: normal-mapped point lights, ambient and sun (`lights.ts`), with normals from
 *    hand-tuned hero heights or auto-generated from albedo luminance; emissive pixels glow.
 *    Colour grading happens in the same pass.
 * 2. Bloom: a bright pass blurred at native resolution, added back smoothly upscaled.
 * 3. Particles (`particles.ts`) at full screen resolution.
 * 4. Room slides with an eased push and parallax cloud shadows.
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
import type { State, World } from '../../game/types';
import { type GbcView, NATIVE_H, NATIVE_W, computeGbcCanvasSize } from '../gbc';
import { type Flash, MAX_LIGHTS, computeLighting } from './lights';
import { ParticleSystem } from './particles';

const UP = 4;
const DW = NATIVE_W * UP;
const DH = NATIVE_H * UP;
export const SLIDE_SECONDS = 0.32;

export interface HdView {
  /** Present the frame `gbc` just composed. */
  render(world: World, s: State, time: number, dt: number): void;
  resize(stageWidth: number, stageHeight: number): void;
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
// highp to match the vertex shader: mobile drivers refuse to link a shared uniform whose
// precision differs between stages (PixiJS defaults fragment shaders to mediump)
uniform highp vec4 uInputSize;

uniform vec2 uFrameSize;
uniform vec3 uAmbient;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec4 uGrade;
uniform vec3 uTint;
uniform int uLightCount;
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec4 uLightColor[${MAX_LIGHTS}];

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Height at native pixel px: hand-tuned for heroes, else albedo luminance (ink = low edge)
float heightAt(vec2 px) {
    vec2 p = clamp(px, vec2(0.5), uFrameSize - 0.5);
    vec4 aux = texture(uAux, p / uFrameSize);
    float autoH = luma(texture(uTexture, p * uInputSize.zw).rgb);
    return aux.a > 0.5 && aux.b > 0.5 ? aux.r : autoH;
}

void main(void)
{
    vec4 albedo = texture(uTexture, vTextureCoord);
    vec2 px = vTextureCoord * uInputSize.xy;
    vec4 aux = texture(uAux, px / uFrameSize);

    float h0 = heightAt(px);
    float hl = heightAt(px + vec2(-1.0, 0.0));
    float hr = heightAt(px + vec2(1.0, 0.0));
    float hu = heightAt(px + vec2(0.0, -1.0));
    float hd = heightAt(px + vec2(0.0, 1.0));
    vec3 n = normalize(vec3((hl - hr) * 2.2, (hu - hd) * 2.2, 1.0));
    vec3 surface = vec3(px, h0 * 6.0);

    vec3 light = uAmbient + uSunColor * max(dot(n, normalize(uSunDir)), 0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;
        vec4 lp = uLightPos[i];
        vec4 lc = uLightColor[i];
        vec3 toLight = lp.xyz - surface;
        float att = clamp(1.0 - length(toLight.xy) / lp.w, 0.0, 1.0);
        att *= att;
        float diffuse = max(dot(n, normalize(toLight)), 0.0) * 0.75 + 0.25;
        light += lc.rgb * lc.a * att * diffuse;
    }

    // Flames, blasts and sparks are their own light source
    float emissive = aux.a > 0.5 ? aux.g : 0.0;
    light = max(light, vec3(1.15 * emissive));

    vec3 c = albedo.rgb * light;
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

void main(void)
{
    vec3 c = texture(uTexture, vTextureCoord).rgb;
    float peak = max(c.r, max(c.g, c.b));
    finalColor = vec4(c * smoothstep(0.72, 0.98, peak), 1.0);
}
`;

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
  const app = new Application();
  await app.init({
    width: DW,
    height: DH,
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

  const albedoTex = canvasTexture(gbc.frame, 'nearest');
  const auxTex = canvasTexture(gbc.aux, 'nearest');

  const lightUniforms = new UniformGroup({
    uFrameSize: { value: new Float32Array([NATIVE_W, NATIVE_H]), type: 'vec2<f32>' },
    uAmbient: { value: new Float32Array(3), type: 'vec3<f32>' },
    uSunDir: { value: new Float32Array(3), type: 'vec3<f32>' },
    uSunColor: { value: new Float32Array(3), type: 'vec3<f32>' },
    uGrade: { value: new Float32Array(4), type: 'vec4<f32>' },
    uTint: { value: new Float32Array(3), type: 'vec3<f32>' },
    uLightCount: { value: 0, type: 'i32' },
    uLightPos: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
    uLightColor: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
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
    },
  });
  const brightFilter = new Filter({
    glProgram: GlProgram.from({
      vertex: FILTER_VERTEX,
      fragment: BRIGHT_FRAGMENT,
      name: 'hd-bright',
    }),
    resources: {},
  });

  // Native-resolution passes
  const albedoSprite = new Sprite(albedoTex);
  albedoSprite.filters = [lightFilter];
  const litScene = new Container();
  litScene.addChild(albedoSprite);

  let litRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'nearest' });
  let prevRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'nearest' });
  const bloomRT = RenderTexture.create({ width: NATIVE_W, height: NATIVE_H, scaleMode: 'linear' });

  const brightSprite = new Sprite(litRT);
  brightSprite.filters = [brightFilter, new BlurFilter({ strength: 3, quality: 3 })];
  const brightScene = new Container();
  brightScene.addChild(brightSprite);

  // Display stage
  const worldLayer = new Container();
  const prevSprite = new Sprite(prevRT);
  const litSprite = new Sprite(litRT);
  const bloomSprite = new Sprite(bloomRT);
  for (const sp of [prevSprite, litSprite, bloomSprite]) sp.scale.set(UP);
  bloomSprite.blendMode = 'add';
  bloomSprite.alpha = 0.75;
  prevSprite.visible = false;
  worldLayer.addChild(prevSprite, litSprite, bloomSprite);

  const clouds = new TilingSprite({
    texture: canvasTexture(makeCloudCanvas(), 'linear'),
    width: DW,
    height: DH,
  });
  clouds.alpha = 0.16;

  const solidParticles = new Graphics();
  const glowParticles = new Graphics();
  glowParticles.blendMode = 'add';
  app.stage.addChild(worldLayer, clouds, solidParticles, glowParticles);

  const particles = new ParticleSystem(1234);
  const flashes: Flash[] = [];
  let slide: { dx: number; dy: number; start: number } | null = null;

  const view: HdView = {
    canvas,

    render(world: World, s: State, time: number, dt: number): void {
      // 1. Upload this frame's albedo and G-buffer
      albedoTex.source.update();
      auxTex.source.update();

      // 2. Lights, from state and fresh blast flashes
      for (const bl of s.blasts) {
        if (!bl.shape || bl.shape === 'hub' || bl.shape === 'single') {
          flashes.push({ x: bl.x, y: bl.y, kind: bl.kind, born: time });
        }
      }
      while (flashes.length > 0 && time - (flashes[0]?.born ?? time) > 0.4) flashes.shift();
      const lighting = computeLighting(world, s, time, flashes);
      const u = lightUniforms.uniforms as {
        uAmbient: Float32Array;
        uSunDir: Float32Array;
        uSunColor: Float32Array;
        uGrade: Float32Array;
        uTint: Float32Array;
        uLightCount: number;
        uLightPos: Float32Array;
        uLightColor: Float32Array;
      };
      u.uAmbient.set(lighting.ambient);
      u.uSunDir.set(lighting.sunDir);
      u.uSunColor.set(lighting.sunColor);
      const crypt = s.zone === 'ember-crypt';
      u.uGrade.set(crypt ? [1.08, 1.1, 0.5, 0] : [1.12, 1.06, 0.5, 0]);
      u.uTint.set(crypt ? [0.95, 0.92, 1.08] : [1.05, 1.0, 0.92]);
      u.uLightCount = lighting.lights.length;
      lighting.lights.forEach((l, i) => {
        u.uLightPos.set([l.x, l.y, l.z, l.radius], i * 4);
        u.uLightColor.set([l.color[0], l.color[1], l.color[2], l.intensity], i * 4);
      });
      lightUniforms.update();

      // 3. Lit frame and bloom, at native resolution
      renderer.render({ container: litScene, target: litRT, clear: true });
      brightSprite.texture = litRT;
      renderer.render({ container: brightScene, target: bloomRT, clear: true });

      // 4. Particles in screen space
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
        const size = p.size * UP * (p.kind === 'smoke' ? 1.6 - k * 0.6 : 1);
        const alpha = p.kind === 'smoke' ? 0.35 * k : p.glow ? k : Math.min(1, k * 2);
        g.circle(p.x * UP, p.y * UP, size / 2).fill({ color: p.color, alpha });
      }

      // 5. Room slide and parallax clouds
      let offX = 0;
      let offY = 0;
      if (slide) {
        const t = Math.min(1, (time - slide.start) / SLIDE_SECONDS);
        const e = easeInOutCubic(t);
        offX = slide.dx * (1 - e) * DW;
        offY = slide.dy * (1 - e) * DH;
        prevSprite.visible = t < 1;
        prevSprite.position.set(offX - slide.dx * DW, offY - slide.dy * DH);
        if (t >= 1) slide = null;
      } else {
        prevSprite.visible = false;
      }
      litSprite.position.set(offX, offY);
      bloomSprite.position.set(offX, offY);
      solidParticles.position.set(offX, offY);
      glowParticles.position.set(offX, offY);
      clouds.visible = !crypt;
      clouds.tilePosition.set(time * 7 + offX * 1.35, time * 3 + offY * 1.35);

      renderer.render(app.stage);
    },

    resize(stageWidth: number, stageHeight: number): void {
      const { width, height } = computeGbcCanvasSize(stageWidth, stageHeight);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
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
