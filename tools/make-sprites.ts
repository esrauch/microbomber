/**
 * Contact-sheet preview of microbomber's GBC art (`src/render/gbcArt.ts`): every sprite
 * in its palette, then every background tile in each zone's palettes, magnified.
 * The game bakes the same data at runtime, so this is for eyeballing art changes.
 *
 *   npm run make-sprites [out.png]   (defaults to a file in the system temp dir)
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { ZoneId } from '../src/game/types';
import { BG, OBJ } from '../src/render/gbcArt';
import { BG_PALETTES, OBJ_PALETTES, type Rgb } from '../src/render/gbcPalette';

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i] ?? 0;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter None
    for (let x = 0; x < width * 4; x++) {
      raw[y * stride + 1 + x] = rgba[y * width * 4 + x] ?? 0;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

const SCALE = 5;
const CELL = 26; // room for 24px boss sprites plus a gap
const COLS = 10;
const ZONES: ZoneId[] = ['overworld', 'ember-crypt'];

const objNames = Object.keys(OBJ) as (keyof typeof OBJ)[];
const bgNames = Object.keys(BG) as (keyof typeof BG)[];
const objRows = Math.ceil(objNames.length / COLS);
const bgRows = Math.ceil(bgNames.length / COLS);
const gridRows = objRows + bgRows * ZONES.length;
const W = COLS * CELL * SCALE;
const H = gridRows * CELL * SCALE;
const out = new Uint8Array(W * H * 4);

const put = (x: number, y: number, c: Rgb): void => {
  for (let dy = 0; dy < SCALE; dy++) {
    for (let dx = 0; dx < SCALE; dx++) {
      const i = ((y * SCALE + dy) * W + x * SCALE + dx) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
    }
  }
};

// Checker backdrop so transparent sprite pixels are visible
for (let y = 0; y < H / SCALE; y++) {
  for (let x = 0; x < W / SCALE; x++) {
    const v = ((x >> 2) + (y >> 2)) % 2 ? 200 : 176;
    put(x, y, [v, v + 16, v]);
  }
}

objNames.forEach((name, i) => {
  const sprite = OBJ[name];
  const pal = OBJ_PALETTES[sprite.pal];
  const ox = (i % COLS) * CELL;
  const oy = Math.floor(i / COLS) * CELL;
  sprite.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = ch === '.' ? undefined : pal[Number(ch) - 1];
      if (col) put(ox + x, oy + y, col);
    });
  });
});

ZONES.forEach((zone, zi) => {
  bgNames.forEach((name, i) => {
    const tile = BG[name];
    const ox = (i % COLS) * CELL;
    const oy = (objRows + zi * bgRows + Math.floor(i / COLS)) * CELL;
    tile.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const palId = tile.quads[(y >> 3) * 2 + (x >> 3)] ?? tile.quads[0];
        const col = BG_PALETTES[zone][palId][Number(ch)];
        if (col) put(ox + x, oy + y, col);
      });
    });
  });
});

const outPath = process.argv[2] ?? join(tmpdir(), 'microbomber-gbc-preview.png');
writeFileSync(outPath, encodePng(W, H, out));
console.log(
  `Wrote ${outPath} (${W}x${H}): ${objNames.length} sprites, ${bgNames.length} tiles x ${ZONES.length} zones`,
);
