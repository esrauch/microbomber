/**
 * Curated `22 x 26` Abstracted Puzzle Suite — Part A (`P01-P22`).
 *
 * Contains:
 * - `P01-P12`: Four progressive `1 -> 2 -> 3` Escalation Triads (`Stolen Flame`,
 *   `Don't Burn the Box`, `Cold Feet`, `High Tide, Heavy Feet`).
 * - `P13-P22`: Ten standalone multi-step `22 x 26` lateral-thinking puzzle rooms.
 */
import { BigRoomCanvas, LAB_BIG_H, LAB_BIG_W, buildProvenEscalationTriadRooms } from './generate';
import type { LabRoomSpec } from './types';

export interface CuratedPuzzleEntry {
  code: string;
  triad?: string;
  act?: 1 | 2 | 3;
  designNote: string;
  allowGenerousBaselineKit?: boolean;
  room: LabRoomSpec;
}

function buildTriadEntries(): CuratedPuzzleEntry[] {
  const triads = buildProvenEscalationTriadRooms();

  const meta: Array<{
    codes: readonly [string, string, string];
    names: readonly [string, string, string];
    notes: readonly [string, string, string];
  }> = [
    {
      codes: ['P01', 'P02', 'P03'],
      names: [
        'P01 Bring Your Own Match',
        'P02 No Match, Borrow the Ray',
        'P03 Spare the Messenger',
      ],
      notes: [
        'Act I (Stolen Flame): With Fire Bomb available, throw Fire directly over the fence to light the brazier.',
        'Act II (Stolen Flame): Fire Bomb stripped! Blast the cracked wall and push the SW Mirror into the Laser to bend fire into the brazier.',
        'Act III (Stolen Flame): A required Wooden Crate sits inside the reflected beam lane—evacuate it onto O before reflecting the Laser onto Sensor S1.',
      ],
    },
    {
      codes: ['P04', 'P05', 'P06'],
      names: ['P04 Rock the Beam', 'P05 One Box Too Few', 'P06 Coat of Rime'],
      notes: [
        "Act I (Don't Burn the Box): The crate's only route to O crosses the Laser. Drop a Rock in the beam lane to shield the crossing, escort the crate down the column, then take the Mousehole round to the second O.",
        "Act II (Don't Burn the Box): Fire stripped and a second O added! Frost-coat the crate with Ice so it hydroplanes unburned across the Laser onto O.",
        "Act III (Don't Burn the Box): Wall backstop removed—thread the Mousehole first to stage a Rock stopper, then frost-slide the crate across the Laser.",
      ],
    },
    {
      codes: ['P07', 'P08', 'P09'],
      names: ['P07 Gale Vault', 'P08 Too Wide to Roll', 'P09 Shut the Shaft'],
      notes: [
        'Act I (Cold Feet): Wind-jump across a narrow 2-tile spike strip onto the goal terrace.',
        'Act II (Cold Feet): Wind stripped and spikes widened to 4 tiles—use Ice at your feet so the Fan slides Ice-Pip safely across the spikes.',
        'Act III (Cold Feet): Blast the Crystal to clear the windblock — but a Laser shaft crosses the middle of the spikes and would thaw Ice-Pip mid-slide. Drop a Rock into the shaft to shut the beam off, then freeze yourself and ride the Fan across.',
      ],
    },
    {
      codes: ['P10', 'P11', 'P12'],
      names: ['P10 Float the Gap', 'P11 Dry Trench Blueprint', 'P12 Under the Beam, Over the Tide'],
      notes: [
        'Act I (High Tide): Detonate a Bomb on the Sluice pedestal to float two aligned crates up to level 1 as a bridge.',
        'Act II (High Tide): Hop into the dry trench, push the crate off the ramp to complete the bridge and uncover the exit ramp, then flood High.',
        'Act III (High Tide): A level 1 Laser sweeps the north crossing—walk down the ramp into the dry level 0 trench, pass safely UNDER the level 1 beam to push the north crate South out of the ray to y=13, climb back out, bomb W, and cross the floating bridge!',
      ],
    },
  ];

  const entries: CuratedPuzzleEntry[] = [];
  triads.forEach((triad, tIdx) => {
    const m = meta[tIdx];
    if (!m) return;
    triad.rooms.forEach((rm, sIdx) => {
      const act = (sIdx + 1) as 1 | 2 | 3;
      const code = m.codes[sIdx] ?? `P0${sIdx + 1}`;
      const name = m.names[sIdx] ?? rm.name;
      const designNote = m.notes[sIdx] ?? triad.title;
      entries.push({
        code,
        triad: triad.title,
        act,
        designNote,
        allowGenerousBaselineKit: act === 1,
        room: {
          ...rm,
          id: code.toLowerCase(),
          name,
        },
      });
    });
  });

  return entries;
}

