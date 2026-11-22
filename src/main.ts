/**
 * microbomber: Vertical Slice entry point (`GAME.md`, `ROADMAP.md` §6.1–6.2).
 * Portrait layout:
 *   `#topbar` (GBC HUD + Minimap) -> `#stage` (Zone Bezel + Integer Playfield)
 *   -> `#dialogue-strip` (Fixed GBC Dialogue / Prompt Box) -> `#controls` (Pixel Stick + B/A).
 */
import buildInfo from 'virtual:build-info';
import type { BlastVisual, BombKind } from './game/types';
import { DUNGEON_999_ENTRIES } from './game/dungeon999';
import {
  FIXED_DT,
  HEART_PIECES_PER_HEART,
  type Input,
  type State,
  campaignWorld,
  currentRoom,
  cycleEquippedBomb,
  enterDungeon999,
  enterRoom,
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
import type { ObjPaletteId } from './render/gbcPalette';
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
  'Grandma: Your brother raised that Iron Tower overnight, making trouble again! Take the NE stairs down to the basement for the Magic Bomb Sack!';

function pxIcon(name: ObjSpriteName, size: number, pal?: ObjPaletteId): string {
  if (!(name in OBJ)) {
    return `<span style="display:inline-flex;width:${size}px;height:${size}px;align-items:center;justify-content:center">↷</span>`;
  }
  return `<img src="${hudIconDataUrl(name, 3, pal)}" width="${size}" height="${size}" style="image-rendering:pixelated;display:inline-block;vertical-align:middle" alt="" />`;
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

// The campaign as it was when the player entered Dungeon 999 (a save JSON string), restored
// on the way out. The rig's own state is never saved, so it can't leak bombs into a campaign.
let campaignStash: string | null = null;

function persistState(s: State): void {
  if (s.zone === 'dungeon-999') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(exportSave(s)));
  } catch {
    // Ignore storage quota errors.
  }
}

function loadInitialState(): State {
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dev') === '999'
  ) {
    try {
      campaignStash = localStorage.getItem(SAVE_KEY);
    } catch {
      campaignStash = null;
    }
    const devState = newState(world);
    enterDungeon999(world, devState);
    // ?room=999:<x>,<y> starts in one test room
    const room = /^999:(-?\d+),(-?\d+)$/.exec(
      new URLSearchParams(window.location.search).get('room') ?? '',
    );
    const arrival = room && DUNGEON_999_ENTRIES.get(`${room[1]},${room[2]}`);
    if (room && arrival) {
      enterRoom(world, devState, 'dungeon-999', Number(room[1]), Number(room[2]), ...arrival);
    }
    return devState;
  }
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
let impactFxEnabled = !(
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);

const muteBtn = document.createElement('button');
const impactBtn = document.createElement('button');
const devRigBtn = document.createElement('button');
const resetSaveBtn = document.createElement('button');
for (const btn of [muteBtn, impactBtn, devRigBtn, resetSaveBtn]) {
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
const syncImpactBtnLabel = (): void => {
  impactBtn.textContent = impactFxEnabled ? '✦ IMPACT FX: ON' : '✦ IMPACT FX: OFF';
};
syncImpactBtnLabel();
impactBtn.addEventListener('click', () => {
  impactFxEnabled = !impactFxEnabled;
  if (!impactFxEnabled) hd.canvas.style.transform = '';
  syncImpactBtnLabel();
});
devRigBtn.textContent = '⚙ ENTER DUNGEON 999 (DEV RIG)';
const warpToDungeon999 = (): void => {
  if (state.zone !== 'dungeon-999') campaignStash = JSON.stringify(exportSave(state));
  enterDungeon999(world, state);
  if (menuOpen) toggleMenu(false);
  rebuildRoom();
  settingsModal.style.display = 'none';
  syncHud(true);
};
devRigBtn.addEventListener('click', warpToDungeon999);
if (!new URLSearchParams(window.location.search).has('dev')) devRigBtn.style.display = 'none';

/** Leaving Dungeon 999 restores the campaign exactly as it was on the way in. */
function leaveDungeon999(): State {
  try {
    const raw = campaignStash ?? localStorage.getItem(SAVE_KEY);
    const restored = raw ? importSave(world, JSON.parse(raw)) : null;
    if (restored && restored.zone !== 'dungeon-999') return restored;
  } catch {
    // Fall through to a new game
  }
  return newState(world);
}
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
  cursor: 'pointer',
});
buildStamp.textContent = `microbomber · ${buildInfo.commit}${buildInfo.dirty ? '+' : ''}`;
let stampTapCount = 0;
let stampTapUntil = 0;
buildStamp.addEventListener('click', () => {
  const now = performance.now();
  if (now > stampTapUntil) stampTapCount = 0;
  stampTapUntil = now + 2500;
  stampTapCount++;
  if (stampTapCount >= 5) {
    // Five taps reveal (or hide) the dev-rig button; players never see it otherwise
    stampTapCount = 0;
    devRigBtn.style.display = devRigBtn.style.display === 'none' ? 'inline-flex' : 'none';
  }
});
settingsModal.append(muteBtn, impactBtn, devRigBtn, resetSaveBtn, buildStamp);
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

