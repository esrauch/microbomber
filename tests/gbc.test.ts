import { describe, expect, it } from 'vitest';
import { NATIVE_H, NATIVE_W, computeGbcCanvasSize } from '../src/render/gbc';

describe('2D GBC viewport framing', () => {
  it.each([
    [390, 620],
    [1280, 800],
    [560, 560],
  ])('fits the 9x11 room cleanly inside a %ix%i stage with 9:11 aspect', (w, h) => {
    const size = computeGbcCanvasSize(w, h);
    expect(size.width).toBeLessThanOrEqual(w);
    expect(size.height).toBeLessThanOrEqual(h);
    expect(size.width).toBeGreaterThanOrEqual(NATIVE_W);
    expect(size.height).toBeGreaterThanOrEqual(NATIVE_H);
    expect(size.width / size.height).toBeCloseTo(NATIVE_W / NATIVE_H, 2);
  });
});
