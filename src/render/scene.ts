/**
 * 2.5D Three.js room, prop, character, bomb, and boss renderer (`GAME.md`).
 * Rebuilds static room geometry on room cuts or tile mutations, and updates
 * dynamic entities (player, ghost reticle, bombs, fire, enemies, lighting) every frame.
 */
import * as THREE from 'three';
import {
  ROOM_H,
  ROOM_W,
  type State,
  type Tile,
  type World,
  computeGhostTargets,
  currentRoom,
  isRoomLit,
  roomKey,
  tileAt,
} from '../game/world';

export interface RoomView {
  scene: THREE.Scene;
  /** Rebuild static room tiles & fixed props for the current room. */
  rebuild(world: World, s: State): void;
  /** Sync dynamic entities, lighting, and VFX each animation frame. */
  sync(world: World, s: State, time: number): void;
}

export function makeRoomView(): RoomView {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x182018);

  const hemi = new THREE.HemisphereLight(0xf4f8ff, 0x3b2f20, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d4, 1.35);
  sun.position.set(-6, 15, 9);
  scene.add(sun);

  const lanternLight = new THREE.PointLight(0xff9f43, 0, 7.5, 1.4);
  scene.add(lanternLight);

  // Shared geometries
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.62, 14);
  const headGeo = new THREE.SphereGeometry(0.24, 14, 10);
  const sphereGeo = new THREE.SphereGeometry(0.28, 14, 12);
  const crystalGeo = new THREE.OctahedronGeometry(0.28, 0);
  const coneGeo = new THREE.ConeGeometry(0.22, 0.48, 10);
  const ringGeo = new THREE.RingGeometry(0.3, 0.42, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const dropRingGeo = new THREE.RingGeometry(0.36, 0.43, 4);
  dropRingGeo.rotateX(-Math.PI / 2);
  dropRingGeo.rotateY(Math.PI / 4);

  // Geometry and material caches: rebuild() and sync() run often (every room cut and every
  // frame), so meshes share GPU resources by key instead of allocating fresh ones each time.
  const geoCache = new Map<string, THREE.BufferGeometry>();
  const geo = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
    let g = geoCache.get(key);
    if (!g) {
      g = make();
      geoCache.set(key, g);
    }
    return g;
  };
  const matCache = new Map<string, THREE.Material>();
  const lambert = (params: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial => {
    const key = `L${JSON.stringify(params)}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial(params);
      matCache.set(key, m);
    }
    return m as THREE.MeshLambertMaterial;
  };
  const basic = (params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial => {
    const key = `B${JSON.stringify(params)}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial(params);
      matCache.set(key, m);
    }
    return m as THREE.MeshBasicMaterial;
  };
  const crypBg = new THREE.Color(0x14111c);
  const overworldBg = new THREE.Color(0x192418);

  const tilesGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  const blastsGroup = new THREE.Group();
  scene.add(tilesGroup, dynamicGroup, blastsGroup);

  // Player mesh group (Pip: cobalt tunic, hood, brass goggles)
  const playerGroup = new THREE.Group();
  const playerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.3, 0.52, 14),
    new THREE.MeshLambertMaterial({ color: 0x3b82f6 }),
  );
  playerBody.position.y = 0.26;
  const playerHead = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xf6dcb8 }));
  playerHead.position.y = 0.62;
  const playerHood = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.32, 12),
    new THREE.MeshLambertMaterial({ color: 0xd97706 }),
  );
  playerHood.position.set(0, 0.82, -0.03);
  const goggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.1, 0.14),
    new THREE.MeshLambertMaterial({ color: 0xfbbf24 }),
  );
  goggles.position.set(0, 0.65, 0.18);
  playerGroup.add(playerBody, playerHead, playerHood, goggles);
  scene.add(playerGroup);

  // Ghost landing reticles (`GAME.md` §2)
  const dropReticleMat = new THREE.MeshBasicMaterial({
    color: 0xfefcbf,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const dropReticle = new THREE.Mesh(dropRingGeo, dropReticleMat);
  const throwReticleMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const throwReticle = new THREE.Mesh(ringGeo, throwReticleMat);
  scene.add(dropReticle, throwReticle);

  // Reusable materials for dynamic entities
  const powderBombMat = new THREE.MeshLambertMaterial({ color: 0x262936 });
  const emberBombMat = new THREE.MeshLambertMaterial({
    color: 0xea580c,
    emissive: 0x7c2d12,
  });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  const pushBlockMat = new THREE.MeshLambertMaterial({ color: 0x8d8678 });
  const slimeMat = new THREE.MeshLambertMaterial({ color: 0x48bb78 });
  const batMat = new THREE.MeshLambertMaterial({ color: 0x6b46c1 });
  const shielderMat = new THREE.MeshLambertMaterial({ color: 0xc05621 });
  const woodShieldMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const projMat = new THREE.MeshBasicMaterial({ color: 0xf6ad55 });
  const powderBlastMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
  });
  const emberBlastMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
  });

  return {
    scene,

    rebuild(world: World, s: State): void {
      tilesGroup.clear();
      const isCrypt = s.zone === 'ember-crypt';
      scene.background = isCrypt ? crypBg : overworldBg;

      const floorColor = isCrypt ? 0x52475c : 0x8eb86d;
      const floorAltColor = isCrypt ? 0x4a4054 : 0x85b065;
      const wallColor = isCrypt ? 0x352c42 : 0x5d7052;
      const crackedColor = isCrypt ? 0x7c6755 : 0x9c8658;

      const room = currentRoom(world, s);
      const solved = s.roomSolved || s.solvedRooms.has(roomKey(s.zone, s.rx, s.ry));

      for (let y = 0; y < ROOM_H; y++) {
        for (let x = 0; x < ROOM_W; x++) {
          const t: Tile = tileAt(world, s, s.zone, s.rx, s.ry, x, y);
          const wx = x + 0.5;
          const wz = y + 0.5;
          const checker = (x + y) % 2 === 0;

          // Base floor slab under non-pit/non-water tiles
          if (t !== '^' && t !== '~') {
            const slab = new THREE.Mesh(
              unitBox,
              lambert({ color: checker ? floorColor : floorAltColor }),
            );
            slab.scale.set(0.99, 0.1, 0.99);
            slab.position.set(wx, 0.05, wz);
            tilesGroup.add(slab);
          }

          if (t === '#') {
            const wall = new THREE.Mesh(unitBox, lambert({ color: wallColor }));
            wall.scale.set(0.99, 0.95, 0.99);
            wall.position.set(wx, 0.525, wz);
            tilesGroup.add(wall);
          } else if (t === '%') {
            // Signposted cracked wall (`GAME.md` §7): distinct sandstone hue + dark crack seams
            const cWall = new THREE.Mesh(unitBox, lambert({ color: crackedColor }));
            cWall.scale.set(0.98, 0.94, 0.98);
            cWall.position.set(wx, 0.52, wz);
            tilesGroup.add(cWall);

            const seamMat = basic({ color: 0x261c14 });
            const seam1 = new THREE.Mesh(
              geo('BoxGeometry(0.7, 0.08, 1.01)', () => new THREE.BoxGeometry(0.7, 0.08, 1.01)),
              seamMat,
            );
            seam1.rotation.z = 0.35;
            seam1.position.set(wx, 0.56, wz);
            const seam2 = new THREE.Mesh(
              geo('BoxGeometry(1.01, 0.08, 0.7)', () => new THREE.BoxGeometry(1.01, 0.08, 0.7)),
              seamMat,
            );
            seam2.rotation.x = -0.3;
            seam2.position.set(wx, 0.48, wz);
            const topCrack = new THREE.Mesh(
              geo('BoxGeometry(0.72, 0.04, 0.1)', () => new THREE.BoxGeometry(0.72, 0.04, 0.1)),
              seamMat,
            );
            topCrack.rotation.y = 0.6;
            topCrack.position.set(wx, 1.0, wz);
            tilesGroup.add(seam1, seam2, topCrack);
          } else if (t === '~') {
            const water = new THREE.Mesh(unitBox, lambert({ color: 0x3b82c4 }));
            water.scale.set(1, 0.05, 1);
            water.position.set(wx, 0.02, wz);
            tilesGroup.add(water);
          } else if (t === '^') {
            const pitRim = new THREE.Mesh(unitBox, basic({ color: 0x0b0910 }));
            pitRim.scale.set(1, 0.02, 1);
            pitRim.position.set(wx, 0.0, wz);
            tilesGroup.add(pitRim);
          } else if (t === '=') {
            const postMat = lambert({ color: 0x8b5a2b });
            for (const ox of [-0.34, 0.34]) {
              const post = new THREE.Mesh(
                geo('BoxGeometry(0.16, 0.42, 0.16)', () => new THREE.BoxGeometry(0.16, 0.42, 0.16)),
                postMat,
              );
              post.position.set(wx + ox, 0.31, wz);
              tilesGroup.add(post);
            }
            const rail = new THREE.Mesh(
              geo('BoxGeometry(0.98, 0.12, 0.18)', () => new THREE.BoxGeometry(0.98, 0.12, 0.18)),
              postMat,
            );
            rail.position.set(wx, 0.38, wz);
            tilesGroup.add(rail);
          } else if (t === 'B') {
            const briarMat = lambert({ color: 0x4a5d23 });
            const thornMat = lambert({ color: 0x7c4a1e });
            const bush = new THREE.Mesh(
              geo('DodecahedronGeometry(0.42, 0)', () => new THREE.DodecahedronGeometry(0.42, 0)),
              briarMat,
            );
            bush.position.set(wx, 0.42, wz);
            tilesGroup.add(bush);
            for (const [ox, oz, rot] of [
              [-0.2, -0.15, 0.5],
              [0.22, 0.15, -0.5],
            ] as const) {
              const spike = new THREE.Mesh(
                geo('ConeGeometry(0.1, 0.45, 6)', () => new THREE.ConeGeometry(0.1, 0.45, 6)),
                thornMat,
              );
              spike.position.set(wx + ox, 0.58, wz + oz);
              spike.rotation.z = rot;
              tilesGroup.add(spike);
            }
          } else if (t === 'W') {
            const crate = new THREE.Mesh(unitBox, lambert({ color: 0xb7791f }));
            crate.scale.set(0.84, 0.72, 0.84);
            crate.position.set(wx, 0.46, wz);
            tilesGroup.add(crate);
          } else if (t === 'R' || t === 'U') {
            const raised =
              (t === 'R' && s.crystalColor === 'red') || (t === 'U' && s.crystalColor === 'blue');
            const col = t === 'R' ? 0xe53e3e : 0x3182ce;
            const barrier = new THREE.Mesh(
              unitBox,
              lambert({
                color: col,
                transparent: !raised,
                opacity: raised ? 1 : 0.42,
              }),
            );
            const h = raised ? 0.82 : 0.06;
            barrier.scale.set(0.86, h, 0.86);
            barrier.position.set(wx, 0.1 + h / 2, wz);
            tilesGroup.add(barrier);
          } else if (t === 'C') {
            const base = new THREE.Mesh(
              geo(
                'CylinderGeometry(0.34, 0.4, 0.28, 12)',
                () => new THREE.CylinderGeometry(0.34, 0.4, 0.28, 12),
              ),
              lambert({ color: 0x718096 }),
            );
            base.position.set(wx, 0.24, wz);
            const orb = new THREE.Mesh(
              crystalGeo,
              lambert({
                color: s.crystalColor === 'red' ? 0xf56565 : 0x63b3ed,
                emissive: s.crystalColor === 'red' ? 0x742a2a : 0x1a365d,
              }),
            );
            orb.position.set(wx, 0.64, wz);
            tilesGroup.add(base, orb);
          } else if (t === 'T') {
            const bowl = new THREE.Mesh(
              geo(
                'CylinderGeometry(0.34, 0.26, 0.46, 12)',
                () => new THREE.CylinderGeometry(0.34, 0.26, 0.46, 12),
              ),
              lambert({ color: 0x5a524c }),
            );
            bowl.position.set(wx, 0.33, wz);
            tilesGroup.add(bowl);
            // Show gold order pips (1, 2, 3) on ordered braziers so players can read order visually
            const spec = room?.torches?.find((ts) => ts.x === x && ts.y === y);
            if (spec?.order) {
              const pipMat = basic({ color: 0xfbbf24 });
              for (let p = 0; p < spec.order; p++) {
                const pip = new THREE.Mesh(
                  geo('SphereGeometry(0.055, 8, 8)', () => new THREE.SphereGeometry(0.055, 8, 8)),
                  pipMat,
                );
                const offset = (p - (spec.order - 1) / 2) * 0.15;
                pip.position.set(wx + offset, 0.36, wz + 0.33);
                tilesGroup.add(pip);
              }
            }
          } else if (t === 'D' || t === 'K' || t === 'S') {
            const doorColor = t === 'K' ? 0x9b2c2c : t === 'D' ? 0x975a16 : 0x4a5568;
            const door = new THREE.Mesh(unitBox, lambert({ color: doorColor }));
            door.scale.set(0.96, 0.92, 0.96);
            door.position.set(wx, 0.52, wz);
            tilesGroup.add(door);
            if (t === 'D' || t === 'K') {
              const lockPlate = new THREE.Mesh(
                geo('BoxGeometry(0.3, 0.34, 1.0)', () => new THREE.BoxGeometry(0.3, 0.34, 1.0)),
                basic({ color: t === 'K' ? 0xfbbf24 : 0xf6e05e }),
              );
              lockPlate.position.set(wx, 0.55, wz);
              tilesGroup.add(lockPlate);
            }
          } else if (t === 'O') {
            const plate = new THREE.Mesh(
              geo(
                'CylinderGeometry(0.36, 0.4, 0.08, 16)',
                () => new THREE.CylinderGeometry(0.36, 0.4, 0.08, 16),
              ),
              lambert({
                color: solved ? 0x48bb78 : 0xd69e2e,
              }),
            );
            plate.position.set(wx, 0.14, wz);
            tilesGroup.add(plate);
          } else if (t === '>') {
            const portalSpec = room?.portals?.find((p) => p.x === x && p.y === y);
            const active = !portalSpec?.requiresWarpUnlock || s.cryptWarpUnlocked;
            const pad = new THREE.Mesh(
              geo(
                'CylinderGeometry(0.42, 0.44, 0.08, 20)',
                () => new THREE.CylinderGeometry(0.42, 0.44, 0.08, 20),
              ),
              basic({
                color: portalSpec?.requiresWarpUnlock ? (active ? 0x38bdf8 : 0x334155) : 0xfbbf24,
              }),
            );
            pad.position.set(wx, 0.13, wz);
            tilesGroup.add(pad);
          }
        }
      }

      // Render static NPCs in this room
      for (const npc of room?.npcs ?? []) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(cylGeo, lambert({ color: npc.color }));
        body.position.y = 0.41;
        const head = new THREE.Mesh(
          headGeo,
          lambert({
            color: npc.id === 'spire-plaque' ? 0xa0aec0 : 0xf6dcb8,
          }),
        );
        head.position.y = 0.82;
        g.add(body, head);
        g.position.set(npc.x, 0, npc.y);
        tilesGroup.add(g);
      }
    },

    sync(world: World, s: State, time: number): void {
      dynamicGroup.clear();

      // Dark-room dynamic lighting (`Lantern Hall` / `Wickgeist`)
      const room = currentRoom(world, s);
      const lit = isRoomLit(world, s);
      if (room?.dark && !lit) {
        hemi.intensity = 0.16;
        sun.intensity = 0.12;
        lanternLight.intensity = 2.2;
        lanternLight.position.set(s.x, 1.8, s.y);
      } else if (room?.dark && lit) {
        hemi.intensity = 0.72;
        sun.intensity = 0.85;
        const firstLit = s.torches.find((t) => t.lit);
        lanternLight.intensity = 2.8;
        lanternLight.position.set((firstLit?.x ?? s.x) + 0.5, 2.2, (firstLit?.y ?? s.y) + 0.5);
      } else {
        hemi.intensity = s.zone === 'ember-crypt' ? 0.92 : 1.15;
        sun.intensity = s.zone === 'ember-crypt' ? 1.05 : 1.35;
        lanternLight.intensity = 0;
      }

      // Player position, facing rotation & i-frame blink
      const blinkHide = s.invulnTimer > 0 && Math.floor(time * 18) % 2 === 0;
      playerGroup.visible = !blinkHide;
      const walkBob = Math.hypot(s.vx, s.vy) > 0.2 ? 0.04 : 0.02 * Math.sin(time * 8);
      playerGroup.position.set(s.x, 0.1 + walkBob, s.y);
      playerGroup.rotation.y = Math.atan2(s.fx, s.fy);

      // Ghost target reticles (`GAME.md` §2)
      const { dropTile, throwTile } = computeGhostTargets(world, s);
      const isEmber = s.selectedBomb === 'ember';
      dropReticleMat.color.setHex(isEmber ? 0xfdba74 : 0xfef08a);
      throwReticleMat.color.setHex(isEmber ? 0xf97316 : 0xfbbf24);
      dropReticle.position.set(dropTile[0] + 0.5, 0.12, dropTile[1] + 0.5);
      throwReticle.position.set(throwTile[0] + 0.5, 0.125, throwTile[1] + 0.5);
      throwReticle.visible = throwTile[0] !== dropTile[0] || throwTile[1] !== dropTile[1];

      // Push blocks (`P`)
      for (const blk of s.blocks) {
        const m = new THREE.Mesh(unitBox, pushBlockMat);
        m.scale.set(0.88, 0.78, 0.88);
        m.position.set(blk.x + 0.5, 0.49, blk.y + 0.5);
        dynamicGroup.add(m);
      }

      // Lit braziers (`T`)
      for (const t of s.torches) {
        if (!t.lit) continue;
        const flicker = 0.9 + 0.16 * Math.sin(time * 18 + t.x * 3 + t.y * 5);
        const flame = new THREE.Mesh(coneGeo, fireMat);
        flame.scale.set(flicker, flicker * 1.15, flicker);
        flame.position.set(t.x + 0.5, 0.75, t.y + 0.5);
        dynamicGroup.add(flame);
      }

      // Burning Ember patches (`2.5 s`)
      for (const f of s.fires) {
        const pad = new THREE.Mesh(
          geo(
            'CylinderGeometry(0.42, 0.45, 0.08, 14)',
            () => new THREE.CylinderGeometry(0.42, 0.45, 0.08, 14),
          ),
          fireMat,
        );
        pad.position.set(f.x + 0.5, 0.14, f.y + 0.5);
        const tongue = new THREE.Mesh(coneGeo, fireMat);
        const sFlick = 0.8 + 0.25 * Math.sin(time * 22 + f.x);
        tongue.scale.setScalar(sFlick);
        tongue.position.set(f.x + 0.5, 0.36, f.y + 0.5);
        dynamicGroup.add(pad, tongue);
      }

      // Live bombs (grounded & parabolic thrown arc)
      for (const b of s.bombs) {
        const m = new THREE.Mesh(sphereGeo, b.kind === 'ember' ? emberBombMat : powderBombMat);
        const pulse = 1 + 0.1 * Math.sin(time * (7 + 12 / Math.max(0.18, b.fuse)));
        m.scale.setScalar(pulse);

        let arcY = 0;
        if (b.flight) {
          const u = Math.min(1, b.flight.elapsed / b.flight.duration);
          arcY = 4 * 1.15 * u * (1 - u);
        }
        m.position.set(b.x, 0.36 + arcY, b.y);
        const spark = new THREE.Mesh(
          geo('SphereGeometry(0.08, 8, 8)', () => new THREE.SphereGeometry(0.08, 8, 8)),
          sparkMat,
        );
        spark.position.set(b.x, 0.66 + arcY, b.y);
        dynamicGroup.add(m, spark);
      }

      // Pickups (keys, Ember Bomb relic, Heart Shards, Satchel upgrades, Cinder Core)
      for (const p of s.pickups) {
        const bob = 0.42 + 0.08 * Math.sin(time * 4.5 + p.x);
        const color =
          p.kind === 'ember-bomb' || p.kind === 'cinder-core'
            ? 0xf97316
            : p.kind === 'heart-shard' || p.kind === 'heart-container' || p.kind === 'heart-drop'
              ? 0xef4444
              : p.kind === 'satchel-upgrade'
                ? 0x38bdf8
                : 0xfacc15;
        const gem = new THREE.Mesh(
          p.kind === 'cinder-core' || p.kind === 'ember-bomb'
            ? crystalGeo
            : geo('SphereGeometry(0.24, 12, 10)', () => new THREE.SphereGeometry(0.24, 12, 10)),
          lambert({ color, emissive: color, emissiveIntensity: 0.28 }),
        );
        gem.position.set(p.x, bob, p.y);
        gem.rotation.y = time * 2.2;
        dynamicGroup.add(gem);
      }

      // Enemies & Bosses
      for (const e of s.enemies) {
        const eg = new THREE.Group();
        if (e.kind === 'slime') {
          const squash = 1 + 0.14 * Math.sin(time * 8 + e.id);
          const body = new THREE.Mesh(sphereGeo, slimeMat);
          body.scale.set(1.15 / Math.sqrt(squash), squash, 1.15 / Math.sqrt(squash));
          body.position.y = 0.28;
          eg.add(body);
        } else if (e.kind === 'bat') {
          const body = new THREE.Mesh(
            geo('SphereGeometry(0.2, 10, 8)', () => new THREE.SphereGeometry(0.2, 10, 8)),
            batMat,
          );
          body.position.y = 0.68 + 0.08 * Math.sin(time * 12 + e.id);
          const flap = 0.45 * Math.sin(time * 22 + e.id);
          for (const side of [-1, 1] as const) {
            const wing = new THREE.Mesh(
              geo('BoxGeometry(0.34, 0.05, 0.18)', () => new THREE.BoxGeometry(0.34, 0.05, 0.18)),
              batMat,
            );
            wing.position.set(side * 0.24, body.position.y, 0);
            wing.rotation.z = side * flap;
            eg.add(wing);
          }
          eg.add(body);
        } else if (e.kind === 'shielder') {
          const body = new THREE.Mesh(cylGeo, shielderMat);
          body.position.y = 0.38;
          eg.add(body);
          if (e.armored) {
            const shield = new THREE.Mesh(
              geo('BoxGeometry(0.68, 0.56, 0.12)', () => new THREE.BoxGeometry(0.68, 0.56, 0.12)),
              woodShieldMat,
            );
            shield.position.set(0, 0.38, 0.36);
            eg.add(shield);
          }
          eg.rotation.y = Math.atan2(e.fx, e.fy);
        } else if (e.kind === 'wickgeist') {
          const ghostly = e.armored;
          const wMat = lambert({
            color: ghostly ? 0x7dd3fc : 0xc084fc,
            emissive: ghostly ? 0x0c4a6e : 0x6b21a8,
            transparent: true,
            opacity: ghostly ? 0.38 : 0.95,
          });
          const robe = new THREE.Mesh(
            geo('ConeGeometry(0.42, 0.95, 14)', () => new THREE.ConeGeometry(0.42, 0.95, 14)),
            wMat,
          );
          robe.position.y = 0.62 + 0.08 * Math.sin(time * 5);
          eg.add(robe);
        } else if (e.kind === 'cinderhull') {
          const coreColor = e.armored ? 0x4a5568 : 0xf97316;
          const core = new THREE.Mesh(
            geo('DodecahedronGeometry(0.56, 0)', () => new THREE.DodecahedronGeometry(0.56, 0)),
            lambert({
              color: coreColor,
              emissive: e.armored ? 0x1a202c : 0x9a3412,
            }),
          );
          core.position.y = 0.62;
          eg.add(core);
          if (e.armored) {
            const vineMat = lambert({ color: 0x3f6212 });
            for (let k = 0; k < 4; k++) {
              const ring = new THREE.Mesh(
                geo(
                  'TorusGeometry(0.6, 0.09, 8, 16)',
                  () => new THREE.TorusGeometry(0.6, 0.09, 8, 16),
                ),
                vineMat,
              );
              ring.position.y = 0.62;
              ring.rotation.x = (k * Math.PI) / 4;
              ring.rotation.y = time * 1.2 + k;
              eg.add(ring);
            }
          }
        }

        eg.position.set(e.x, 0.05, e.y);
        dynamicGroup.add(eg);
      }

      // Enemy projectiles
      for (const pr of s.projectiles) {
        const orb = new THREE.Mesh(
          geo('SphereGeometry(0.16, 10, 8)', () => new THREE.SphereGeometry(0.16, 10, 8)),
          projMat,
        );
        orb.position.set(pr.x, 0.48, pr.y);
        dynamicGroup.add(orb);
      }

      // Transient blast flashes (`0.24 s` fade)
      for (const b of s.blasts) {
        const mat = (b.kind === 'ember' ? emberBlastMat : powderBlastMat).clone();
        const m = new THREE.Mesh(unitBox, mat);
        m.scale.set(0.92, 0.52, 0.92);
        m.position.set(b.x, 0.34, b.y);
        m.userData.born = time;
        blastsGroup.add(m);
      }
      for (const m of [...blastsGroup.children] as THREE.Mesh[]) {
        const age = time - (m.userData.born as number);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 0.24);
        if (age >= 0.24) {
          blastsGroup.remove(m);
          (m.material as THREE.Material).dispose();
        }
      }
    },
  };
}
