import { describe, expect, it } from 'vitest';
import { NATIVE_H, NATIVE_W } from '../src/render/gbc';
import {
  actionButtonDataUrl,
  bezelTileDataUrl,
  computeIntegerFrame,
  gbcBoxBorderCss,
  gbcFrameDataUrl,
} from '../src/ui/bezel';
import { joystickKnobDataUrl, joystickRingDataUrl } from '../src/ui/joystick';
import { GLYPH_BITMAPS, PIXEL_FONT_FAMILY, buildPixelFontTtf } from '../src/ui/pixelFont';

function readU16Be(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 8) | buf[off + 1]!) >>> 0;
}

function readI16Be(buf: Uint8Array, off: number): number {
  const v = readU16Be(buf, off);
  return v >= 0x8000 ? v - 0x10000 : v;
}

function readU32Be(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 24) | (buf[off + 1]! << 16) | (buf[off + 2]! << 8) | buf[off + 3]!) >>> 0;
}

function decodeDataUrlBytes(url: string, prefix: string): Uint8Array {
  expect(url.startsWith(prefix)).toBe(true);
  const b64 = url.slice(prefix.length);
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function pngDimensions(dataUrl: string): { width: number; height: number } {
  const bytes = decodeDataUrlBytes(dataUrl, 'data:image/png;base64,');
  expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    width: readU32Be(bytes, 16),
    height: readU32Be(bytes, 20),
  };
}

describe('Phase 6.1 integer device-pixel framing (`computeIntegerFrame`)', () => {
  it('chooses exact whole device-pixel scale on 411x520 @ 2.625x phone', () => {
    const dpr = 2.625;
    const f = computeIntegerFrame(411, 520, dpr);
    expect(f.clamped).toBe(false);
    expect(Number.isInteger(f.deviceScale)).toBe(true);
    expect([5, 6]).toContain(f.deviceScale);
    expect(f.cssWidth).toBeLessThanOrEqual(411);
    expect(f.cssHeight).toBeLessThanOrEqual(520);
    expect(Math.round(f.cssWidth * dpr) % NATIVE_W).toBe(0);
    expect(Math.round(f.cssHeight * dpr) % NATIVE_H).toBe(0);
    expect((f.cssWidth * dpr) / NATIVE_W).toBeCloseTo(f.deviceScale, 10);
    expect((f.cssHeight * dpr) / NATIVE_H).toBeCloseTo(f.deviceScale, 10);
    expect(f.bezelSidePx).toBeGreaterThan(0);
    expect(f.bezelTopPx).toBeGreaterThan(0);
    expect(f.bezelBottomPx).toBeGreaterThan(0);
  });

  it('chooses 4x integer device scale on 375x460 @ 2x phone with zero fractional art pixels', () => {
    const f = computeIntegerFrame(375, 460, 2);
    expect(f.clamped).toBe(false);
    expect(f.deviceScale).toBe(4);
    expect((f.cssWidth * 2) % NATIVE_W).toBe(0);
    expect((f.cssHeight * 2) % NATIVE_H).toBe(0);
    expect(f.cssWidth).toBe(352);
    expect(f.cssHeight).toBe(416);
    expect(f.bezelSidePx).toBe(11.5);
    expect(f.bezelTopPx).toBe(22);
    expect(f.bezelBottomPx).toBe(22);
  });

  it('chooses 6x integer device scale on 390x500 @ 3x phone with positive bezel bands', () => {
    const f = computeIntegerFrame(390, 500, 3);
    expect(f.clamped).toBe(false);
    expect(f.deviceScale).toBe(6);
    expect((f.cssWidth * 3) % NATIVE_W).toBe(0);
    expect((f.cssHeight * 3) % NATIVE_H).toBe(0);
    expect(f.cssWidth).toBe(352);
    expect(f.cssHeight).toBe(416);
    expect(f.bezelSidePx).toBeGreaterThan(0);
    expect(f.bezelTopPx).toBeGreaterThan(0);
    expect(f.bezelBottomPx).toBeGreaterThan(0);
  });

  it.each([
    [1280, 800, 1, 3],
    [1440, 900, 2, 8],
  ])(
    'chooses whole integer deviceScale=%i on desktop %ix%i @ %ix',
    (stageW, stageH, dpr, expectedScale) => {
      const f = computeIntegerFrame(stageW, stageH, dpr);
      expect(f.clamped).toBe(false);
      expect(Number.isInteger(f.deviceScale)).toBe(true);
      expect(f.deviceScale).toBe(expectedScale);
      expect((f.cssWidth * dpr) % NATIVE_W).toBe(0);
      expect((f.cssHeight * dpr) % NATIVE_H).toBe(0);
      expect(f.cssWidth).toBeLessThanOrEqual(stageW);
      expect(f.cssHeight).toBeLessThanOrEqual(stageH);
    },
  );

  it('gracefully clamps tiny sub-native windows while preserving aspect ratio', () => {
    const f = computeIntegerFrame(132, 160, 1);
    expect(f.clamped).toBe(true);
    expect(f.deviceScale).toBe(1);
    expect(f.cssWidth).toBeLessThanOrEqual(132);
    expect(f.cssHeight).toBeLessThanOrEqual(160);
    expect(f.cssWidth / f.cssHeight).toBeCloseTo(NATIVE_W / NATIVE_H, 1);
  });
});