// Compact non-intrusive Dev Telemetry Strip shown at top of #stage in Dungeon 999
const devTelemetryEl = document.createElement('div');
Object.assign(devTelemetryEl.style, {
  position: 'absolute',
  top: '4px',
  left: '6px',
  right: '6px',
  display: 'none',
  padding: '2px 6px',
  background: 'rgba(14, 20, 34, 0.86)',
  border: '1px solid #6888b0',
  boxShadow: '0 2px 6px rgba(0,0,0,0.65)',
  color: '#d8e8f8',
  fontFamily: `'${PIXEL_FONT_FAMILY}', monospace`,
  fontSize: '7.5px',
  lineHeight: '1.25',
  letterSpacing: '0.02em',
  pointerEvents: 'none',
  zIndex: '12',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
stageEl.append(devTelemetryEl);

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

const swapBtn = document.createElement('button');
swapBtn.title = 'Quick-Swap Bomb [Q / Tab]';
Object.assign(swapBtn.style, {
  height: '24px',
  padding: '0 7px',
  borderRadius: '0',
  border: '2px solid #d8b868',
  boxShadow: '0 0 0 1px #181420, inset 0 -2px 0 #584424',
  background: '#282218',
  color: '#f8f8f0',
  fontFamily: `'${PIXEL_FONT_FAMILY}', monospace`,
  fontSize: '8px',
  letterSpacing: '0.04em',
  display: 'none',
  alignItems: 'center',
  gap: '4px',
  cursor: 'pointer',
  touchAction: 'none',
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
topRow.append(satchelPips, swapBtn, startBtn);

const BOMB_META: Record<BombKind, { sprite: ObjSpriteName; pal?: ObjPaletteId; label: string }> = {
  bomb: { sprite: 'BOMB_1', pal: 'powder', label: 'Bomb' },
  fire: { sprite: 'FIREBOMB_1', pal: 'fire', label: 'Fire' },
  squeak: { sprite: 'BOMB_1', pal: 'villager', label: 'Squeak' },
  wind: { sprite: 'BOMB_1', pal: 'spectral', label: 'Wind' },
  magnet: { sprite: 'BOMB_1', pal: 'crimson', label: 'Magnet' },
  ice: { sprite: 'FIREBOMB_1', pal: 'spectral', label: 'Ice' },
  rock: { sprite: 'BOMB_1', pal: 'green', label: 'Rock' },
};

function bombIcon(kind: BombKind, size: number): string {
  const m = BOMB_META[kind];
  return pxIcon(m.sprite, size, m.pal);
}

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
  label: HTMLSpanElement;
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
  return { button: b, inner, icon: iconSpan, label: labelSpan };
};

const actionRow = document.createElement('div');
Object.assign(actionRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
});
// Game Boy order: B = Roll (or Drop when holding) on the left, A = Pull (or Throw when holding) on the right
const rollHandles = makeVerbBtn(0, 'B', 'B·ROLL');
const placeHandles = makeVerbBtn(1, 'A', 'A·PULL');
const rollBtn = rollHandles.button;
const rollBtnIcon = rollHandles.icon;
const rollBtnLabel = rollHandles.label;
const placeBtn = placeHandles.button;
const placeBtnIcon = placeHandles.icon;
const placeBtnLabel = placeHandles.label;
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
  title.textContent = '★ MAGIC BOMB SACK ★';
  Object.assign(title.style, {
    fontSize: '11px',
    color: '#f8d858',
    letterSpacing: '0.08em',
  });

  const currentStatus = document.createElement('div');
  currentStatus.innerHTML = state.equipped
    ? `EQUIPPED: ${bombIcon(state.equipped, 16)} <span style="color:#f8d858">${BOMB_META[state.equipped].label.toUpperCase()}</span>`
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
      ? `<div style="line-height:1.1;margin-bottom:3px">${bombIcon(kind, 28)}</div>${BOMB_META[kind].label}${tag}`
      : `<div style="height:28px;display:flex;align-items:center;justify-content:center;margin-bottom:3px;font-size:14px;color:#cbd5c0">—</div>None${tag}`;
    const b = menuButton(cardHtml, isCursor, isEquipped);
    b.addEventListener('click', () => {
      applyEquip(kind);
    });
    grid.append(b);
  }

  const hint = document.createElement('div');
  hint.textContent = 'Select bomb for [A] PULL · while overhead: [B] DROP · [A] THROW';
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
function pulseHaptics(pattern: number | number[]): void {
  if (!impactFxEnabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore restricted/unsupported vibration contexts.
  }
}

function quickSwapBomb(): void {
  if (menuOpen || state.unlockedBombs.length === 0) return;
  const before = state.equipped;
  const next = cycleEquippedBomb(state);
  if (next !== before) {
    sfx.play('bomb-swap');
    pulseHaptics(8);
    persistState(state);
    syncHud(true);
  } else if (next !== null) {
    sfx.play('bomb-swap');
  }
}

swapBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  quickSwapBomb();
});

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
  if (k === 'q' || k === 'tab') {
    if (!e.repeat) quickSwapBomb();
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
    const isCrypt = state.zone === 'ice-cave' || state.zone === 'dungeon-999';
    const isBasement = state.zone === 'basement';
    stageEl.style.backgroundColor = isCrypt ? '#121a28' : isBasement ? '#221812' : '#182818';
    stageEl.style.backgroundImage = `url("${bezelTileDataUrl(state.zone, 2)}")`;
    hd.canvas.style.boxShadow = isCrypt
      ? '0 0 0 2px #181420, 0 0 0 4px #4a6a98, 0 0 0 6px #181420, 0 6px 18px rgba(0, 0, 0, 0.75)'
      : isBasement
        ? '0 0 0 2px #181420, 0 0 0 4px #88603c, 0 0 0 6px #181420, 0 6px 18px rgba(0, 0, 0, 0.75)'
        : '0 0 0 2px #181420, 0 0 0 4px #406838, 0 0 0 6px #181420, 0 6px 18px rgba(0, 0, 0, 0.72)';
    applyGbcBoxFrame(topbarEl, state.zone, 'normal');
    applyGbcBoxFrame(bossBarWrap, state.zone, 'boss');
    applyGbcBoxFrame(settingsModal, state.zone, 'gold');
    controlsEl.style.background = isCrypt ? '#141c2a' : isBasement ? '#201814' : '#182018';
    controlsEl.style.boxShadow = isCrypt
      ? 'inset 0 2px 0 #3c5478'
      : isBasement
        ? 'inset 0 2px 0 #684c34'
        : 'inset 0 2px 0 #485848';
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
  const rollBusy = state.heldBomb === null && (state.rollTimer > 0 || state.rollRecoveryTimer > 0);
  if (rollBusy !== prevRollBusy) {
    prevRollBusy = rollBusy;
    rollBtn.style.opacity = rollBusy ? '0.68' : '1';
  }
}