function buildP13EmptyPockets(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // West chute hall (`x=7..9, y=9..15`) + East goal hall (`x=11..14, y=9..15`) joined by Mousehole `m`
  c.carveRect(7, 9, 9, 15, '.');
  c.carveRect(11, 9, 14, 15, '.');
  c.set(10, 14, 'm');

  // Bomb Grate + North chute to Crystal `C`
  c.set(8, 9, 'C');
  c.set(8, 10, 'n');
  c.set(8, 11, 'g');
  c.set(8, 12, 'n');
  c.set(7, 10, '#');
  c.set(9, 10, '#');
  c.set(7, 11, '#');
  c.set(9, 11, '#');

  // East side: Blue crystal barrier `UUU` + 1-tile pit `^` requiring a Roll!
  c.carveRect(11, 12, 14, 12, 'U');
  c.carveRect(11, 10, 14, 10, '^');
  c.set(13, 9, 'O');

  return {
    code: 'P13',
    designNote:
      'Roll a Bomb through the Bomb Grate up the chute to flip C, thread the Mousehole empty-handed, cross lowered U, and Roll across the pit to O.',
    room: {
      id: 'p13',
      name: 'P13 Empty Pockets',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      entry: [8, 14],
      condition: 'hold-buttons',
      rows: c.rows(),
    },
  };
}

function buildP14BankOffCascade(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // 3-step chute `(10,13) n -> (10,12) g -> (10,11) n` into Waterfall Veil `|` `(10, 10)`!
  // Unfrozen `|` `(10, 10)` douses the bomb on tick 3; frozen `|` stops it on `(10, 11)` beside `C` `(11, 11)`!
  c.carveRect(8, 10, 8, 14, '.');
  c.carveRect(8, 14, 11, 14, '.');
  c.set(9, 10, '=');
  c.set(10, 10, '|');
  c.set(10, 11, 'n');
  c.set(11, 11, 'C');
  c.set(10, 12, 'g');
  c.set(10, 13, 'n');
  c.set(12, 14, 'U');
  c.set(13, 14, 'O');

  return {
    code: 'P14',
    designNote:
      'Active Waterfall Veil at (10,10) douses any Bomb rolled up the chute; throw Ice over the fence to freeze the Veil into a solid backstop so a Bomb halts at (10,11) and flips C!',
    room: {
      id: 'p14',
      name: 'P14 Bank Off the Cascade',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'ice'],
      initialCrystal: 'blue',
      entry: [8, 14],
      condition: 'hold-buttons',
      rows: c.rows(),
    },
  };
}

function buildP15SpringTheMessenger(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  // Carve `x=6..7` on West bank so `(6, 13)` is flat `level 1` floor behind the `(7, 13)` cliff face!
  c.carveRect(6, 10, 14, 15, '.');
  c.setLevelRect(8, 11, 12, 15, '0');
  c.setLevelRect(11, 11, 14, 11, '1');
  c.set(11, 11, '#');
  c.set(12, 12, 'L');
  c.carveRect(13, 12, 14, 15, '#');
  c.carveRect(6, 10, 7, 11, '#');
  c.set(14, 11, 'O');

  c.set(9, 12, '#');
  c.set(11, 12, '#');
  c.set(9, 13, '#');
  c.set(11, 13, '#');
  c.set(10, 14, 'n');
  c.set(10, 13, 'g');
  c.set(10, 12, 'J');
  c.set(10, 11, '^');
  c.set(10, 10, '.');
  c.set(10, 9, 'C');
  c.carveRect(8, 10, 9, 10, '#');

  const lvls = c.levels();
  return {
    code: 'P15',
    designNote:
      'Hop down from level 1 into the basin, roll a Bomb through the Grate onto a Spring Pad that vaults it over a chasm to C, and step onto Pillar L before detonation to ride up to level 1 O!',
    room: {
      id: 'p15',
      name: 'P15 Spring the Messenger',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      pillars: 'red',
      entry: [6, 13],
      condition: 'hold-buttons',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      springs: [{ x: 10, y: 12, dir: 'N' }],
    },
  };
}

