/**
 * Standalone Abstracted Puzzle Lab — Interactive Browser SVG Step-Player & Critic Workbench (`Phase 4`).
 *
 * Driven directly by `puzzle-lab.html` (`http://localhost:5178/puzzle-lab.html`). Zero imports from
 * `src/**` so abstracted puzzles can be played, stepped backward/forward, tweaked live, and
 * Critic-certified in milliseconds before any 60 Hz backport.
 */
import { type RoomEvaluationReport } from './critic';
import { labLedgeDrops, labLevelAt, liquidKindAt } from './elevation';
import { composeEntangledRooms } from './generate';
import { applyLabAction, cloneLabState, createLabState, effectiveTileAt } from './sim';
import { type CuratedPuzzleEntry, certifySuiteEntry, getCuratedPuzzleSuite } from './suite';
import { DIRS, type Dir, type LabBombKind, type LabRoomSpec, type LabState } from './types';

const CELL = 22;

const entries: CuratedPuzzleEntry[] = [...getCuratedPuzzleSuite()];
let currentIdx = 0;
let activeRoom: LabRoomSpec = entries[0]?.room ?? {
  id: 'empty',
  name: 'Empty',
  width: 22,
  height: 26,
  kit: [],
  entry: [10, 12],
  condition: 'hold-buttons',
  rows: Array.from({ length: 26 }, () => '#'.repeat(22)),
};
let history: LabState[] = [createLabState(activeRoom)];
let selectedBomb: LabBombKind | null = activeRoom.kit[0] ?? null;
let lastReport: RoomEvaluationReport | null = null;
let composeSeed = 20261123;
let witnessTimer: number | null = null;

function curState(): LabState {
  return history[history.length - 1] ?? createLabState(activeRoom);
}

function stopWitnessPlayback(): void {
  if (witnessTimer !== null) {
    window.clearInterval(witnessTimer);
    witnessTimer = null;
  }
}

function selectEntry(idx: number): void {
  stopWitnessPlayback();
  const item = entries[idx];
  if (!item) return;
  currentIdx = idx;
  activeRoom = item.room;
  history = [createLabState(activeRoom)];
  selectedBomb = activeRoom.kit[0] ?? null;
  lastReport = null;
  const editor = document.getElementById('rows-editor') as HTMLTextAreaElement | null;
  if (editor) editor.value = activeRoom.rows.join('\n');
  renderAll();
}

function tileColor(room: LabRoomSpec, s: LabState, x: number, y: number): string {
  const key = `${x},${y}`;
  const t = effectiveTileAt(room, s, x, y);
  const liq = liquidKindAt(room, s, x, y);
  if (t === '#') return '#1e2530';
  if (t === '%') return '#5c4433';
  if (t === 'B') return '#6ec8f5';
  if (s.frozenWater.has(key) || s.frostCells.has(key) || s.frozenVeils.has(key)) return '#8fe3ff';
  if (liq === 'deep') return '#164b7a';
  if (liq === 'shallow') return '#256d85';
  if (t === '^') return '#07090d';
  if (t === '!') return '#4a1e26';
  if (t === '=') return '#3f4b5b';
  if (t === ',') return '#5f6f2c';
  const lvl = labLevelAt(room, s, x, y) ?? 0;
  return lvl === 2 ? '#434c5e' : lvl === 1 ? '#343c4a' : '#282f3a';
}

