/**
 * A virtual joystick for touch: a ring mounted inside the left side of the
 * dedicated control band (`GAME.md` §2) with an analogue knob and small dead zone.
 */

const SIZE = 118; // ring diameter, px
const REACH = SIZE / 2 - 18; // max travel of knob centre, px
const DEAD = 0.14; // dead-zone fraction
const FULL = 0.7; // fraction of reach that already gives full speed, so thumbs needn't hit the rim

export interface Joystick {
  /**
   * Analogue direction (x right, y down) with length 0..1: rescaled from the dead-zone edge
   * so movement starts from zero, and saturating at `FULL` of the stick's reach.
   */
  read(): { dx: number; dy: number };
}

export function mountJoystick(host: HTMLElement): Joystick {
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'relative',
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    flexShrink: '0',
    borderRadius: '50%',
    border: '3px solid rgba(244, 227, 176, 0.68)',
    background: 'rgba(20, 26, 22, 0.55)',
    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.45)',
    touchAction: 'none',
    userSelect: 'none',
  });

  const knob = document.createElement('div');
  Object.assign(knob.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '50px',
    height: '50px',
    margin: '-25px 0 0 -25px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #fff5d6, #d9c08c)',
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.45)',
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
    try {
      ring.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events may omit capture support.
    }
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
      const m = Math.hypot(dx, dy);
      if (m < DEAD) return { dx: 0, dy: 0 };
      const k = Math.min(1, (m - DEAD) / (FULL - DEAD)) / m;
      return { dx: dx * k, dy: dy * k };
    },
  };
}
