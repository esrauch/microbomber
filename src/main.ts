/**
 * microbomber: Vertical Slice entry point (`GAME.md`, `ROADMAP.md` §6.1–6.2).
 * Portrait layout:
 *   `#topbar` (GBC HUD + Minimap) -> `#stage` (Zone Bezel + Integer Playfield)
 *   -> `#dialogue-strip` (Fixed GBC Dialogue / Prompt Box) -> `#controls` (Pixel Stick + B/A).
 */
import buildInfo from 'virtual:build-info';
import type { BlastVisual, BombKind } from './game/types';
import {
  FIXED_DT,
  type Input,
  type State,
  campaignWorld,
  currentRoom,
  equipBomb,
  exportSave,
  importSave,
  newState,
  roomKey,
  showBanner,
  tick,
} from './game/world';
import { OBJ, type ObjSpriteName } from './render/gbcArt';
import { hudIconDataUrl, makeGbcView } from './render/gbc';
import { type HdView, SLIDE_SECONDS, createHdView } from './render/hd/hdView';
import {
  actionButtonDataUrl,
  applyGbcBoxFrame,
  bezelTileDataUrl,
  computeIntegerFrame,
  soundIconDataUrl,
} from './ui/bezel';
import { mountJoystick } from './ui/joystick';
import { PIXEL_FONT_FAMILY, installPixelFont } from './ui/pixelFont';
import { makeSfx } from './ui/sfx';

installPixelFont();

const SAVE_KEY = 'microbomber.save.v3';
const LEGACY_SAVE_KEY = 'microbomber.save.v2';
const ROLL_ICON = 'HUD_ROLL' as ObjSpriteName;
const INTRO_BANNER =
  'The Iron Tower rusted every blade on Cinderholm! Talk to Bram, press B to Roll, or tap/hold A behind the smithy.';

function pxIcon(name: ObjSpriteName, size: number): string {
  if (!(name in OBJ)) {
    return `<span style="display:inline-flex;width:${size}px;height:${size}px;align-items:center;justify-content:center">↷</span>`;
  }
  return `<img src="${hudIconDataUrl(name, 3)}" width="${size}" height="${size}" style="image-rendering:pixelated;display:inline-block;vertical-align:middle" alt="" />`;
}

function soundBadgeHtml(muted: boolean): string {
  const src = soundIconDataUrl(muted, 2);
  const label = muted ? 'SOUND: OFF' : 'SOUND: ON';
  return `<img src="${src}" width="16" height="16" style="image-rendering:pixelated;display:inline-block;vertical-align:middle;margin-right:6px" alt="" /><span>${label}</span>`;
}

const topbar = document.querySelector<HTMLElement>('#topbar');
const stage = document.querySelector<HTMLElement>('#stage');
const dialogueStrip = document.querySelector<HTMLElement>('#dialogue-strip');
const controls = document.querySelector<HTMLElement>('#controls');
if (!topbar || !stage || !dialogueStrip || !controls) {
  throw new Error('index.html is missing required shell elements');
}
const topbarEl = topbar;
const stageEl = stage;
const dialogueStripEl = dialogueStrip;
const controlsEl = controls;

const world = campaignWorld();
const sfx = makeSfx();

function persistState(s: State): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(exportSave(s)));
  } catch {
    // Ignore storage quota errors.
  }
}

function loadInitialState(): State {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const restored = importSave(world, JSON.parse(raw));
      if (restored) return restored;
    }
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacyRaw) {
      const migrated = importSave(world, JSON.parse(legacyRaw));
      if (migrated) {
        persistState(migrated);
        return migrated;
      }
    }
  } catch {
    // Ignore malformed or unavailable storage.
  }
  const fresh = newState(world);
  showBanner(fresh, INTRO_BANNER, 5.5);
  return fresh;
}

let state = loadInitialState();

const view = makeGbcView();

// HD-2D lite presentation on WebGL via PixiJS (`GAME.md` §10): the only renderer. The game
// waits here until it is ready; if it cannot start, the crash panel shows why.
let hd: HdView;
try {
  hd = await createHdView(stageEl, view);
} catch (err) {
  console.error('microbomber could not start its WebGL renderer (it needs WebGL2).', err);
  throw err;
}

