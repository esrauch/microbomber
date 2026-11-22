import { describe, expect, it } from 'vitest';
import { campaignWorld, newState } from '../src/game/world';
import { OBJ } from '../src/render/gbcArt';
import {
  auxKind,
  bakeAux,
  bakeAuxData,
  bakeTileEmissiveAuxData,
  heroHeight,
} from '../src/render/gbcAux';
import { FLASH_SECONDS, MAX_LIGHTS, computeLighting, zoneShadowInk } from '../src/render/hd/lights';
import { MAX_PARTICLES, ParticleSystem } from '../src/render/hd/particles';

const brightness = (c: readonly number[]): number => c.reduce((a, b) => a + b, 0) / c.length;
const chromaSpan = (c: readonly number[]): number => Math.max(...c) - Math.min(...c);

describe('HD-2D lighting model', () => {
  it('lights the overworld brightly, the crypt dimmer, and an unlit dark room barely at all', () => {
    const world = campaignWorld();
    const field = computeLighting(world, newState(world, 'overworld', 3, 2), 0, []);
    const crypt = computeLighting(world, newState(world, 'ice-cave', 1, 3), 0, []);
    const dark = newState(world, 'ice-cave', 0, 0); // Frozen Sanctum, braziers unlit
    const darkLit = computeLighting(world, dark, 0, []);

    expect(brightness(field.ambient)).toBeGreaterThan(brightness(crypt.ambient));
    expect(brightness(crypt.ambient)).toBeGreaterThan(brightness(darkLit.ambient));
    expect(brightness(darkLit.ambient)).toBeLessThan(0.1);
    // Outdoors uses a stronger directional sun than indoor shrine chambers
    expect(brightness(field.sunColor)).toBeGreaterThan(brightness(crypt.sunColor) * 3);
    // Pip's lantern keeps a clean moon-ivory pool of light around Pip in a dark room (not muddy brown)
    const lantern = darkLit.lights.find((l) => l.x === dark.x * 16);
    expect(lantern?.radius).toBeGreaterThan(30);
    expect(lantern?.color[2]).toBeGreaterThanOrEqual(0.85);
    expect(chromaSpan(lantern?.color ?? [0, 0, 0])).toBeLessThan(0.1);
  });

  it('uses chromatic non-grey zone shadow inks for overworld and ice-cave', () => {
    const owInk = zoneShadowInk('overworld');
    const cryptInk = zoneShadowInk('ice-cave');
    expect(chromaSpan(owInk)).toBeGreaterThan(0.05);
    expect(chromaSpan(cryptInk)).toBeGreaterThan(0.05);
    expect(owInk).not.toEqual(cryptInk);

    const world = campaignWorld();
    const field = computeLighting(world, newState(world, 'overworld', 3, 2), 0, []);
    const crypt = computeLighting(world, newState(world, 'ice-cave', 1, 3), 0, []);
    expect(field.shadowInk).toEqual(owInk);
    expect(crypt.shadowInk).toEqual(cryptInk);
  });

  it('adds a flickering light for each lit brazier, dips ambient on blast flash, and fades flashes out', () => {
    const world = campaignWorld();
    const s = newState(world, 'ice-cave', 1, 3); // Entry Hall: two braziers start lit
    const lit = s.torches.filter((t) => t.lit).length;
    expect(lit).toBeGreaterThan(0);
    const baseLighting = computeLighting(world, s, 0, []);
    expect(baseLighting.lights).toHaveLength(lit);

    const flash = { x: 5.5, y: 6.5, kind: 'bomb' as const, born: 1 };
    const flashLighting = computeLighting(world, s, 1.0, [flash]);
    // Active bomb explosion flash dips base ambient so radial blast shadows pop across the room
    expect(brightness(flashLighting.ambient)).toBeLessThan(brightness(baseLighting.ambient));
    const at = (t: number): number =>
      computeLighting(world, s, t, [flash]).lights.reduce((a, l) => a + l.intensity, 0);
    expect(at(1.0)).toBeGreaterThan(at(1.0 + FLASH_SECONDS * 0.5));
    expect(computeLighting(world, s, 1 + FLASH_SECONDS + 0.01, [flash]).lights).toHaveLength(lit);
  });

  it('keeps at most MAX_LIGHTS lights, preferring those nearest Pip', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 1.5, 1.5);
    s.fires = Array.from({ length: 40 }, (_, i) => ({
      x: i % 11,
      y: Math.floor(i / 11),
      remaining: 2,
      tickCooldown: 0,
      generation: 0,
    }));
    const { lights } = computeLighting(world, s, 0, []);
    expect(lights).toHaveLength(MAX_LIGHTS);
    const farthest = Math.max(...lights.map((l) => Math.hypot(l.x - 24, l.y - 24)));
    expect(farthest).toBeLessThan(Math.hypot(10.5 * 16 - 24, 3.5 * 16 - 24));
  });
});

