import {
  type Input,
  LIFT_DELAY,
  ROLL_DURATION,
  type State,
  type World,
  tick,
} from '../src/game/world';

export const idle: Input = { dx: 0, dy: 0 };

/** Press B = Roll (along `(dx, dy)` or current facing when `(0, 0)`) and step through the 0.25s roll. */
export function rollB(world: World, s: State, dx = 0, dy = 0): void {
  const dt = 1 / 60;
  const steps = Math.round(ROLL_DURATION / dt);
  tick(world, s, { dx, dy, holdB: true }, dt);
  for (let i = 1; i < steps; i++) {
    tick(world, s, { dx, dy }, dt);
  }
}

/** Tap A = Pull out: a quick press and release drops the equipped bomb at Pip's feet. */
export function tapA(world: World, s: State): void {
  tick(world, s, { ...idle, holdA: true }, 0.02);
  tick(world, s, idle, 0.001);
}

/** Hold A = Pull out past the lift delay, then release: lifts a bomb overhead and throws it. */
export function throwA(world: World, s: State, dx?: number, dy?: number): void {
  if (dx !== undefined && dy !== undefined && Math.hypot(dx, dy) > 0) {
    tick(world, s, { dx, dy, holdA: true }, 0.001);
    tick(world, s, { ...idle, holdA: true }, LIFT_DELAY + 0.005);
  } else {
    tick(world, s, { ...idle, holdA: true }, LIFT_DELAY + 0.005);
  }
  tick(world, s, idle, 0.001);
}

/** Legacy aliases for callers not yet migrated to `tapA` / `throwA`. */
export const tapB = tapA;
export const throwB = throwA;