const resize = (): void => {
  const stageW = stageEl.clientWidth || 360;
  const stageH = stageEl.clientHeight || 480;
  const dpr = window.devicePixelRatio || 1;
  const frame = computeIntegerFrame(stageW, stageH, dpr);
  const hdWithScale = hd as HdView & {
    setScale?: (deviceScale: number, cssWidth: number, cssHeight: number) => void;
  };
  if (hdWithScale.setScale) {
    hdWithScale.setScale(frame.deviceScale, frame.cssWidth, frame.cssHeight);
  } else {
    hd.resize(stageW, stageH);
    hd.canvas.style.width = `${frame.cssWidth}px`;
    hd.canvas.style.height = `${frame.cssHeight}px`;
  }
};
window.addEventListener('resize', resize);
if (typeof ResizeObserver !== 'undefined') {
  const stageObserver = new ResizeObserver(() => resize());
  stageObserver.observe(stageEl);
}

// =========================================================================
// Top HUD: Hearts, Keys, Non-Truncated Room Title/Objective, Minimap, Gear
// =========================================================================
const statusLeft = document.createElement('div');
Object.assign(statusLeft.style, {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  minWidth: '0',
  flex: '1 1 auto',
});

const heartsRow = document.createElement('div');
Object.assign(heartsRow.style, {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '6px',
  fontSize: '10px',
  lineHeight: '1.1',
});

const roomMetaRow = document.createElement('div');
Object.assign(roomMetaRow.style, {
  fontSize: '8.5px',
  lineHeight: '1.3',
  color: '#d8e0d0',
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
});
statusLeft.append(heartsRow, roomMetaRow);

const statusRight = document.createElement('div');
Object.assign(statusRight.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: '0',
});

const minimapEl = document.createElement('div');
Object.assign(minimapEl.style, {
  display: 'grid',
  gap: '2px',
  padding: '3px',
  background: '#101414',
  border: '2px solid #485848',
  boxShadow: 'inset 0 0 0 1px #181420',
});

const gearBtn = document.createElement('button');
gearBtn.innerHTML = pxIcon('HUD_GEAR', 18);
gearBtn.title = 'Settings & Reset';
Object.assign(gearBtn.style, {
  width: '28px',
  height: '28px',
  borderRadius: '0',
  border: '2px solid #98a888',
  boxShadow: '0 0 0 1px #181420, inset 0 -2px 0 #485848',
  background: '#202820',
  color: '#f8f8f0',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: '0',
});
statusRight.append(minimapEl, gearBtn);
topbarEl.append(statusLeft, statusRight);

// Settings popover (GBC double-lined pixel frame)
const settingsModal = document.createElement('div');
Object.assign(settingsModal.style, {
  position: 'absolute',
  top: '6px',
  right: '6px',
  zIndex: '30',
  display: 'none',
  flexDirection: 'column',
  gap: '6px',
  padding: '6px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.72)',
  fontSize: '9.5px',
  minWidth: '198px',
});
const muteBtn = document.createElement('button');
const resetSaveBtn = document.createElement('button');
for (const btn of [muteBtn, resetSaveBtn]) {
  Object.assign(btn.style, {
    padding: '6px 8px',
    borderRadius: '0',
    border: '2px solid #889880',
    boxShadow: '0 0 0 1px #181420, inset 0 -2px 0 #384838',
    background: '#243024',
    color: '#f8f8f0',
    fontFamily: `'${PIXEL_FONT_FAMILY}', monospace`,
    fontSize: '9px',
    lineHeight: '1.25',
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
  });
}

muteBtn.innerHTML = soundBadgeHtml(false);
muteBtn.addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  muteBtn.innerHTML = soundBadgeHtml(sfx.muted);
});
const RESET_LABEL = '↺ NEW GAME (RESET SAVE)';
resetSaveBtn.textContent = RESET_LABEL;
// Two-tap confirm: the first tap arms the button, a second tap within 3 s erases the save
let resetArmedUntil = 0;
resetSaveBtn.addEventListener('click', () => {
  const now = performance.now();
  if (now > resetArmedUntil) {
    resetArmedUntil = now + 3000;
    resetSaveBtn.textContent = '⚠ TAP AGAIN TO ERASE SAVE';
    window.setTimeout(() => {
      if (performance.now() >= resetArmedUntil) resetSaveBtn.textContent = RESET_LABEL;
    }, 3050);
    return;
  }
  resetArmedUntil = 0;
  resetSaveBtn.textContent = RESET_LABEL;
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // ignore
  }
  state = newState(world);
  showBanner(state, INTRO_BANNER, 5.5);
  if (menuOpen) toggleMenu(false);
  rebuildRoom();
  settingsModal.style.display = 'none';
  syncHud(true);
});
const buildStamp = document.createElement('div');
Object.assign(buildStamp.style, {
  fontSize: '8px',
  lineHeight: '1.25',
  color: '#98a898',
  borderTop: '1px solid #384838',
  paddingTop: '5px',
});
buildStamp.textContent = `microbomber · ${buildInfo.commit}${buildInfo.dirty ? '+' : ''}`;
settingsModal.append(muteBtn, resetSaveBtn, buildStamp);
stageEl.append(settingsModal);

