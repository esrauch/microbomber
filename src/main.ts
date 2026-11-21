/**
 * microbomber: Vertical Slice entry point (`GAME.md`).
 * Portrait layout: Top Status + Minimap -> 2D GBC Sprite Stage -> Dedicated Control Band.
 */
import buildInfo from 'virtual:build-info';
import type { BombKind } from './game/types';
import {
  type Input,
  type State,
  campaignWorld,
  currentRoom,
  equipItem,
  exportSave,
  importSave,
  newState,
  roomKey,
  showBanner,
  tick,
} from './game/world';
import { makeGbcView } from './render/gbc';
import { mountJoystick } from './ui/joystick';
import { makeSfx } from './ui/sfx';

const SAVE_KEY = 'microbomber.save.v1';

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

function loadInitialState(): State {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const restored = importSave(world, JSON.parse(raw));
      if (restored) return restored;
    }
  } catch {
    // Ignore malformed or unavailable storage.
  }
  const fresh = newState(world);
  showBanner(
    fresh,
    'The Ironblight Spire rusted every blade on Cinderholm! Walk to Bram or drop a bomb (💣) on cracked stone.',
    5.5,
  );
  return fresh;
}

function persistState(s: State): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(exportSave(s)));
  } catch {
    // Ignore storage quota errors.
  }
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
gearBtn.textContent = '⚙️';
gearBtn.title = 'Settings & Reset';
Object.assign(gearBtn.style, {
  width: '30px',
  height: '30px',
  borderRadius: '8px',
  border: '1px solid #425244',
  background: '#253026',
  color: '#f4eedc',
  fontSize: '15px',
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
  } catch {
    // ignore
  }
  state = newState(world);
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
  borderRadius: '8px',
  background: 'rgba(20, 16, 26, 0.85)',
  border: '1px solid #7c2d12',
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
  borderRadius: '999px',
  background: '#2d2438',
  overflow: 'hidden',
});
const bossFill = document.createElement('div');
Object.assign(bossFill.style, {
  height: '100%',
  width: '100%',
  background: 'linear-gradient(90deg, #e53e3e, #f97316)',
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
  borderRadius: '10px',
  background: 'rgba(20, 25, 21, 0.92)',
  border: '1.5px solid #d69e2e',
  color: '#fefcbf',
  fontSize: '12.5px',
  fontWeight: '600',
  lineHeight: '1.35',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
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
// Dedicated Control Band (`GAME.md` §2): Joystick, START, and item buttons B and A
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

const BOMB_META: Record<BombKind, { icon: string; label: string }> = {
  powder: { icon: '💣', label: 'Blackpowder' },
  ember: { icon: '🔥', label: 'Ember' },
};

/** Item buttons held right now: `[B, A]`. Tap drops, hold lifts, release throws. */
const buttonHeld: [boolean, boolean] = [false, false];

let menuOpen = false;
let menuCursor: BombKind | null = null;

const makeItemBtn = (slot: 0 | 1, letter: 'B' | 'A'): HTMLButtonElement => {
  const b = document.createElement('button');
  b.innerHTML = `<span style="font-size:24px;line-height:1"></span><span style="font-size:12px;font-weight:800;letter-spacing:0.05em">${letter}</span>`;
  Object.assign(b.style, {
    width: '74px',
    height: '74px',
    borderRadius: '50%',
    border: '3px solid #f6e05e',
    background: 'rgba(45, 38, 24, 0.85)',
    color: '#fff9eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.45)',
    cursor: 'pointer',
    touchAction: 'none',
  });
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (menuOpen) {
      // In the pause menu, B and A equip the highlighted item, as on the GBC subscreen
      equipCursor(slot);
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
  return b;
};

const actionRow = document.createElement('div');
Object.assign(actionRow.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
});
// Game Boy order: B on the left, A on the right
const itemBtns: [HTMLButtonElement, HTMLButtonElement] = [makeItemBtn(0, 'B'), makeItemBtn(1, 'A')];
actionRow.append(...itemBtns);

rightCluster.append(topRow, actionRow);
controls.append(rightCluster);

// =========================================================================
// Pause subscreen (START): pick an item, then press B or A to equip it
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

const menuButton = (html: string, active: boolean): HTMLButtonElement => {
  const b = document.createElement('button');
  b.innerHTML = html;
  Object.assign(b.style, {
    minWidth: '96px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: `3px solid ${active ? '#f6e05e' : '#4a5568'}`,
    background: active ? 'rgba(66, 52, 28, 0.92)' : '#1e2620',
    color: '#f4eedc',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  });
  return b;
};

function renderMenu(): void {
  menuEl.replaceChildren();
  const title = document.createElement('div');
  title.textContent = 'ITEMS';
  Object.assign(title.style, { fontSize: '18px', fontWeight: '900', letterSpacing: '0.2em' });

  const slotsRow = document.createElement('div');
  Object.assign(slotsRow.style, { display: 'flex', gap: '12px' });
  (['B', 'A'] as const).forEach((letter, i) => {
    const slot = i === 0 ? 0 : 1;
    const kind = state.slots[slot];
    const label = kind ? `${BOMB_META[kind].icon} ${BOMB_META[kind].label}` : '—';
    const b = menuButton(`<div style="font-size:11px;opacity:0.7">${letter}</div>${label}`, false);
    b.addEventListener('click', () => equipCursor(slot));
    slotsRow.append(b);
  });

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px',
  });
  for (const kind of state.unlockedBombs) {
    const b = menuButton(
      `<div style="font-size:26px;line-height:1.1">${BOMB_META[kind].icon}</div>${BOMB_META[kind].label}`,
      kind === menuCursor,
    );
    b.addEventListener('click', () => {
      menuCursor = kind;
      renderMenu();
    });
    grid.append(b);
  }

  const hint = document.createElement('div');
  hint.textContent = 'Pick an item, then press B or A to equip it.';
  Object.assign(hint.style, { fontSize: '12px', color: '#cbd5c0' });

  const resume = menuButton('▶ Resume', false);
  resume.addEventListener('click', () => toggleMenu(false));

  menuEl.append(title, slotsRow, grid, hint, resume);
}

