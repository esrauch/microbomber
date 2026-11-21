/**
 * HD-2D particles (ROADMAP Phase 5): sparks, smoke, debris, embers, dust and droplets,
 * spawned from simulation events and drawn above the lit frame. Pure simulation in native
 * pixels (no DOM or WebGL) so it is testable; `hdView.ts` draws them.
 */
import type { BlastVisual, State } from '../../game/types';

const TILE = 16;

/** Hard cap so a chain of blasts can never flood a phone. */
export const MAX_PARTICLES = 600;

export type ParticleKind = 'spark' | 'smoke' | 'debris' | 'ember' | 'dust' | 'drop';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  /** Diameter in native pixels. */
  size: number;
  /** 0xRRGGBB */
  color: number;
  /** Downward acceleration in native px/s² (negative rises). */
  gravity: number;
  /** Fraction of velocity kept per second. */
  drag: number;
  /** Additive glow (sparks, embers) rather than a solid fleck. */
  glow: boolean;
}

/** Small deterministic PRNG so particle bursts are reproducible in tests. */
export function makeRng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

export class ParticleSystem {
  readonly particles: Particle[] = [];
  private readonly rand: () => number;
  private emberClock = 0;

  constructor(seed = 1) {
    this.rand = makeRng(seed);
  }

  private burst(
    n: number,
    x: number,
    y: number,
    make: (angle: number, speed: number) => Omit<Particle, 'x' | 'y'>,
    minSpeed: number,
    maxSpeed: number,
  ): void {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const angle = this.rand() * Math.PI * 2;
      const speed = minSpeed + this.rand() * (maxSpeed - minSpeed);
      this.particles.push({ x, y, ...make(angle, speed) });
    }
  }

  /** Spawn bursts for this frame's simulation events and blasts. */
  spawnFromFrame(s: State, events: readonly string[], blasts: readonly BlastVisual[]): void {
    const r = this.rand;
    for (const bl of blasts) {
      const x = bl.x * TILE;
      const y = bl.y * TILE;
      const hub = !bl.shape || bl.shape === 'hub' || bl.shape === 'single';
      if (bl.kind === 'powder') {
        this.burst(
          hub ? 14 : 5,
          x,
          y,
          (a, v) => ({
            kind: 'spark',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 20,
            life: 0.25 + r() * 0.25,
            maxLife: 0.5,
            size: 1 + r() * 1.2,
            color: r() < 0.5 ? 0xfff0a0 : 0xffb040,
            gravity: 160,
            drag: 0.05,
            glow: true,
          }),
          60,
          150,
        );
        this.burst(
          hub ? 8 : 3,
          x,
          y,
          (a, v) => ({
            kind: 'smoke',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 10,
            life: 0.6 + r() * 0.5,
            maxLife: 1.1,
            size: 5 + r() * 5,
            color: 0x4a4650,
            gravity: -18,
            drag: 0.15,
            glow: false,
          }),
          8,
          30,
        );
      } else {
        this.burst(
          hub ? 12 : 4,
          x,
          y,
          (a, v) => ({
            kind: 'ember',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 25,
            life: 0.5 + r() * 0.6,
            maxLife: 1.1,
            size: 1 + r(),
            color: r() < 0.5 ? 0xff8030 : 0xffd060,
            gravity: -30,
            drag: 0.2,
            glow: true,
          }),
          30,
          90,
        );
        this.burst(
          hub ? 5 : 2,
          x,
          y,
          (a, v) => ({
            kind: 'smoke',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 14,
            life: 0.7 + r() * 0.5,
            maxLife: 1.2,
            size: 5 + r() * 4,
            color: 0x5a3c30,
            gravity: -22,
            drag: 0.15,
            glow: false,
          }),
          6,
          22,
        );
      }
    }

    const px = s.x * TILE;
    const py = s.y * TILE;
    for (const ev of events) {
      if (ev === 'tile-break' || ev === 'tile-burn') {
        // Chips fly from the nearest blast; good enough for a single-frame burst
        const src = blasts[0];
        const x = src ? src.x * TILE : px;
        const y = src ? src.y * TILE : py;
        this.burst(
          10,
          x,
          y,
          (a, v) => ({
            kind: 'debris',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 60,
            life: 0.5 + r() * 0.4,
            maxLife: 0.9,
            size: 1.5 + r() * 1.5,
            color: ev === 'tile-burn' ? 0x3a2a1a : 0x8a7a68,
            gravity: 260,
            drag: 0.3,
            glow: false,
          }),
          40,
          110,
        );
      } else if (ev === 'bomb-kick' || ev === 'player-roll') {
        this.burst(
          5,
          px,
          py + 6,
          (a, v) => ({
            kind: 'dust',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v * 0.4 - 6,
            life: 0.3 + r() * 0.2,
            maxLife: 0.5,
            size: 2 + r() * 2,
            color: s.zone === 'ember-crypt' ? 0x8a7aa0 : 0xc8b890,
            gravity: -10,
            drag: 0.1,
            glow: false,
          }),
          10,
          30,
        );
      } else if (ev === 'bomb-splash') {
        const b = s.bombs[s.bombs.length - 1];
        const x = b ? b.x * TILE : px;
        const y = b ? b.y * TILE : py;
        this.burst(
          8,
          x,
          y,
          (a, v) => ({
            kind: 'drop',
            vx: Math.cos(a) * v * 0.6,
            vy: -Math.abs(Math.sin(a) * v),
            life: 0.35 + r() * 0.2,
            maxLife: 0.55,
            size: 1.2,
            color: 0xd8f0ff,
            gravity: 300,
            drag: 0.1,
            glow: false,
          }),
          30,
          70,
        );
      }
    }
  }

  /** Rising embers from fire patches and lit braziers, at a steady rate. */
  emitAmbient(s: State, dt: number): void {
    const sources: Array<[number, number]> = [
      ...s.fires.map((f): [number, number] => [(f.x + 0.5) * TILE, (f.y + 0.6) * TILE]),
      ...s.torches
        .filter((t) => t.lit)
        .map((t): [number, number] => [(t.x + 0.5) * TILE, t.y * TILE]),
    ];
    if (sources.length === 0 || this.particles.length >= MAX_PARTICLES) {
      this.emberClock = 0;
      return;
    }
    this.emberClock = Math.min(this.emberClock + dt, 0.36);
    const r = this.rand;
    for (let step = 0; step < 4 && this.emberClock > 0.09; step++) {
      this.emberClock -= 0.09;
      const src = sources[Math.floor(r() * sources.length)];
      if (!src || this.particles.length >= MAX_PARTICLES) break;
      this.particles.push({
        kind: 'ember',
        x: src[0] + (r() - 0.5) * 6,
        y: src[1],
        vx: (r() - 0.5) * 10,
        vy: -18 - r() * 16,
        life: 0.6 + r() * 0.5,
        maxLife: 1.1,
        size: 0.8 + r() * 0.6,
        color: r() < 0.5 ? 0xff9040 : 0xffd070,
        gravity: -6,
        drag: 0.5,
        glow: true,
      });
    }
  }

  update(dt: number): void {
    let w = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const keep = Math.pow(p.drag, dt);
      p.vx *= keep;
      p.vy = p.vy * keep + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.particles[w++] = p;
    }
    this.particles.length = w;
  }

  clear(): void {
    this.particles.length = 0;
  }
}