gearBtn.addEventListener('click', () => {
  settingsModal.style.display = settingsModal.style.display === 'none' ? 'flex' : 'none';
});

// =========================================================================
// Stage Overlays: Boss HP Bar & Flip-Screen Fade (Dialogue moved to Bezel!)
// =========================================================================
const bossBarWrap = document.createElement('div');
Object.assign(bossBarWrap.style, {
  position: 'absolute',
  top: '6px',
  left: '10px',
  right: '10px',
  display: 'none',
  flexDirection: 'column',
  gap: '4px',
  padding: '2px 5px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.68)',
  pointerEvents: 'none',
  zIndex: '10',
});
const bossTitleEl = document.createElement('div');
Object.assign(bossTitleEl.style, {
  fontSize: '8.5px',
  lineHeight: '1.2',
  color: '#f8d858',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  justifyContent: 'space-between',
});
const bossTrack = document.createElement('div');
Object.assign(bossTrack.style, {
  height: '8px',
  borderRadius: '0',
  background: '#281c38',
  border: '1px solid #181420',
  overflow: 'hidden',
});
const bossFill = document.createElement('div');
Object.assign(bossFill.style, {
  height: '100%',
  width: '100%',
  background:
    'repeating-linear-gradient(90deg, #e82830 0px, #e82830 6px, #f88820 6px, #f88820 8px)',
  transition: 'width 0.1s steps(12, end)',
});
bossTrack.append(bossFill);
bossBarWrap.append(bossTitleEl, bossTrack);
stageEl.append(bossBarWrap);

// Dedicated fixed-height GBC Dialogue Strip docked in bezel below `#stage` (`§6.1`)
const dialogueContent = document.createElement('div');
Object.assign(dialogueContent.style, {
  width: '100%',
  fontSize: '8.5px',
  lineHeight: '1.3',
  color: '#f8f8f0',
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
});
dialogueStripEl.append(dialogueContent);

const fade = document.createElement('div');
Object.assign(fade.style, {
  position: 'absolute',
  inset: '0',
  background: '#000',
  opacity: '0',
  pointerEvents: 'none',
  transition: 'opacity 85ms linear',
  zIndex: '20',
});
stageEl.append(fade);

// =========================================================================
// Dedicated Control Band (`GAME.md` §2): Pixel Stick, START, B=Roll, A=Place
// =========================================================================
const joystick = mountJoystick(controlsEl);

const rightCluster = document.createElement('div');
Object.assign(rightCluster.style, {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '6px',
});

