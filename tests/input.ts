import {
  FIXED_DT,
  type Input,
  ROLL_DURATION,
  type State,
  type World,
  slopeVector,
  tick,
  tileAt,
} from '../src/game/world';

export const idle: Input = { dx: 0, dy: 0 };

/** Advance the simulation by `steps` deterministic `FIXED_DT` (`1/60s`) frames, returning all emitted events. */
export function stepTicks(world: World, s: State, steps: number, input: Input = idle): string[] {
  const seen: string[] = [];
  for (let i = 0; i < steps; i++) {
    tick(world, s, input, FIXED_DT);
    seen.push(...s.events);
  }
  return seen;
}

/** Advance the simulation for `seconds` using deterministic `FIXED_DT` frames, returning all emitted events. */
export function stepSeconds(
  world: World,
  s: State,
  seconds: number,
  input: Input = idle,
): string[] {
  return stepTicks(world, s, Math.ceil(seconds / FIXED_DT), input);
}

/** Press B = Roll (along `(dx, dy)` or current facing when `(0, 0)`) and step through the 0.25s roll. */
export function rollB(world: World, s: State, dx = 0, dy = 0): void {
  const steps = Math.round(ROLL_DURATION / FIXED_DT);
  tick(world, s, { dx, dy, holdB: true }, FIXED_DT);
  for (let i = 1; i < steps; i++) {
    tick(world, s, { dx, dy }, FIXED_DT);
  }
}

/** Press A = Pull: takes out the equipped bomb and holds it over Pip's head. */
export function pullA(world: World, s: State): void {
  tick(world, s, { ...idle, holdA: true }, FIXED_DT);
  tick(world, s, idle, FIXED_DT);
}

/** Press B = Drop (while holding overhead): puts the held bomb on the ground just ahead of Pip. */
export function dropB(world: World, s: State): void {
  tick(world, s, { ...idle, holdB: true }, FIXED_DT);
  tick(world, s, idle, FIXED_DT);
}

/** Pull a bomb overhead (if not already holding one) and drop it ahead of Pip. */
export function tapA(world: World, s: State): void {
  if (s.heldBomb === null) {
    pullA(world, s);
  }
  if (s.heldBomb !== null) {
    dropB(world, s);
  }
}

/**
 * Pull a bomb overhead (if not already holding one) and throw it facing the cardinal
 * direction of `(dx, dy)`, so it arcs over fences and rolls off that way.
 */
export function kickA(world: World, s: State, dx: number, dy: number): void {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const kx = horizontal ? Math.sign(dx) : 0;
  const ky = horizontal ? 0 : Math.sign(dy);
  s.aimX = kx;
  s.aimY = ky;
  s.fx = kx;
  s.fy = ky;
  if (s.heldBomb === null) {
    pullA(world, s);
  }
  if (s.heldBomb !== null) {
    tick(world, s, { ...idle, holdA: true }, FIXED_DT);
    tick(world, s, idle, FIXED_DT);
  }
}

/**
 * Place a bomb as a player standing on a chute would: facing down the chute, so the bomb
 * lands on it ahead of Pip and rolls away. Off a chute, Pip keeps the current aim.
 */
export function placeDownChute(world: World, s: State): void {
  const sv = slopeVector(tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(s.x), Math.floor(s.y)));
  if (sv) {
    s.aimX = sv.dx;
    s.aimY = sv.dy;
  }
  tapA(world, s);
}
