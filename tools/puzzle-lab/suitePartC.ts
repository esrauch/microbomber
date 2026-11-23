/**
 * Standalone Abstracted Puzzle Lab — Curated `22 x 26` Suite Part C (`P43-P50`).
 *
 * Eight focused multi-step primitive rooms expanding two core mechanical families:
 * - `P43-P46`: Multiple Pillars & Height Changes (`0/1/2` counter-phase escalators, periscope
 *   pillar prisms, three-tier one-way ledge cascades, and twin-column multi-level laser eclipses).
 * - `P47-P50`: Non-Trivial Mine Carts (`3x3` turntable roundhouse track switches, sluice-drained
 *   waterfall rails, cryo-freight carts, and gate-controlled magnetic flatbeds).
 */
import { BigRoomCanvas, LAB_BIG_H, LAB_BIG_W } from './generate';
import type { CuratedPuzzleEntry } from './suitePartA';

function buildP43CounterPhaseEscalator(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('0');

  // Level 0 north-west court: Pip at (9,10), Crystal C at (8,10), Crate at (9,11) (plain '.' north of L1!)
  c.carveRect(8, 10, 9, 11, '.');
  c.set(8, 10, 'C');
  c.set(8, 11, 's'); // 0 <-> 1 ramp down to level 1 west bay (8,12)

  // Level 1 middle bridge: (8,12) '.', Red Pillar L1 at (9,12) (base 0 -> 1), (10,12) '.' (level 1), Blue Pillar L2 at (11,12) (base 1 -> 2)
  c.setLevelRect(8, 12, 8, 13, '1');
  c.set(8, 12, '.');
  c.set(8, 13, 'm'); // Mousehole blocks Crate from taking Pip's ramp path!
  c.setLevelRect(9, 12, 9, 12, '0');
  c.set(9, 12, 'L');
  c.setLevelRect(10, 12, 10, 12, '1');
  c.set(10, 12, '.');
  c.setLevelRect(11, 12, 11, 12, '1');
  c.set(11, 12, 'L');

  // Pip's level 1 -> 2 footpath around the south/east perimeter to (11,11) (plain '.' north of L2!)
  c.setLevelRect(8, 14, 9, 14, '1');
  c.set(8, 14, '.');
  c.set(9, 14, 'e'); // 1 <-> 2 ramp up to level 2 east gallery
  c.setLevelRect(10, 14, 13, 14, '2');
  c.carveRect(10, 14, 13, 14, '.');
  c.setLevelRect(13, 10, 13, 14, '2');
  c.carveRect(13, 10, 13, 14, '.');
  c.setLevelRect(11, 10, 12, 11, '2');
  c.carveRect(11, 10, 12, 11, '.');
  c.set(12, 12, '#');
  c.set(12, 13, '#');
  c.setLevelRect(11, 13, 11, 13, '2');
  c.set(11, 13, 'O');
  c.set(11, 14, 'O');

  const lvls = c.levels();
  return {
    code: 'P43',
    designNote:
      'Mousehole m blocks the Crate from climbing the footpath! Push the Crate South onto Red Pillar L1 (level 0), flip Crystal C to Red so L1 rises (0->1) while Blue Pillar L2 sinks (2->1) flush with (10,12) at level 1, push the Crate East across (10,12) onto L2, flip C back to Blue to lift the Crate to level 2, and push it South onto O1!',
    room: {
      id: 'p43',
      name: 'P43 Counter-Phase Escalator',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      entry: [9, 10],
      condition: 'hold-buttons',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      pillarSpecs: [
        { x: 9, y: 12, trigger: 'red' },
        { x: 11, y: 12, trigger: 'blue' },
      ],
      props: [{ id: 'crate', kind: 'crate', x: 9, y: 11 }],
    },
  };
}