function renderBoardSvg(room: LabRoomSpec, s: LabState): string {
  const w = room.width * CELL;
  const h = room.height * CELL;
  const parts: string[] = [
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`,
  ];

  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const px = x * CELL;
      const py = y * CELL;
      const key = `${x},${y}`;
      const t = effectiveTileAt(room, s, x, y);
      const fill = tileColor(room, s, x, y);
      parts.push(
        `<rect x="${px}" y="${py}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="#141922" stroke-width="0.6"/>`,
      );

      const drops = labLedgeDrops(room, s, x, y);
      if (drops) {
        parts.push(
          `<rect x="${px + 1}" y="${py + CELL - 4}" width="${CELL - 2}" height="3" fill="#11161d" opacity="0.85"/>`,
        );
      }

      const sw = room.switches?.find((item) => item.x === x && item.y === y);
      const glyph =
        t === 'O' || sw?.kind === 'O'
          ? 'O'
          : t === 'Q' || sw?.kind === 'Q'
            ? 'Q'
            : t === 'C'
              ? 'C'
              : t === 'W'
                ? 'W'
                : t === 'N'
                  ? 'N'
                  : t === 'G' || t === 'R' || t === 'U' || t === 'X'
                    ? t
                    : t === 'g' || t === 'm' || t === 't' || t === '|' || t === 'J' || t === 'L'
                      ? t
                      : t === 'n' || t === 's' || t === 'e' || t === 'w'
                        ? t
                        : t === '!'
                          ? '▲'
                          : '';
      if (glyph) {
        const gColor =
          glyph === 'O'
            ? '#f2cc60'
            : glyph === 'Q'
              ? '#ffa657'
              : glyph === 'C'
                ? s.crystalColor === 'red'
                  ? '#ff7b72'
                  : '#58a6ff'
                : '#d0d7de';
        parts.push(
          `<text x="${px + CELL / 2}" y="${py + CELL / 2 + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${gColor}">${glyph}</text>`,
        );
      }

      if (s.rockCell && s.rockCell[0] === x && s.rockCell[1] === y) {
        parts.push(
          `<rect x="${px + 3}" y="${py + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="4" fill="#8b949e" stroke="#f0f6fc" stroke-width="1"/>`,
        );
      }
      if (s.burningCells.has(key)) {
        parts.push(
          `<circle cx="${px + CELL / 2}" cy="${py + CELL / 2}" r="6" fill="#ff7b72" opacity="0.85"/>`,
        );
      }
    }
  }

  // Turntables
  for (const tt of room.turntables ?? []) {
    const span = tt.size * CELL;
    const x0 = (tt.cx - (tt.size === 3 ? 1 : 0)) * CELL;
    const y0 = (tt.cy - (tt.size === 3 ? 1 : 0)) * CELL;
    parts.push(
      `<rect x="${x0 + 1}" y="${y0 + 1}" width="${span - 2}" height="${span - 2}" fill="none" stroke="#d29922" stroke-dasharray="3 2" stroke-width="1.4"/>`,
    );
  }

  // Laser rays, emitters, and sensors
  for (const ray of s.lastLaserRays) {
    const cx = ray.x * CELL + CELL / 2;
    const cy = ray.y * CELL + CELL / 2;
    const horiz = ray.dir === 'E' || ray.dir === 'W';
    parts.push(
      horiz
        ? `<line x1="${ray.x * CELL}" y1="${cy}" x2="${(ray.x + 1) * CELL}" y2="${cy}" stroke="#ff5555" stroke-width="3" opacity="0.9"/>`
        : `<line x1="${cx}" y1="${ray.y * CELL}" x2="${cx}" y2="${(ray.y + 1) * CELL}" stroke="#ff5555" stroke-width="3" opacity="0.9"/>`,
    );
  }
  for (const ls of room.lasers ?? []) {
    parts.push(
      `<rect x="${ls.x * CELL + 3}" y="${ls.y * CELL + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="3" fill="#b62324" stroke="#ffa198"/>`,
    );
  }
  for (const sn of room.sensors ?? []) {
    const lit = s.activeSensors.has(sn.id);
    parts.push(
      `<circle cx="${sn.x * CELL + CELL / 2}" cy="${sn.y * CELL + CELL / 2}" r="7" fill="${lit ? '#3fb950' : '#30363d'}" stroke="#f0f6fc" stroke-width="1.2"/>`,
    );
  }
  for (const fn of room.fans ?? []) {
    parts.push(
      `<rect x="${fn.x * CELL + 3}" y="${fn.y * CELL + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="3" fill="#1f6feb" stroke="#79c0ff"/>`,
    );
  }

  // Braziers
  for (const br of s.braziers) {
    parts.push(
      `<circle cx="${br.x * CELL + CELL / 2}" cy="${br.y * CELL + CELL / 2}" r="7" fill="${br.lit ? '#ff9933' : '#484f58'}" stroke="#e6edf3" stroke-width="1"/>`,
    );
  }

  // Props
  for (const p of s.props) {
    if (p.submerged) continue;
    const px = p.x * CELL;
    const py = p.y * CELL;
    const fill =
      p.kind === 'crate'
        ? p.burnTicks > 0
          ? '#f85149'
          : '#b87a3d'
        : p.kind === 'raft'
          ? '#8a5a2b'
          : p.kind === 'mirror'
            ? '#79c0ff'
            : p.kind === 'metal'
              ? '#6e7681'
              : '#8b949e';
    const stroke = p.frosted ? '#a5f3fc' : '#f0f6fc';
    parts.push(
      `<rect x="${px + 3}" y="${py + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${p.frosted ? 2.2 : 1}"/>`,
    );
    const label =
      p.kind === 'mirror' ? (p.facing ?? 'M') : p.kind === 'raft' ? 'R' : p.kind[0]?.toUpperCase();
    parts.push(
      `<text x="${px + CELL / 2}" y="${py + CELL / 2 + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#0d1117">${label ?? ''}</text>`,
    );
  }

  // Creatures & Mine Carts
  for (const c of s.creatures) {
    const cx = c.x * CELL + CELL / 2;
    const cy = c.y * CELL + CELL / 2;
    if (c.kind === 'cart') {
      const px = c.x * CELL;
      const py = c.y * CELL;
      parts.push(
        `<rect x="${px + 2}" y="${py + 3}" width="${CELL - 4}" height="${CELL - 6}" rx="3" fill="#d29922" stroke="#f0f6fc" stroke-width="1.3"/>`,
        `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#0d1117">M${c.dir}</text>`,
      );
      continue;
    }
    const fill = c.frozenTicks > 0 ? '#7dd3fc' : '#d2a8ff';
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="7.5" fill="${fill}" stroke="#0d1117" stroke-width="1.2"/>`,
      `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#0d1117">${c.kind[0]?.toUpperCase() ?? 'C'}</text>`,
    );
  }

  // Bombs
  for (const b of s.bombs) {
    const cx = b.x * CELL + CELL / 2;
    const cy = b.y * CELL + CELL / 2;
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="6.5" fill="#f0883e" stroke="#fff" stroke-width="1"/>`,
      `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#0d1117">${b.fuse}</text>`,
    );
  }

  // Pip
  const pipX = s.pip.x * CELL + CELL / 2;
  const pipY = s.pip.y * CELL + CELL / 2;
  const pipFill = s.pip.icedTicks > 0 ? '#67e8f9' : s.roomSolved ? '#3fb950' : '#f778ba';
  const [fdx, fdy] =
    s.pip.dir === 'N' ? [0, -1] : s.pip.dir === 'S' ? [0, 1] : s.pip.dir === 'E' ? [1, 0] : [-1, 0];
  // Dashed highlight on the tile Pip is facing (where a dropped bomb lands).
  const aheadX = (s.pip.x + fdx) * CELL;
  const aheadY = (s.pip.y + fdy) * CELL;
  parts.push(
    `<rect x="${aheadX + 2}" y="${aheadY + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="3" fill="rgba(255,214,10,0.12)" stroke="#ffd60a" stroke-width="1.6" stroke-dasharray="3 2"/>`,
  );
  const tipX = pipX + fdx * 15;
  const tipY = pipY + fdy * 15;
  const baseX = pipX + fdx * 7;
  const baseY = pipY + fdy * 7;
  parts.push(
    `<circle cx="${pipX}" cy="${pipY}" r="8" fill="${pipFill}" stroke="#ffffff" stroke-width="1.6"/>`,
    `<polygon points="${tipX},${tipY} ${baseX - fdy * 6},${baseY + fdx * 6} ${baseX + fdy * 6},${baseY - fdx * 6}" fill="#ffd60a" stroke="#0d1117" stroke-width="1"/>`,
    `<text x="${pipX}" y="${pipY + 3.5}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#0d1117">${s.pip.dir}</text>`,
  );

  parts.push('</svg>');
  return parts.join('');
}

