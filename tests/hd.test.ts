import { describe, expect, it } from 'vitest';
import { campaignWorld, newState } from '../src/game/world';
import { auxKind, heroHeight } from '../src/render/gbcAux';
import { FLASH_SECONDS, MAX_LIGHTS, computeLighting } from '../src/render/hd/lights';
import { MAX_PARTICLES, ParticleSystem } from '../src/render/hd/particles';

const brightness = (c: readonly number[]): number => c.reduce((a, b) => a + b, 0) / c.length;

describe('HD-2D lighting model', () => {
  it('lights the overworld brightly, the crypt dimmer, and an unlit dark room barely at all', () => {
    const world = campaignWorld();
    const field = computeLighting(world, newState(world, 'overworld', 3, 2), 0, []);
    const crypt = computeLighting(world, newState(world, 'ember-crypt', 1, 3), 0, []);
    const dark = newState(world, 'ember-crypt', 1, 1); // Lantern Hall, braziers unlit
    const darkLit = computeLighting(world, dark, 0, []);

    expect(brightness(field.ambient)).toBeGreaterThan(brightness(crypt.ambient));
    expect(brightness(crypt.ambient)).toBeGreaterThan(brightness(darkLit.ambient));
    expect(brightness(darkLit.ambient)).toBeLessThan(0.1);
    // Pip's lantern keeps a pool of light around Pip in a dark room
    const lantern = darkLit.lights.find((l) => l.x === dark.x * 16);
    expect(lantern?.radius).toBeGreaterThan(30);
  });

  it('adds a flickering light for each lit brazier and fades blast flashes out', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 1, 3); // Crypt Foyer: two braziers start lit
    const lit = s.torches.filter((t) => t.lit).length;
    expect(lit).toBeGreaterThan(0);
    expect(computeLighting(world, s, 0, []).lights).toHaveLength(lit);

    const flash = { x: 5.5, y: 6.5, kind: 'powder' as const, born: 1 };
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
  it('bursts sparks and smoke from a Blackpowder blast, then lets them burn out', () => {
    const world = campaignWorld();
    const s = newState(world);
    const ps = new ParticleSystem(42);
    ps.spawnFromFrame(s, ['boom-powder'], [{ x: 5.5, y: 6.5, kind: 'powder', shape: 'hub' }]);
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
      ps.spawnFromFrame(s, ['bomb-kick'], [{ x: 3.5, y: 3.5, kind: 'ember', shape: 'hub' }]);
      ps.update(0.1);
      return ps.particles.map((p) => Math.round(p.x * 100));
    };
    expect(run()).toEqual(run());

    const flood = new ParticleSystem(3);
    const blasts = Array.from({ length: 200 }, () => ({
      x: 5,
      y: 5,
      kind: 'powder' as const,
      shape: 'hub' as const,
    }));
    flood.spawnFromFrame(s, [], blasts);
    expect(flood.particles.length).toBeLessThanOrEqual(MAX_PARTICLES);
  });
});

describe('HD-2D sprite G-buffer', () => {
  it('classifies heroes, emissives and plain sprites', () => {
    expect(auxKind('PIP_SOUTH_IDLE')).toBe('hero');
    expect(auxKind('CINDERHULL_ARMORED_1')).toBe('hero');
    expect(auxKind('WICKGEIST_DARK')).toBe('hero');
    expect(auxKind('BLAST_HUB_1')).toBe('emissive');
    expect(auxKind('FIRE_2')).toBe('emissive');
    expect(auxKind('SLIME_1')).toBe('plain');
  });

  it('gives Pip’s hood more height than the tunic and the ink outline the least', () => {
    const at = (idx: number): number => heroHeight('PIP_SOUTH_IDLE', idx, 8, 6, 16, 16);
    expect(at(2)).toBeGreaterThan(at(3)); // amber hood above cobalt tunic
    expect(at(3)).toBeGreaterThan(at(6)); // tunic above ink
    // The dome rounds the figure: the same colour sits higher at the centre than the edge
    expect(heroHeight('PIP_SOUTH_IDLE', 3, 8, 8, 16, 16)).toBeGreaterThan(
      heroHeight('PIP_SOUTH_IDLE', 3, 0, 8, 16, 16),
    );
    for (let idx = 1; idx <= 6; idx++) {
      const h = heroHeight('PIP_SOUTH_IDLE', idx, 0, 0, 16, 16);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });
});