function buildP44PeriscopePrism(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('0');

  // Level 0 north court: Crystal C at (7,10), open (8..10,10..11), Mirror m1 at (9,11), Red Pillar L1 at (10,11) with '.' at (10,10)
  c.carveRect(7, 10, 10, 11, '.');
  c.set(7, 10, 'C');
  c.set(7, 11, '#');
  c.set(8, 11, 's'); // 0 <-> 1 ramp to level 1 balcony
  c.set(10, 11, 'L');
  c.set(10, 12, '.'); // Plain '.' directly north of L2 (10,13) per ELEVATION.md §8

  // Level 1 west balcony (8..9, 12..13) with Q at (8,13); wall (9,12) = '#' so (9,13) is walled off from level 0!
  c.setLevelRect(8, 12, 9, 13, '1');
  c.carveRect(8, 12, 9, 13, '.');
  c.set(9, 12, '#');
  c.set(8, 13, 'Q');

  // Switch Pillar L2 at (10,13) (base level 0, rises 0 -> 1 while Q is held, bridging (9,13) -> (11,13))
  c.setLevelRect(10, 13, 10, 13, '0');
  c.set(10, 13, 'L');

  // Level 1 east island O at (11,13) and level 1 south sensor at (10,14)
  c.setLevelRect(11, 13, 11, 13, '1');
  c.set(11, 13, 'O');
  c.setLevelRect(10, 14, 10, 14, '1');
  c.set(10, 14, '.');
  c.setLevelRect(11, 11, 13, 11, '0');
  c.carveRect(11, 11, 13, 11, '.');

  const lvls = c.levels();
  return {
    code: 'P44',
    designNote:
      'Push Mirror m1 onto Red Pillar L1 (level 0) and flip Crystal C so L1 lifts the Mirror into the level 1 Laser (reflecting it South toward S1). Then drop a Bomb onto Q (8,13) so Switch Pillar L2 (10,13) rises temporarily as a level 1 bridge—cross to O (11,13) before the Bomb detonates and drops L2 back beneath the beam!',
    room: {
      id: 'p44',
      name: 'P44 Periscope Prism',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      entry: [9, 10],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      pillarSpecs: [
        { x: 10, y: 11, trigger: 'red' },
        { x: 10, y: 13, trigger: 'switches' },
      ],
      props: [{ id: 'm1', kind: 'mirror', x: 9, y: 11, facing: 'SE' }],
      lasers: [{ id: 'L1', x: 13, y: 11, dir: 'W', level: 1 }],
      sensors: [{ id: 'S1', x: 10, y: 14, level: 1 }],
    },
  };
}

function buildP45ThreeTierCascade(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('0');

  // West level 2 starting cliff: (5,11) walkable level 2 behind (6,11) cliff rim -> hops East (2 -> 1) onto (7,11) level 1!
  c.setLevelRect(5, 11, 6, 11, '2');
  c.carveRect(5, 11, 6, 11, '.');

  // Middle level 1 terrace: (7, 11..13) walkable level 1 behind (8,12) cliff rim -> hops East (1 -> 0) onto (9,12) level 0!
  c.setLevelRect(7, 11, 7, 13, '1');
  c.carveRect(7, 11, 7, 13, '.');
  c.set(7, 13, 'O');
  c.setLevelRect(8, 12, 8, 12, '1');
  c.set(8, 12, '.');

  // Level 0 canyon floor at (9,12) (plain '.' north of Red Pillar L1 at (9,13)!), with Crystal C1 at (9,11) (level 0)
  c.setLevelRect(9, 11, 9, 13, '0');
  c.set(9, 11, 'C');
  c.set(9, 12, '.');
  c.set(9, 13, 'L');

  // Level 1 transfer landing at (10,13) between L1 (9,13) and L2 (11,13)
  c.setLevelRect(10, 13, 10, 13, '1');
  c.set(10, 13, '.');

  // Blue Pillar L2 at (11,13) (base level 1, sinks 2 -> 1 on Red, rises 1 -> 2 on Blue)
  // South of L2: (11,14) '.' (level 1) and Crystal C2 at (11,15) (level 1)
  // North of L2: (11,12) '.' (level 2) and (11,11) O2 (level 2)
  c.setLevelRect(11, 13, 11, 15, '1');
  c.set(11, 13, 'L');
  c.set(11, 14, '.');
  c.set(11, 15, 'C');
  c.setLevelRect(11, 11, 11, 12, '2');
  c.set(11, 12, '.');
  c.set(11, 11, 'O');

  const lvls = c.levels();
  return {
    code: 'P45',
    designNote:
      'Hop East off the level 2 cliff onto the level 1 terrace to weight O1 with the Crate, hop East again down to the level 0 canyon (9,12), stand on Red Pillar L1 (9,13) and throw/drop a Bomb to flip Crystal C (lifting you 0->1 while Blue Pillar L2 sinks 2->1), cross (10,13) onto L2 (11,13) and bomb C again to ride L2 up (1->2) onto O2!',
    room: {
      id: 'p45',
      name: 'P45 Three-Tier Cascade',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      entry: [5, 11],
      condition: 'hold-buttons',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      pillarSpecs: [
        { x: 9, y: 13, trigger: 'red' },
        { x: 11, y: 13, trigger: 'blue' },
      ],
      props: [{ id: 'c1', kind: 'crate', x: 7, y: 12 }],
    },
  };
}

