/**
 * microbomber: Vertical Slice entry point (`GAME.md`).
 * Portrait layout: Top Status + Minimap -> 2D GBC Sprite Stage -> Dedicated Control Band.
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
import { mountJoystick } from './ui/joystick';
import { makeSfx } from './ui/sfx';

const SAVE_KEY = 'microbomber.save.v3';
const LEGACY_SAVE_KEY = 'microbomber.save.v2';
const ROLL_ICON = 'HUD_ROLL' as ObjSpriteName;
const INTRO_BANNER =
  'The Ironblight Spire rusted every blade on Cinderholm! Talk to Bram, press B to Roll, or tap/hold A behind the smithy.';

function pxIcon(name: ObjSpriteName, size: number): string {
  if (!(name in OBJ)) {
    return `<span style="display:inline-flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;font-weight:900">↷</span>`;
  }
  return `<img src="${hudIconDataUrl(name, 3)}" width="${size}" height="${size}" style="image-rendering:pixelated;display:inline-block;vertical-align:middle" alt="" />`;
}

const topbar = document.querySelector<HTMLElement>('#topbar');
const stage = document.querySelector<HTMLElement>('#stage');
const canvas = document.querySelector<HTMLCanvasElement>('#game');
const controls = document.querySelector<HTMLElement>('#controls');
if (!topbar || !stage || !canvas || !controls) {
  throw new Error('index.html is missing required shell elements');
}
const stageEl = stage;
const canvasEl = canvas;

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

const view = makeGbcView(canvasEl);

function rebuildRoom(): void {
  stageEl.style.background = state.zone === 'ember-crypt' ? '#110d18' : '#101611';
  canvasEl.style.borderColor = state.zone === 'ember-crypt' ? '#443658' : '#2d3d30';
  view.rebuild(world, state);
}

const resize = (): void => {
  const w = stageEl.clientWidth || 360;
  const h = stageEl.clientHeight || 480;
  view.resize(w, h);
};
window.addEventListener('resize', resize);

// =========================================================================
// Top HUD: Hearts, Keys, Room Title/Objective, Auto-Drawn Minimap, Settings
// =========================================================================
const statusLeft = document.createElement('div');
Object.assign(statusLeft.style, {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  minWidth: '0',
});

const heartsRow = document.createElement('div');
Object.assign(heartsRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '15px',
  fontWeight: '800',
  lineHeight: '1.1',
});

const roomMetaRow = document.createElement('div');
Object.assign(roomMetaRow.style, {
  fontSize: '11.5px',
  color: '#cbd5c0',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
statusLeft.append(heartsRow, roomMetaRow);

const statusRight = document.createElement('div');
Object.assign(statusRight.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: '0',
});

const minimapEl = document.createElement('div');
Object.assign(minimapEl.style, {
  display: 'grid',
  gap: '2px',
  padding: '3px',
  background: '#111612',
  border: '1px solid #38463a',
  borderRadius: '6px',
});

const gearBtn = document.createElement('button');
gearBtn.innerHTML = pxIcon('HUD_GEAR', 18);
gearBtn.title = 'Settings & Reset';
Object.assign(gearBtn.style, {
  width: '30px',
  height: '30px',
  borderRadius: '4px',
  border: '2px solid #4a5d4c',
  background: '#222b24',
  color: '#f4eedc',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: '0',
});
statusRight.append(minimapEl, gearBtn);
topbar.append(statusLeft, statusRight);

// Settings popover
const settingsModal = document.createElement('div');
Object.assign(settingsModal.style, {
  position: 'absolute',
  top: '8px',
  right: '8px',
  zIndex: '30',
  display: 'none',
  flexDirection: 'column',
  gap: '8px',
  padding: '12px',
  borderRadius: '10px',
  background: 'rgba(22, 28, 23, 0.96)',
  border: '1.5px solid #556957',
  boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
  fontSize: '13px',
  minWidth: '190px',
});
const muteBtn = document.createElement('button');
const resetSaveBtn = document.createElement('button');
for (const btn of [muteBtn, resetSaveBtn]) {
  Object.assign(btn.style, {
    padding: '7px 10px',
    borderRadius: '7px',
    border: '1px solid #4a5d4c',
    background: '#2a362b',
    color: '#f4eedc',
    fontWeight: '700',
    fontSize: '12.5px',
    cursor: 'pointer',
    textAlign: 'left',
  });
}

muteBtn.textContent = '🔊 Sound: On';
muteBtn.addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  muteBtn.textContent = sfx.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
});
const RESET_LABEL = '↺ New Game (Reset Save)';
resetSaveBtn.textContent = RESET_LABEL;
// Two-tap confirm: the first tap arms the button, a second tap within 3 s erases the save
let resetArmedUntil = 0;
resetSaveBtn.addEventListener('click', () => {
  const now = performance.now();
  if (now > resetArmedUntil) {
    resetArmedUntil = now + 3000;
    resetSaveBtn.textContent = '⚠ Tap again to erase your save';
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
  fontSize: '11px',
  color: '#9aa899',
  borderTop: '1px solid #334034',
  paddingTop: '6px',
});
buildStamp.textContent = `microbomber · ${buildInfo.commit}${buildInfo.dirty ? '+' : ''}`;
settingsModal.append(muteBtn, resetSaveBtn, buildStamp);
stageEl.append(settingsModal);

gearBtn.addEventListener('click', () => {
  settingsModal.style.display = settingsModal.style.display === 'none' ? 'flex' : 'none';
});

// =========================================================================
// Stage Overlays: Boss HP Bar, Storybook Banner, Flip-Screen Fade
// =========================================================================
const bossBarWrap = document.createElement('div');
Object.assign(bossBarWrap.style, {
  position: 'absolute',
  top: '8px',
  left: '12px',
  right: '12px',
  display: 'none',
  flexDirection: 'column',
  gap: '3px',
  padding: '5px 9px',
  borderRadius: '3px',
  background: '#181020',
  border: '2px solid #e89840',
  boxShadow: 'inset 0 0 0 2px #100c18, 0 4px 12px rgba(0,0,0,0.6)',
  pointerEvents: 'none',
  zIndex: '10',
});
const bossTitleEl = document.createElement('div');
Object.assign(bossTitleEl.style, {
  fontSize: '11.5px',
  fontWeight: '800',
  color: '#fbd38d',
  display: 'flex',
  justifyContent: 'space-between',
});
const bossTrack = document.createElement('div');
Object.assign(bossTrack.style, {
  height: '7px',
  borderRadius: '2px',
  background: '#2d2438',
  border: '1px solid #100c18',
  overflow: 'hidden',
});
const bossFill = document.createElement('div');
Object.assign(bossFill.style, {
  height: '100%',
  width: '100%',
  background: 'linear-gradient(90deg, #e03028, #f88820)',
  transition: 'width 0.12s ease',
});
bossTrack.append(bossFill);
bossBarWrap.append(bossTitleEl, bossTrack);
stage.append(bossBarWrap);

const bannerEl = document.createElement('div');
Object.assign(bannerEl.style, {
  position: 'absolute',
  left: '10px',
  right: '10px',
  bottom: '10px',
  padding: '8px 12px',
  borderRadius: '3px',
  background: '#141820',
  border: '2px solid #f8d848',
  boxShadow: 'inset 0 0 0 2px #2c3848, 0 4px 14px rgba(0, 0, 0, 0.65)',
  color: '#f8f8f0',
  fontSize: '12.5px',
  fontWeight: '700',
  lineHeight: '1.35',
  pointerEvents: 'none',
  display: 'none',
  zIndex: '12',
});
stage.append(bannerEl);

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
stage.append(fade);

// =========================================================================
// Dedicated Control Band (`GAME.md` §2): Joystick, START, B = Roll, A = Pull out
// =========================================================================
const joystick = mountJoystick(controls);

const rightCluster = document.createElement('div');
Object.assign(rightCluster.style, {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '8px',
});

const topRow = document.createElement('div');
Object.assign(topRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

const satchelPips = document.createElement('div');
Object.assign(satchelPips.style, {
  fontSize: '11.5px',
  fontWeight: '800',
  color: '#cbd5c0',
  letterSpacing: '2px',
});

const startBtn = document.createElement('button');
startBtn.textContent = 'START';
Object.assign(startBtn.style, {
  height: '26px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '2px solid #4a5568',
  background: '#1e2620',
  color: '#e2e8f0',
  fontSize: '11px',
  fontWeight: '800',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  touchAction: 'none',
});
topRow.append(satchelPips, startBtn);

const BOMB_META: Record<BombKind, { sprite: ObjSpriteName; label: string }> = {
  powder: { sprite: 'POWDER_1', label: 'Blackpowder' },
  ember: { sprite: 'EMBER_1', label: 'Ember' },
};

/** Fixed-verb buttons held right now: `[holdB (Roll), holdA (Pull out)]`. */
const buttonHeld: [boolean, boolean] = [false, false];

