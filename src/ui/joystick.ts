/**
 * A virtual joystick for touch: a ring fixed in the bottom-left corner with a
 * knob you drag. Its direction is analogue (a knob halfway out walks at half
 * speed), with a small dead zone in the middle.
 */

const SIZE = 120; // ring diameter, px
const REACH = SIZE / 2 - 18; // how far the knob's centre can travel, px
const DEAD = 0.15; // fraction of the reach that counts as still

export interface Joystick {
  /** The stick's direction, each axis -1..1 (screen x right, y down), and 0, 0 when untouched. */
  read(): { dx: number; dy: number };
}

export function mountJoystick(host: HTMLElement): Joystick {
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'fixed',
    left: '16px',
    bottom: 'calc(16px + env(safe-area-inset-bottom))',
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    borderRadius: '50%',
    border: '3px solid rgba(244, 227, 176, 0.7)',
    background: 'rgba(40, 30, 20, 0.35)',
    touchAction: 'none',
  });
  const knob = document.createElement('div');
  Object.assign(knob.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '52px',
    height: '52px',
    margin: '-26px 0 0 -26px',
    borderRadius: '50%',
    background: 'rgba(244, 227, 176, 0.85)',
    pointerEvents: 'none',
  });
  ring.append(knob);
  host.append(ring);

  let pointer: number | null = null;
  let offset = { x: 0, y: 0 };
  const place = (e: PointerEvent): void => {
    const box = ring.getBoundingClientRect();
    let x = e.clientX - (box.left + box.width / 2);
    let y = e.clientY - (box.top + box.height / 2);
    const d = Math.hypot(x, y);
    if (d > REACH) {
      x = (x / d) * REACH;
      y = (y / d) * REACH;
    }
    offset = { x, y };
    knob.style.transform = `translate(${x}px, ${y}px)`;
  };
  const release = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    offset = { x: 0, y: 0 };
    knob.style.transform = '';
  };
  ring.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    ring.setPointerCapture(e.pointerId);
    place(e);
  });
  ring.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) place(e);
  });
  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);

  return {
    read() {
      const dx = offset.x / REACH;
      const dy = offset.y / REACH;
      return Math.hypot(dx, dy) < DEAD ? { dx: 0, dy: 0 } : { dx, dy };
    },
  };
}