const topRow = document.createElement('div');
Object.assign(topRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

const satchelPips = document.createElement('div');
Object.assign(satchelPips.style, {
  fontSize: '10px',
  lineHeight: '1',
  color: '#f8d858',
  letterSpacing: '2px',
});

const startBtn = document.createElement('button');
startBtn.textContent = 'START';
Object.assign(startBtn.style, {
  height: '24px',
  padding: '0 10px',
  borderRadius: '0',
  border: '2px solid #98a898',
  boxShadow: '0 0 0 1px #181420, inset 0 -2px 0 #384838',
  background: '#202820',
  color: '#f8f8f0',
  fontSize: '8.5px',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  touchAction: 'none',
});
topRow.append(satchelPips, startBtn);

const BOMB_META: Record<BombKind, { sprite: ObjSpriteName; label: string }> = {
  bomb: { sprite: 'BOMB_1', label: 'Bomb' },
  fire: { sprite: 'FIREBOMB_1', label: 'Fire' },
};

/** Fixed-verb buttons held right now: `[holdB (Roll), holdA (Place)]`. */
const buttonHeld: [boolean, boolean] = [false, false];
/**
 * Presses since the last simulation step: a tap that goes down and up between two frames
 * still reads as held for one step, so it is never lost.
 */
const pressLatch: [boolean, boolean] = [false, false];

let menuOpen = false;
let menuCursor: BombKind | null = null;

interface VerbBtnHandles {
  button: HTMLButtonElement;
  inner: HTMLSpanElement;
  icon: HTMLSpanElement;
}

const makeVerbBtn = (slot: 0 | 1, kind: 'B' | 'A', badgeLabel: string): VerbBtnHandles => {
  const b = document.createElement('button');
  const inner = document.createElement('span');
  Object.assign(inner.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1px',
    pointerEvents: 'none',
    transform: 'translateY(-1px)',
  });
  const iconSpan = document.createElement('span');
  Object.assign(iconSpan.style, {
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
  });
  const labelSpan = document.createElement('span');
  labelSpan.textContent = badgeLabel;
  Object.assign(labelSpan.style, {
    fontSize: '7.5px',
    lineHeight: '1.05',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    textShadow: '0 1px 0 #181420, 1px 0 0 #181420',
  });
  inner.append(iconSpan, labelSpan);
  b.append(inner);
  Object.assign(b.style, {
    width: '68px',
    height: '68px',
    padding: '0',
    border: 'none',
    borderRadius: '0',
    backgroundColor: 'transparent',
    backgroundImage: `url("${actionButtonDataUrl(kind, false)}")`,
    backgroundSize: '68px 68px',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    color: '#f8f8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    touchAction: 'none',
  });
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (menuOpen) {
      applyEquip(menuCursor);
      toggleMenu(false);
      return;
    }
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events may omit capture support.
    }
    buttonHeld[slot] = true;
    pressLatch[slot] = true;
    syncActionCapVisuals();
  });
  const release = (): void => {
    buttonHeld[slot] = false;
    syncActionCapVisuals();
  };
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
  return { button: b, inner, icon: iconSpan };
};

const actionRow = document.createElement('div');
Object.assign(actionRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
});
// Game Boy order: B = Roll on the left, A = Place on the right
const rollHandles = makeVerbBtn(0, 'B', 'B·ROLL');
const placeHandles = makeVerbBtn(1, 'A', 'A·PLACE');
const rollBtn = rollHandles.button;
const rollBtnIcon = rollHandles.icon;
const placeBtn = placeHandles.button;
const placeBtnIcon = placeHandles.icon;
actionRow.append(rollBtn, placeBtn);

rightCluster.append(topRow, actionRow);
controlsEl.append(rightCluster);

// =========================================================================
// Pause subscreen (START): GBC-framed Satchel Subscreen
// =========================================================================
const menuEl = document.createElement('div');
Object.assign(menuEl.style, {
  position: 'absolute',
  inset: '0',
  zIndex: '25',
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px',
  background: 'rgba(12, 14, 18, 0.84)',
  color: '#f8f8f0',
  textAlign: 'center',
});
const menuPanel = document.createElement('div');
Object.assign(menuPanel.style, {
  width: '100%',
  maxWidth: '336px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  padding: '8px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
});
menuEl.append(menuPanel);
stageEl.append(menuEl);

const menuButton = (html: string, active: boolean, equipped = false): HTMLButtonElement => {
  const b = document.createElement('button');
  b.innerHTML = html;
  applyGbcBoxFrame(b, state.zone, active ? 'gold' : equipped ? 'boss' : 'normal');
  Object.assign(b.style, {
    minWidth: '88px',
    padding: '4px 8px',
    color: '#f8f8f0',
    fontSize: '9px',
    lineHeight: '1.25',
    cursor: 'pointer',
  });
  return b;
};

function menuChoices(): Array<BombKind | null> {
  return [...state.unlockedBombs, null];
}

