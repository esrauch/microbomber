/**
 * Standalone Abstracted Puzzle Lab — Typed Trick Library & 8x8 Pairwise Physics Prober (`Phase 2`).
 *
 * Each `TrickDescriptor` pairs its compositional preconditions/postconditions and off-label
 * affordance roles with an executable micro-arena verified by the 5-Gate Critic.
 */
import { type RoomEvaluationReport, evaluateRoomQuality } from './critic';
import type { SolveBudget } from './solver';
import type { LabBombKind, LabRoomSpec, PropSpec } from './types';

export interface TrickPortContract {
  needsKit: readonly LabBombKind[];
  requiresStates?: readonly string[];
  producesStates: readonly string[];
  affordanceRoles: Readonly<Record<string, readonly string[]>>;
}

export interface TrickDescriptor {
  id: string;
  name: string;
  mechanics: readonly string[];
  naiveTrap: string;
  contract: TrickPortContract;
  microArena: LabRoomSpec;
}

export const SEED_TRICKS: readonly TrickDescriptor[] = [
  {
    id: 'TR-01',
    name: 'Frost-Coated Crate Across Active Laser',
    mechanics: ['ice', 'rock', 'crate', 'laser', 'shallow-frost', 'mousehole'],
    naiveTrap:
      'Pushing the bare wooden crate into the Laser blocks the sensor and burns the crate.',
    contract: {
      needsKit: ['ice', 'rock'],
      producesStates: ['button-weighted', 'sensor-lit'],
      affordanceRoles: { crate: ['frost-armored', 'moved', 'switch-weight'] },
    },
    microArena: {
      id: 'trick-tr01',
      name: 'TR-01 Coat of Rime',
      width: 10,
      height: 8,
      kit: ['ice', 'rock'],
      entry: [3, 2],
      condition: 'buttons-and-sensors',
      rows: [
        '##########',
        '#........#',
        '#..;;;;..#',
        '#....;...#',
        '#m===g===#',
        '#..O.;...#',
        '#........#',
        '##########',
      ],
      switches: [{ x: 5, y: 5, kind: 'O' }],
      props: [{ id: 'crate', kind: 'crate', x: 5, y: 2 }],
      lasers: [{ id: 'L1', x: 2, y: 3, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 8, y: 3, level: 0 }],
    },
  },
  {
    id: 'TR-02',
    name: 'Kit-Restricted Mirror Flame Heist',
    mechanics: ['mirror', 'laser', 'brazier', 'bomb'],
    naiveTrap: 'Fire Bomb is withheld; brazier sits behind a fence out of reach.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['torch-lit'],
      affordanceRoles: { mirror: ['moved', 'laser-optics'] },
    },
    microArena: {
      id: 'trick-tr02',
      name: 'TR-02 Borrow the Ray',
      width: 9,
      height: 9,
      kit: ['bomb'],
      entry: [2, 5],
      condition: 'all-torches',
      rows: [
        '#########',
        '#.......#',
        '#.......#',
        '#....%..#',
        '#.......#',
        '#.......#',
        '#=======#',
        '#.......#',
        '#########',
      ],
      props: [{ id: 'mirror', kind: 'mirror', x: 5, y: 4, facing: 'SW' }],
      braziers: [{ id: 'b1', x: 5, y: 7 }],
      lasers: [{ id: 'L1', x: 1, y: 2, dir: 'E', level: 0 }],
    },
  },
  {
    id: 'TR-03',
    name: 'Self-Cryo Spike & Inverter-Laser Run',
    mechanics: ['ice', 'self-cryo', 'fan', 'spikes', 'laser-inverter'],
    naiveTrap:
      '4-tile spike strip is too wide to Roll, and an active Laser guards the landing pad.',
    contract: {
      needsKit: ['ice'],
      producesStates: ['pip-crossed-hazard', 'sensor-latched'],
      affordanceRoles: { pip: ['self-cryo-puck', 'beam-eclipse'] },
    },
    microArena: {
      id: 'trick-tr03',
      name: 'TR-03 Thaw at the Gate',
      width: 11,
      height: 7,
      kit: ['ice'],
      entry: [3, 1],
      condition: 'buttons-and-sensors',
      rows: [
        '###########',
        '#.........#',
        '#.........#',
        '#..;!!!!.O#',
        '#.........#',
        '#.........#',
        '###########',
      ],
      fans: [{ id: 'F1', x: 1, y: 3, dir: 'E', level: 0 }],
      lasers: [{ id: 'L1', x: 8, y: 1, dir: 'S', level: 0 }],
      sensors: [{ id: 'S1', x: 8, y: 5, level: 0, inverted: true, latch: true }],
    },
  },
  {
    id: 'TR-04',
    name: 'Douse-Save a Burning Crate',
    mechanics: ['crate', 'laser', 'shallow-water', 'wind'],
    naiveTrap: 'Crossing the Laser ignites the crate so it burns to ash unless blown into water.',
    contract: {
      needsKit: ['wind'],
      producesStates: ['button-weighted'],
      affordanceRoles: { crate: ['moved', 'burning-fuel', 'doused', 'switch-weight'] },
    },
    microArena: {
      id: 'trick-tr04',
      name: 'TR-04 Snatch from the Ray',
      width: 9,
      height: 7,
      kit: ['wind'],
      entry: [2, 3],
      condition: 'hold-buttons',
      rows: [
        '#########',
        '#.......#',
        '#....#..#',
        '#....;#.#',
        '#....#..#',
        '#.O.....#',
        '#########',
      ],
      switches: [{ x: 5, y: 3, kind: 'O' }],
      props: [{ id: 'crate', kind: 'crate', x: 3, y: 3 }],
      lasers: [{ id: 'L1', x: 4, y: 1, dir: 'S', level: 0 }],
    },
  },
  {
    id: 'TR-05',
    name: 'Split-Track Bomb Grate & Mousehole',
    mechanics: ['bomb', 'bomb-grate', 'mousehole', 'chute', 'crystal'],
    naiveTrap: 'Mousehole forbids carrying a bomb; Bomb Grate blocks Pip.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['crystal-flipped', 'pip-crossed-barrier'],
      affordanceRoles: {},
    },
    microArena: {
      id: 'trick-tr05',
      name: 'TR-05 Empty Pockets',
      width: 9,
      height: 8,
      kit: ['bomb'],
      entry: [2, 5],
      condition: 'hold-buttons',
      initialCrystal: 'blue',
      rows: [
        '#########',
        '#..C#..O#',
        '#..n#UUU#',
        '#..g#...#',
        '#..n#...#',
        '#...m...#',
        '#.......#',
        '#########',
      ],
    },
  },
  {
    id: 'TR-06',
    name: 'Sluice Flood-Bridge & Buoyant Switch Release',
    mechanics: ['bomb', 'sluice', 'crate', 'elevation'],
    naiveTrap:
      'When drained, cliffs block crossing; when flooded, floating crates cannot be pushed.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['sluice-high', 'elevated-bridge'],
      affordanceRoles: { b1: ['moved', 'floating-bridge'] },
    },
    microArena: {
      id: 'trick-tr06',
      name: 'TR-06 Dry Trench Blueprint',
      width: 9,
      height: 7,
      kit: ['bomb'],
      entry: [1, 3],
      condition: 'hold-buttons',
      sluice: { initial: 0 },
      levels: [
        '111111111',
        '111111111',
        '111001111',
        '111001111',
        '111001111',
        '111111111',
        '111111111',
      ],
      rows: [
        '#########',
        '#W......#',
        '#..;;.O.#',
        '#.e;;...#',
        '#..;;...#',
        '#.......#',
        '#########',
      ],
      props: [
        { id: 'b1', kind: 'crate', x: 4, y: 2 },
        { id: 'b2', kind: 'crate', x: 3, y: 3 },
      ],
    },
  },
  {
    id: 'TR-07',
    name: '3x3 Turntable Push-Leverage Swap',
    mechanics: ['bomb', 'turntable-3x3', 'crate', 'crystal'],
    naiveTrap:
      'Crate is pinned below a wall at (4,2) so Pip can never stand North of it to push South.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['turntable-rotated', 'button-weighted'],
      affordanceRoles: { crate: ['moved', 'switch-weight'] },
    },
    microArena: {
      id: 'trick-tr07',
      name: 'TR-07 Spin to Unpin',
      width: 9,
      height: 9,
      kit: ['bomb'],
      entry: [2, 4],
      condition: 'hold-buttons',
      rows: [
        '#########',
        '#.C.....#',
        '#...#...#',
        '#..#.#..#',
        '#.......#',
        '#.......#',
        '#.O...O.#',
        '#.......#',
        '#########',
      ],
      props: [{ id: 'crate', kind: 'crate', x: 4, y: 3 }],
      turntables: [{ id: 'dial', cx: 4, cy: 4, size: 3, trigger: 'crystal' }],
    },
  },
  {
    id: 'TR-08',
    name: 'Height-Clipped Pillar Laser Eclipse',
    mechanics: ['bomb', 'pillar', 'laser-inverter', 'elevation'],
    naiveTrap: 'Laser is at level 1 with no level-1 blocks to shutter it.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['pillar-risen', 'sensor-latched'],
      affordanceRoles: {},
    },
    microArena: {
      id: 'trick-tr08',
      name: 'TR-08 Duck the Ray, Raise the Column',
      width: 9,
      height: 8,
      kit: ['bomb'],
      entry: [2, 5],
      condition: 'buttons-and-sensors',
      pillars: 'switches',
      levels: [
        '111111111',
        '111111111',
        '100000001',
        '100000001',
        '100000001',
        '100000001',
        '100000001',
        '111111111',
      ],
      rows: [
        '#########',
        '#.......#',
        '#...L...#',
        '#.......#',
        '#..Q..GO#',
        '#.....###',
        '#.......#',
        '#########',
      ],
      props: [{ id: 'st', kind: 'stone', x: 3, y: 3 }],
      lasers: [{ id: 'L1', x: 1, y: 2, dir: 'E', level: 1 }],
      sensors: [{ id: 'S1', x: 7, y: 2, level: 1, inverted: true }],
    },
  },
  {
    id: 'TR-09',
    name: 'Stern-Thruster Raft Recoil',
    mechanics: ['bomb', 'raft', 'deep-water'],
    naiveTrap: 'Wall-to-wall deep moat has no bridges, fans, currents, or Ice Bomb.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['raft-docked'],
      affordanceRoles: { raft: ['moved'] },
    },
    microArena: {
      id: 'trick-tr09',
      name: 'TR-09 Stern Thruster',
      width: 9,
      height: 7,
      kit: ['bomb'],
      entry: [2, 3],
      condition: 'hold-buttons',
      rows: [
        '#########',
        '#..~~~..#',
        '#..~~~..#',
        '#..~~~.O#',
        '#..~~~..#',
        '#..~~~..#',
        '#########',
      ],
      props: [{ id: 'raft', kind: 'raft', x: 3, y: 3 }],
    },
  },
  {
    id: 'TR-10',
    name: 'Burning Crate Fireball Catapult',
    mechanics: ['bomb', 'crate', 'laser', 'spring', 'brazier'],
    naiveTrap: 'No Fire Bomb in kit, and brazier sits across a pit above a Laser.',
    contract: {
      needsKit: ['bomb'],
      producesStates: ['torch-lit'],
      affordanceRoles: { crate: ['moved', 'burning-fuel', 'burned-away-shutter'] },
    },
    microArena: {
      id: 'trick-tr10',
      name: 'TR-10 Flying Ember',
      width: 9,
      height: 9,
      kit: ['bomb'],
      entry: [2, 6],
      condition: 'all-torches',
      rows: [
        '#########',
        '#.......#',
        '#.......#',
        '#...^...#',
        '#...J...#',
        '#...%...#',
        '#.......#',
        '#.......#',
        '#########',
      ],
      props: [{ id: 'crate', kind: 'crate', x: 4, y: 6 }],
      springs: [{ x: 4, y: 4, dir: 'N' }],
      lasers: [{ id: 'L1', x: 1, y: 2, dir: 'E', level: 0 }],
      braziers: [{ id: 'b1', x: 4, y: 1 }],
    },
  },
];