describe('Phase 6.2 in-repo TrueType pixel font (`buildPixelFontTtf`)', () => {
  it('compiles a valid SFNT 0x00010000 TrueType binary with required tables & checksums', () => {
    expect(PIXEL_FONT_FAMILY).toBe('CinderholmPixel');
    const ttf = buildPixelFontTtf();
    expect(ttf.length).toBeGreaterThan(2048);
    expect(readU32Be(ttf, 0)).toBe(0x00010000);

    const numTables = readU16Be(ttf, 4);
    const tables = new Map<string, { checksum: number; offset: number; length: number }>();
    const tagsInOrder: string[] = [];

    for (let i = 0; i < numTables; i++) {
      const recOff = 12 + i * 16;
      const tag = String.fromCharCode(
        ttf[recOff]!,
        ttf[recOff + 1]!,
        ttf[recOff + 2]!,
        ttf[recOff + 3]!,
      );
      tagsInOrder.push(tag);
      tables.set(tag, {
        checksum: readU32Be(ttf, recOff + 4),
        offset: readU32Be(ttf, recOff + 8),
        length: readU32Be(ttf, recOff + 12),
      });
    }

    // Tags must be sorted strictly in ascending ASCII order for OTS validation
    expect(tagsInOrder).toEqual([...tagsInOrder].sort());

    const required = [
      'OS/2',
      'cmap',
      'glyf',
      'head',
      'hhea',
      'hmtx',
      'loca',
      'maxp',
      'name',
      'post',
    ];
    for (const req of required) {
      expect(tables.has(req)).toBe(true);
      const entry = tables.get(req)!;
      expect(entry.offset % 4).toBe(0);
      expect(entry.offset + entry.length).toBeLessThanOrEqual(ttf.length);
    }

    // Whole-file TrueType checksum must sum to 0xB1B0AFBA (uint32)
    let totalSum = 0;
    for (let i = 0; i < ttf.length; i += 4) {
      totalSum = (totalSum + readU32Be(ttf, i)) >>> 0;
    }
    expect(totalSum).toBe(0xb1b0afba);

    // Check head unitsPerEm = 1024 and magicNumber = 0x5F0F3CF5
    const head = tables.get('head')!;
    expect(readU32Be(ttf, head.offset + 12)).toBe(0x5f0f3cf5);
    expect(readU16Be(ttf, head.offset + 18)).toBe(1024);

    // Verify cmap Format 4 maps ASCII letters/digits and all HUD/dialogue glyphs to non-empty contours
    const cmap = tables.get('cmap')!;
    const subOff = cmap.offset + readU32Be(ttf, cmap.offset + 8);
    expect(readU16Be(ttf, subOff)).toBe(4);
    const segCount = readU16Be(ttf, subOff + 6) / 2;
    const endCodesOff = subOff + 14;
    const startCodesOff = endCodesOff + segCount * 2 + 2;
    const idDeltasOff = startCodesOff + segCount * 2;

    const lookupGlyphId = (cp: number): number => {
      for (let s = 0; s < segCount; s++) {
        const end = readU16Be(ttf, endCodesOff + s * 2);
        const start = readU16Be(ttf, startCodesOff + s * 2);
        if (cp >= start && cp <= end) {
          if (start === 0xffff) return 0;
          const delta = readU16Be(ttf, idDeltasOff + s * 2);
          return (cp + delta) & 0xffff;
        }
      }
      return 0;
    };

    const loca = tables.get('loca')!;
    const glyf = tables.get('glyf')!;

    // Space (0x20) maps to valid glyph with empty outline
    const spaceGid = lookupGlyphId(0x20);
    expect(spaceGid).toBeGreaterThan(0);
    expect(readU32Be(ttf, loca.offset + spaceGid * 4)).toBe(
      readU32Be(ttf, loca.offset + (spaceGid + 1) * 4),
    );

    // Printable visible ASCII 0x21..0x7E + special HUD/dialogue symbols must have non-empty contours
    const hudSymbols = ['·', '½', '×', '—', '’', '→', '↺', '▸', '●', '○', '⚠', '★'];
    for (let cp = 0x21; cp <= 0x7e; cp++) {
      expect(GLYPH_BITMAPS[cp]).toBeDefined();
      const gid = lookupGlyphId(cp);
      expect(gid).toBeGreaterThan(0);
      const gStart = readU32Be(ttf, loca.offset + gid * 4);
      const gEnd = readU32Be(ttf, loca.offset + (gid + 1) * 4);
      expect(gEnd).toBeGreaterThan(gStart);
      const contourCount = readI16Be(ttf, glyf.offset + gStart);
      expect(contourCount).toBeGreaterThan(0);
    }

    for (const sym of hudSymbols) {
      const cp = sym.codePointAt(0)!;
      expect(GLYPH_BITMAPS[cp]).toBeDefined();
      const gid = lookupGlyphId(cp);
      expect(gid).toBeGreaterThan(0);
      const gStart = readU32Be(ttf, loca.offset + gid * 4);
      const gEnd = readU32Be(ttf, loca.offset + (gid + 1) * 4);
      expect(gEnd).toBeGreaterThan(gStart);
    }

    // Descender glyphs g, j, p, q, y drop 1px below baseline (yMin === -128)
    for (const desc of ['g', 'j', 'p', 'q', 'y']) {
      const gid = lookupGlyphId(desc.charCodeAt(0));
      const gStart = readU32Be(ttf, loca.offset + gid * 4);
      const yMin = readI16Be(ttf, glyf.offset + gStart + 4);
      expect(yMin).toBe(-128);
    }
  });
});