function buildP16TwoTierHandshake(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(8, 9, 12, 11, '.');
  c.carveRect(8, 12, 12, 12, '=');
  c.carveRect(8, 13, 12, 14, '.');
  c.set(10, 9, '#');
  c.set(10, 10, '#');
  c.set(12, 11, 'O');
  c.set(8, 14, 'O');

  return {
    code: 'P16',
    designNote:
      'Brass Beetle is fenced in the north pen behind an L-wall; use two Squeak lures across the balustrade to steer it south around the wall and east onto O1, then step on O2.',
    room: {
      id: 'P16'.toLowerCase(),
      name: 'P16 Beetle Shepherd',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['squeak'],
      entry: [9, 13],
      condition: 'hold-buttons',
      rows: c.rows(),
      creatures: [{ id: 'b1', kind: 'beetle', x: 9, y: 9, dir: 'E' }],
    },
  };
}

function buildP17DryTunnelWetFuse(): CuratedPuzzleEntry {
  // North tunnel `(9..11, 11)` is a 1-tile Cart Track `'t'` ending at Crystal `'C'` `(12, 11)`.
  // The Mine Cart sits at `(9, 11)` right in the mouth of the track—blocking Pip from entering the
  // dry tunnel! South passage `(10, 13)` has a Waterfall Veil `'|'` that douses any bomb Pip carries/throws.
  // Drop a Bomb into the Mine Cart at `(9, 11)` so it rolls East down the track `'t'` and detonates at `'C'`,
  // lowering the `'U'` barriers so Pip can walk through the Waterfall Veil onto `'O'`!
  const c2 = new BigRoomCanvas();
  c2.carveRect(7, 11, 8, 14, '.');
  c2.set(9, 13, '.');
  c2.set(9, 14, '.');
  c2.carveRect(11, 13, 13, 14, '.');
  c2.set(9, 11, 't');
  c2.set(10, 11, 't');
  c2.set(11, 11, 't');
  c2.set(12, 11, 't');
  c2.set(13, 11, 'C');
  c2.set(10, 13, '|');
  c2.set(12, 13, 'U');
  c2.set(12, 14, 'U');
  c2.set(13, 14, 'O');

  return {
    code: 'P17',
    designNote:
      'The Mine Cart blocks Pip from entering the dry north track tunnel, while the south Waterfall Veil douses bombs—load a Bomb into the Mine Cart so it rides the track to C, then walk through the Waterfall to O!',
    room: {
      id: 'p17',
      name: 'P17 Dry Track, Wet Passage',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      initialCrystal: 'blue',
      entry: [8, 13],
      condition: 'hold-buttons',
      rows: c2.rows(),
      creatures: [{ id: 'cart1', kind: 'cart', x: 9, y: 11, dir: 'E' }],
    },
  };
}