function buildP46TwinColumnEclipse(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('0');
  c.carveRect(9, 10, 10, 13, '.');
  c.set(8, 11, '.');
  c.set(8, 12, 'C');
  c.set(9, 14, 'Q');
  c.set(10, 14, 'm');
  // Red Pillar L1 at (9,11) with plain '.' at (9,10); Switch Pillar L2 at (11,12) with plain '.' at (11,11)
  c.set(9, 11, 'L');
  c.set(11, 10, '.');
  c.set(11, 11, '.');
  c.set(11, 12, 'L');
  c.set(11, 13, '.');
  c.set(11, 14, '.');
  c.set(12, 11, '.');
  c.set(13, 11, '.');
  c.set(12, 13, 'O');

  const lvls = c.levels();
  return {
    code: 'P46',
    designNote:
      'Red Pillar L1 (9,11) starts UP, shielding (10,11) from Laser1 while you push the Crate South from (10,11) to (10,13). Then flip Crystal C to lower L1 (powering S1), stand at (9,13) and place on Q (9,14) to temporarily raise Switch Pillar L2 (11,12)—push the Crate East across (11,13) onto O1 (12,13) and step onto O2 (10,14) before L2 lowers for S2!',
    room: {
      id: 'p46',
      name: 'P46 Twin-Column Eclipse',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'red',
      entry: [10, 10],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      switches: [{ x: 10, y: 14, kind: 'O' }],
      pillarSpecs: [
        { x: 9, y: 11, trigger: 'red' },
        { x: 11, y: 12, trigger: 'switches' },
      ],
      props: [{ id: 'crate', kind: 'crate', x: 10, y: 11 }],
      lasers: [
        { id: 'Laser1', x: 7, y: 11, dir: 'E', level: 0 },
        { id: 'Laser2', x: 11, y: 9, dir: 'S', level: 0 },
      ],
      sensors: [
        { id: 'S1', x: 13, y: 11, level: 0 },
        { id: 'S2', x: 11, y: 14, level: 0 },
      ],
    },
  };
}