function renderRoomList(): void {
  const listEl = document.getElementById('room-list');
  if (!listEl) return;
  listEl.innerHTML = entries
    .map((e, i) => {
      const sel = i === currentIdx ? 'selected' : '';
      const sub = e.triad
        ? `${e.triad} · Act ${e.act ?? 1}`
        : `Kit: ${e.room.kit.join(', ') || 'none'}`;
      return `<button class="room-item ${sel}" data-idx="${i}">
        <span><b>${e.room.name}</b></span>
        <span class="room-sub">${sub}</span>
      </button>`;
    })
    .join('');

  listEl.querySelectorAll<HTMLButtonElement>('button.room-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset['idx'] ?? '0');
      selectEntry(idx);
    });
  });
}

function renderKitBar(): void {
  const bar = document.getElementById('kit-bar');
  if (!bar) return;
  if (activeRoom.kit.length === 0) {
    bar.innerHTML = '<span class="badge">Kit: Empty-Handed</span>';
    return;
  }
  bar.innerHTML = activeRoom.kit
    .map((b, i) => {
      const cls = b === selectedBomb ? 'active-kit' : '';
      return `<button class="${cls}" data-bomb="${b}">[${i + 1}] ${b.toUpperCase()}</button>`;
    })
    .join('');
  bar.querySelectorAll<HTMLButtonElement>('button[data-bomb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedBomb = (btn.dataset['bomb'] as LabBombKind | undefined) ?? null;
      renderKitBar();
    });
  });
}