function renderMenu(): void {
  applyGbcBoxFrame(menuPanel, state.zone, 'gold');
  menuPanel.replaceChildren();
  const title = document.createElement('div');
  title.textContent = '★ SPARK SATCHEL ★';
  Object.assign(title.style, {
    fontSize: '11px',
    color: '#f8d858',
    letterSpacing: '0.08em',
  });

  const currentStatus = document.createElement('div');
  currentStatus.innerHTML = state.equipped
    ? `EQUIPPED: ${pxIcon(BOMB_META[state.equipped].sprite, 16)} <span style="color:#f8d858">${BOMB_META[state.equipped].label.toUpperCase()}</span>`
    : 'EQUIPPED: <span style="color:#cbd5c0">NONE</span> (PURE ROLL)';
  Object.assign(currentStatus.style, {
    fontSize: '8.5px',
    lineHeight: '1.3',
    color: '#e2e8f0',
    padding: '3px 8px',
    background: '#101418',
    border: '1px solid #485848',
  });

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
  });
  for (const kind of menuChoices()) {
    const isCursor = kind === menuCursor;
    const isEquipped = kind === state.equipped;
    const tag = isEquipped
      ? '<div style="font-size:7.5px;color:#68d391;margin-top:3px">▸ EQUIPPED</div>'
      : '<div style="font-size:7.5px;color:#98a898;margin-top:3px">&nbsp;</div>';
    const cardHtml = kind
      ? `<div style="line-height:1.1;margin-bottom:3px">${pxIcon(BOMB_META[kind].sprite, 28)}</div>${BOMB_META[kind].label}${tag}`
      : `<div style="height:28px;display:flex;align-items:center;justify-content:center;margin-bottom:3px;font-size:14px;color:#cbd5c0">—</div>None${tag}`;
    const b = menuButton(cardHtml, isCursor, isEquipped);
    b.addEventListener('click', () => {
      applyEquip(kind);
    });
    grid.append(b);
  }

  const hint = document.createElement('div');
  hint.textContent = 'Select bomb for [A] PLACE · [B] ROLL · walk into a bomb to kick it';
  Object.assign(hint.style, {
    fontSize: '8px',
    lineHeight: '1.35',
    color: '#cbd5c0',
  });

  const resume = menuButton('▶ RESUME', false);
  resume.addEventListener('click', () => toggleMenu(false));

  menuPanel.append(title, currentStatus, grid, hint, resume);
}

function applyEquip(kind: BombKind | null): void {
  equipBomb(state, kind);
  menuCursor = state.equipped;
  persistState(state);
  renderMenu();
  syncHud(true);
}

const held = new Set<string>();

// Keyboard: WASD / Arrows move, J / Space = B (Roll), K / E = A (Place),
// Enter / Esc / P = START. In the menu, left/right cycle choices and J / Space / K / E equip.
const B_KEYS = [' ', 'j'];
const A_KEYS = ['k', 'e'];

let prevBVisual = false;
let prevAVisual = false;

function syncActionCapVisuals(): void {
  const bDown = !menuOpen && (buttonHeld[0] || B_KEYS.some((k) => held.has(k)));
  const aDown = !menuOpen && (buttonHeld[1] || A_KEYS.some((k) => held.has(k)));
  if (bDown !== prevBVisual) {
    prevBVisual = bDown;
    rollBtn.style.backgroundImage = `url("${actionButtonDataUrl('B', bDown)}")`;
    rollHandles.inner.style.transform = bDown ? 'translateY(1px)' : 'translateY(-1px)';
  }
  if (aDown !== prevAVisual) {
    prevAVisual = aDown;
    placeBtn.style.backgroundImage = `url("${actionButtonDataUrl('A', aDown)}")`;
    placeHandles.inner.style.transform = aDown ? 'translateY(1px)' : 'translateY(-1px)';
  }
}

function toggleMenu(open = !menuOpen): void {
  menuOpen = open;
  buttonHeld[0] = false;
  buttonHeld[1] = false;
  held.clear();
  syncActionCapVisuals();
  if (open) {
    menuCursor = state.equipped;
    renderMenu();
  }
  menuEl.style.display = open ? 'flex' : 'none';
  startBtn.style.borderColor = open ? '#f8d858' : '#98a898';
}
startBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  toggleMenu();
});