let menuOpen = false;
let menuCursor: BombKind | null = null;

const makeVerbBtn = (
  slot: 0 | 1,
  badgeLabel: string,
  borderCol: string,
  bgCol: string,
  extraShadow = '',
): [HTMLButtonElement, HTMLSpanElement] => {
  const b = document.createElement('button');
  const iconSpan = document.createElement('span');
  Object.assign(iconSpan.style, {
    height: '26px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
  });
  const labelSpan = document.createElement('span');
  labelSpan.textContent = badgeLabel;
  Object.assign(labelSpan.style, {
    fontSize: '9.5px',
    fontWeight: '800',
    lineHeight: '1.05',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  });
  b.append(iconSpan, labelSpan);
  Object.assign(b.style, {
    width: '74px',
    height: '74px',
    padding: '0 2px',
    borderRadius: '50%',
    border: `3px solid ${borderCol}`,
    background: bgCol,
    color: '#fff9eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    boxShadow: `${extraShadow ? `${extraShadow}, ` : ''}0 4px 10px rgba(0, 0, 0, 0.45)`,
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
  });
  const release = (): void => {
    buttonHeld[slot] = false;
  };
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
  return [b, iconSpan];
};

const actionRow = document.createElement('div');
Object.assign(actionRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
});
// Game Boy order: B = Roll on the left, A = Pull out on the right
const [rollBtn, rollBtnIcon] = makeVerbBtn(
  0,
  'B · Roll',
  '#4fd1c5',
  'rgba(20, 42, 44, 0.88)',
  'inset 0 0 0 1.5px rgba(246, 224, 94, 0.42)',
);
const [pullBtn, pullBtnIcon] = makeVerbBtn(1, 'A · Pull out', '#f6e05e', 'rgba(45, 38, 24, 0.88)');
actionRow.append(rollBtn, pullBtn);

