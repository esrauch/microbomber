/**
 * HD-2D particles (ROADMAP Phase 5): sparks, smoke, debris, embers, dust and droplets,
 * spawned from simulation events and drawn above the lit frame. Pure simulation in native
 * pixels (no DOM or WebGL) so it is testable; `hdView.ts` draws them.
 */
import { BIG_ROOM_W, type BlastVisual, type State } from '../../game/types';

// Frame pixels per tile for the current room: 16, or 32 in Grandma's rooms drawn at 2x
let TILE = 16;
const tileFor = (s: State): number => (16 * BIG_ROOM_W) / s.roomW;

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
    TILE = tileFor(s);
    const r = this.rand;
    for (const bl of blasts) {
      const x = bl.x * TILE;
      const y = bl.y * TILE;
      const hub = !bl.shape || bl.shape === 'hub' || bl.shape === 'single';
      if (bl.kind === 'bomb') {
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
      } else if (bl.kind === 'ice' || bl.kind === 'wind') {
        this.burst(
          hub ? 12 : 4,
          x,
          y,
          (a, v) => ({
            kind: 'spark',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 15,
            life: 0.3 + r() * 0.3,
            maxLife: 0.6,
            size: 1 + r() * 1.2,
            color: r() < 0.5 ? 0x80f4ff : 0xe8ffff,
            gravity: bl.kind === 'wind' ? -25 : 90,
            drag: 0.15,
            glow: true,
          }),
          45,
          120,
        );
      } else if (bl.kind === 'magnet' || bl.kind === 'squeak' || bl.kind === 'rock') {
        const c1 = bl.kind === 'magnet' ? 0xff5870 : bl.kind === 'squeak' ? 0xffe070 : 0xa8c890;
        const c2 = bl.kind === 'magnet' ? 0xffd860 : bl.kind === 'squeak' ? 0xfff8e0 : 0x8a7a68;
        this.burst(
          hub ? 10 : 4,
          x,
          y,
          (a, v) => ({
            kind: bl.kind === 'rock' ? 'debris' : 'spark',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 25,
            life: 0.3 + r() * 0.3,
            maxLife: 0.6,
            size: 1.1 + r(),
            color: r() < 0.5 ? c1 : c2,
            gravity: bl.kind === 'rock' ? 220 : 80,
            drag: 0.15,
            glow: bl.kind !== 'rock',
          }),
          35,
          95,
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
            // Ice Cave obstacles melt into pale droplets; brambles burn to soot
            color: ev === 'tile-burn' ? (s.zone === 'ice-cave' ? 0xa8d8f8 : 0x3a2a1a) : 0x8a7a68,
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
            color: s.zone === 'ice-cave' ? 0xb8d0e0 : 0xc8b890,
            gravity: -10,
            drag: 0.1,
            glow: false,
          }),
          10,
          30,
        );
      } else if (ev === 'ice-storm') {
        const wraith = s.enemies.find((e) => e.kind === 'wickgeist');
        const wx = wraith ? wraith.x * TILE : px;
        const wy = wraith ? wraith.y * TILE : py;
        this.burst(
          32,
          wx,
          wy,
          (a, v) => ({
            kind: 'spark',
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.4 + r() * 0.35,
            maxLife: 0.75,
            size: 1.4 + r() * 1.2,
            color: r() < 0.5 ? 0x80f4ff : 0xffffff,
            gravity: 0,
            drag: 0.25,
            glow: true,
          }),
          55,
          145,
        );
      } else if (ev === 'portal-warp') {
        this.burst(
          18,
          px,
          py,
          (a, v) => ({
            kind: 'spark',
            vx: Math.cos(a) * v * 0.65,
            vy: Math.sin(a) * v * 0.45 - 38,
            life: 0.35 + r() * 0.3,
            maxLife: 0.65,
            size: 1.2 + r() * 1.1,
            color: r() < 0.5 ? 0x60f0ff : 0xe8ffff,
            gravity: -55,
            drag: 0.25,
            glow: true,
          }),
          24,
          75,
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
    TILE = tileFor(s);
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

  update(dt: number, isWallAt?: (px: number, py: number) => boolean): void {
    let w = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const keep = Math.pow(p.drag, dt);
      p.vx *= keep;
      p.vy = p.vy * keep + p.gravity * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (p.kind === 'spark' && isWallAt) {
        if (isWallAt(nx, p.y)) {
          p.vx = -p.vx * 0.62;
        } else {
          p.x = nx;
        }
        if (isWallAt(p.x, ny)) {
          p.vy = -p.vy * 0.62;
        } else {
          p.y = ny;
        }
      } else {
        p.x = nx;
        p.y = ny;
      }
      this.particles[w++] = p;
    }
    this.particles.length = w;
  }

  clear(): void {
    this.particles.length = 0;
  }
}