function equipCursor(slot: 0 | 1): void {
  if (!menuCursor) return;
  equipItem(state, slot, menuCursor);
  persistState(state);
  renderMenu();
  syncHud(true);
}

function toggleMenu(open = !menuOpen): void {
  menuOpen = open;
  buttonHeld[0] = false;
  buttonHeld[1] = false;
  if (open) {
    menuCursor = state.slots[0] ?? state.unlockedBombs[0] ?? null;
    renderMenu();
  }
  menuEl.style.display = open ? 'flex' : 'none';
  startBtn.style.borderColor = open ? '#f6e05e' : '#4a5568';
}
startBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  toggleMenu();
});

// Keyboard: WASD / Arrows move, J / Space = B, K / E = A (hold to lift, release to throw),
// Enter / Esc / P = START. In the menu, left/right pick an item and J / K equip it.
const held = new Set<string>();
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
    const list = state.unlockedBombs;
    const idx = menuCursor ? list.indexOf(menuCursor) : -1;
    if (k === 'arrowleft' || k === 'a') menuCursor = list[Math.max(0, idx - 1)] ?? null;
    if (k === 'arrowright' || k === 'd')
      menuCursor = list[Math.min(list.length - 1, idx + 1)] ?? null;
    if (B_KEYS.includes(k)) equipCursor(0);
    else if (A_KEYS.includes(k)) equipCursor(1);
    else renderMenu();
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
    state.slots.join(','),
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

  // Hearts + Keys + Cores
  const totalHearts = Math.floor(state.maxHp / 2);
  let heartsHtml = '';
  for (let i = 0; i < totalHearts; i++) {
    const rem = state.hp - i * 2;
    heartsHtml += rem >= 2 ? '❤️' : rem === 1 ? '💔' : '🖤';
  }
  const extras: string[] = [];
  if (state.heartShards % 2 === 1) extras.push('🩷½');
  if (state.smallKeys > 0) extras.push(`🗝️×${state.smallKeys}`);
  if (state.hasBossKey) extras.push('🗝️★');
  if (state.cores.includes('cinder')) extras.push('🔥Core');
  heartsRow.textContent = extras.length ? `${heartsHtml}  ${extras.join(' ')}` : heartsHtml;

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

  // Satchel pips & the items on B and A
  satchelPips.textContent =
    '●'.repeat(readyBombs) + '○'.repeat(Math.max(0, state.maxBombs - readyBombs));
  state.slots.forEach((kind, i) => {
    const icon = itemBtns[i]?.querySelector('span');
    if (icon) icon.textContent = kind ? BOMB_META[kind].icon : '·';
  });

  // Boss HP bar
  if (boss) {
    bossBarWrap.style.display = 'flex';
    const bName = boss.kind === 'cinderhull' ? 'CINDERHULL · Shrine Boss' : 'WICKGEIST · Phantom';
    const shieldTag = boss.armored
      ? boss.kind === 'cinderhull'
        ? '🌿 Thorn Armor (Use Ember!)'
        : '🌑 In Shadow (Light Brazier!)'
      : '✨ Exposed!';
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

let last = performance.now();
let cutting = false;

const frame = (now: number): void => {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (!cutting && !menuOpen) {
    const moved = tick(world, state, readInput(), dt);
    for (const ev of state.events) {
      sfx.play(ev);
    }
    const needsRebuild = state.events.some((ev) => REBUILD_EVENTS.has(ev));
    const gotPickup = state.events.some((ev) => ev.startsWith('pickup-') || ev === 'room-solved');

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
  }

  syncHud();
  view.sync(world, state, now / 1000);
};
requestAnimationFrame(frame);