export interface ProbedMotif {
  room: LabRoomSpec;
  report: RoomEvaluationReport;
}

export interface PairwiseProbeOptions {
  maxCandidates?: number;
  perArenaBudget?: SolveBudget;
}

/**
 * Automated Pairwise Micro-Arena Prober:
 * Instantiates compact `9 x 7` testboxes pairing obstacle topologies (`Laser`, `Spikes`, `Deep
 * Moat`, `Bomb Grate + Mousehole`) with prop/kit combinations, keeping only verified multi-step
 * rooms that pass all 5 Critic Gates (`0` shortcuts, `0` unused kit bombs, `0` dead props).
 */
export function probePairwiseMicroArenas(options: PairwiseProbeOptions = {}): ProbedMotif[] {
  const maxCandidates = options.maxCandidates ?? 24;
  const budget: SolveBudget = options.perArenaBudget ?? {
    maxStates: 650,
    maxDepth: 7,
    maxMs: 180,
  };

  const candidates: LabRoomSpec[] = [];

  const barrierTemplates: Array<{
    tag: string;
    entry: readonly [number, number];
    rows: readonly string[];
    switches?: LabRoomSpec['switches'];
    lasers?: LabRoomSpec['lasers'];
    sensors?: LabRoomSpec['sensors'];
    fans?: LabRoomSpec['fans'];
    condition: LabRoomSpec['condition'];
  }> = [
    {
      tag: 'laser-frost',
      entry: [2, 2],
      condition: 'buttons-and-sensors',
      rows: [
        '#########',
        '#.......#',
        '#.;;;;..#',
        '#...;...#',
        '#m==;===#',
        '#.O.;...#',
        '#########',
      ],
      switches: [{ x: 4, y: 5, kind: 'O' }],
      lasers: [{ id: 'L1', x: 2, y: 3, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 7, y: 3, level: 0 }],
    },
    {
      tag: 'moat-raft',
      entry: [2, 3],
      condition: 'hold-buttons',
      rows: [
        '#########',
        '#..~~~..#',
        '#..~~~..#',
        '#..~~~.O#',
        '#..~~~..#',
        '#..~~~..#',
        '#########',
      ],
    },
    {
      tag: 'spike-gale',
      entry: [2, 1],
      condition: 'buttons-and-sensors',
      rows: [
        '#########',
        '#.......#',
        '#.;!!!.O#',
        '#..###..#',
        '#.......#',
        '#.......#',
        '#########',
      ],
      fans: [{ id: 'F1', x: 1, y: 2, dir: 'E', level: 0 }],
      lasers: [{ id: 'L1', x: 6, y: 1, dir: 'S', level: 0 }],
      sensors: [{ id: 'S1', x: 6, y: 5, level: 0, inverted: true, latch: true }],
    },
    {
      tag: 'split-grate',
      entry: [2, 5],
      condition: 'hold-buttons',
      rows: [
        '#########',
        '#..C#..O#',
        '#..n#UUU#',
        '#..g#...#',
        '#..n#...#',
        '#...m...#',
        '#########',
      ],
    },
  ];

  const loadouts: Array<{
    tag: string;
    kit: readonly LabBombKind[];
    props?: readonly PropSpec[];
  }> = [
    { tag: 'ice-crate', kit: ['ice'], props: [{ id: 'c1', kind: 'crate', x: 4, y: 2 }] },
    { tag: 'bomb-raft', kit: ['bomb'], props: [{ id: 'r1', kind: 'raft', x: 3, y: 3 }] },
    { tag: 'wind-raft', kit: ['wind'], props: [{ id: 'r1', kind: 'raft', x: 3, y: 3 }] },
    { tag: 'ice-only', kit: ['ice'] },
    { tag: 'bomb-only', kit: ['bomb'] },
    { tag: 'overkitted-bomb-fire', kit: ['bomb', 'fire'] },
  ];

  for (const bt of barrierTemplates) {
    for (const ld of loadouts) {
      if (candidates.length >= maxCandidates) break;
      const validProps = (ld.props ?? []).filter((p) => (bt.rows[p.y]?.[p.x] ?? '#') !== '#');
      if ((ld.props ?? []).length !== validProps.length) continue;

      candidates.push({
        id: `probe-${bt.tag}-${ld.tag}`,
        name: `Probe ${bt.tag} x ${ld.tag}`,
        width: 9,
        height: 7,
        entry: bt.entry,
        kit: ld.kit,
        condition: bt.condition,
        rows: bt.rows,
        ...(bt.switches ? { switches: bt.switches } : {}),
        ...(validProps.length > 0 ? { props: validProps } : {}),
        ...(bt.lasers ? { lasers: bt.lasers } : {}),
        ...(bt.sensors ? { sensors: bt.sensors } : {}),
        ...(bt.fans ? { fans: bt.fans } : {}),
      });
    }
  }

  const survivors: ProbedMotif[] = [];
  for (const room of candidates) {
    const report = evaluateRoomQuality(room, {
      solveBudget: budget,
      ablationBudget: { maxStates: 400, maxDepth: 6, maxMs: 100 },
      minMacroSteps: 2,
      minCreativityScore: 20,
    });
    if (report.passedAllGates) {
      survivors.push({ room, report });
    }
  }

  return survivors.sort((a, b) => b.report.creativity.totalScore - a.report.creativity.totalScore);
}