function buildP18BurnAwayTimer(): CuratedPuzzleEntry {
  // True Burn-Away Timer:
  // - Laser `L1` `(7, 11) -> E` powers normal Sensor `S1` `(15, 11)` AND blocks the only corridor `(13, 10..13)` to `O` `(13, 13)`!
  // - Crate is fenced inside a 3x3 Dial centered at `(10, 12)` (`crate` at `(9, 12)`).
  // - Bombing Crystal `C` `(12, 9)` rotates the Dial 90° CW, swinging the crate into `(10, 11)`:
  //   1. While the crate burns in the beam (`4` ticks), the Laser downstream at `(13, 11)` is BLOCKED—unblocking Pip's path to `O` `(13, 13)`!
  //   2. Once Pip crosses to `O`, the crate finishes burning to ash—so the Laser shoots across `(13, 11)` again (re-blocking the path behind Pip) and powers `S1`!
  const c3 = new BigRoomCanvas();
  c3.carveRect(7, 9, 13, 10, '.');
  c3.set(7, 9, 'C');
  c3.carveRect(8, 10, 12, 14, '=');
  c3.carveRect(9, 11, 11, 13, '.'); // 3x3 dial interior (`cx=10, cy=12`) fenced off from Pip
  c3.set(7, 11, '.');
  c3.set(8, 11, '=');
  c3.set(12, 11, '=');
  c3.carveRect(13, 10, 13, 13, '.'); // East crossing corridor across `y=11` to `O` `(13, 13)`
  c3.set(13, 13, 'O');
  c3.set(14, 11, '=');
  c3.set(15, 11, '.');

  return {
    code: 'P18',
    designNote:
      'Laser L1 powers normal Sensor S1 while blocking the east hallway to O! Flip C with a Bomb so the 3x3 Dial swings the crate into L1—shielding the hallway for 4 ticks so you can cross to O before the crate burns to ash and re-powers S1.',
    room: {
      id: 'p18',
      name: 'P18 Burn-Away Timer',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      entry: [11, 9],
      condition: 'buttons-and-sensors',
      rows: c3.rows(),
      props: [{ id: 'crate', kind: 'crate', x: 9, y: 12 }],
      turntables: [{ id: 'dial', cx: 10, cy: 12, size: 3, trigger: 'crystal' }],
      lasers: [{ id: 'L1', x: 7, y: 11, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 15, y: 11, level: 0 }],
    },
  };
}

function buildP19SnatchFromRay(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  const rowY = 12;
  c.carveRect(7, rowY - 2, 13, rowY + 2, '.');
  c.set(9, rowY, 'Q');
  c.set(9, rowY - 1, '#');
  c.set(9, rowY + 1, '#');
  c.set(10, rowY, '!');
  c.set(10, rowY + 1, 'G');
  c.set(11, rowY + 1, '#');
  c.set(12, rowY - 1, '#');
  c.set(12, rowY + 1, '#');
  c.set(13, rowY, '#');
  c.set(12, rowY, ';');

  return {
    code: 'P19',
    designNote:
      'Push the crate across spikes under Laser L1 (igniting it!), shove it into the tunnel to light Brazier b1, and Wind-gust the burning crate onto shallow water Q before it burns to ash!',
    room: {
      id: 'p19',
      name: 'P19 Snatch from the Ray',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['wind'],
      entry: [8, rowY],
      condition: 'torches-and-sensors',
      rows: c.rows(),
      switches: [{ x: 12, y: rowY, kind: 'Q' }],
      props: [{ id: 'crate', kind: 'crate', x: 9, y: rowY }],
      braziers: [{ id: 'b1', x: 11, y: rowY - 1 }],
      lasers: [{ id: 'L1', x: 10, y: rowY - 2, dir: 'S', level: 0 }],
      sensors: [{ id: 'S1', x: 10, y: rowY + 2, level: 0 }],
    },
  };
}

function buildP20SpinToUnpin(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  const dialCy = 12;
  c.carveRect(6, dialCy - 3, 8, dialCy + 3, '.');
  c.carveRect(10, dialCy - 2, 15, dialCy + 3, '.');
  c.set(9, dialCy + 2, 'm');
  c.set(7, dialCy - 3, 'C');
  c.set(7, dialCy - 2, 'n');
  c.set(7, dialCy - 1, 'g');
  c.set(7, dialCy, 'n');
  c.set(6, dialCy - 2, '#');
  c.set(8, dialCy - 2, '#');
  c.set(6, dialCy - 1, '#');
  c.set(8, dialCy - 1, '#');

  const dialCx = 12;
  c.set(dialCx, dialCy - 2, '#');
  c.set(dialCx - 1, dialCy - 1, '#');
  c.set(dialCx + 1, dialCy - 1, '#');
  c.set(dialCx + 2, dialCy + 2, 'O');
  c.set(10, dialCy + 2, 'O');

  return {
    code: 'P20',
    designNote:
      'Crate is pinned inside a 3-wall dead-end on a 3x3 Dial; dispatch a Bomb through the Grate to flip C (rotating the pocket 90° CW), squeeze through the Mousehole, and push the crate onto O.',
    room: {
      id: 'p20',
      name: 'P20 Spin to Unpin',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      entry: [7, dialCy + 2],
      condition: 'hold-buttons',
      rows: c.rows(),
      props: [{ id: 'crate', kind: 'crate', x: dialCx, y: dialCy - 1 }],
      turntables: [{ id: 'dial', cx: dialCx, cy: dialCy, size: 3, trigger: 'crystal' }],
    },
  };
}