rightCluster.append(topRow, actionRow);
controls.append(rightCluster);

// =========================================================================
// Pause subscreen (START): pick the equipped bomb or None; game pauses
// =========================================================================
const menuEl = document.createElement('div');
Object.assign(menuEl.style, {
  position: 'absolute',
  inset: '0',
  zIndex: '25',
  display: 'none',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '14px',
  padding: '16px',
  background: 'rgba(14, 18, 15, 0.94)',
  color: '#f4eedc',
  textAlign: 'center',
});
stage.append(menuEl);

const menuButton = (html: string, active: boolean, equipped = false): HTMLButtonElement => {
  const b = document.createElement('button');
  b.innerHTML = html;
  const borderCol = active ? '#f6e05e' : equipped ? '#4fd1c5' : '#4a5568';
  Object.assign(b.style, {
    minWidth: '96px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: `3px solid ${borderCol}`,
    background: active ? 'rgba(66, 52, 28, 0.92)' : '#1e2620',
    color: '#f4eedc',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  });
  return b;
};

function menuChoices(): Array<BombKind | null> {
  return [...state.unlockedBombs, null];
}

function renderMenu(): void {
  menuEl.replaceChildren();
  const title = document.createElement('div');
  title.textContent = 'EQUIP BOMB';
  Object.assign(title.style, { fontSize: '18px', fontWeight: '900', letterSpacing: '0.18em' });

  const currentStatus = document.createElement('div');
  currentStatus.innerHTML = state.equipped
    ? `Equipped: ${pxIcon(BOMB_META[state.equipped].sprite, 18)} <strong>${BOMB_META[state.equipped].label}</strong>`
    : 'Equipped: <strong>None</strong> (Pure Roll)';
  Object.assign(currentStatus.style, {
    fontSize: '12.5px',
    color: '#e2e8f0',
    padding: '5px 12px',
    borderRadius: '999px',
    background: '#1a221c',
    border: '1px solid #38463a',
  });

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px',
  });
  for (const kind of menuChoices()) {
    const isCursor = kind === menuCursor;
    const isEquipped = kind === state.equipped;
    const tag = isEquipped
      ? '<div style="font-size:10px;color:#68d391;margin-top:3px;letter-spacing:0.06em">EQUIPPED</div>'
      : '<div style="font-size:10px;color:#9aa899;margin-top:3px">&nbsp;</div>';
    const cardHtml = kind
      ? `<div style="line-height:1.1;margin-bottom:4px">${pxIcon(BOMB_META[kind].sprite, 32)}</div>${BOMB_META[kind].label}${tag}`
      : `<div style="height:32px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;font-size:22px;font-weight:900;color:#cbd5c0">—</div>None${tag}`;
    const b = menuButton(cardHtml, isCursor, isEquipped);
    b.addEventListener('click', () => {
      applyEquip(kind);
    });
    grid.append(b);
  }

  const hint = document.createElement('div');
  hint.textContent = 'Tap a bomb (or None for pure dodge rolls) · B = Roll · A = Pull out';
  Object.assign(hint.style, { fontSize: '12px', color: '#cbd5c0' });

  const resume = menuButton('▶ Resume', false);
  resume.addEventListener('click', () => toggleMenu(false));

  menuEl.append(title, currentStatus, grid, hint, resume);
}