// Long presses on the verb buttons must not open the context menu (Android) or start a
// text selection (iOS), which would steal the touch and leave a button stuck held
for (const type of ['contextmenu', 'selectstart'] as const) {
  window.addEventListener(type, (e) => {
    // ...except in the crash report, which must stay selectable for copying
    if (e.target instanceof Element && e.target.closest('#crash-overlay')) return;
    e.preventDefault();
  });
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'tab') e.preventDefault();
  if (k === 'enter' || k === 'escape' || k === 'p') {
    if (!e.repeat) toggleMenu();
    return;
  }
  if (menuOpen) {
    if (e.repeat) return;
    const choices = menuChoices();
    const idx = Math.max(0, choices.indexOf(menuCursor));
    if (k === 'arrowleft' || k === 'a') {
      menuCursor = choices[(idx - 1 + choices.length) % choices.length] ?? null;
      renderMenu();
    } else if (k === 'arrowright' || k === 'd') {
      menuCursor = choices[(idx + 1) % choices.length] ?? null;
      renderMenu();
    } else if (B_KEYS.includes(k) || A_KEYS.includes(k)) {
      applyEquip(menuCursor);
      toggleMenu(false);
    }
    return;
  }
  if (B_KEYS.includes(k)) pressLatch[0] = true;
  if (A_KEYS.includes(k)) pressLatch[1] = true;
  held.add(k);
  syncActionCapVisuals();
});
window.addEventListener('keyup', (e) => {
  held.delete(e.key.toLowerCase());
  syncActionCapVisuals();
});

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
  const input: Input = {
    dx,
    dy,
    holdB: pressLatch[0] || buttonHeld[0] || B_KEYS.some((k) => held.has(k)),
    holdA: pressLatch[1] || buttonHeld[1] || A_KEYS.some((k) => held.has(k)),
  };
  pressLatch[0] = false;
  pressLatch[1] = false;
  return input;
};

// =========================================================================
// Zone Bezel & Unified GBC Box Skinning + HUD Synchronization
// =========================================================================
let prevSkinnedZone: State['zone'] | null = null;
let prevBannerActive: boolean | null = null;

function syncZoneChrome(force = false): void {
  const bannerActive = Boolean(state.bannerText);
  if (force || state.zone !== prevSkinnedZone) {
    prevSkinnedZone = state.zone;
    const isCrypt = state.zone === 'ice-cave';
    stageEl.style.backgroundColor = isCrypt ? '#121a28' : '#182818';
    stageEl.style.backgroundImage = `url("${bezelTileDataUrl(state.zone, 2)}")`;
    hd.canvas.style.boxShadow = isCrypt
      ? '0 0 0 2px #181420, 0 0 0 4px #4a6a98, 0 0 0 6px #181420, 0 6px 18px rgba(0, 0, 0, 0.75)'
      : '0 0 0 2px #181420, 0 0 0 4px #406838, 0 0 0 6px #181420, 0 6px 18px rgba(0, 0, 0, 0.72)';
    applyGbcBoxFrame(topbarEl, state.zone, 'normal');
    applyGbcBoxFrame(bossBarWrap, state.zone, 'boss');
    applyGbcBoxFrame(settingsModal, state.zone, 'gold');
    controlsEl.style.background = isCrypt ? '#141c2a' : '#182018';
    controlsEl.style.boxShadow = isCrypt ? 'inset 0 2px 0 #3c5478' : 'inset 0 2px 0 #485848';
    prevBannerActive = null;
  }
  if (force || bannerActive !== prevBannerActive) {
    prevBannerActive = bannerActive;
    applyGbcBoxFrame(dialogueStripEl, state.zone, bannerActive ? 'gold' : 'normal');
  }
}

function rebuildRoom(): void {
  syncZoneChrome();
  view.rebuild(world, state);
}

let prevHudSig = '';
let prevRollBusy = false;

function syncRollBtnFeedback(): void {
  const rollBusy = state.rollTimer > 0 || state.rollRecoveryTimer > 0;
  if (rollBusy !== prevRollBusy) {
    prevRollBusy = rollBusy;
    rollBtn.style.opacity = rollBusy ? '0.68' : '1';
  }
}