function syncHud(force = false): void {
  const room = currentRoom(world, state);
  const readyBombs = Math.max(0, state.maxBombs - state.bombs.length - (state.heldBomb ? 1 : 0));
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
    state.heldBomb ?? 'none',
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
      rem >= 1.75
        ? 'HUD_HEART_FULL'
        : rem >= 1.25
          ? 'HUD_HEART_THREE_QUARTER'
          : rem >= 0.75
            ? 'HUD_HEART_HALF'
            : rem >= 0.25
              ? 'HUD_HEART_QUARTER'
              : 'HUD_HEART_EMPTY';
    heartImgs.push(pxIcon(hName, 14));
  }
  const extras: string[] = [];
  const heartPieces = state.heartShards % HEART_PIECES_PER_HEART;
  if (heartPieces > 0)
    extras.push(`${pxIcon('HUD_SHARD', 13)}${heartPieces}/${HEART_PIECES_PER_HEART}`);
  if (state.smallKeys > 0) extras.push(`${pxIcon('HUD_KEY', 13)}×${state.smallKeys}`);
  if (state.hasBossKey) extras.push(pxIcon('HUD_BOSS_KEY', 14));
  if (state.cores.includes('cinder')) extras.push(`${pxIcon('PICKUP_CINDER_CORE', 14)}`);
  heartsRow.innerHTML = `<span style="display:inline-flex;gap:2px;align-items:center">${heartImgs.join('')}</span>${extras.length ? `<span style="display:inline-flex;gap:5px;align-items:center;margin-left:4px;font-size:9.5px">${extras.join('')}</span>` : ''}`;

  // Non-truncated room name + full objective (wraps cleanly across 2 pixel lines, zero `...`)
  const zonePrefix =
    state.zone === 'dungeon-999'
      ? 'Dungeon 999'
      : state.zone === 'ice-cave'
        ? 'Ice Cave'
        : state.zone === 'basement'
          ? 'Mouse House'
          : 'Cinderholm';
  const obj = room?.objective ? ` · ${room.objective}` : '';
  roomMetaRow.textContent = `${zonePrefix}: ${room?.name ?? ''}${obj}`;

  // Auto-drawn minimap (`GAME.md` §5)
  minimapEl.replaceChildren();
  const cols =
    state.zone === 'dungeon-999'
      ? 5
      : state.zone === 'ice-cave'
        ? 3
        : state.zone === 'basement'
          ? 2
          : 4;
  const rows =
    state.zone === 'dungeon-999'
      ? 3
      : state.zone === 'ice-cave'
        ? 4
        : state.zone === 'basement'
          ? 4
          : 6;
  const minX = state.zone === 'overworld' ? 2 : 0;
  const minY = state.zone === 'dungeon-999' ? -1 : 0;
  minimapEl.style.gridTemplateColumns = `repeat(${cols}, 7px)`;
  for (let my = minY; my < minY + rows; my++) {
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
            ? state.zone === 'dungeon-999'
              ? '#68b8f8'
              : state.zone === 'ice-cave'
                ? '#a078e8'
                : state.zone === 'basement'
                  ? '#d89858'
                  : '#60c878'
            : exists
              ? '#283428'
              : 'transparent',
      });
      minimapEl.append(cell);
    }
  }

  // Satchel pips, fast bomb-swap pill & two-state verb sprites on B (Roll / Drop) and A (Pull / Throw)
  satchelPips.textContent =
    state.unlockedBombs.length > 0
      ? '●'.repeat(readyBombs) + '○'.repeat(Math.max(0, state.maxBombs - readyBombs))
      : '';
  const activeSwapKind = state.equipped ?? state.unlockedBombs[0];
  if (state.unlockedBombs.length >= 2 && activeSwapKind) {
    swapBtn.style.display = 'inline-flex';
    swapBtn.innerHTML = `${bombIcon(activeSwapKind, 14)}<span>${BOMB_META[activeSwapKind].label.toUpperCase()} ↻</span>`;
  } else {
    swapBtn.style.display = 'none';
  }
  if (state.heldBomb) {
    rollBtnIcon.innerHTML = bombIcon(state.heldBomb, 24);
    rollBtnLabel.textContent = 'B·DROP';
    placeBtnIcon.innerHTML = bombIcon(state.heldBomb, 24);
    placeBtnLabel.textContent = 'A·THROW';
    placeBtn.style.opacity = '1';
  } else {
    rollBtnIcon.innerHTML = pxIcon(ROLL_ICON, 24);
    rollBtnLabel.textContent = 'B·ROLL';
    placeBtnIcon.innerHTML = state.equipped
      ? bombIcon(state.equipped, 24)
      : '<span style="font-size:14px;opacity:0.75">—</span>';
    placeBtnLabel.textContent = 'A·PULL';
    placeBtn.style.opacity = state.equipped ? '1' : '0.52';
  }

  // Boss HP bar
  if (boss) {
    bossBarWrap.style.display = 'flex';
    const bName =
      boss.kind === 'wickgeist'
        ? 'ICE WRAITH · BOSS'
        : boss.fleeOnDefeat
          ? 'ICE GOLEM · PHASE 1'
          : 'ICE GOLEM · PHASE 2';
    const shieldTag = boss.armored
      ? boss.kind === 'cinderhull'
        ? 'ICE ARMOUR (USE FIRE!)'
        : 'IN DARK (LIGHT BRAZIER!)'
      : boss.fleeOnDefeat
        ? 'FROST CRUST (USE BOMBS!)'
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
    dialogueContent.style.color =
      state.zone === 'ice-cave' || state.zone === 'dungeon-999'
        ? '#b0c8e0'
        : state.zone === 'basement'
          ? '#e0c8a8'
          : '#98b098';
    const line1 = document.createElement('div');
    line1.textContent = `▸ ${room?.objective ?? 'Explore Cinderholm Isle'}`;
    const line2 = document.createElement('div');
    line2.style.color =
      state.zone === 'ice-cave' || state.zone === 'dungeon-999'
        ? '#7890b0'
        : state.zone === 'basement'
          ? '#a88c6c'
          : '#789078';
    line2.style.marginTop = '2px';
    line2.textContent =
      state.unlockedBombs.length === 0
        ? '[B] ROLL · WALK NEAR GRANDMA TO TALK'
        : state.unlockedBombs.length >= 2
          ? state.heldBomb
            ? '[B] DROP · [A] THROW · [Q/TAP] SWAP'
            : '[B] ROLL · [A] PULL · [Q/TAP] SWAP'
          : state.heldBomb
            ? '[B] DROP · [A] THROW · [START] SATCHEL'
            : '[B] ROLL · [A] PULL · [START] SATCHEL';
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
  'gate-open',
  'gate-close',
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
let hitStopRemaining = 0;
let shakeRemaining = 0;
let shakeDuration = 0.14;
let shakeAmplitude = 0;
let shakeSeed = 0;

function triggerShake(amplitudePx: number, durationSec: number): void {
  if (!impactFxEnabled) return;
  if (amplitudePx >= shakeAmplitude || shakeRemaining <= 0) {
    shakeAmplitude = amplitudePx;
    shakeDuration = Math.max(0.05, durationSec);
  }
  shakeRemaining = Math.max(shakeRemaining, durationSec);
}

function triggerHitStop(seconds: number): void {
  if (!impactFxEnabled) return;
  hitStopRemaining = Math.max(hitStopRemaining, seconds);
}

let prevTelemX = state.x;
let prevTelemY = state.y;
let prevTelemText = '';

function syncDevTelemetry(dt: number): void {
  if (state.zone !== 'dungeon-999') {
    if (devTelemetryEl.style.display !== 'none') {
      devTelemetryEl.style.display = 'none';
      prevTelemText = '';
    }
    prevTelemX = state.x;
    prevTelemY = state.y;
    return;
  }
  devTelemetryEl.style.display = 'block';
  const rawSpd = dt > 0.001 ? Math.hypot(state.x - prevTelemX, state.y - prevTelemY) / dt : 0;
  const spd = rawSpd > 25 ? 0 : rawSpd;
  prevTelemX = state.x;
  prevTelemY = state.y;

  const eq = (state.equipped ?? 'none').toUpperCase();
  const crys = state.crystalColor.toUpperCase();
  const b0 = state.bombs[0];
  const bombExtra = b0
    ? ` · B(${b0.x.toFixed(1)},${b0.y.toFixed(1)} v=${Math.hypot(b0.vx, b0.vy).toFixed(1)} f=${b0.fuse.toFixed(1)}s)`
    : '';
  const text = `POS (${state.x.toFixed(1)},${state.y.toFixed(1)}) · SPD ${spd.toFixed(1)} · BOMBS ${state.bombs.length}/${state.maxBombs} · ${eq} · ${crys}${bombExtra}`;
  if (text !== prevTelemText) {
    prevTelemText = text;
    devTelemetryEl.textContent = text;
  }
}

function applyImpactFeedback(ev: string): void {
  if (
    ev === 'boom-bomb' ||
    ev === 'boom-fire' ||
    ev === 'boom-wind' ||
    ev === 'boom-magnet' ||
    ev === 'boom-ice' ||
    ev === 'boom-rock'
  ) {
    triggerShake(2.5, 0.14);
    triggerHitStop(0.024);
    pulseHaptics(14);
  } else if (ev === 'player-hurt' || ev === 'armor-burn') {
    triggerShake(3.5, 0.18);
    triggerHitStop(0.04);
    pulseHaptics([16, 22, 24]);
  } else if (ev === 'boss-flee' || ev === 'ice-storm') {
    triggerShake(4.5, 0.26);
    triggerHitStop(0.055);
    pulseHaptics([22, 28, 34]);
  } else if (ev === 'enemy-defeat') {
    triggerShake(2.0, 0.1);
    triggerHitStop(0.032);
    pulseHaptics(10);
  } else if (ev === 'enemy-hit') {
    const hasBoss = state.enemies.some((e) => e.kind === 'cinderhull' || e.kind === 'wickgeist');
    if (hasBoss) {
      triggerShake(2.5, 0.12);
      triggerHitStop(0.032);
      pulseHaptics(12);
    }
  } else if (ev === 'room-solved') {
    const cond = currentRoom(world, state)?.condition;
    if (cond === 'miniboss' || cond === 'boss') {
      triggerShake(5.0, 0.3);
      triggerHitStop(0.055);
      pulseHaptics([25, 30, 40]);
    }
  }
}

const frame = (now: number): void => {
  requestAnimationFrame(frame);
  (window as Window & { __microbomberBooted?: boolean }).__microbomberBooted = true;
  const elapsed = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  renderTime = now / 1000;

  state.events = [];
  state.blasts = [];

  if (!cutting && !menuOpen) {
    let simElapsed = elapsed;
    if (hitStopRemaining > 0) {
      const absorbed = Math.min(simElapsed, hitStopRemaining);
      hitStopRemaining -= absorbed;
      simElapsed -= absorbed;
    }
    accumulator += simElapsed;
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
        applyImpactFeedback(ev);
        frameEvents.push(ev);
        if (REBUILD_EVENTS.has(ev)) needsRebuild = true;
        if (ev.startsWith('pickup-') || ev === 'room-solved' || ev === 'boss-flee') {
          gotPickup = true;
        }
      }
      if (moved) {
        accumulator = 0;
        hitStopRemaining = 0;
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
    if (moved && fromZone === 'dungeon-999' && state.zone !== 'dungeon-999') {
      state = leaveDungeon999();
      campaignStash = null;
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
    hitStopRemaining = 0;
  }

  if (shakeRemaining > 0 && !cutting && !menuOpen && impactFxEnabled) {
    shakeRemaining = Math.max(0, shakeRemaining - elapsed);
    if (shakeRemaining > 0) {
      shakeSeed = (shakeSeed + 1) % 1024;
      const decay = shakeRemaining / shakeDuration;
      const mag = shakeAmplitude * decay;
      const sx = Math.round(Math.sin(shakeSeed * 2.39996) * mag);
      const sy = Math.round(Math.cos(shakeSeed * 1.75487) * mag);
      hd.canvas.style.transform = sx === 0 && sy === 0 ? '' : `translate(${sx}px, ${sy}px)`;
    } else {
      hd.canvas.style.transform = '';
    }
  } else if (hd.canvas.style.transform !== '') {
    shakeRemaining = 0;
    hd.canvas.style.transform = '';
  }

  syncHud();
  syncDevTelemetry(elapsed);
  syncRollBtnFeedback();
  syncActionCapVisuals();
  view.sync(world, state, renderTime);
  hd.render(world, state, renderTime, elapsed);
};
requestAnimationFrame(frame);