describe('HD-2D particles', () => {
  it('bursts sparks and smoke from a Bomb blast, then lets them burn out', () => {
    const world = campaignWorld();
    const s = newState(world);
    const ps = new ParticleSystem(42);
    ps.spawnFromFrame(s, ['boom-bomb'], [{ x: 5.5, y: 6.5, kind: 'bomb', shape: 'hub' }]);
    const kinds = new Set(ps.particles.map((p) => p.kind));
    expect(kinds.has('spark')).toBe(true);
    expect(kinds.has('smoke')).toBe(true);
    for (let i = 0; i < 120; i++) ps.update(1 / 60);
    expect(ps.particles).toHaveLength(0);
  });

  it('is deterministic for a seed and never exceeds MAX_PARTICLES', () => {
    const world = campaignWorld();
    const s = newState(world);
    const run = (): number[] => {
      const ps = new ParticleSystem(7);
      ps.spawnFromFrame(s, ['bomb-kick'], [{ x: 3.5, y: 3.5, kind: 'fire', shape: 'hub' }]);
      ps.update(0.1);
      return ps.particles.map((p) => Math.round(p.x * 100));
    };
    expect(run()).toEqual(run());

    const flood = new ParticleSystem(3);
    const blasts = Array.from({ length: 200 }, () => ({
      x: 5,
      y: 5,
      kind: 'bomb' as const,
      shape: 'hub' as const,
    }));
    flood.spawnFromFrame(s, [], blasts);
    expect(flood.particles.length).toBeLessThanOrEqual(MAX_PARTICLES);
  });
});

describe('HD-2D sprite G-buffer', () => {
  it('classifies heroes, emissives and plain sprites across 4-frame and windup/cast sets', () => {
    expect(auxKind('MOUSE_SOUTH_IDLE')).toBe('hero');
    expect(auxKind('CINDERHULL_ARMORED_1')).toBe('hero');
    expect(auxKind('CINDERHULL_ARMORED_WINDUP')).toBe('hero');
    expect(auxKind('CINDERHULL_EXPOSED_4')).toBe('hero');
    expect(auxKind('WICKGEIST_DARK')).toBe('hero');
    expect(auxKind('WICKGEIST_DARK_CAST')).toBe('hero');
    expect(auxKind('WICKGEIST_LIT_4')).toBe('hero');
    expect(auxKind('BLAST_HUB_1')).toBe('emissive');
    expect(auxKind('FIRE_2')).toBe('emissive');
    expect(auxKind('PROJ_4')).toBe('emissive');
    expect(auxKind('SLIME_4')).toBe('plain');
    expect(auxKind('BAT_3')).toBe('plain');
    expect(auxKind('SHIELDER_4')).toBe('plain');
    expect(auxKind('BOMB_1')).toBe('plain');
  });

  it('gives the fuse mouse ears more height than the fur and the ink outline the least', () => {
    const at = (idx: number): number => heroHeight('MOUSE_SOUTH_IDLE', idx, 8, 6, 16, 16);
    expect(at(2)).toBeGreaterThan(at(3)); // pink ears above fawn fur
    expect(at(3)).toBeGreaterThan(at(6)); // fur above ink
    // The dome rounds the figure: the same colour sits higher at the centre than the edge
    expect(heroHeight('MOUSE_SOUTH_IDLE', 3, 8, 8, 16, 16)).toBeGreaterThan(
      heroHeight('MOUSE_SOUTH_IDLE', 3, 0, 8, 16, 16),
    );
    for (let idx = 1; idx <= 6; idx++) {
      const h = heroHeight('MOUSE_SOUTH_IDLE', idx, 0, 0, 16, 16);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it('bakes emissive G only on flames, blasts, bomb fuse sparks, and active warp/seal runes', () => {
    const maxEmissive = (data: Uint8ClampedArray): number => {
      let maxG = 0;
      for (let i = 1; i < data.length; i += 4) maxG = Math.max(maxG, data[i] ?? 0);
      return maxG;
    };

    // Full emissive sprites glow at 255 on bright shades and keep 0 on ink outlines
    const fire = bakeAuxData('FIRE_1');
    const blast = bakeAuxData('BLAST_1');
    expect(maxEmissive(fire.data)).toBe(255);
    expect(maxEmissive(blast.data)).toBe(255);
    expect(bakeAux('FIRE_1').width).toBe(fire.width);

    // Bomb & Fire Bomb sprites glow (G = 220) ONLY on spark/core indices 1 & 2, never on cast-iron body
    const bomb = bakeAuxData('BOMB_1');
    const fireBomb = bakeAuxData('FIREBOMB_1');
    expect(maxEmissive(bomb.data)).toBe(220);
    expect(maxEmissive(fireBomb.data)).toBe(220);
    const bombRows = OBJ.BOMB_1.rows;
    for (let y = 0; y < bomb.height; y++) {
      for (let x = 0; x < bomb.width; x++) {
        const ch = bombRows[y]?.[x] ?? '.';
        const g = bomb.data[(y * bomb.width + x) * 4 + 1] ?? 0;
        if (ch === '1' || ch === '2') {
          expect(g).toBe(220);
        } else {
          expect(g).toBe(0);
        }
      }
    }

    // Plain actors and the mouse have zero emissive bloom
    expect(maxEmissive(bakeAuxData('SLIME_1').data)).toBe(0);
    expect(maxEmissive(bakeAuxData('MOUSE_SOUTH_IDLE').data)).toBe(0);

    // Active warp pads and lit Tower seal sockets bake emissive rune masks
    expect(maxEmissive(bakeTileEmissiveAuxData('warp').data)).toBe(230);
    expect(maxEmissive(bakeTileEmissiveAuxData('sealLit').data)).toBe(230);
  });
});
