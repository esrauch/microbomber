/**
 * A virtual joystick for touch (`GAME.md` §2, `ROADMAP.md` §6.2):
 * - Outer `118 × 118` (`59 × 59` art px `@ 2×`) carved octagonal/circular GBC socket with
 *   cardinal compass ticks (`N, S, E, W`), recessed dark d-pad well, and `1px` ink outline.
 * - Inner `50 × 50` (`25 × 25` art px `@ 2×`) pixel-art brass/amber thumb cap with specular
 *   pixel highlight and tactile `+` grip cross.
 */
import { WALK_MIN_INPUT } from '../game/world';
import { INK_RGB, rgb555 } from '../render/gbcPalette';
import { TRANSPARENT_RGBA, encodeRgbaPngDataUrl, opaque } from './bezel';

const SIZE = 118; // ring diameter, px (59 art px @ 2x)
const KNOB_SIZE = 50; // knob diameter, px (25 art px @ 2x)
const REACH = SIZE / 2 - 18; // max travel of knob centre, px
export const DEAD = 0.22; // inner dead-zone fraction (no facing change, no walk)
export const TURN = 0.44; // middle facing-only zone outer fraction (turns in place, no walk)
export const FULL = 0.78; // fraction of reach that already gives full walk speed
/** Half-angle (in radians, ~10°) of each of the 8 cardinal/diagonal snap cones. */
export const SNAP_CONE_RAD = (10 * Math.PI) / 180;
const TURN_MAG = 0.3; // output magnitude inside the facing-only ring (AIM_MIN_INPUT <= m < WALK_MIN_INPUT)

/**
 * Snap an angle (in radians) to the nearest of the 8 compass directions (`k * π/4`) when it
 * falls within `±SNAP_CONE_RAD`, and blend smoothly across the remaining gap between cones.
 */
export function snapEightWayAngle(angle: number): { angle: number; lockedIndex: number | null } {
  const sector = Math.PI / 4;
  const halfSector = Math.PI / 8;
  const nearestIdx = Math.round(angle / sector);
  const nearestAngle = nearestIdx * sector;
  const diff = angle - nearestAngle;
  const absDiff = Math.abs(diff);
  const normIdx = ((nearestIdx % 8) + 8) % 8;
  if (absDiff <= SNAP_CONE_RAD) {
    return { angle: nearestAngle, lockedIndex: normIdx };
  }
  const t = (absDiff - SNAP_CONE_RAD) / (halfSector - SNAP_CONE_RAD);
  return {
    angle: nearestAngle + Math.sign(diff) * t * halfSector,
    lockedIndex: null,
  };
}

/**
 * Map normalized stick deflection `(dx, dy)` (`0..1` of `REACH`) across three concentric zones,
 * locking to the 8 cardinal/diagonal directions within `±SNAP_CONE_RAD`:
 * - `m < DEAD`: `{ dx: 0, dy: 0 }` (dead zone)
 * - `DEAD <= m < TURN`: facing-only vector of magnitude `TURN_MAG` (rotates Pip in place)
 * - `m >= TURN`: walk vector ramping from `WALK_MIN_INPUT` to `1` at `FULL`
 */
export function mapJoystickDeflection(dx: number, dy: number): { dx: number; dy: number } {
  const m = Math.hypot(dx, dy);
  if (m < DEAD) return { dx: 0, dy: 0 };
  const { angle } = snapEightWayAngle(Math.atan2(dy, dx));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const uxClean = Math.abs(ux) < 1e-12 ? 0 : ux;
  const uyClean = Math.abs(uy) < 1e-12 ? 0 : uy;
  if (m < TURN) {
    return { dx: uxClean * TURN_MAG, dy: uyClean * TURN_MAG };
  }
  const u = Math.min(1, (m - TURN) / (FULL - TURN));
  const mag = WALK_MIN_INPUT + u * (1 - WALK_MIN_INPUT);
  return { dx: uxClean * mag, dy: uyClean * mag };
}

export interface Joystick {
  /**
   * Analogue direction (x right, y down) with length 0..1: rescaled from the dead-zone edge
   * so movement starts from zero, and saturating at `FULL` of the stick's reach.
   */
  read(): { dx: number; dy: number };
  /** Show or hide the Dungeon 999 debug overlay (concentric zone rings and 8-way snap cones). */
  setDebug?(show: boolean): void;
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

  const debugCanvas = document.createElement('canvas');
  debugCanvas.width = SIZE;
  debugCanvas.height = SIZE;
  Object.assign(debugCanvas.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    pointerEvents: 'none',
    display: 'none',
    zIndex: '2',
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
    zIndex: '1',
  });
  ring.append(knob, debugCanvas);
  host.append(ring);

  let pointer: number | null = null;
  let offset = { x: 0, y: 0 };
  let showDebug = false;

  const drawDebugOverlay = (): void => {
    if (!showDebug) return;
    const ctx = debugCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const rDead = DEAD * REACH;
    const rTurn = TURN * REACH;
    const rFull = FULL * REACH;
    const rMax = REACH;

    const normDx = offset.x / REACH;
    const normDy = offset.y / REACH;
    const m = Math.hypot(normDx, normDy);
    const activeSnap = m >= DEAD ? snapEightWayAngle(Math.atan2(normDy, normDx)) : null;

    // 1. 8 cardinal & diagonal snap cones from rDead out to rMax
    for (let i = 0; i < 8; i++) {
      const centerAngle = i * (Math.PI / 4);
      const a0 = centerAngle - SNAP_CONE_RAD;
      const a1 = centerAngle + SNAP_CONE_RAD;
      const isLocked = activeSnap?.lockedIndex === i;
      ctx.beginPath();
      ctx.arc(cx, cy, rMax, a0, a1);
      ctx.arc(cx, cy, rDead, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = isLocked
        ? 'rgba(248, 216, 88, 0.34)'
        : i % 2 === 0
          ? 'rgba(104, 184, 248, 0.18)'
          : 'rgba(160, 120, 232, 0.15)';
      ctx.fill();
      ctx.strokeStyle = isLocked ? 'rgba(248, 216, 88, 0.85)' : 'rgba(168, 200, 224, 0.38)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Concentric zone rings: DEAD (red/amber), TURN (cyan), FULL (green), REACH (outer)
    const rings: Array<{ r: number; color: string; active: boolean }> = [
      { r: rDead, color: '#f88868', active: m < DEAD },
      { r: rTurn, color: '#68b8f8', active: m >= DEAD && m < TURN },
      { r: rFull, color: '#60c878', active: m >= TURN },
      { r: rMax, color: 'rgba(168, 200, 224, 0.45)', active: false },
    ];
    for (const rg of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = rg.active ? 1.75 : 1;
      ctx.stroke();
    }
  };

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
    drawDebugOverlay();
  };

  const release = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    offset = { x: 0, y: 0 };
    knob.style.transform = '';
    drawDebugOverlay();
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
      return mapJoystickDeflection(offset.x / REACH, offset.y / REACH);
    },
    setDebug(show: boolean) {
      if (show === showDebug) return;
      showDebug = show;
      debugCanvas.style.display = show ? 'block' : 'none';
      if (show) drawDebugOverlay();
    },
  };
}