function renderMetaAndTelemetry(): void {
  const s = curState();
  const entry = entries[currentIdx];
  const metaEl = document.getElementById('room-meta');
  if (metaEl) {
    metaEl.innerHTML = `
      <div><b>${activeRoom.name}</b> ${s.roomSolved ? '<span class="badge good">SOLVED</span>' : ''}</div>
      <div style="margin-top:4px;color:var(--muted)">${entry?.designNote ?? 'Custom / Tweaked 22×26 room'}</div>
      <div style="margin-top:6px">
        <span class="badge">Cond: ${activeRoom.condition}</span>
        <span class="badge">Kit: ${activeRoom.kit.join(', ') || 'none'}</span>
      </div>
    `;
  }

  const telEl = document.getElementById('state-telemetry');
  if (telEl) {
    telEl.innerHTML = `
      <div><b>Tick:</b> ${s.tick} · <b>History:</b> ${history.length} states · <b>Last:</b> ${lastActionLabel}</div>
      <div><b>Pip:</b> (${s.pip.x},${s.pip.y}) facing ${s.pip.dir} ${s.pip.icedTicks > 0 ? `· Ice-Pip(${s.pip.icedTicks})` : ''}</div>
      <div><b>Crystal:</b> ${s.crystalColor} · <b>Polarity:</b> ${s.polarity} · <b>Water:</b> ${s.waterLevel === 1 ? 'HIGH' : 'LOW'}</div>
      <div><b>Gates:</b> ${s.gatesOpen ? 'OPEN' : 'SHUT'} · <b>Pillars:</b> ${s.pillarsUp ? 'UP' : 'DOWN'} · <b>Sensors:</b> ${[...s.activeSensors].join(',') || '-'}</div>
    `;
  }
}

