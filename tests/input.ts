import {
  FIXED_DT,
  type Input,
  LIFT_DELAY,
  ROLL_DURATION,
  type State,
  type World,
  tick,
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

/** Tap A = Pull out: a quick press and release drops the equipped bomb at Pip's feet. */
export function tapA(world: World, s: State): void {
  tick(world, s, { ...idle, holdA: true }, FIXED_DT);
  tick(world, s, idle, FIXED_DT);
}

/** Hold A = Pull out past the lift delay, then release: lifts a bomb overhead and throws it. */
export function throwA(world: World, s: State, dx?: number, dy?: number): void {
  if (dx !== undefined && dy !== undefined && Math.hypot(dx, dy) > 0) {
    const len = Math.hypot(dx, dy);
    s.aimX = dx / len;
    s.aimY = dy / len;
    s.fx = s.aimX;
    s.fy = s.aimY;
  }
  const holdSteps = Math.ceil((LIFT_DELAY + 1e-6) / FIXED_DT);
  for (let i = 0; i < holdSteps; i++) {
    tick(world, s, { ...idle, holdA: true }, FIXED_DT);
  }
  tick(world, s, idle, FIXED_DT);
}

/** Legacy aliases for callers not yet migrated to `tapA` / `throwA`. */
export const tapB = tapA;
export const throwB = throwA;