function buildP47RoundhouseSwitch(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // South walkway for Pip around the 3x3 Dial: (8..9,13), (8..12,14), (12,13), O at (8,13)
  c.carveRect(8, 13, 12, 14, '.');
  c.set(8, 13, 'O');

  // 3x3 Dial at (11,12): fence '=' on non-track dial cells so Pip cannot walk onto the dial!
  c.carveRect(10, 11, 12, 13, '=');
  c.set(12, 13, '.');
  c.set(9, 12, 't');
  c.set(10, 12, 't');
  c.set(11, 12, 't');
  c.set(11, 11, 't');
  c.set(11, 10, 'C');

  // East track branch outside the 3x3 Dial: (13..14,12) 't' leading to '%' at (15,12) which blocks Laser L1 (15,10) -> S1 (15,14)
  c.set(13, 12, 't');
  c.set(14, 12, 't');
  c.set(15, 11, '.');
  c.set(15, 12, '%');
  c.set(15, 13, '.');
  c.set(15, 14, '.');

  return {
    code: 'P47',
    designNote:
      'Load Bomb #1 into the Mine Cart at (9,12): it rolls onto the 3x3 Roundhouse Dial, turns North to (11,11), and detonates against Crystal C—rotating both the track and the Mine Cart 90° CW to (12,12) facing East! Then walk to (12,13) and load Bomb #2 into the rotated Cart at (12,12) to blast % at (15,12) and unblock L1 -> S1!',
    room: {
      id: 'p47',
      name: 'P47 Roundhouse Switch',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      entry: [9, 13],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      creatures: [{ id: 'cart1', kind: 'cart', x: 9, y: 12, dir: 'E' }],
      turntables: [{ id: 'dial', cx: 11, cy: 12, size: 3, trigger: 'crystal' }],
      lasers: [{ id: 'L1', x: 15, y: 10, dir: 'S', level: 0 }],
      sensors: [{ id: 'S1', x: 15, y: 14, level: 0 }],
    },
  };
}

function buildP48ShutSluiceDryRail(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('1');

  // Cart Track 't' along y=11: (8,11) -> (9,11) -> (10,11) [Waterfall Veil '|'] -> (11,11) [Q] -> C at (12,11)
  c.set(8, 11, 't');
  c.set(9, 11, 't');
  c.set(10, 11, '|');
  c.set(11, 11, 't');
  c.set(12, 11, 'C');

  c.carveRect(8, 12, 9, 13, '.');
  c.set(7, 13, 'W');
  c.setLevelRect(10, 13, 10, 13, '0');
  c.set(10, 13, ';');
  c.set(8, 12, 'O');

  // East Laser line x=13: L1 (13,10) -> S through Gate 'G' (13,11) and Red barrier 'R' (13,12) to S1 (13,13)
  c.set(13, 11, 'G');
  c.set(13, 12, 'R');
  c.set(13, 13, '.');

  const lvls = c.levels();
  return {
    code: 'P48',
    designNote:
      'Active Waterfall Veil | at (10,11) douses any bomb in the Mine Cart while the Sluice is High! First bomb Sluice W to drain the veil (and the level 0 trench), push the Crate into the drained trench onto O1, then load a Bomb into the Cart so it rolls dry across (10,11) to park on Q (11,11) (opening Gate G) and flip C (12,11) (lowering R for L1 -> S1)!',
    room: {
      id: 'p48',
      name: 'P48 Shut the Sluice, Dry the Rail',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'red',
      sluice: { initial: 1, drainsVeilsWhenLow: true },
      entry: [8, 13],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      switches: [
        { x: 11, y: 11, kind: 'Q' },
        { x: 10, y: 13, kind: 'O' },
      ],
      props: [{ id: 'crate', kind: 'crate', x: 9, y: 13 }],
      creatures: [{ id: 'cart1', kind: 'cart', x: 8, y: 11, dir: 'E' }],
      lasers: [{ id: 'L1', x: 13, y: 10, dir: 'S', level: 1 }],
      sensors: [{ id: 'S1', x: 13, y: 13, level: 1 }],
    },
  };
}