function buildP21PrismBackhand(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // `(11, 11)` `~` directly under Laser `L1` `(6, 11) -> S1(14, 11)` is the ONLY gap through the `x=11` wall!
  // Any ice frozen at `(11, 11)` while `L1` is active melts immediately on the same tick.
  // 1. Push Mirror `m1` (`NE`) North into `(8, 11)` so its fireproof rear face blocks `L1`.
  // 2. Freeze `(11, 11)` `~` with `Ice`, push Mirror `m2` East across `(11, 11)` to `(12, 11)` and South onto `O1` `(12, 12)`.
  // 3. Walk back across `(11, 11)` and push `m1` South out of the beam onto `O2` `(8, 13)` (letting `L1` melt `(11, 11)` and power `S1`) while Pip steps onto `O3` `(7, 13)`!
  c.carveRect(7, 10, 10, 13, '.');
  c.set(6, 11, '.');
  c.set(11, 11, '~');
  c.carveRect(12, 10, 14, 12, '.');
  c.set(13, 12, 'O');
  c.set(8, 13, 'O');
  c.set(7, 13, 'O');

  return {
    code: 'P21',
    designNote:
      "The only water crossing at (11,11) lies directly under Laser L1 (which instantly melts unshielded ice)! Push Mirror m1's fireproof rear into (8,11) to block L1, freeze (11,11) and push m2 across to O1, then return West and push m1 out of the ray onto O2!",
    room: {
      id: 'p21',
      name: 'P21 Prism Backhand',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['ice'],
      entry: [7, 12],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [
        { id: 'm1', kind: 'mirror', x: 8, y: 12, facing: 'NE' },
        { id: 'm2', kind: 'mirror', x: 10, y: 11, facing: 'NE' },
      ],
      lasers: [{ id: 'L1', x: 6, y: 11, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 14, y: 11, level: 0 }],
    },
  };
}

function buildP22DuckRayRaiseColumn(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  c.carveRect(6, 10, 14, 14, '.');
  c.setLevelRect(8, 11, 13, 14, '0');
  c.carveRect(6, 10, 7, 11, '#');
  c.set(10, 11, 'L');
  c.set(9, 13, 'Q');
  // No Gate `G` needed: the Inverter Laser `L1 -> S1` itself requires raising Pillar `'L'` `(10, 11)`!
  c.set(13, 13, 'O');
  c.carveRect(12, 12, 13, 12, '#');
  c.carveRect(12, 14, 13, 14, '#');

  const lvls = c.levels();
  return {
    code: 'P22',
    designNote:
      'Hop down to level 0 to walk safely beneath the level 1 Laser, blast-shove the Stone onto Q so fireproof Pillar L rises to sever the Inverter beam, then step onto O.',
    room: {
      id: 'p22',
      name: 'P22 Duck the Ray, Raise the Column',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      pillars: 'switches',
      entry: [6, 13],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      props: [{ id: 'st', kind: 'stone', x: 9, y: 12 }],
      lasers: [{ id: 'L1', x: 7, y: 11, dir: 'E', level: 1 }],
      sensors: [{ id: 'S1', x: 14, y: 11, level: 1, inverted: true }],
    },
  };
}

export function buildSuitePartA(): CuratedPuzzleEntry[] {
  return [
    ...buildTriadEntries(),
    buildP13EmptyPockets(),
    buildP14BankOffCascade(),
    buildP15SpringTheMessenger(),
    buildP16TwoTierHandshake(),
    buildP17DryTunnelWetFuse(),
    buildP18BurnAwayTimer(),
    buildP19SnatchFromRay(),
    buildP20SpinToUnpin(),
    buildP21PrismBackhand(),
    buildP22DuckRayRaiseColumn(),
  ];
}