function renderCriticPanel(): void {
  const el = document.getElementById('critic-report');
  if (!el) return;
  if (!lastReport) {
    el.innerHTML =
      'Click <b>Solve &amp; Audit</b> to run the 5-Gate Critic and trace witness steps.';
    return;
  }
  const r = lastReport;
  const statusBadge = r.solve.solved
    ? `<span class="badge good">SOLVED (${r.solve.steps.length} steps · ${r.solve.elapsedMs.toFixed(0)} ms)</span>`
    : `<span class="badge bad">UNSOLVED</span>`;
  const tierBadge = `<span class="badge">${r.creativity.tier.toUpperCase()} (${r.creativity.totalScore})</span>`;

  const stepsHtml = r.solve.steps
    .map(
      (st, idx) => `<button class="step-btn" data-step="${idx}">${idx + 1}. ${st.label}</button>`,
    )
    .join('');

  el.innerHTML = `
    <div style="margin-bottom:6px">${statusBadge} ${tierBadge}</div>
    <div><b>Unused Kit:</b> ${r.ablation.unusedKitBombs.join(', ') || 'none'}</div>
    <div><b>Redundant Props:</b> ${r.ablation.redundantProps.join(', ') || 'none'}</div>
    <div><b>Shortcuts:</b> ${r.shortcuts.join('; ') || 'none'}</div>
    <div style="margin-top:6px;color:var(--muted)">${r.creativity.notes.join(' · ')}</div>
    <div style="margin-top:8px">${stepsHtml}</div>
  `;

  el.querySelectorAll<HTMLButtonElement>('button.step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetStep = Number(btn.dataset['step'] ?? '0');
      stopWitnessPlayback();
      const nextHist: LabState[] = [createLabState(activeRoom)];
      for (let i = 0; i <= targetStep && i < r.solve.steps.length; i++) {
        const macro = r.solve.steps[i];
        if (!macro) continue;
        for (const act of macro.actions) {
          const prev = nextHist[nextHist.length - 1];
          if (!prev) break;
          const next = cloneLabState(prev);
          applyLabAction(activeRoom, next, act);
          nextHist.push(next);
        }
      }
      history = nextHist;
      renderAll();
    });
  });
}

function renderAll(): void {
  renderRoomList();
  renderKitBar();
  const wrap = document.getElementById('board-wrap');
  if (wrap) wrap.innerHTML = renderBoardSvg(activeRoom, curState());
  renderMetaAndTelemetry();
  renderCriticPanel();
}

let lastActionLabel = '—';

function pushAction(act: Parameters<typeof applyLabAction>[2]): void {
  stopWitnessPlayback();
  const next = cloneLabState(curState());
  const res = applyLabAction(activeRoom, next, act);
  const desc =
    act.kind === 'face' || act.kind === 'step' || act.kind === 'roll'
      ? `${act.kind} ${act.dir}`
      : act.kind === 'actBomb'
        ? `${act.how} ${act.bomb} ${act.dir}`
        : act.kind;
  lastActionLabel = res.ok ? desc : `${desc} ✗ (${res.reason ?? 'blocked'})`;
  if (res.ok) history.push(next);
  renderAll();
}

function runAudit(): void {
  stopWitnessPlayback();
  const entry = entries[currentIdx] ?? {
    code: 'CUSTOM',
    designNote: 'Live edited room',
    room: activeRoom,
  };
  const cert = certifySuiteEntry({ ...entry, room: activeRoom });
  lastReport = cert.report;
  renderCriticPanel();
}

function playWitness(): void {
  if (!lastReport) runAudit();
  const rep = lastReport;
  if (!rep || !rep.solve.solved) return;
  stopWitnessPlayback();
  history = [createLabState(activeRoom)];
  renderAll();

  const flat = [...rep.solve.flatActions];
  let idx = 0;
  witnessTimer = window.setInterval(() => {
    const act = flat[idx];
    if (!act) {
      stopWitnessPlayback();
      return;
    }
    idx++;
    const next = cloneLabState(curState());
    applyLabAction(activeRoom, next, act);
    history.push(next);
    renderAll();
    if (next.roomSolved) stopWitnessPlayback();
  }, 260);
}