describe('Phase 6.1 & 6.2 pixel-art bezel, GBC box frames, action caps & joystick', () => {
  it('bakes zone-themed 16x16 @ 2x bezel tiles and 24x24 double-lined GBC frames', () => {
    const owBezel = bezelTileDataUrl('overworld', 2);
    const cryptBezel = bezelTileDataUrl('ice-cave', 2);
    expect(owBezel).not.toBe(cryptBezel);
    expect(pngDimensions(owBezel)).toEqual({ width: 32, height: 32 });
    expect(pngDimensions(cryptBezel)).toEqual({ width: 32, height: 32 });

    const owFrame = gbcFrameDataUrl('overworld');
    const cryptFrame = gbcFrameDataUrl('ice-cave');
    expect(owFrame).not.toBe(cryptFrame);
    expect(pngDimensions(owFrame)).toEqual({ width: 24, height: 24 });
    expect(gbcBoxBorderCss('overworld').borderImageSlice).toBe('8 fill');
  });

  it('bakes 68x68 B/A arcade caps with distinct pressed states and 118x118 / 50x50 joystick art', () => {
    const bUp = actionButtonDataUrl('B', false);
    const bDown = actionButtonDataUrl('B', true);
    const aUp = actionButtonDataUrl('A', false);
    const aDown = actionButtonDataUrl('A', true);
    expect(bUp).not.toBe(bDown);
    expect(aUp).not.toBe(aDown);
    expect(bUp).not.toBe(aUp);
    expect(pngDimensions(bUp)).toEqual({ width: 68, height: 68 });
    expect(pngDimensions(bDown)).toEqual({ width: 68, height: 68 });
    expect(pngDimensions(aUp)).toEqual({ width: 68, height: 68 });
    expect(pngDimensions(aDown)).toEqual({ width: 68, height: 68 });

    expect(pngDimensions(joystickRingDataUrl())).toEqual({ width: 118, height: 118 });
    expect(pngDimensions(joystickKnobDataUrl())).toEqual({ width: 50, height: 50 });
  });
});