function buildP49CryoFreight(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Cart Track 't' along y=11: (9..12, 11). Mine Cart starts at (9,11) blocking Laser L1 (9,9) -> S1 (9,14)!
  c.carveRect(9, 11, 12, 11, 't');
  c.set(9, 10, '.');
  c.set(9, 13, '.');
  c.set(9, 14, '.');

  // Row y=12: Pip at (8,12), (9..10,12) '.', Crate at (11,12), deep water '~' at (12,12), O1 at (13,12), O2 at (10,12)
  c.carveRect(8, 12, 11, 12, '.');
  c.set(10, 12, 'O');
  c.set(12, 12, '~');
  c.set(13, 12, 'O');

  return {
    code: 'P49',
    designNote:
      'Throwing an Ice Bomb directly at (12,12) ~ sinks it in deep water! Instead, drop the Ice Bomb into the Mine Cart at (9,11): the Cart rolls East to (12,11)—simultaneously unblocking Laser L1 -> S1 at x=9 and detonating its 3x3 cryo blast at the end of the track to freeze (12,12) ~ so you can push the Crate across to O1!',
    room: {
      id: 'p49',
      name: 'P49 Cryo Freight',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['ice'],
      entry: [8, 12],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [{ id: 'crate', kind: 'crate', x: 11, y: 12 }],
      creatures: [{ id: 'cart1', kind: 'cart', x: 9, y: 11, dir: 'E' }],
      lasers: [{ id: 'L1', x: 9, y: 9, dir: 'S', level: 0 }],
      sensors: [{ id: 'S1', x: 9, y: 14, level: 0 }],
    },
  };
}

function buildP50MagneticFlatbed(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // West Pip platform (7..8, 11..13) with Q at (7,11), Crate at (7,12), O2 at (7,13)
  c.carveRect(7, 11, 8, 13, '.');
  c.set(7, 11, 'Q');
  c.set(7, 13, 'O');

  // Cart Track 't' along y=11: (8,11) -> (9,11) -> (10,11) [Gate 'G'] -> (11,11), with Polarity Switch 'N' at (11,10)
  c.set(8, 11, 't');
  c.set(9, 11, 't');
  c.set(10, 11, 'G');
  c.set(11, 11, 't');
  c.set(11, 10, 'N');

  // East magnetic target: Metal Block at (11,13) pulled North onto O1 (11,12), plus 1x1 Polarity Turntable Laser L1 (12,13) -> S1 (12,9)
  c.set(11, 12, 'O');
  c.set(11, 13, '.');
  c.carveRect(12, 9, 12, 13, '.');

  return {
    code: 'P50',
    designNote:
      'Gate G (10,11) blocks the middle of the Cart Track! First push the Crate onto Q (7,11) to open Gate G on the rail, then load a Magnet Bomb into the Mine Cart at (8,11): it rolls through G to (11,11) where its magnetic pulse drags the distant Metal Block onto O1 (11,12) and flips Polarity Switch N (11,10) to rotate L1 onto S1!',
    room: {
      id: 'p50',
      name: 'P50 Magnetic Flatbed',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['magnet'],
      initialPolarity: 'south',
      entry: [8, 12],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [
        { id: 'crate', kind: 'crate', x: 7, y: 12 },
        { id: 'metal', kind: 'metal', x: 11, y: 13 },
      ],
      creatures: [{ id: 'cart1', kind: 'cart', x: 8, y: 11, dir: 'E' }],
      turntables: [{ id: 'tt1', cx: 12, cy: 13, size: 1, trigger: 'polarity' }],
      lasers: [{ id: 'L1', x: 12, y: 13, dir: 'W', level: 0, turntableId: 'tt1' }],
      sensors: [{ id: 'S1', x: 12, y: 9, level: 0 }],
    },
  };
}

export function buildSuitePartC(): CuratedPuzzleEntry[] {
  return [
    buildP43CounterPhaseEscalator(),
    buildP44PeriscopePrism(),
    buildP45ThreeTierCascade(),
    buildP46TwinColumnEclipse(),
    buildP47RoundhouseSwitch(),
    buildP48ShutSluiceDryRail(),
    buildP49CryoFreight(),
    buildP50MagneticFlatbed(),
  ];
}
