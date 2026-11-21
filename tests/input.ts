import { type Input, LIFT_DELAY, type State, type World, tick } from '../src/game/world';

export const idle: Input = { dx: 0, dy: 0 };

/** Tap B: a quick press and release drops B's bomb. */
export function tapB(world: World, s: State): void {
  tick(world, s, { ...idle, holdB: true }, 0.02);
  tick(world, s, idle, 0.001);
}

/** Hold B past the lift delay, then release: lifts a bomb overhead and throws it. */
export function throwB(world: World, s: State): void {
  tick(world, s, { ...idle, holdB: true }, LIFT_DELAY + 0.005);
  tick(world, s, idle, 0.001);
}