function wireEvents(): void {
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    stopWitnessPlayback();
    history = [createLabState(activeRoom)];
    renderAll();
  });
  document.getElementById('btn-undo')?.addEventListener('click', () => {
    stopWitnessPlayback();
    if (history.length > 1) {
      history.pop();
      renderAll();
    }
  });
  document.getElementById('btn-tick')?.addEventListener('click', () => {
    pushAction({ kind: 'wait', ticks: 1 });
  });
  document.getElementById('btn-settle')?.addEventListener('click', () => {
    pushAction({ kind: 'settle' });
  });
  document.getElementById('btn-solve')?.addEventListener('click', runAudit);
  document.getElementById('btn-play-witness')?.addEventListener('click', playWitness);

  document.getElementById('btn-compose')?.addEventListener('click', () => {
    composeSeed += 17;
    const gen = composeEntangledRooms(composeSeed, 1, { maxAttempts: 4 });
    const g = gen[0];
    if (!g) return;
    entries.unshift({
      code: `GEN`,
      designNote: `Composed (${g.family}, seed ${g.seed})`,
      room: g.room,
    });
    selectEntry(0);
    lastReport = g.report;
    renderCriticPanel();
  });

  document.getElementById('btn-apply-rows')?.addEventListener('click', () => {
    const editor = document.getElementById('rows-editor') as HTMLTextAreaElement | null;
    if (!editor) return;
    const rows = editor.value.split('\n').filter((line) => line.length > 0);
    activeRoom = { ...activeRoom, rows };
    history = [createLabState(activeRoom)];
    runAudit();
    renderAll();
  });

  window.addEventListener('keydown', (ev) => {
    if ((ev.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
    const keyMap: Record<string, Dir> = {
      ArrowUp: 'N',
      KeyW: 'N',
      ArrowDown: 'S',
      KeyS: 'S',
      ArrowLeft: 'W',
      KeyA: 'W',
      ArrowRight: 'E',
      KeyD: 'E',
    };
    const dir = keyMap[ev.code];
    // Turn in place: I/J/K/L (no modifiers needed — Ctrl/Alt+Arrow are OS gestures on macOS).
    const faceMap: Record<string, Dir> = { KeyI: 'N', KeyK: 'S', KeyJ: 'W', KeyL: 'E' };
    const faceDir = faceMap[ev.code];
    if (faceDir && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      pushAction({ kind: 'face', dir: faceDir });
      return;
    }
    if (dir) {
      ev.preventDefault();
      if (ev.ctrlKey || ev.altKey || ev.metaKey) {
        pushAction({ kind: 'face', dir });
        return;
      }
      pushAction(ev.shiftKey ? { kind: 'roll', dir } : { kind: 'step', dir });
      return;
    }
    if (ev.code === 'Space' && selectedBomb) {
      ev.preventDefault();
      pushAction({ kind: 'actBomb', bomb: selectedBomb, how: 'drop', dir: curState().pip.dir });
      return;
    }
    if (ev.code === 'KeyE' && selectedBomb && DIRS.includes(curState().pip.dir)) {
      ev.preventDefault();
      pushAction({ kind: 'actBomb', bomb: selectedBomb, how: 'throw', dir: curState().pip.dir });
      return;
    }
    if (ev.code === 'Period') {
      ev.preventDefault();
      pushAction({ kind: 'wait', ticks: 1 });
      return;
    }
    if (ev.code === 'Enter') {
      ev.preventDefault();
      pushAction({ kind: 'settle' });
      return;
    }
    if (ev.code === 'KeyZ') {
      ev.preventDefault();
      if (history.length > 1) {
        history.pop();
        renderAll();
      }
      return;
    }
    if (ev.key >= '1' && ev.key <= '7') {
      const idx = Number(ev.key) - 1;
      const b = activeRoom.kit[idx];
      if (b) {
        selectedBomb = b;
        renderKitBar();
      }
    }
  });
}

wireEvents();
selectEntry(0);
