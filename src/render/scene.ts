/**
 * One room in three.js: a block per tile (floor low, walls tall, cracked walls
 * tinted so a sharp eye spots them), plus the player, bombs and blasts. The
 * room's tiles are rebuilt when the player cuts to another room or a wall
 * breaks; the player, bombs and blasts move every frame.
 */
import * as THREE from 'three';
import { ROOM_H, ROOM_W, type State, type Tile, type World, tileAt } from '../game/world';

const LOOK: Record<Tile, { colour: number; height: number }> = {
  '.': { colour: 0x9cc07a, height: 0.1 },
  '#': { colour: 0x6b7f5a, height: 1 },
  '%': { colour: 0x7f8a64, height: 1 },
  '~': { colour: 0x4c8fc4, height: 0.04 },
};

export interface RoomView {
  scene: THREE.Scene;
  /** Rebuild the tiles for the player's current room. */
  rebuild(world: World, s: State): void;
  /** Move the player, bombs and blasts to match the state. */
  sync(s: State, time: number): void;
}

export function makeRoomView(): RoomView {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d2416);
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x403420, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const tiles = new THREE.Group();
  scene.add(tiles);

  const player = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.32, 0.7, 16),
    new THREE.MeshLambertMaterial({ color: 0xe8c547 }),
  );
  scene.add(player);

  const bombGeometry = new THREE.SphereGeometry(0.28, 16, 12);
  const bombMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const bombs = new THREE.Group();
  scene.add(bombs);
  const blastMaterial = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true });
  const blasts = new THREE.Group();
  scene.add(blasts);

  return {
    scene,
    rebuild(world, s) {
      tiles.clear();
      const cracked = new THREE.Color(0x9a8a60);
      for (let y = 0; y < ROOM_H; y++)
        for (let x = 0; x < ROOM_W; x++) {
          const t = tileAt(world, s, s.rx, s.ry, x, y);
          const { colour, height } = LOOK[t];
          const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: colour }));
          m.scale.set(1, height, 1);
          m.position.set(x + 0.5, height / 2, y + 0.5);
          // A cracked wall shows a seam of lighter stone.
          if (t === '%') (m.material as THREE.MeshLambertMaterial).color.lerp(cracked, 0.5);
          tiles.add(m);
        }
    },
    sync(s, time) {
      player.position.set(s.x, 0.1 + 0.35, s.y);
      bombs.clear();
      for (const b of s.bombs) {
        const m = new THREE.Mesh(bombGeometry, bombMaterial);
        // Bombs swell faster as the fuse runs down.
        const pulse = 1 + 0.08 * Math.sin(time * (6 + 10 / Math.max(0.2, b.fuse)));
        m.scale.setScalar(pulse);
        m.position.set(b.x + 0.5, 0.1 + 0.28, b.y + 0.5);
        bombs.add(m);
      }
      for (const b of s.blasts) {
        const m = new THREE.Mesh(box, blastMaterial.clone());
        m.scale.set(0.95, 0.5, 0.95);
        m.position.set(b.x, 0.3, b.y);
        m.userData.born = time;
        blasts.add(m);
      }
      // Blasts flash and fade over a quarter of a second.
      for (const m of [...blasts.children] as THREE.Mesh[]) {
        const age = time - (m.userData.born as number);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 0.25);
        if (age > 0.25) blasts.remove(m);
      }
    },
  };
}