function applyEquip(kind: BombKind | null): void {
  equipBomb(state, kind);
  menuCursor = state.equipped;
  persistState(state);
  renderMenu();
  syncHud(true);
}

const held = new Set<string>();

function toggleMenu(open = !menuOpen): void {
  menuOpen = open;
  buttonHeld[0] = false;
  buttonHeld[1] = false;
  held.clear();
  if (open) {
    menuCursor = state.equipped;
    renderMenu();
  }
  menuEl.style.display = open ? 'flex' : 'none';
  startBtn.style.borderColor = open ? '#f6e05e' : '#4a5568';
}
startBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  toggleMenu();
});

// Long presses on the verb buttons must not open the context menu (Android) or start a
// text selection (iOS), which would steal the touch and leave a button stuck held
for (const type of ['contextmenu', 'selectstart'] as const) {
  window.addEventListener(type, (e) => e.preventDefault());
}

// Keyboard: WASD / Arrows move, J / Space = B (Roll), K / E = A (Pull out),
// Enter / Esc / P = START. In the menu, left/right cycle choices and J / Space / K / E equip.
const B_KEYS = [' ', 'j'];
const A_KEYS = ['k', 'e'];
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
  held.add(k);
});
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

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
  return {
    dx,
    dy,
    holdB: buttonHeld[0] || B_KEYS.some((k) => held.has(k)),
    holdA: buttonHeld[1] || A_KEYS.some((k) => held.has(k)),
  };
};

// =========================================================================
// HUD Synchronization (diffed so DOM only updates when values change)
// =========================================================================
let prevHudSig = '';
let prevRollBusy = false;

