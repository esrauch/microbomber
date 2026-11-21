/**
 * The camera: fixed for a whole level. Every level is one screen, so it frames
 * the entire map (at a steep tilt, so things show their sides) and never pans
 * or zooms. On resize it re-frames to fit the new screen. One room is one screen.
 */
import * as THREE from 'three';

/** How far the camera tilts from straight down (radians): steep, but showing the sides of things. */
const TILT = THREE.MathUtils.degToRad(30);
/** Empty margin around the map, as a fraction of the screen. */
const MARGIN = 0.04;

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  /** Re-frame the whole map for a screen of this size. */
  resize(width: number, height: number): void;
}

export function makeCameraRig(bounds: { width: number; depth: number }): CameraRig {
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
  const centre = new THREE.Vector3(bounds.width / 2, 0, bounds.depth / 2);
  const corners = [0, bounds.width].flatMap((x) =>
    [0, bounds.depth].flatMap((z) => [0, 1.5].map((y) => new THREE.Vector3(x, y, z))),
  );

  /** Place the camera `distance` back from the centre, along the tilted view. */
  const place = (distance: number): void => {
    camera.position.set(centre.x, distance * Math.cos(TILT), centre.z + distance * Math.sin(TILT));
    camera.lookAt(centre);
    camera.updateMatrixWorld();
  };
  /** Whether every corner of the map (and things standing on it) is on screen. */
  const fits = (): boolean =>
    corners.every((c) => {
      const p = c.clone().project(camera);
      return Math.abs(p.x) <= 1 - MARGIN && Math.abs(p.y) <= 1 - MARGIN && p.z < 1;
    });

  return {
    camera,
    resize(width, height) {
      camera.aspect = width / (height || 1);
      camera.updateProjectionMatrix();
      // The nearest distance that fits the whole map (a bounded search).
      let lo = 1;
      let hi = 400;
      for (let step = 0; step < 40; step++) {
        const mid = (lo + hi) / 2;
        place(mid);
        if (fits()) hi = mid;
        else lo = mid;
      }
      place(hi);
    },
  };
}
