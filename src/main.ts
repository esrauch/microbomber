/** microbomber: a flip-screen adventure where your only tool is bombs. */
import * as THREE from 'three';
import buildInfo from 'virtual:build-info';
import { type Input, ROOM_H, ROOM_W, newState, testWorld, tick } from './game/world';
import { makeCameraRig } from './render/camera';
import { makeRoomView } from './render/scene';
import { mountJoystick } from './ui/joystick';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hud = document.querySelector<HTMLDivElement>('#hud');
if (!canvas || !hud) throw new Error('index.html is missing #game or #hud');

const world = testWorld();
const state = newState(0, 0, 4.5, 7.5);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const view = makeRoomView();
view.rebuild(world, state);
const rig = makeCameraRig({ width: ROOM_W, depth: ROOM_H });

const resize = (): void => {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  rig.resize(canvas.clientWidth, canvas.clientHeight);
};
window.addEventListener('resize', resize);
resize();
hud.textContent = `microbomber · ${buildInfo.commit}${buildInfo.dirty ? '+' : ''}`;

// A black overlay for the cut between rooms (a quick fade, never a scroll).
const fade = document.createElement('div');
Object.assign(fade.style, {
  position: 'fixed',
  inset: '0',
  background: '#000',
  opacity: '0',
  pointerEvents: 'none',
  transition: 'opacity 90ms linear',
});
document.body.append(fade);

// Input: arrows/WASD and Space; on touch, a virtual joystick and a bomb button.
const held = new Set<string>();
let bombQueued = false;
window.addEventListener('keydown', (e) => {
  held.add(e.key.toLowerCase());
  if (e.key === ' ') bombQueued = true;
});
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
const joystick = mountJoystick(document.body);
const bombButton = document.createElement('button');
bombButton.textContent = '💣';
Object.assign(bombButton.style, {
  position: 'fixed',
  right: '16px',
  bottom: 'calc(16px + env(safe-area-inset-bottom))',
  width: '72px',
  height: '72px',
  borderRadius: '50%',
  border: '3px solid #f4e3b0',
  background: 'rgba(40, 30, 20, 0.6)',
  fontSize: '34px',
  touchAction: 'none',
});
bombButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  bombQueued = true;
});
document.body.append(bombButton);

const readInput = (): Input => {
  let dx = 0;
  let dy = 0;
  if (held.has('arrowleft') || held.has('a')) dx -= 1;
  if (held.has('arrowright') || held.has('d')) dx += 1;
  if (held.has('arrowup') || held.has('w')) dy -= 1;
  if (held.has('arrowdown') || held.has('s')) dy += 1;
  const stick = joystick.read();
  if (stick.dx || stick.dy) {
    dx = stick.dx;
    dy = stick.dy;
  }
  const bomb = bombQueued;
  bombQueued = false;
  return { dx, dy, bomb };
};

let last = performance.now();
let cutting = false;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!cutting) {
    const brokeBefore = state.broken.size;
    const moved = tick(world, state, readInput(), dt);
    if (moved) {
      // Cut to the new room: fade out, swap, fade in. The game waits meanwhile.
      cutting = true;
      fade.style.opacity = '1';
      window.setTimeout(() => {
        view.rebuild(world, state);
        fade.style.opacity = '0';
        cutting = false;
      }, 90);
    } else if (state.broken.size !== brokeBefore) {
      view.rebuild(world, state);
    }
  }
  view.sync(state, now / 1000);
  renderer.render(view.scene, rig.camera);
});