function syncRollBtnFeedback(): void {
  const rollBusy = state.rollTimer > 0 || state.rollRecoveryTimer > 0;
  if (rollBusy !== prevRollBusy) {
    prevRollBusy = rollBusy;
    rollBtn.style.opacity = rollBusy ? '0.62' : '1';
    rollBtn.style.borderColor = rollBusy ? '#2c7a7b' : '#4fd1c5';
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

  // Pixel Hearts + Keys + Cores (zero OS emojis!)
  const totalHearts = Math.floor(state.maxHp / 2);
  const heartImgs: string[] = [];
  for (let i = 0; i < totalHearts; i++) {
    const rem = state.hp - i * 2;
    const hName: ObjSpriteName =
      rem >= 2 ? 'HUD_HEART_FULL' : rem === 1 ? 'HUD_HEART_HALF' : 'HUD_HEART_EMPTY';
    heartImgs.push(pxIcon(hName, 15));
  }
  const extras: string[] = [];
  if (state.heartShards % 2 === 1) extras.push(`${pxIcon('HUD_SHARD', 14)}½`);
  if (state.smallKeys > 0) extras.push(`${pxIcon('HUD_KEY', 14)}×${state.smallKeys}`);
  if (state.hasBossKey) extras.push(pxIcon('HUD_BOSS_KEY', 15));
  if (state.cores.includes('cinder')) extras.push(`${pxIcon('PICKUP_CINDER_CORE', 15)}`);
  heartsRow.innerHTML = `<span style="display:inline-flex;gap:2px;align-items:center">${heartImgs.join('')}</span>${extras.length ? `<span style="display:inline-flex;gap:6px;align-items:center;margin-left:6px;font-size:13px">${extras.join('')}</span>` : ''}`;

  const zonePrefix = state.zone === 'ember-crypt' ? 'Ember Crypt' : 'Cinderholm';
  const obj = room?.objective ? ` · ${room.objective}` : '';
  roomMetaRow.textContent = `${zonePrefix}: ${room?.name ?? ''}${obj}`;

  // Auto-drawn minimap (`GAME.md` §5)
  minimapEl.replaceChildren();
  const cols = state.zone === 'ember-crypt' ? 3 : 4;
  const rows = state.zone === 'ember-crypt' ? 4 : 6;
  const minX = state.zone === 'ember-crypt' ? 0 : 2;
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
        borderRadius: '1.5px',
        background: isCur
          ? '#fbbf24'
          : visited
            ? state.zone === 'ember-crypt'
              ? '#9f7aea'
              : '#68d391'
            : exists
              ? '#273129'
              : 'transparent',
      });
      minimapEl.append(cell);
    }
  }

  // Satchel pips & fixed-verb sprites on B = Roll and A = Pull out
  satchelPips.textContent =
    '●'.repeat(readyBombs) + '○'.repeat(Math.max(0, state.maxBombs - readyBombs));
  rollBtnIcon.innerHTML = pxIcon(ROLL_ICON, 26);
  pullBtnIcon.innerHTML = state.equipped
    ? pxIcon(BOMB_META[state.equipped].sprite, 26)
    : '<span style="font-size:18px;font-weight:900;opacity:0.75">—</span>';
  pullBtn.style.borderColor = state.equipped ? '#f6e05e' : '#718096';

  // Boss HP bar
  if (boss) {
    bossBarWrap.style.display = 'flex';
    const bName = boss.kind === 'cinderhull' ? 'CINDERHULL · Shrine Boss' : 'WICKGEIST · Phantom';
    const shieldTag = boss.armored
      ? boss.kind === 'cinderhull'
        ? 'Thorn Armor (Use Ember!)'
        : 'In Shadow (Light Brazier!)'
      : 'Exposed!';
    bossTitleEl.innerHTML = `<span>${bName}</span><span>${shieldTag}</span>`;
    bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  } else {
    bossBarWrap.style.display = 'none';
  }

  // Storybook Banner
  if (state.bannerText) {
    bannerEl.style.display = 'block';
    bannerEl.textContent = state.bannerText;
  } else {
    bannerEl.style.display = 'none';
  }
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
let accumulator = 0;
let cutting = false;

const frame = (now: number): void => {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;

  state.events = [];
  state.blasts = [];

  if (!cutting && !menuOpen) {
    accumulator += elapsed;
    const frameEvents: string[] = [];
    const frameBlasts: BlastVisual[] = [];
    let moved = false;
    let needsRebuild = false;
    let gotPickup = false;

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

    if (moved) {
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
  view.sync(world, state, now / 1000);
};
requestAnimationFrame(frame);
