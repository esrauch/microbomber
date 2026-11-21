/**
 * Generates two magnified pixel-art inspection PNGs (`ASSETS.md` §4):
 * 1. Contact sheet of all 6-colour OBJ sprites (up to 32x32) and 4-colour BG tiles.
 * 2. Stitched 6-room proof sheet (`Millbrook Square`, `Spire Courtyard`, `Ember Crypt Arch`,
 *    `Crypt Foyer`, `Crystal Crossroads`, `Sanctum of Ash`) rendered via `buildRoomLayout`.
 *
 *   npm run make-sprites [contact.png] [rooms.png]
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { ZoneId } from '../src/game/types';
import { ROOM_H, ROOM_W, campaignWorld, newState } from '../src/game/world';
import { BG, type BgTile, OBJ, type ObjSpriteName } from '../src/render/gbcArt';
import { buildRoomLayout } from '../src/render/gbcAutotile';
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
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
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

function makeScaledCanvas(logicalW: number, logicalH: number, scale: number) {
  const pw = logicalW * scale;
  const ph = logicalH * scale;
  const out = new Uint8Array(pw * ph * 4);
  const put = (x: number, y: number, c: Rgb): void => {
    if (x < 0 || y < 0 || x >= logicalW || y >= logicalH) return;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const i = ((y * scale + dy) * pw + x * scale + dx) * 4;
        out[i] = c[0];
        out[i + 1] = c[1];
        out[i + 2] = c[2];
        out[i + 3] = 255;
      }
    }
  };
  return { pw, ph, out, put };
}

// ============================================================================
// 1. Sprite & Tile Contact Sheet
// ============================================================================
const SCALE = 4;
const CELL = 34; // fits 32x32 Cinderhull boss frames + 2px gutter
const COLS = 10;
const ZONES: ZoneId[] = ['overworld', 'ember-crypt'];

const objNames = Object.keys(OBJ) as ObjSpriteName[];
const bgNames = Object.keys(BG) as (keyof typeof BG)[];
const objRows = Math.ceil(objNames.length / COLS);
const bgRows = Math.ceil(bgNames.length / COLS);
const gridRows = objRows + bgRows * ZONES.length;
const sheet = makeScaledCanvas(COLS * CELL, gridRows * CELL, SCALE);

for (let y = 0; y < gridRows * CELL; y++) {
  for (let x = 0; x < COLS * CELL; x++) {
    const v = ((x >> 2) + (y >> 2)) % 2 ? 196 : 172;
    sheet.put(x, y, [v, v + 12, v]);
  }
}

objNames.forEach((name, i) => {
  const sprite = OBJ[name];
  const pal = OBJ_PALETTES[sprite.pal];
  const ox = (i % COLS) * CELL + 1;
  const oy = Math.floor(i / COLS) * CELL + 1;
  sprite.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const idx = Number(ch);
      const col = idx >= 1 && idx <= 6 ? pal[idx - 1] : undefined;
      if (col) sheet.put(ox + x, oy + y, col);
    });
  });
});

ZONES.forEach((zone, zi) => {
  bgNames.forEach((name, i) => {
    const tile = BG[name];
    const ox = (i % COLS) * CELL + 8;
    const oy = (objRows + zi * bgRows + Math.floor(i / COLS)) * CELL + 8;
    tile.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const palId = tile.quads[(y >> 3) * 2 + (x >> 3)] ?? tile.quads[0];
        const col = BG_PALETTES[zone][palId][Number(ch)];
        if (col) sheet.put(ox + x, oy + y, col);
      });
    });
  });
});

const contactPath = process.argv[2] ?? join(tmpdir(), 'microbomber-gbc-contact.png');
writeFileSync(contactPath, encodePng(sheet.pw, sheet.ph, sheet.out));
console.log(
  `Wrote contact sheet ${contactPath} (${sheet.pw}x${sheet.ph}): ${objNames.length} sprites, ${bgNames.length} tiles`,
);

// ============================================================================
// 2. Stitched 6-Room Multi-Tile Proof Sheet (3 cols x 2 rows of 176x208 rooms)
// ============================================================================
const ROOM_PX_W = ROOM_W * 16;
const ROOM_PX_H = ROOM_H * 16;
const GAP = 6;
const PROOF_COLS = 3;
const PROOF_ROWS = 2;
const proof = makeScaledCanvas(
  PROOF_COLS * ROOM_PX_W + (PROOF_COLS + 1) * GAP,
  PROOF_ROWS * ROOM_PX_H + (PROOF_ROWS + 1) * GAP,
  2,
);

for (let y = 0; y < PROOF_ROWS * ROOM_PX_H + (PROOF_ROWS + 1) * GAP; y++) {
  for (let x = 0; x < PROOF_COLS * ROOM_PX_W + (PROOF_COLS + 1) * GAP; x++) {
    proof.put(x, y, [20, 24, 22]);
  }
}

function drawProofBgTile(
  ox: number,
  oy: number,
  zone: ZoneId,
  tile: BgTile,
  transparentZero: boolean,
  topShadow: boolean,
): void {
  const pals = BG_PALETTES[zone];
  tile.rows.forEach((row, py) => {
    [...row].forEach((ch, px) => {
      const idx = Number(ch);
      if (transparentZero && idx === 0) return;
      const palId = tile.quads[(py >> 3) * 2 + (px >> 3)] ?? tile.quads[0];
      const shadeIdx = topShadow && py < 2 && idx < 3 ? Math.min(3, idx + 1) : idx;
      const col = pals[palId][shadeIdx] ?? pals[palId][0];
      proof.put(ox + px, oy + py, col);
    });
  });
}

function drawProofObj(ox: number, oy: number, name: ObjSpriteName): void {
  const sp = OBJ[name];
  const pal = OBJ_PALETTES[sp.pal];
  sp.rows.forEach((row, py) => {
    [...row].forEach((ch, px) => {
      const idx = Number(ch);
      const col = idx >= 1 && idx <= 6 ? pal[idx - 1] : undefined;
      if (col) proof.put(ox + px, oy + py, col);
    });
  });
}

const world = campaignWorld();
const SAMPLE_ROOMS: Array<{
  zone: ZoneId;
  rx: number;
  ry: number;
  px: number;
  py: number;
  cinder?: boolean;
}> = [
  { zone: 'overworld', rx: 3, ry: 2, px: 5.5, py: 6.5 }, // Millbrook Square
  { zone: 'overworld', rx: 2, ry: 0, px: 5.5, py: 8.5, cinder: true }, // Spire Courtyard
  { zone: 'overworld', rx: 3, ry: 5, px: 5.5, py: 8.0 }, // Ember Crypt Arch
  { zone: 'ember-crypt', rx: 1, ry: 3, px: 5.5, py: 8.5 }, // Crypt Foyer
  { zone: 'ember-crypt', rx: 1, ry: 2, px: 5.5, py: 9.0 }, // Crystal Crossroads
  { zone: 'ember-crypt', rx: 0, ry: 0, px: 5.5, py: 8.5 }, // Sanctum of Ash (Cinderhull!)
];

SAMPLE_ROOMS.forEach((spec, idx) => {
  const col = idx % PROOF_COLS;
  const row = Math.floor(idx / PROOF_COLS);
  const rx0 = GAP + col * (ROOM_PX_W + GAP);
  const ry0 = GAP + row * (ROOM_PX_H + GAP);

  const s = newState(world, spec.zone, spec.rx, spec.ry, spec.px, spec.py);
  if (spec.cinder) {
    s.cores.push('cinder');
    s.spireCinderSlotted = true;
  }
  const plan = buildRoomLayout(world, s);
  for (const g of plan.ground) {
    drawProofBgTile(
      rx0 + g.x * 16,
      ry0 + g.y * 16,
      spec.zone,
      g.tile,
      Boolean(g.transparentZero),
      Boolean(g.topShadow),
    );
  }
  for (const d of plan.decals) {
    drawProofBgTile(
      rx0 + d.x * 16,
      ry0 + d.y * 16,
      spec.zone,
      d.tile,
      Boolean(d.transparentZero),
      Boolean(d.topShadow),
    );
  }
  for (const p of plan.props) {
    drawProofBgTile(
      rx0 + p.x * 16,
      ry0 + p.y * 16,
      spec.zone,
      p.tile,
      Boolean(p.transparentZero),
      Boolean(p.topShadow),
    );
  }
  interface ProofDrawable {
    footY: number;
    draw: () => void;
  }
  const actors: ProofDrawable[] = [];
  for (const o of plan.overhead) {
    actors.push({
      footY: o.y + 0.99,
      draw: () =>
        drawProofBgTile(
          rx0 + o.x * 16,
          ry0 + o.y * 16,
          spec.zone,
          o.tile,
          Boolean(o.transparentZero),
          false,
        ),
    });
  }
  for (const t of s.torches) {
    if (t.lit || spec.cinder) {
      actors.push({
        footY: t.y + 0.55,
        draw: () => drawProofObj(rx0 + t.x * 16, ry0 + t.y * 16 - 5, 'FIRE_1'),
      });
    }
  }
  for (const e of s.enemies) {
    if (e.kind === 'cinderhull') {
      actors.push({
        footY: e.y,
        draw: () =>
          drawProofObj(
            rx0 + Math.round(e.x * 16 - 16),
            ry0 + Math.round(e.y * 16 - 15),
            'CINDERHULL_ARMORED_1',
          ),
      });
    }
  }
  actors.push({
    footY: s.y,
    draw: () =>
      drawProofObj(
        rx0 + Math.round(s.x * 16 - 8),
        ry0 + Math.round(s.y * 16 - 10),
        'MOUSE_SOUTH_IDLE',
      ),
  });
  actors.sort((a, b) => a.footY - b.footY);
  for (const a of actors) a.draw();
  for (const c of plan.ceiling) {
    drawProofBgTile(
      rx0 + c.x * 16,
      ry0 + c.y * 16,
      spec.zone,
      c.tile,
      Boolean(c.transparentZero),
      false,
    );
  }
});

const roomsPath = process.argv[3] ?? join(tmpdir(), 'microbomber-gbc-rooms.png');
writeFileSync(roomsPath, encodePng(proof.pw, proof.ph, proof.out));
console.log(`Wrote 6-room proof sheet ${roomsPath} (${proof.pw}x${proof.ph})`);
