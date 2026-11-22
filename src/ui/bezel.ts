/**
 * Phase 6.1 & 6.2 Pixel-Perfect Framing, Zone Bezel & Unified GBC Box UI (`ROADMAP.md` §6.1–6.2,
 * `ASSETS.md` §1.6):
 * - Integer device-pixel playfield framing (`computeIntegerFrame`).
 * - Pure-TS deterministic RGBA -> PNG data-URI encoder (bit-exact RGB555 in Browser & Node).
 * - Zone-themed `16 × 16` Super Game Boy / GBC bezel tile (`bezelTileDataUrl`).
 * - Unified `24 × 24` (`8px` slice) double-lined GBC box frame (`gbcFrameDataUrl`, `gbcBoxBorderCss`).
 * - Crisp `68 × 68` (`34 × 34 @ 2×`) pixel-art arcade action caps (`actionButtonDataUrl`).
 */
import type { ZoneId } from '../game/types';
import { NATIVE_H, NATIVE_W } from '../render/gbc';
import { BG_PALETTES, INK_RGB, type Rgb, rgb555 } from '../render/gbcPalette';

export type Rgba = readonly [number, number, number, number];

export interface IntegerFrame {
  /** Whole integer device pixels per native art pixel (`>= 1`). */
  deviceScale: number;
  /** Physical backing width in device pixels (`NATIVE_W * deviceScale`). */
  deviceWidth: number;
  /** Physical backing height in device pixels (`NATIVE_H * deviceScale`). */
  deviceHeight: number;
  /** CSS display width (`deviceWidth / dpr`, or aspect-clamped on sub-native tiny windows). */
  cssWidth: number;
  /** CSS display height (`deviceHeight / dpr`, or aspect-clamped on sub-native tiny windows). */
  cssHeight: number;
  /** Top bezel band thickness in CSS pixels. */
  bezelTopPx: number;
  /** Bottom bezel band thickness in CSS pixels. */
  bezelBottomPx: number;
  /** Left/right bezel band thickness in CSS pixels. */
  bezelSidePx: number;
  /** True only when the stage itself is smaller than `1×` native (`176 × 208`). */
  clamped: boolean;
}

const BEZEL_MARGIN_CSS_PX = 4;

/**
 * Choose an exact integer physical device-pixel scale for the `176 × 208` playfield inside a
 * `stageCssW × stageCssH` CSS stage at `dpr` device-pixel ratio.
 */
export function computeIntegerFrame(stageCssW: number, stageCssH: number, dpr = 1): IntegerFrame {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const stageW = Math.max(1, stageCssW);
  const stageH = Math.max(1, stageCssH);
  const stageDevW = stageW * safeDpr;
  const stageDevH = stageH * safeDpr;

  // Tiny window fallback: if even 1x native exceeds the stage, clamp CSS size keeping aspect.
  if (stageW < NATIVE_W || stageH < NATIVE_H || stageDevW < NATIVE_W || stageDevH < NATIVE_H) {
    const fit = Math.min(stageW / NATIVE_W, stageH / NATIVE_H);
    const cssWidth = Math.max(1, Math.floor(NATIVE_W * fit));
    const cssHeight = Math.max(1, Math.floor(NATIVE_H * fit));
    const bezelSidePx = Math.max(0, (stageW - cssWidth) / 2);
    const bezelTopPx = Math.max(0, Math.floor((stageH - cssHeight) / 2));
    const bezelBottomPx = Math.max(0, stageH - cssHeight - bezelTopPx);
    return {
      deviceScale: 1,
      deviceWidth: NATIVE_W,
      deviceHeight: NATIVE_H,
      cssWidth,
      cssHeight,
      bezelTopPx,
      bezelBottomPx,
      bezelSidePx,
      clamped: true,
    };
  }

  const marginDev = BEZEL_MARGIN_CSS_PX * safeDpr;
  const availDevW = stageDevW >= NATIVE_W + marginDev * 2 ? stageDevW - marginDev * 2 : stageDevW;
  const availDevH = stageDevH >= NATIVE_H + marginDev * 2 ? stageDevH - marginDev * 2 : stageDevH;

  const deviceScale = Math.max(1, Math.floor(Math.min(availDevW / NATIVE_W, availDevH / NATIVE_H)));
  const deviceWidth = NATIVE_W * deviceScale;
  const deviceHeight = NATIVE_H * deviceScale;
  const cssWidth = deviceWidth / safeDpr;
  const cssHeight = deviceHeight / safeDpr;
  const bezelSidePx = Math.max(0, (stageW - cssWidth) / 2);
  const bezelTopPx = Math.max(0, (stageH - cssHeight) / 2);
  const bezelBottomPx = Math.max(0, stageH - cssHeight - bezelTopPx);

  return {
    deviceScale,
    deviceWidth,
    deviceHeight,
    cssWidth,
    cssHeight,
    bezelTopPx,
    bezelBottomPx,
    bezelSidePx,
    clamped: false,
  };
}

