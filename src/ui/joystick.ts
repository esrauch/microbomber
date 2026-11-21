/**
 * A virtual joystick for touch (`GAME.md` §2, `ROADMAP.md` §6.2):
 * - Outer `118 × 118` (`59 × 59` art px `@ 2×`) carved octagonal/circular GBC socket with
 *   cardinal compass ticks (`N, S, E, W`), recessed dark d-pad well, and `1px` ink outline.
 * - Inner `50 × 50` (`25 × 25` art px `@ 2×`) pixel-art brass/amber thumb cap with specular
 *   pixel highlight and tactile `+` grip cross.
 */
import { INK_RGB, rgb555 } from '../render/gbcPalette';
import { TRANSPARENT_RGBA, encodeRgbaPngDataUrl, opaque } from './bezel';

const SIZE = 118; // ring diameter, px (59 art px @ 2x)
const KNOB_SIZE = 50; // knob diameter, px (25 art px @ 2x)
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

let cachedRingUrl: string | null = null;
let cachedKnobUrl: string | null = null;

/** `59 × 59` art px (`118 × 118` `@ 2×`) carved octagonal/circular GBC stick socket. */
export function joystickRingDataUrl(): string {
  if (cachedRingUrl) return cachedRingUrl;

  const rimHi = rgb555(216, 208, 168);
  const rimMid = rgb555(128, 136, 112);
  const rimShade = rgb555(64, 72, 64);
  const tickGold = rgb555(248, 216, 80);
  const tickHi = rgb555(248, 248, 224);
  const wellBase = rgb555(24, 32, 28);
  const wellDeep = rgb555(16, 20, 24);
  const wellGuide = rgb555(40, 52, 44);

  cachedRingUrl = encodeRgbaPngDataUrl(
    59,
    59,
    (x, y) => {
      const dx = x - 29;
      const dy = y - 29;
      const rCirc = Math.hypot(dx, dy);
      const rOct = (Math.abs(dx) + Math.abs(dy)) * 0.74;
      const d = Math.max(rCirc, rOct);

      if (d > 28.8) return TRANSPARENT_RGBA;
      if (d > 27.5) return opaque(INK_RGB);

      const dither = (x + y) % 2 === 0;

      // Cardinal compass ticks (N, S, E, W) inset into the carved bevel ring
      const northTick = Math.abs(dx) <= 1 && y >= 2 && y <= 5;
      const southTick = Math.abs(dx) <= 1 && y >= 53 && y <= 56;
      const westTick = Math.abs(dy) <= 1 && x >= 2 && x <= 5;
      const eastTick = Math.abs(dy) <= 1 && x >= 53 && x <= 56;
      if (northTick || southTick || westTick || eastTick) {
        const centerLine = dx === 0 || dy === 0;
        return opaque(centerLine ? tickHi : tickGold);
      }
      const tickBorder =
        (Math.abs(dx) === 2 && ((y >= 2 && y <= 5) || (y >= 53 && y <= 56))) ||
        (Math.abs(dy) === 2 && ((x >= 2 && x <= 5) || (x >= 53 && x <= 56)));
      if (tickBorder && d <= 27.5 && d > 22.6) {
        return opaque(INK_RGB);
      }

      // Carved stone/brass outer bevel ring
      if (d > 22.6) {
        if (dx + dy < -8) return opaque(rimHi);
        if (dx + dy > 10) return opaque(dither ? rimShade : rimMid);
        return opaque(dither ? rimHi : rimMid);
      }

      // 1px inner ink lip around the recessed well
      if (d > 21.4) return opaque(INK_RGB);

      // Upper-left cast shadow inside the recessed well
      if (d > 18.6 && dx + dy < -2) {
        return opaque(dither ? wellDeep : wellBase);
      }

      // Subtle recessed d-pad guide cross inside the dark well
      const inCross =
        (Math.abs(dx) <= 2 && Math.abs(dy) <= 15) || (Math.abs(dy) <= 2 && Math.abs(dx) <= 15);
      if (inCross) {
        const crossEdge =
          (Math.abs(dx) === 2 && Math.abs(dy) <= 15) ||
          (Math.abs(dy) === 2 && Math.abs(dx) <= 15) ||
          Math.abs(dx) === 15 ||
          Math.abs(dy) === 15;
        return opaque(crossEdge ? wellGuide : wellDeep);
      }

      return opaque(wellBase);
    },
    2,
  );
  return cachedRingUrl;
}

/** `25 × 25` art px (`50 × 50` `@ 2×`) pixel-art brass/amber thumb cap with `+` grip cross. */
export function joystickKnobDataUrl(): string {
  if (cachedKnobUrl) return cachedKnobUrl;

  const glint = rgb555(248, 248, 232);
  const goldHi = rgb555(248, 216, 88);
  const brassMid = rgb555(216, 152, 48);
  const bronzeShade = rgb555(144, 88, 32);
  const bronzeDeep = rgb555(88, 48, 24);

  cachedKnobUrl = encodeRgbaPngDataUrl(
    25,
    25,
    (x, y) => {
      const dx = x - 12;
      const dy = y - 12;
      const d = Math.hypot(dx, dy);

      if (d > 12.1) return TRANSPARENT_RGBA;
      if (d > 10.8) return opaque(INK_RGB);

      const dither = (x + y) % 2 === 0;

      // Specular pixel crescent on upper-left rim
      if (d > 8.4 && d <= 10.3 && dx < -1 && dy < -1 && dx + dy < -6) {
        return opaque(glint);
      }

      // Outer brass bevel
      if (d > 8.6) {
        if (dx + dy < -2) return opaque(goldHi);
        if (dx + dy > 3) return opaque(dither ? bronzeDeep : bronzeShade);
        return opaque(dither ? goldHi : brassMid);
      }

      // Tactile '+' grip cross in the centre of the thumb cap
      const inGrip =
        (Math.abs(dx) <= 1 && Math.abs(dy) <= 4) || (Math.abs(dy) <= 1 && Math.abs(dx) <= 4);
      if (inGrip) {
        if (dx === 0 && dy === 0) return opaque(INK_RGB);
        const catchLight = dx === 1 || dy === 1;
        return opaque(catchLight ? goldHi : bronzeDeep);
      }

      // Thumb cap dome shading
      if (dx + dy < -4) return opaque(goldHi);
      if (dx + dy > 4) return opaque(dither ? bronzeShade : brassMid);
      return opaque(brassMid);
    },
    2,
  );
  return cachedKnobUrl;
}

export function mountJoystick(host: HTMLElement): Joystick {
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'relative',
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    flexShrink: '0',
    backgroundImage: `url("${joystickRingDataUrl()}")`,
    backgroundSize: `${SIZE}px ${SIZE}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    touchAction: 'none',
    userSelect: 'none',
  });

  const knob = document.createElement('div');
  Object.assign(knob.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${KNOB_SIZE}px`,
    height: `${KNOB_SIZE}px`,
    margin: `${-KNOB_SIZE / 2}px 0 0 ${-KNOB_SIZE / 2}px`,
    backgroundImage: `url("${joystickKnobDataUrl()}")`,
    backgroundSize: `${KNOB_SIZE}px ${KNOB_SIZE}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
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
    knob.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
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