function syncHud(force = false): void {
  const room = currentRoom(world, state);
  const readyBombs = Math.max(0, state.maxBombs - state.bombs.length);
  const boss = state.enemies.find((e) => e.kind === 'wickgeist' || e.kind === 'cinderhull');
  const sig = [
    state.zone,
    state.rx,
    state.ry,
    state.hp,
    state.maxHp,
    state.heartShards,
    state.smallKeys,
    state.hasBossKey,
    state.equipped ?? 'none',
    state.unlockedBombs.join(','),
    readyBombs,
    state.maxBombs,
    state.cores.join(','),
    state.bannerText ?? '',
    boss ? `${boss.kind}:${boss.hp}:${boss.armored ? 1 : 0}` : '',
    state.visitedRooms.size,
  ].join('|');

  if (!force && sig === prevHudSig) return;
  prevHudSig = sig;
  syncZoneChrome(force);

  // Pixel Hearts + Keys + Cores (zero OS emojis!)
  const totalHearts = Math.floor(state.maxHp / 2);
  const heartImgs: string[] = [];
  for (let i = 0; i < totalHearts; i++) {
    const rem = state.hp - i * 2;
    const hName: ObjSpriteName =
      rem >= 2 ? 'HUD_HEART_FULL' : rem === 1 ? 'HUD_HEART_HALF' : 'HUD_HEART_EMPTY';
    heartImgs.push(pxIcon(hName, 14));
  }
  const extras: string[] = [];
  if (state.heartShards % 2 === 1) extras.push(`${pxIcon('HUD_SHARD', 13)}½`);
  if (state.smallKeys > 0) extras.push(`${pxIcon('HUD_KEY', 13)}×${state.smallKeys}`);
  if (state.hasBossKey) extras.push(pxIcon('HUD_BOSS_KEY', 14));
  if (state.cores.includes('cinder')) extras.push(`${pxIcon('PICKUP_CINDER_CORE', 14)}`);
  heartsRow.innerHTML = `<span style="display:inline-flex;gap:2px;align-items:center">${heartImgs.join('')}</span>${extras.length ? `<span style="display:inline-flex;gap:5px;align-items:center;margin-left:4px;font-size:9.5px">${extras.join('')}</span>` : ''}`;

  // Non-truncated room name + full objective (wraps cleanly across 2 pixel lines, zero `...`)
  const zonePrefix = state.zone === 'ice-cave' ? 'Ice Cave' : 'Cinderholm';
  const obj = room?.objective ? ` · ${room.objective}` : '';
  roomMetaRow.textContent = `${zonePrefix}: ${room?.name ?? ''}${obj}`;

  // Auto-drawn minimap (`GAME.md` §5)
  minimapEl.replaceChildren();
  const cols = state.zone === 'ice-cave' ? 3 : 4;
  const rows = state.zone === 'ice-cave' ? 4 : 6;
  const minX = state.zone === 'ice-cave' ? 0 : 2;
  minimapEl.style.gridTemplateColumns = `repeat(${cols}, 7px)`;
  for (let my = 0; my < rows; my++) {
    for (let mx = minX; mx < minX + cols; mx++) {
      const rk = roomKey(state.zone, mx, my);
      const exists = world.rooms.has(rk);
      const visited = state.visitedRooms.has(rk);
      const isCur = state.rx === mx && state.ry === my;
      const cell = document.createElement('div');
      Object.assign(cell.style, {
        width: '7px',
        height: '7px',
        borderRadius: '0',
        background: isCur
          ? '#f8d848'
          : visited
            ? state.zone === 'ice-cave'
              ? '#a078e8'
              : '#60c878'
            : exists
              ? '#283428'
              : 'transparent',
      });
      minimapEl.append(cell);
    }
  }

  // Satchel pips & fixed-verb sprites on B = Roll and A = Place
  satchelPips.textContent =
    '●'.repeat(readyBombs) + '○'.repeat(Math.max(0, state.maxBombs - readyBombs));
  rollBtnIcon.innerHTML = pxIcon(ROLL_ICON, 24);
  placeBtnIcon.innerHTML = state.equipped
    ? pxIcon(BOMB_META[state.equipped].sprite, 24)
    : '<span style="font-size:14px;opacity:0.75">—</span>';
  placeBtn.style.opacity = state.equipped ? '1' : '0.76';

  // Boss HP bar
  if (boss) {
    bossBarWrap.style.display = 'flex';
    const bName = boss.kind === 'wickgeist' ? 'ICE WRAITH · BOSS' : 'ICE GOLEM · MINIBOSS';
    const shieldTag = boss.armored
      ? boss.kind === 'cinderhull'
        ? 'ICE ARMOUR (USE FIRE!)'
        : 'IN DARK (LIGHT BRAZIER!)'
      : 'EXPOSED!';
    bossTitleEl.innerHTML = `<span>${bName}</span><span>${shieldTag}</span>`;
    bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  } else {
    bossBarWrap.style.display = 'none';
  }

  // Fixed-height Bezel Dialogue Strip (never covers playfield & never resizes `#stage`!)
  dialogueContent.replaceChildren();
  if (state.bannerText) {
    dialogueContent.style.color = '#f8f8f0';
    const arrow = document.createElement('span');
    arrow.textContent = '▸ ';
    arrow.style.color = '#f8d848';
    dialogueContent.append(arrow, document.createTextNode(state.bannerText));
  } else {
    dialogueContent.style.color = state.zone === 'ice-cave' ? '#b0c8e0' : '#98b098';
    const line1 = document.createElement('div');
    line1.textContent = `▸ ${room?.objective ?? 'Explore Cinderholm Isle'}`;
    const line2 = document.createElement('div');
    line2.style.color = state.zone === 'ice-cave' ? '#7890b0' : '#789078';
    line2.style.marginTop = '2px';
    line2.textContent = '[B] ROLL · [A] PLACE · [START] SATCHEL';
    dialogueContent.append(line1, line2);
  }

  // Re-check stage size in case topbar wrapped to 1 vs 2 lines
  resize();
}