// =========================================================================
// Deterministic Nearest-Neighbour RGBA -> PNG Data-URL Encoder
// =========================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c = ((CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] ?? 0)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function writeU32Be(arr: Uint8Array, offset: number, val: number): void {
  arr[offset] = (val >>> 24) & 0xff;
  arr[offset + 1] = (val >>> 16) & 0xff;
  arr[offset + 2] = (val >>> 8) & 0xff;
  arr[offset + 3] = val & 0xff;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32Be(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out, 4, 8 + data.length);
  writeU32Be(out, 8 + data.length, crc);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

/**
 * Encode an `artW × artH` RGBA pixel grid scaled by integer `scale` (nearest-neighbour)
 * into a bit-exact `data:image/png;base64,...` URI.
 */
export function encodeRgbaPngDataUrl(
  artW: number,
  artH: number,
  pixelAt: (x: number, y: number) => Rgba,
  scale = 1,
): string {
  const s = Math.max(1, Math.floor(scale));
  const outW = artW * s;
  const outH = artH * s;
  const rowStride = 1 + outW * 4;
  const raw = new Uint8Array(outH * rowStride);

  for (let ay = 0; ay < artH; ay++) {
    for (let sy = 0; sy < s; sy++) {
      const oy = ay * s + sy;
      const rowBase = oy * rowStride;
      raw[rowBase] = 0; // PNG filter 0 (None)
      for (let ax = 0; ax < artW; ax++) {
        const [r, g, b, a] = pixelAt(ax, ay);
        for (let sx = 0; sx < s; sx++) {
          const pxBase = rowBase + 1 + (ax * s + sx) * 4;
          raw[pxBase] = r;
          raw[pxBase + 1] = g;
          raw[pxBase + 2] = b;
          raw[pxBase + 3] = a;
        }
      }
    }
  }

  // Zlib wrapper around stored (uncompressed) DEFLATE blocks of <= 65535 bytes
  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const zlib = new Uint8Array(2 + numBlocks * 5 + raw.length + 4);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  let zOff = 2;
  for (let b = 0; b < numBlocks; b++) {
    const start = b * maxBlock;
    const end = Math.min(raw.length, start + maxBlock);
    const len = end - start;
    const isLast = b === numBlocks - 1 ? 1 : 0;
    zlib[zOff++] = isLast;
    zlib[zOff++] = len & 0xff;
    zlib[zOff++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    zlib[zOff++] = nlen & 0xff;
    zlib[zOff++] = (nlen >>> 8) & 0xff;
    zlib.set(raw.subarray(start, end), zOff);
    zOff += len;
  }
  writeU32Be(zlib, zOff, adler32(raw));

  const ihdr = new Uint8Array(13);
  writeU32Be(ihdr, 0, outW);
  writeU32Be(ihdr, 4, outH);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const cIhdr = makeChunk('IHDR', ihdr);
  const cIdat = makeChunk('IDAT', zlib);
  const cIend = makeChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
  let off = 0;
  png.set(sig, off);
  off += sig.length;
  png.set(cIhdr, off);
  off += cIhdr.length;
  png.set(cIdat, off);
  off += cIdat.length;
  png.set(cIend, off);

  return `data:image/png;base64,${toBase64(png)}`;
}

export function opaque(c: Rgb): Rgba {
  return [c[0], c[1], c[2], 255];
}

export const TRANSPARENT_RGBA: Rgba = [0, 0, 0, 0];

// =========================================================================
// 1. Zone-Themed 16x16 Super Game Boy / GBC Bezel Tile (`ROADMAP.md` §6.1)
// =========================================================================

// Quiet backdrop: plain ink with a sparse, low-contrast diamond so the playfield leads
const OW_BEZEL_PATTERN: readonly string[] = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000100000000',
  '0000001010000000',
  '0000000100000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

const CRYPT_BEZEL_PATTERN: readonly string[] = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000100000000',
  '0000001010000000',
  '0000000100000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

const bezelCache = new Map<string, string>();

export function bezelTileDataUrl(zone: ZoneId, scale = 2): string {
  const key = `${zone}:${scale}`;
  const hit = bezelCache.get(key);
  if (hit) return hit;

  const zp = BG_PALETTES[zone];
  const palette: readonly [Rgb, Rgb, Rgb, Rgb] =
    zone === 'ice-cave'
      ? [INK_RGB, zp.floor[3], zp.floor[3], zp.floor[3]]
      : [INK_RGB, zp.foliage[3], zp.foliage[3], zp.foliage[3]];
  const rows = zone === 'ice-cave' ? CRYPT_BEZEL_PATTERN : OW_BEZEL_PATTERN;

  const url = encodeRgbaPngDataUrl(
    16,
    16,
    (x, y) => {
      const ch = rows[y]?.[x] ?? '0';
      const idx = ch === '3' ? 3 : ch === '2' ? 2 : ch === '1' ? 1 : 0;
      return opaque(palette[idx]);
    },
    scale,
  );
  bezelCache.set(key, url);
  return url;
}

// =========================================================================
// 2. Unified Double-Lined 24x24 (8px Slice) GBC Box Frame (`ROADMAP.md` §6.2)
// =========================================================================

export type GbcBoxAccent = 'normal' | 'gold' | 'boss';

interface FrameColors {
  outerHi: Rgb;
  outerMid: Rgb;
  hairline: Rgb;
  fill: Rgb;
}

function frameColorsFor(zone: ZoneId, accent: GbcBoxAccent): FrameColors {
  if (accent === 'boss') {
    return {
      outerHi: rgb555(248, 216, 88),
      outerMid: rgb555(216, 128, 48),
      hairline: rgb555(224, 56, 48),
      fill: rgb555(24, 16, 32),
    };
  }
  if (accent === 'gold') {
    return {
      outerHi: rgb555(248, 232, 144),
      outerMid: rgb555(216, 168, 64),
      hairline: rgb555(120, 184, 112),
      fill: zone === 'ice-cave' ? rgb555(14, 20, 36) : rgb555(16, 24, 24),
    };
  }
  if (zone === 'ice-cave') {
    return {
      outerHi: rgb555(200, 224, 240),
      outerMid: rgb555(72, 112, 160),
      hairline: rgb555(232, 184, 80),
      fill: rgb555(14, 20, 36),
    };
  }
  return {
    outerHi: rgb555(216, 208, 168),
    outerMid: rgb555(128, 144, 112),
    hairline: rgb555(224, 184, 88),
    fill: rgb555(16, 24, 20),
  };
}

const frameCache = new Map<string, string>();

/**
 * Bake an authentic `24 × 24` (`8px` corner slice) GBC double-lined pixel frame:
 * - `d = 0`: `1px` outer ink silhouette with `1px` pixel-chamfered corners
 * - `d = 1..2`: `2px` bright bevel border with corner rivets (uniform along edge stretch axes)
 * - `d = 3`: `1px` inner dark groove
 * - `d = 4`: `1px` inner gold/stone hairline
 * - `d = 5`: `1px` inner dark separator
 * - `d >= 6`: dark RGB555 interior fill
 */
export function gbcFrameDataUrl(zone: ZoneId, accent: GbcBoxAccent = 'normal'): string {
  const key = `${zone}:${accent}`;
  const hit = frameCache.get(key);
  if (hit) return hit;

  const cols = frameColorsFor(zone, accent);
  const S = 24;
  const url = encodeRgbaPngDataUrl(S, S, (x, y) => {
    const dx = Math.min(x, S - 1 - x);
    const dy = Math.min(y, S - 1 - y);
    const d = Math.min(dx, dy);

    // 1px notched outer pixel corners with continuous ink step at (1,1)
    if (dx === 0 && dy === 0) return TRANSPARENT_RGBA;
    if (dx === 1 && dy === 1) return opaque(INK_RGB);
    if (d === 0) return opaque(INK_RGB);

    // Decorative corner rivet inside the 8x8 corner slice (never in stretched 8..15 middle!)
    if ((dx === 2 || dx === 3) && (dy === 2 || dy === 3)) {
      return dx === 2 && dy === 2 ? opaque(cols.outerHi) : opaque(INK_RGB);
    }

    if (d === 1) {
      // Sunlit top & left outer bevel, shaded bottom & right outer bevel
      const sunlit = y === 1 || x === 1;
      return opaque(sunlit ? cols.outerHi : cols.outerMid);
    }
    if (d === 2) {
      return opaque(cols.outerMid);
    }
    if (d === 3) {
      return opaque(INK_RGB);
    }
    if (d === 4) {
      return opaque(cols.hairline);
    }
    if (d === 5) {
      return opaque(INK_RGB);
    }
    return opaque(cols.fill);
  });

  frameCache.set(key, url);
  return url;
}

export interface GbcBoxCss {
  borderStyle: string;
  borderWidth: string;
  borderColor: string;
  borderRadius: string;
  borderImageSource: string;
  borderImageSlice: string;
  borderImageWidth: string;
  borderImageRepeat: string;
  backgroundColor: string;
}

export function gbcBoxBorderCss(zone: ZoneId, accent: GbcBoxAccent = 'normal'): GbcBoxCss {
  const cols = frameColorsFor(zone, accent);
  return {
    borderStyle: 'solid',
    borderWidth: '8px',
    borderColor: 'transparent',
    borderRadius: '0',
    borderImageSource: `url("${gbcFrameDataUrl(zone, accent)}")`,
    borderImageSlice: '8 fill',
    borderImageWidth: '8px',
    borderImageRepeat: 'stretch',
    backgroundColor: `rgb(${cols.fill[0]}, ${cols.fill[1]}, ${cols.fill[2]})`,
  };
}

export function applyGbcBoxFrame(
  el: HTMLElement,
  zone: ZoneId,
  accent: GbcBoxAccent = 'normal',
): void {
  Object.assign(el.style, gbcBoxBorderCss(zone, accent));
}

// =========================================================================
// 3. Pixel-Art Action Button Caps (34x34 art px @ 2x = 68x68 px) (`§6.2`)
// =========================================================================

interface CapPalette {
  glint: Rgb;
  rimBright: Rgb;
  rimMid: Rgb;
  face: Rgb;
  faceShade: Rgb;
  socket: Rgb;
}

const CAP_PALETTES: Record<'B' | 'A', { up: CapPalette; down: CapPalette }> = {
  B: {
    up: {
      glint: rgb555(240, 248, 248),
      rimBright: rgb555(96, 224, 216),
      rimMid: rgb555(40, 144, 152),
      face: rgb555(24, 80, 96),
      faceShade: rgb555(16, 48, 64),
      socket: rgb555(16, 24, 32),
    },
    down: {
      glint: rgb555(168, 232, 232),
      rimBright: rgb555(56, 168, 168),
      rimMid: rgb555(24, 104, 112),
      face: rgb555(16, 56, 72),
      faceShade: rgb555(16, 32, 48),
      socket: rgb555(16, 24, 32),
    },
  },
  A: {
    up: {
      glint: rgb555(248, 248, 232),
      rimBright: rgb555(248, 216, 80),
      rimMid: rgb555(192, 128, 32),
      face: rgb555(88, 56, 24),
      faceShade: rgb555(56, 32, 16),
      socket: rgb555(24, 16, 16),
    },
    down: {
      glint: rgb555(240, 216, 128),
      rimBright: rgb555(200, 152, 48),
      rimMid: rgb555(136, 88, 24),
      face: rgb555(64, 40, 16),
      faceShade: rgb555(40, 24, 16),
      socket: rgb555(24, 16, 16),
    },
  },
};

const btnCache = new Map<string, string>();

/**
 * Bake a `68 × 68` (`34 × 34` art pixels scaled `2×` nearest-neighbour) GBC arcade thumb cap
 * with `1px` ink outline, specular crescent highlight, checkerboard-dithered bevel rim, and
 * a depressed `pressed = true` state (cap & highlight shift down `1` art px = `2px` output).
 */
export function actionButtonDataUrl(kind: 'B' | 'A', pressed: boolean): string {
  const key = `${kind}:${pressed ? 1 : 0}`;
  const hit = btnCache.get(key);
  if (hit) return hit;

  const pal = pressed ? CAP_PALETTES[kind].down : CAP_PALETTES[kind].up;
  const ART = 34;
  const cx = 16.5;
  // Unpressed cap sits 1 art pixel (2 CSS px) higher above its recessed socket rim
  const capCy = pressed ? 16.5 : 15.5;
  const socketCy = 17.2;

  const url = encodeRgbaPngDataUrl(
    ART,
    ART,
    (x, y) => {
      const dx = x - cx;
      const dy = y - capCy;
      const dist = Math.hypot(dx, dy);
      const sockDist = Math.hypot(dx, y - socketCy);

      if (dist > 15.6) {
        // Lower cast-iron socket well visible under unpressed cap
        if (!pressed && y >= 17 && sockDist <= 15.6) {
          return sockDist > 14.5 ? opaque(INK_RGB) : opaque(pal.socket);
        }
        return TRANSPARENT_RGBA;
      }

      // 1px outer ink silhouette
      if (dist > 14.4) {
        return opaque(INK_RGB);
      }

      const dither = (x + y) % 2 === 0;
      const topLeft = dx + dy < -2;
      const bottomRight = dx + dy > 4;

      // Specular crescent highlight along top-left rim (shifts down with `capCy` when pressed!)
      if (dist > 11.8 && dist <= 13.7 && dx < -1.5 && dy < -1.5 && dx + dy < -9.5) {
        return opaque(pal.glint);
      }

      // Beveled outer ring with pixel checkerboard dithering
      if (dist > 12.1) {
        if (topLeft) return opaque(pal.rimBright);
        if (bottomRight) return opaque(dither ? pal.rimMid : pal.faceShade);
        return opaque(dither ? pal.rimBright : pal.rimMid);
      }

      // 1px subtle inner bevel groove
      if (dist > 11.1) {
        return opaque(topLeft ? pal.rimMid : pal.faceShade);
      }

      // Depressed top inner shadow when held down
      if (pressed && dy < -7.5) {
        return opaque(pal.faceShade);
      }

      // Subtle dithered lower bowl shading on button face
      if (dy > 6.5 && dither) {
        return opaque(pal.faceShade);
      }

      return opaque(pal.face);
    },
    2,
  );

  btnCache.set(key, url);
  return url;
}

// =========================================================================
// 4. Crisp 12x12 Pixel Speaker Icon for Settings (Zero OS Emojis!)
// =========================================================================

const SOUND_ON_ROWS = [
  '.....66.....',
  '....6226.66.',
  '..6621266216',
  '.6221126.626',
  '621122266.62',
  '621222262662',
  '621222262662',
  '624422266.62',
  '.6442226.626',
  '..6642266216',
  '....6446.66.',
  '.....66.....',
];

const SOUND_OFF_ROWS = [
  '.....66.....',
  '....6226....',
  '..662126.6.6',
  '.62211266363',
  '62112226.636',
  '62122226.636',
  '621222266363',
  '62442226.6.6',
  '.6442226....',
  '..664226....',
  '....6446....',
  '.....66.....',
];

const soundCache = new Map<string, string>();

export function soundIconDataUrl(muted: boolean, scale = 2): string {
  const key = `${muted ? 1 : 0}:${scale}`;
  const hit = soundCache.get(key);
  if (hit) return hit;

  const rows = muted ? SOUND_OFF_ROWS : SOUND_ON_ROWS;
  const c1 = rgb555(248, 248, 240);
  const c2 = rgb555(248, 208, 72);
  const c3 = rgb555(232, 56, 48);
  const c4 = rgb555(160, 104, 40);

  const url = encodeRgbaPngDataUrl(
    12,
    12,
    (x, y) => {
      const ch = rows[y]?.[x] ?? '.';
      if (ch === '1') return opaque(c1);
      if (ch === '2') return opaque(c2);
      if (ch === '3') return opaque(c3);
      if (ch === '4') return opaque(c4);
      if (ch === '6') return opaque(INK_RGB);
      return TRANSPARENT_RGBA;
    },
    scale,
  );
  soundCache.set(key, url);
  return url;
}
