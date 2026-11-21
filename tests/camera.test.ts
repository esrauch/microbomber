import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROOM_H, ROOM_W } from '../src/game/world';
import { makeCameraRig } from '../src/render/camera';

describe('fixed 2.5D camera rig', () => {
  it.each([
    [390, 620],
    [1280, 800],
    [560, 560],
  ])('frames the entire %ix%i stage above the control band', (w, h) => {
    const rig = makeCameraRig({ width: ROOM_W, depth: ROOM_H });
    rig.resize(w, h);
    for (const [x, z] of [
      [0, 0],
      [ROOM_W, 0],
      [0, ROOM_H],
      [ROOM_W, ROOM_H],
    ] as const) {
      const p = new THREE.Vector3(x, 0, z).project(rig.camera);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
  });
});