// Initial room build, layout & HUD render
rebuildRoom();
resize();
syncHud(true);

const REBUILD_EVENTS = new Set([
  'tile-break',
  'tile-burn',
  'crystal-flip',
  'door-unlock',
  'room-solved',
  'player-respawn',
  'core-slotted',
]);

const MAX_FRAME_STEPS = 6;

let last = performance.now();
let renderTime = 0;
let accumulator = 0;
let cutting = false;

const frame = (now: number): void => {
  requestAnimationFrame(frame);
  (window as Window & { __microbomberBooted?: boolean }).__microbomberBooted = true;
  const elapsed = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  renderTime = now / 1000;

  state.events = [];
  state.blasts = [];

  if (!cutting && !menuOpen) {
    accumulator += elapsed;
    const frameEvents: string[] = [];
    const frameBlasts: BlastVisual[] = [];
    let moved = false;
    let needsRebuild = false;
    let gotPickup = false;
    const fromZone = state.zone;
    const fromRx = state.rx;
    const fromRy = state.ry;

    for (let step = 0; step < MAX_FRAME_STEPS && accumulator >= FIXED_DT; step++) {
      accumulator -= FIXED_DT;
      moved = tick(world, state, readInput(), FIXED_DT);
      for (const ev of state.events) {
        sfx.play(ev);
        frameEvents.push(ev);
        if (REBUILD_EVENTS.has(ev)) needsRebuild = true;
        if (ev.startsWith('pickup-') || ev === 'room-solved') gotPickup = true;
      }
      if (moved) {
        accumulator = 0;
        frameBlasts.length = 0;
        break;
      }
      for (const bl of state.blasts) {
        frameBlasts.push(bl);
      }
    }
    if (accumulator >= FIXED_DT) {
      accumulator = 0;
    }

    state.events = frameEvents;
    state.blasts = frameBlasts;

    const slideDx = state.rx - fromRx;
    const slideDy = state.ry - fromRy;
    const slides =
      state.zone === fromZone &&
      Math.abs(slideDx) + Math.abs(slideDy) === 1 &&
      !state.events.includes('player-respawn');

    if (moved && slides) {
      // Walking off an edge: the old room slides out as the next one slides in
      persistState(state);
      hd.beginRoomSlide(slideDx, slideDy, renderTime);
      rebuildRoom();
      syncHud(true);
      cutting = true;
      window.setTimeout(() => {
        cutting = false;
      }, SLIDE_SECONDS * 1000);
    } else if (moved) {
      persistState(state);
      cutting = true;
      fade.style.opacity = '1';
      window.setTimeout(() => {
        rebuildRoom();
        syncHud(true);
        fade.style.opacity = '0';
        cutting = false;
      }, 85);
    } else {
      if (needsRebuild) rebuildRoom();
      if (gotPickup) persistState(state);
    }
  } else {
    accumulator = 0;
  }

  syncHud();
  syncRollBtnFeedback();
  syncActionCapVisuals();
  view.sync(world, state, renderTime);
  hd.render(world, state, renderTime, elapsed);
};
requestAnimationFrame(frame);
