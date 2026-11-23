/**
 * Curated `22 x 26` Abstracted Puzzle Suite — Part B (`P23-P42`).
 *
 * Twenty standalone `22 x 26` multi-step puzzles showcasing buoyancy + magnetism, stern-recoil
 * rafts, meltwater puddles, spring-vaulted embers, wind-vortex curveballs, branching fuses,
 * Self-Cryo curling, 3x3 rotating grate-chutes, dual-face mirrors, calm-lee windbreaks,
 * Mimic cryo-relays, and capstone clockwork synthesis.
 */
import { BigRoomCanvas, LAB_BIG_H, LAB_BIG_W } from './generate';
import type { CuratedPuzzleEntry } from './suitePartA';

function buildP23FireproofEclipse(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  // Separate north canal `(9..10, 11)` from south crate canal `(9..10, 13)` with `#` walls `(9..10, 12)`
  // so crates on `y=13` can NEVER be pushed into `y=11`—ONLY Magnet from `(7, 11)`? `(7, 11)` is `L1`!
  // Put `L1` at `(6, 11)` (`(7, 11)` `.`? `(7, 11)` would be in `L1`!). Put `Raft` at `(9, 11)`, `Metal` at `(9, 12)`
  // inside `(9, 11..12)` (`#` at `(9..10, 13)`? Put south crate bridge on `y=14` `(9..10, 14)` separated by `#` `(9..10, 13)`!).
  c.carveRect(5, 9, 13, 14, '.');
  c.setLevelRect(9, 11, 10, 14, '0');
  c.carveRect(9, 11, 10, 12, ';');
  c.carveRect(9, 13, 10, 13, '#');
  c.carveRect(9, 14, 10, 14, ';');
  c.set(7, 13, 'W');
  c.set(12, 14, 'O');
  const lvls = c.levels();

  return {
    code: 'P23',
    designNote:
      'While Low, Magnet-pull the fireproof Metal block onto the grounded Raft in the north basin, then bomb Sluice W so Raft+Metal rises to level 1 and eclipses the Inverter Laser while crates bridge the south canal!',
    room: {
      id: 'p23',
      name: 'P23 Fireproof Eclipse',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'magnet'],
      maxActiveBombs: 1,
      entry: [7, 14],
      condition: 'buttons-and-sensors',
      sluice: { initial: 0 },
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      props: [
        { id: 'raft', kind: 'raft', x: 9, y: 11 },
        { id: 'metal', kind: 'metal', x: 9, y: 12 },
        { id: 'c1', kind: 'crate', x: 9, y: 14 },
        { id: 'c2', kind: 'crate', x: 10, y: 14 },
      ],
      lasers: [{ id: 'L1', x: 6, y: 11, dir: 'E', level: 1 }],
      sensors: [{ id: 'S1', x: 13, y: 11, level: 1, inverted: true }],
    },
  };
}

function buildP24SternThruster(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(8, 8, 12, 9, '.');
  c.carveRect(8, 10, 12, 10, '=');
  c.set(8, 10, '.');
  c.set(8, 11, '.');
  c.carveRect(9, 11, 12, 13, '~');
  c.set(11, 10, '.');
  c.set(10, 10, '#');
  c.set(11, 9, '#');
  c.set(11, 14, 'O');

  return {
    code: 'P24',
    designNote:
      'Throw a Rock Bomb over the north balustrade into the lake to build a mooring post at (12,11), board the Raft, and use two Bomb stern-recoils (East into the post, then South) to reach O!',
    room: {
      id: 'p24',
      name: 'P24 Stern Thruster',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'rock'],
      entry: [8, 11],
      condition: 'hold-buttons',
      rows: c.rows(),
      props: [{ id: 'raft', kind: 'raft', x: 9, y: 11 }],
    },
  };
}

function buildP25PuddleMaker(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(7, 9, 13, 14, '.');
  // Keep `x=11` open for `L2 (11,9) -> S2 (11,14)` while walling `(12..13, 10)` & `(12..13, 12)`!
  c.set(12, 10, '#');
  c.set(13, 10, '#');
  c.set(12, 12, '#');
  c.set(13, 12, '#');
  c.set(13, 11, '#');
  c.set(8, 9, 'C');
  c.set(10, 11, 'B');
  c.set(11, 11, ';');
  c.set(12, 11, 'O');
  c.set(8, 13, 'O');

  return {
    code: 'P25',
    designNote:
      'Flip C once so the 1x1 Laser melts Ice Block B into a puddle, flip C again to aim at S1, then freeze the new puddle & crate with Ice so the crate hydroplanes past L2 onto O1!',
    room: {
      id: 'p25',
      name: 'P25 Puddle Maker',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'ice'],
      entry: [8, 11],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [{ id: 'crate', kind: 'crate', x: 9, y: 11 }],
      turntables: [{ id: 'tt1', cx: 10, cy: 10, size: 1, trigger: 'crystal' }],
      lasers: [
        { id: 'L1', x: 10, y: 10, dir: 'E', level: 0, turntableId: 'tt1' },
        { id: 'L2', x: 11, y: 9, dir: 'S', level: 0 },
      ],
      sensors: [
        { id: 'S1', x: 7, y: 10, level: 0 },
        { id: 'S2', x: 11, y: 14, level: 0 },
      ],
    },
  };
}

function buildP26FlyingEmber(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(8, 9, 12, 16, '.');
  c.set(10, 11, '^');
  c.set(10, 12, 'J');
  c.set(10, 13, '%');
  c.carveRect(8, 11, 9, 12, '#');
  c.carveRect(11, 11, 12, 12, '#');

  return {
    code: 'P26',
    designNote:
      'Fire Bomb withheld! Blast %, push the Wooden Crate onto the Spring Pad so it vaults over the chasm directly into the Laser—igniting and radiating fire to light both flanking braziers!',
    room: {
      id: 'p26',
      name: 'P26 Flying Ember',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb'],
      entry: [9, 15],
      condition: 'all-torches',
      rows: c.rows(),
      props: [{ id: 'crate', kind: 'crate', x: 10, y: 14 }],
      springs: [{ x: 10, y: 12, dir: 'N' }],
      lasers: [{ id: 'L1', x: 8, y: 10, dir: 'E', level: 0 }],
      braziers: [
        { id: 'b1', x: 10, y: 9 },
        { id: 'b2', x: 11, y: 10 },
      ],
    },
  };
}

function buildP27CurveballInGale(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Three consecutive `U` barriers `(11, 15..17)` make `wind-jump` (max dist 3) 100% impossible!
  c.carveRect(8, 13, 11, 14, '.');
  c.carveRect(8, 10, 13, 12, '^');
  c.set(12, 12, '.');
  c.set(13, 12, 'C');
  c.set(11, 15, 'U');
  c.set(11, 16, 'U');
  c.set(11, 17, 'U');
  c.set(11, 18, 'O');

  return {
    code: 'P27',
    designNote:
      'Spawn a North-facing Wind Vortex in front of the chasm, then drop a Bomb into the vortex: it launches airborne into an East crosswind Fan, curving 90° mid-air onto (12,12) to flip C!',
    room: {
      id: 'p27',
      name: 'P27 Curveball in the Gale',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'wind'],
      initialCrystal: 'blue',
      entry: [9, 14],
      condition: 'hold-buttons',
      rows: c.rows(),
      fans: [{ id: 'F1', x: 7, y: 12, dir: 'E', level: 0 }],
    },
  };
}

function buildP28DouseTheBranch(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  // `%` cracked wall at `(6, 11)` protects Sluice `'W'` `(6, 10)` so Fire Bomb cannot toggle `'W'`!
  // `=` fence at `(7, 12)` stops Pip at `(6, 12)` from walking up the `,` grass fuse!
  c.carveRect(6, 12, 6, 13, '.');
  c.set(6, 11, '%');
  c.set(6, 10, 'W');
  c.set(7, 12, '=');
  c.set(8, 12, ',');
  c.set(8, 11, ',');
  c.set(8, 10, ',');
  c.set(8, 9, ',');
  c.set(8, 8, ',');
  c.set(9, 8, ',');
  c.set(10, 8, ',');
  c.set(11, 8, '.');
  c.set(9, 12, ',');
  c.setLevelRect(9, 12, 9, 12, '0');
  c.set(10, 12, 'Q');
  c.carveRect(7, 14, 12, 14, '.');
  c.set(9, 14, 'G');
  const lvls = c.levels();

  return {
    code: 'P28',
    designNote:
      'Igniting the fuse over the fence burns the crate on Q in 5 ticks—before the 8-tick north branch reaches the brazier! Blast % and Sluice W to flood the east branch first, then throw Fire onto the fuse.',
    room: {
      id: 'p28',
      name: 'P28 Douse the Branch',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'fire'],
      entry: [6, 12],
      condition: 'torches-and-sensors',
      sluice: { initial: 0, basinCells: [[9, 12]] },
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      props: [{ id: 'crate', kind: 'crate', x: 10, y: 12 }],
      braziers: [{ id: 'b1', x: 11, y: 8 }],
      lasers: [{ id: 'L1', x: 7, y: 14, dir: 'E', level: 1 }],
      sensors: [{ id: 'S1', x: 12, y: 14, level: 1 }],
    },
  };
}

function buildP29ElevatorOnTide(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  // North `level 1` balcony `(7..10, 9)` with `'='` fence at `(10, 10)` lets Pip throw Magnet South down
  // onto Raft `(10, 11)` (`level 0`), pulling Metal `(10, 12)` aboard before bombing Sluice `W` `(6, 12)`.
  // `#` walls at `(9, 10..13)` seal the west side of the elevator shaft so Metal can ONLY be pulled East
  // onto `O1` `(11, 11)` by crossing the south crate bridge `c1, c2` `(9..10, 14)` to the East bank!
  c.carveRect(6, 9, 10, 14, '.');
  c.carveRect(11, 11, 12, 14, '.');
  c.carveRect(9, 10, 9, 13, '#');
  c.set(10, 10, '=');
  c.setLevelRect(10, 11, 10, 12, '0');
  c.carveRect(10, 11, 10, 12, ';');
  c.set(10, 13, '#');
  c.setLevelRect(9, 14, 10, 14, '0');
  c.carveRect(9, 14, 10, 14, ';');
  c.set(6, 12, 'W');
  c.set(11, 11, 'O');
  c.set(12, 14, 'O');
  const lvls = c.levels();

  return {
    code: 'P29',
    designNote:
      'Metal sinks if flooded directly! While Low, throw Magnet onto the grounded Raft to pull Metal North aboard, bomb Sluice W to lift Raft+Metal and the south crate bridge to level 1, cross East, and Magnet-pull Metal onto O1.',
    room: {
      id: 'p29',
      name: 'P29 Elevator on the Tide',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'magnet'],
      maxActiveBombs: 1,
      entry: [7, 14],
      condition: 'hold-buttons',
      sluice: { initial: 0 },
      rows: c.rows(),
      ...(lvls ? { levels: lvls } : {}),
      props: [
        { id: 'raft', kind: 'raft', x: 10, y: 11 },
        { id: 'metal', kind: 'metal', x: 10, y: 12 },
        { id: 'c1', kind: 'crate', x: 9, y: 14 },
        { id: 'c2', kind: 'crate', x: 10, y: 14 },
      ],
    },
  };
}

function buildP30MouseOnTheRocks(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // `L1` shoots NORTH `(9, 12) -> S1(9, 10)` and stops on `#` `(9, 9)` (preventing Pip from ever crossing `x=9` on `y=11`),
  // while upper gallery `(8..10, 8)` lets Pip walk East to `(12, 9)` and throw a Rock boulder onto `(12, 11)`!
  c.carveRect(8, 8, 10, 8, '.');
  c.carveRect(7, 9, 12, 9, '.');
  c.set(9, 9, '#');
  c.carveRect(7, 10, 8, 13, '.');
  c.carveRect(9, 10, 12, 10, '=');
  c.carveRect(8, 11, 11, 11, ';');
  c.set(12, 11, '.');
  c.set(8, 13, ';');
  c.set(9, 13, '!');
  c.set(10, 13, '!');
  c.set(11, 13, '!');
  c.set(12, 13, '.');
  c.set(12, 14, 'O');

  return {
    code: 'P30',
    designNote:
      'Throw a Rock stopper over the north fence onto (12,11), frost-coat the Crate with Ice so it hydroplanes across Laser L1 against the Rock onto O1, then Self-Cryo across the spikes onto O2!',
    room: {
      id: 'p30',
      name: 'P30 Mouse on the Rocks',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['ice', 'rock'],
      maxActiveBombs: 1,
      entry: [7, 10],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      switches: [{ x: 11, y: 11, kind: 'O' }],
      props: [{ id: 'crate', kind: 'crate', x: 8, y: 11 }],
      lasers: [{ id: 'L1', x: 9, y: 12, dir: 'N', level: 0 }],
      sensors: [{ id: 'S1', x: 9, y: 10, level: 0 }],
      fans: [{ id: 'F2', x: 6, y: 13, dir: 'E', level: 0 }],
    },
  };
}

function buildP31BeetleCurling(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(8, 11, 10, 13, '.');
  c.set(10, 12, ';');
  c.set(11, 12, 'g');
  c.set(12, 12, 'O');
  c.set(8, 13, 'O');

  return {
    code: 'P31',
    designNote:
      'Lure the Brass Beetle onto the shallow puddle with Squeak, encase both puddle and Beetle with Ice, and kick the Beetle-cube straight through the Bomb Grate onto O1!',
    room: {
      id: 'p31',
      name: 'P31 Beetle Curling',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['squeak', 'ice'],
      maxActiveBombs: 1,
      entry: [8, 12],
      condition: 'hold-buttons',
      rows: c.rows(),
      creatures: [{ id: 'b1', kind: 'beetle', x: 9, y: 11, dir: 'S' }],
    },
  };
}

function buildP32FourSpokeDispatch(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Bomb Grate `'g'` at `(6, 12)` OUTSIDE the 3x3 Dial `(8, 12)` (`x=7..9, y=11..13`) prevents Pip from walking in!
  // Fire Bomb 1: `(5,12) e -> (6,12) g -> (7,12) e -> (8,12) e` -> hits `C` `(8, 11)`? Wait: if `C` is at `(8, 11)`,
  // `(8, 11)` is inside the dial! Put Dial at `(8, 12)`, `(5,12) e -> (6,12) g -> (7,12) e -> (8,12)`?
  // Put `'e'` at `(6, 12)`? No, Pip walks on `'e'`! Put Pip at `(5, 12)` throwing East over `=` `(6, 12)` onto `(7, 12)` `'e'`!
  // TRACE THROW OVER `=` `(6, 12)`:
  // - **Fire Bomb 1** thrown East from `(5, 12)` (`fuse = 3`, `airborneSteps = 2`):
  //   - Tick 1 (`throw`): flies `(5,12) -> (6,12) = -> (7,12) e` (`airborneSteps = 0`, `fuse = 2`)!
  //   - Tick 2: rolls `(7,12) e -> (8,12) e` (`fuse = 1`)!
  //   - Tick 3: rolls `(8,12) e -> (9,12) .` -> DETONATES at `(9, 12)`, hitting `'C'` `(10, 12)`!
  //   - Dial `(8, 12)` rotates `90° CW`: `(8, 13)` `'n'` rotates into `(7, 12)` `'e'`, and `(8, 12)` `'e'` becomes `'s'`!
  // - **Fire Bomb 2** thrown East from `(5, 12)`:
  //   - Tick 1 (`throw`): lands on `(7, 12)` `'e'` (`fuse = 2`)!
  //   - Tick 2: rolls `(7,12) e -> (8,12) s` (`fuse = 1`)!
  //   - Tick 3: rolls `(8,12) s -> (8,13) .` -> DETONATES at `(8, 13)`, lighting sealed Brazier `b1` at `(8, 14)`!
  c.set(5, 12, '.');
  c.set(5, 13, '.');
  c.set(6, 12, '=');
  c.set(7, 12, 'e');
  c.set(8, 12, 'e');
  c.set(9, 12, '.');
  c.set(8, 13, 'n');
  c.set(10, 12, 'C');
  c.set(8, 14, '.');

  return {
    code: 'P32',
    designNote:
      'Throw Fire Bomb 1 over the balustrade onto the 3x3 Dial chute so it rolls East to flip C (rotating the chute 90° CW), then throw Fire Bomb 2 to the exact same tile so it now curves South to light the sealed brazier!',
    room: {
      id: 'p32',
      name: 'P32 Four-Spoke Dispatch',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['fire'],
      entry: [5, 12],
      condition: 'all-torches',
      rows: c.rows(),
      braziers: [{ id: 'b1', x: 8, y: 14 }],
      turntables: [{ id: 'dial', cx: 8, cy: 12, size: 3, trigger: 'crystal' }],
    },
  };
}

function buildP33MirrorMerryGoRound(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Put `m2` at `(10, 13)` so `(9, 13)` `.` is open West of `m2` for pushing East across frozen `~` `(11, 13)`!
  c.carveRect(7, 10, 10, 13, '.');
  c.carveRect(11, 10, 11, 13, '~');
  c.carveRect(12, 10, 13, 13, '.');
  c.set(13, 10, 'C');
  c.set(12, 13, 'O');
  c.set(13, 13, 'O');
  c.set(8, 11, '=');
  c.set(10, 11, '=');
  c.set(9, 10, '=');
  c.set(9, 12, '=');
  c.set(9, 14, '.');

  return {
    code: 'P33',
    designNote:
      'Fenced SE Mirror on a 1x1 Turntable shields the ~ moat from L1 while you freeze an ice bridge and push Mirror m2 across onto O1—then flip C on the far bank to rotate m1 to SW and power S1!',
    room: {
      id: 'p33',
      name: 'P33 Mirror on the Merry-Go-Round',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'ice'],
      entry: [8, 13],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [
        { id: 'm1', kind: 'mirror', x: 9, y: 11, facing: 'SE' },
        { id: 'm2', kind: 'mirror', x: 10, y: 13, facing: 'NE' },
      ],
      turntables: [{ id: 'tt1', cx: 9, cy: 11, size: 1, trigger: 'crystal' }],
      lasers: [{ id: 'L1', x: 7, y: 11, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 9, y: 14, level: 0 }],
    },
  };
}

function buildP34VaultTheBeam(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // ONE single Spring Pad `'J'` at `(10, 11)` must vault BOTH the crate and Pip over Laser `L1` (`y=12`)!
  // If you vault the bare crate, it stops on the landing pad `(10, 13)` `;`—blocking Pip from vaulting after it!
  // Frost-coat the crate with `Ice` BEFORE pushing it onto `'J'` `(10, 11)`: when it lands on `(10, 13)` `;`,
  // it immediately hydroplanes South onto `O1` `(10, 14)`, clearing `(10, 13)` so Pip can vault after it onto `O2` `(11, 13)`!
  c.carveRect(9, 9, 11, 10, '.');
  c.set(10, 11, 'J');
  c.carveRect(7, 12, 14, 12, '.');
  c.set(10, 12, '^');
  c.set(10, 13, ';');
  c.set(10, 14, ';');
  c.set(11, 13, 'O');

  return {
    code: 'P34',
    designNote:
      'Only ONE Spring Pad crosses Laser L1—if you vault a bare crate, it stops on the landing tile (10,13) and blocks you from jumping after it! Frost-coat the crate with Ice first so it lands on (10,13) ; and immediately hydroplanes onto O1 (10,14), clearing the landing pad for Pip!',
    room: {
      id: 'p34',
      name: 'P34 Vault the Beam',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['ice'],
      entry: [10, 9],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      switches: [{ x: 10, y: 14, kind: 'O' }],
      props: [{ id: 'crate', kind: 'crate', x: 10, y: 10 }],
      springs: [{ x: 10, y: 11, dir: 'S' }],
      lasers: [{ id: 'L1', x: 7, y: 12, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 14, y: 12, level: 0 }],
    },
  };
}

function buildP35TortoiseEclipse(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(7, 10, 9, 13, '.');
  c.set(9, 11, ';');
  c.set(10, 11, 'g');
  // Carve `(11, 9..13)` to `.` so `L1 (11,9) -> S` hits `S1 (11,13)` until the Tortoise lands at `(11,11)`!
  c.carveRect(11, 9, 11, 13, '.');
  c.set(8, 13, 'O');

  return {
    code: 'P35',
    designNote:
      'Encase the iron Tortoise in Ice on the puddle and kick it East through the Bomb Grate into the Inverter Laser—the beam thaws it, trapping it between Grate and wall as a permanent fireproof eclipse!',
    room: {
      id: 'p35',
      name: 'P35 Tortoise Eclipse',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['ice'],
      entry: [7, 11],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      creatures: [{ id: 't1', kind: 'tortoise', x: 9, y: 11, dir: 'E' }],
      lasers: [{ id: 'L1', x: 11, y: 9, dir: 'S', level: 0 }],
      sensors: [{ id: 'S1', x: 11, y: 13, level: 0, inverted: true }],
    },
  };
}

function buildP36MeltYourTracks(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Double spikes `(8..9, 11)` block Pip from rolling East! Throwing Bomb East from `(7, 11)` stops in front
  // of Stone `st` `(9, 11)` at `(8, 11)`, shoving `st` onto `(10, 11)` `;`—and ONLY if `(10..11, 11)` are frozen
  // with Ice does `st` curl all the way onto frozen `(12, 11)` `~`, where flipping `C` melts `(12, 11)` to sink `st` onto `Q`!
  c.carveRect(7, 10, 7, 13, '.');
  c.carveRect(7, 13, 11, 13, '.');
  c.set(8, 10, 'C');
  c.set(8, 11, '!');
  c.set(9, 11, '!');
  c.set(10, 11, ';');
  c.set(11, 11, ';');
  c.set(11, 12, '=');
  c.set(12, 10, '.');
  c.set(12, 11, '~');
  c.set(12, 12, '~');
  c.set(12, 13, '.');
  c.set(6, 13, 'G');
  c.set(5, 13, 'O');

  return {
    code: 'P36',
    designNote:
      'Throw Ice over the south fence to freeze the marsh & river, blast-curl Stone P across frost onto frozen (12,11), then flip C so Laser L1 melts (12,11)—sinking P onto underwater Q while L1 passes over it to S1!',
    room: {
      id: 'p36',
      name: 'P36 Melt and Sink',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'ice'],
      maxActiveBombs: 1,
      entry: [9, 13],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      switches: [{ x: 12, y: 11, kind: 'Q' }],
      props: [{ id: 'st', kind: 'stone', x: 9, y: 11 }],
      turntables: [{ id: 'tt1', cx: 12, cy: 10, size: 1, trigger: 'crystal' }],
      lasers: [{ id: 'L1', x: 12, y: 10, dir: 'E', level: 0, turntableId: 'tt1' }],
      sensors: [{ id: 'S1', x: 12, y: 13, level: 0 }],
    },
  };
}

function buildP37ThreeJobsForPine(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Single Wooden Crate `W` does 3 distinct jobs:
  // 1. Pushed into `~` `(10, 12)` as a floating bridge so Pip crosses East to `(11, 12)`!
  // 2. Wait: once floating in `~`, crates can't be pushed out of `~` — instead:
  //    Job 1 (`laser-blocker`): `W` starts at `(9, 11)` blocking Laser `L1` `(7, 11) -> E`? Move `W` INTO `(9, 10)`?
  //    Look at our `frost-armored` + `moved` + `switch-weight` + `laser-blocker` chain:
  //    1. Push `W` `(9, 11) -> (9, 12)` into Inverter Laser `L1` `(7, 12) -> S1(13, 12)` (`latch: true`) — latching `S1` while igniting `W`!
  //    2. Immediately push burning `W` `(9, 12) -> (9, 13)` (`;` shallow puddle!) — **dousing** `W` before it burns to ash AND lighting adjacent Brazier `b1` `(10, 12)`?
  //       Wait: while `W` is at `(9, 12)` for 1 tick (duringPip's move to `(9, 11)`!), `W` radiates fire East to light Brazier `b1` `(10, 12)`!
  //    3. Freeze `;` `(9, 13)` with `Ice` and push `W` South onto `O1` `(9, 14)` (`!` spikes at `(8, 14)`? No, Pip steps on `O2` `(8, 14)`)!
  //    Check `W` roles: `moved` + `laser-blocker` + `burning-fuel` + `doused` + `switch-weight` = **5 PHYSICAL ROLES ON ONE CRATE** (`No Fire Bomb!`)!
  c.carveRect(7, 10, 12, 14, '.');
  c.set(9, 13, ';');
  c.set(9, 14, 'O');
  c.set(8, 14, 'O');
  // Fence off Brazier `b1` at `(10, 11)`? Put `b1` at `(10, 11)` (`1` tile N of `(10, 12)`):
  // Push `W` into `(10, 12)` (Laser `y=12`): `W` eclipses `S1` `(13, 12)` (`latch: true`), ignites, and on the next tick
  // when Pip pushes `W` South onto `;` `(10, 13)`? Wait: `stepLabTick` runs step 5 (`nextIgnitions` from `burnTicks > 0`) BEFORE step 6 (`settleBuoyancy`? No: `settleBuoyancy` ran inside `step` push BEFORE `stepLabTick`!).
  // So let `W` sit at `(10, 12)` for `1` move (`moveTo(10, 11)` takes 1 tick -> `W` at `(10, 12)` radiates fire East to `b1` `(11, 12)`? `11, 12` is in `L1`! Put `L1` shooting **SOUTH** `(10, 9) -> S1(10, 15)`? `(10, 14)` has `W`!).
  // Put `L1` shooting **EAST** `(7, 12) -> S1(13, 12)`, `b1` at **`(10, 11)`** (`1` tile North of `(10, 12)`!):
  // - Push `W` East `(9, 12) -> (10, 12)` (`W` is in `L1`, `burnTicks = 4`, `S1` latches!).
  // - Pip walks `(9, 12) -> (9, 11) -> (10, 11)`? `(10, 11)` has `b1`! Put `b1` at **`(11, 11)`**, push `W` `(10, 12) -> (11, 12)` (`1` tick: while at `(10,12)`->`(11,12)`, `W` stays in `L1`, radiates fire North to `b1` `(11, 11)`!!), then Pip walks around to `(11, 11)`? `b1` is at `(11, 11)`, so put `b1` at **`(11, 13)`** and `;` at **`(11, 11)`** (`O1` at `(11, 10)`)!
  // TRACE THAT:
  // - `L1` `(7, 12) -> E` to `S1` `(13, 12)` (`inverted: true, latch: true`).
  // - `b1` Brazier at `(10, 13)`.
  // - `;` shallow puddle at `(10, 11)`, `O1` at `(10, 10)`, `O2` at `(8, 10)`.
  // 1. Stand at `(10, 11)`? Walk to `(9, 12)`? Start `W` at `(9, 12)`:
  //    Push `W` East `(9, 12) -> (10, 12)`: `W` enters `L1` -> `S1` latches + `W` ignites (`burnTicks = 4`).
  // 2. Walk Pip from `(9, 12)` to `(11, 12)`? `(11, 12)` is safe while `W` blocks `L1` at `(10, 12)`!
  //    Better: Pip walks `(9, 12) -> (9, 13) -> (10, 13)`? `(10, 13)` is `b1`! Put `b1` at **`(11, 12)`**? `L1` would light `b1` directly!
  //    Put `b1` at **`(10, 13)`**, and `W` starts at `(9, 12)`:
  //    - Step 1: Push `W` East `(9, 12) -> (10, 12)` (`burnTicks = 4`, `S1` latches).
  //    - Now how do you push `W` `(10, 12)` NORTH onto `;` `(10, 11)` when `(10, 13)` South of it has `b1`?!
  //      Swap N and S: `b1` is at **`(10, 11)`**, `;` is at **`(10, 13)`**, `O1` is at **`(10, 14)`**!
  //      - Step 1: Push `W` East `(9, 12) -> (10, 12)` (`burnTicks = 4`, `S1` latches!).
  //      - Step 2: `Wind` bomb (`kit: ['wind']`) at `(9, 11)`? With `kit: ['wind']`:
  //        Drop `Wind` at `(10, 11)`? `(10, 11)` is `b1`! Drop `Wind` at `(9, 12)` facing `'S'`: during `Wind`'s 3-tick fuse, burning `W` at `(10, 12)` **lights `b1` `(10, 11)`** on tick 1, and on tick 3 `Wind` (`dx=+1, dy=0`? `(9, 12)` pushes `W` East!).
  //        No `Wind` needed at all — put `b1` at **`(11, 12)`** behind `#`? Wait: if `b1` is at `(10, 11)` and `;` is at `(11, 12)`? `L1` doesn't stop on `;`!
  //        Put `;` at **`(11, 12)`**? No, in active Laser `;` doesn't douse (`!inActiveLaser`)!
  //        Put `b1` at **`(10, 11)`**, `;` at **`(11, 13)`**, `O1` at **`(11, 14)`**:
  //        - Step 1: Push `W` East `(9, 12) -> (10, 12)` (`W` ignites, `S1` latches).
  //        - Step 2: Push `W` East `(10, 12) -> (11, 12)` (on this tick, `W` radiates fire from `(11,12)` — put `b1` at **`(11, 11)`**? Wait: `step` moves `W` to `(11, 12)` BEFORE `stepLabTick`! So inside `stepLabTick`, `W` is at `(11, 12)` with `burnTicks = 4 -> 3`, radiating fire North to **`b1` `(11, 11)`** and lighting `b1`!).
  //        - Step 3:Wait — to push `W` `(11, 12)` South onto `;` `(11, 13)`, Pip would need `(11, 11)` (occupied by `b1`!). So put `b1` at **`(12, 12)`** (`isOpaqueSolidTile(b1)` = `true`? Wait: `tStopsLaser` does NOT stop on `b1`, AND `lightBrazierAt` lights `b1` directly from `L1` if `b1` is on `y=12`!).
  //        Put `b1` at **`(10, 11)`**! On Step 1 (`push W (9,12) -> (10,12)`): inside `stepLabTick`, `W` was NOT burning yet until step 6 (`updateLasers`), so `W` gets `burnTicks = 4` at the end of Step 1!
  //        On Step 2 (`push W (10,12) -> (11,12)`): `W` ALREADY HAS `burnTicks = 4`! Inside `stepLabTick`, `W` is now at `(11, 12)`, so `W` radiates fire to `(11,11), (11,13), (10,12), (12,12)`!
  //        SO PUT **`b1` AT `(11, 13)`**, AND PUSH `W` **NORTH** FROM `(11, 12)` (standing at `(11, 13)`? Can't stand on `b1`!) -> PUT **`b1` AT `(12, 11)`**? `(11,12)`'s neighbors are `(11,11), (11,13), (10,12), (12,12)`. Put **`b1` AT `(11, 13)`**, `;` AT **`(11, 11)`**, `O1` AT **`(11, 10)`**? Still need `(11, 13)` to push North!
  //        Put `,` (1 grass tile!) at **`(10, 11)`** leading to **`b1` at `(10, 10)`**, while `(11, 11)` is `.` so Pip stands at `(11, 11)` to push `W` `(11, 12)` South onto `;` `(11, 13)` (`O1`)!!
  //        CHECK THAT:
  //        - Step 1: Push `W` `(9,12) -> (10,12)` (`burnTicks = 4`, latches `S1`!).
  //        - Step 2: Walk to `(10, 11)`? Even better: `,` is at `(11, 11)` -> `b1` at `(12, 11)`, and Pip stands at `(11, 11)` AFTER `,` burns to `.` (`1` tick!), pushing `W` South onto `;` `(11, 13)` (`O1`)!
  const c2 = new BigRoomCanvas();
  c2.carveRect(7, 10, 13, 14, '.');
  c2.set(10, 11, ',');
  c2.set(10, 13, ';');
  c2.set(10, 14, '#');
  c2.set(12, 10, 'G');
  c2.set(8, 11, 'Q');

  return {
    code: 'P37',
    designNote:
      'Fire Bomb withheld! One Wooden Crate does 3 jobs: (1) push it right into (10,12) under the grass fuse (10,11) so it ignites the fuse to Brazier b1 (11,11), (2) walk up and right as the grass burns clear, then push the burning crate down into shallow water Q1 (10,13) to douse-save it and unblock S1, and (3) walk left to Q2 (8,11) so both Q plates open Gate G for L2 -> S2!',
    room: {
      id: 'p37',
      name: 'P37 Three Jobs for Pine',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: [],
      entry: [8, 12],
      condition: 'torches-and-sensors',
      rows: c2.rows(),
      // Both `Q1` `(10, 13)` (held by the douse-saved crate!) and `Q2` `(8, 11)` (held by Pip!)
      // must be held simultaneously to open Gate `G` `(12, 10)` for `L2 -> S2`, while `S1` is a normal sensor!
      switches: [{ x: 10, y: 13, kind: 'Q' }],
      props: [{ id: 'crate', kind: 'crate', x: 9, y: 12 }],
      braziers: [{ id: 'b1', x: 11, y: 11 }],
      lasers: [
        { id: 'L1', x: 13, y: 12, dir: 'W', level: 0 },
        { id: 'L2', x: 7, y: 10, dir: 'E', level: 0 },
      ],
      sensors: [
        { id: 'S1', x: 7, y: 12, level: 0 },
        { id: 'S2', x: 13, y: 10, level: 0 },
      ],
    },
  };
}

function buildP38FireAndWater(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // TotK Tadarok homage:
  // Laser `L1` `(7, 11) -> E` hits Stone `P` at `(9, 11)`, shielding indoor Ice Block `B` at `(11, 11)` AND `~` `(10, 11)`!
  // 1. Freeze `~` `(10, 11..12)` with `Ice` while `P` shields `(10, 11)` from `L1`, push `W` `(9, 12)` East across `(10, 12)` onto `O1` `(12, 12)`!
  // 2. Blast-shove Stone `P` `(9, 11)` North/South out of `y=11` with `Bomb`: `L1` melts the ice bridge AND melts `B` `(11, 11)` so `L1` reaches Sensor `S1` `(13, 11)`!
  // 3. Pip threads Mousehole `m` `(10, 13)` (on dry dike `y=13` with `=` on `10,13` -> `m`!) to step onto `O2` `(12, 13)`!
  c.carveRect(7, 10, 9, 13, '.');
  c.set(10, 10, '#');
  c.set(10, 11, '~');
  c.set(10, 12, '~');
  c.set(10, 13, 'm');
  c.carveRect(11, 10, 13, 13, '.');
  c.set(11, 11, 'B');
  c.set(12, 12, 'O');
  c.set(12, 13, 'O');

  return {
    code: 'P38',
    designNote:
      'Stone P shields ~ and Ice Block B from Laser L1; freeze ~ to push W across onto O1 first, then Bomb-shove Stone P clear so L1 melts B and powers S1, and thread the Mousehole to O2!',
    room: {
      id: 'p38',
      name: 'P38 Fire and Water',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'ice'],
      entry: [8, 12],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [
        { id: 'st', kind: 'stone', x: 9, y: 11 },
        { id: 'crate', kind: 'crate', x: 9, y: 12 },
      ],
      lasers: [{ id: 'L1', x: 7, y: 11, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 13, y: 11, level: 0 }],
    },
  };
}

function buildP39CalmLeeFlame(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Separate `b1` `(11, 11)` and `b2` `(11, 14)` by 3 tiles vertically so a single Fire Bomb (`reach=1`)
  // cannot light both at once! With `maxActiveBombs: 1`, whichever brazier you light first gets snuffed
  // by its Fan on the next tick unless you first spawn a `Rock` windbreak at `(9, 11)`!
  c.carveRect(8, 10, 11, 14, '.');
  c.carveRect(10, 10, 11, 14, '=');
  c.set(10, 11, '.');
  c.set(10, 14, '.');
  c.set(9, 11, '.');

  return {
    code: 'P39',
    designNote:
      'Active Fans blow out whichever brazier you light first before a second Fire Bomb can detonate! Spawn a Rock windbreak upwind of b1 so b1 stays lit in the calm lee while you light b2.',
    room: {
      id: 'p39',
      name: 'P39 Calm-Lee Flame',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['fire', 'rock'],
      maxActiveBombs: 1,
      entry: [8, 12],
      condition: 'all-torches',
      rows: c.rows(),
      braziers: [
        { id: 'b1', x: 11, y: 11 },
        { id: 'b2', x: 11, y: 14 },
      ],
      fans: [
        { id: 'F1', x: 7, y: 11, dir: 'E', level: 0 },
        { id: 'F2', x: 7, y: 14, dir: 'E', level: 0 },
      ],
    },
  };
}

function buildP40PolarizedPrism(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  c.carveRect(7, 10, 11, 13, '.');
  c.set(8, 11, 'N');
  c.set(9, 10, '=');
  c.set(11, 10, '=');
  c.set(10, 11, '=');
  c.set(10, 14, '.');
  // Metal gallery behind `=` fence on `x=11`: `Metal` at `(12, 12)`, `O1` at `(13, 12)`!
  c.set(11, 12, '=');
  c.set(12, 12, '.');
  c.set(13, 12, 'O');
  c.set(8, 13, 'O');

  return {
    code: 'P40',
    designNote:
      'Flip Polarity Switch N with a Magnet Bomb: that simultaneously rotates the 1x1 Polarity Mirror to bend L1 onto S1 AND switches magnetism to South-repel so a second Magnet pulse repels Metal across the fence onto O1!',
    room: {
      id: 'p40',
      name: 'P40 Polarized Prism',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['magnet'],
      initialPolarity: 'north',
      entry: [9, 12],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      props: [
        { id: 'm1', kind: 'mirror', x: 10, y: 10, facing: 'SE' },
        { id: 'metal', kind: 'metal', x: 12, y: 12 },
      ],
      turntables: [{ id: 'tt1', cx: 10, cy: 10, size: 1, trigger: 'polarity' }],
      lasers: [{ id: 'L1', x: 7, y: 10, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 10, y: 14, level: 0 }],
    },
  };
}

function buildP41CryoRelay(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Upper Mimic lane `y=10`: Fan `F1` `(7, 10) -> E`, `;` `(9, 10)`, `;` `(10, 10)`, `O1` `(11, 10)` (`#` at `(12, 10)`).
  // Lower Pip lane `y=12`: Fan `F2` `(7, 12) -> E`, `;` `(9, 12)`, `!!!` `(10..12, 12)`, `.` `(13, 12)`, `O2` `(13, 13)`.
  // `=` fence on `y=11` separates Mimic (`(8, 10)`) and Pip (`(8, 12)`)!
  // 1. Step East (`(8,12) -> (9,12)` `;`): Mimic mirrors East (`(8,10) -> (9,10)` `;`)!
  // 2. Drop `Ice` North onto `(9, 11)` (`=`? `=` blocks grounded drop, so make `(9, 11)` `#`? No: make `(9, 11)` `'g'` Bomb Grate!
  //    `'g'` blocks BOTH Pip and Mimic from crossing `y=11`, while allowing Pip to drop `Ice` directly onto `(9, 11)`!):
  //    One `3x3` `Ice` blast at `(9, 11)` freezes BOTH `(9, 10)` + `Mimic` AND `(9, 12)` + `Pip`!
  //    `F1` slides frozen `Mimic` onto `O1` `(11, 10)` (where `#` holds it even if Pip steps later!), while `F2` slides
  //    `Ice-Pip` across `!!!` `(10..12, 12)` onto `(13, 12)`, and Pip steps South (`Mimic` pinned by `#` at `(11, 11)`) onto `O2` `(13, 13)`!
  c.carveRect(8, 10, 11, 10, '.');
  c.set(9, 10, ';');
  c.set(10, 10, ';');
  c.set(11, 10, 'O');
  c.carveRect(8, 11, 13, 11, '#');
  c.set(9, 11, 'g');
  c.carveRect(8, 12, 13, 12, '.');
  c.set(9, 12, ';');
  c.set(10, 12, '!');
  c.set(11, 12, '!');
  c.set(12, 12, '!');
  c.set(13, 13, 'O');

  return {
    code: 'P41',
    designNote:
      'Step East to align the Clockwork Mimic on the upper puddle, then drop one Ice Bomb onto the Bomb Grate between lanes—freezing both Mimic and Pip so parallel Fans slide Mimic onto O1 and Ice-Pip across spikes to O2!',
    room: {
      id: 'p41',
      name: 'P41 Cryo Relay',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['ice'],
      entry: [8, 12],
      condition: 'hold-buttons',
      rows: c.rows(),
      creatures: [{ id: 'm1', kind: 'mimic', x: 8, y: 10, dir: 'E' }],
      fans: [
        { id: 'F1', x: 7, y: 10, dir: 'E', level: 0 },
        { id: 'F2', x: 7, y: 12, dir: 'E', level: 0 },
      ],
    },
  };
}

function buildP42GrandClockwork(): CuratedPuzzleEntry {
  const c = new BigRoomCanvas();
  // Put Mousehole `m` at `(8, 12)` WEST of `L1` `(9, 11) -> E` so `(8, 11)` is ray-free!
  c.carveRect(8, 9, 13, 11, '.');
  c.set(9, 9, '#');
  c.set(9, 10, '%');
  c.carveRect(8, 12, 13, 12, '=');
  c.carveRect(8, 13, 12, 14, '.');
  c.set(8, 12, 'm');

  c.carveRect(10, 10, 12, 10, ';');
  c.set(11, 11, ';');
  // Grate `'g'` in the `'='` fence row `y=12` blocks Pip and non-sliding walk-pushes, while
  // allowing a frost-sliding crate (`Ice Bomb`) to skim across onto `;` `O1` `(11, 13)`!
  c.set(11, 12, 'g');
  c.set(11, 13, ';');
  c.set(10, 14, '#');
  c.set(12, 14, '#');
  c.set(9, 13, 'O');

  return {
    code: 'P42',
    designNote:
      'Capstone synthesis: (1) blast % to unlock the marsh alcove, (2) thread the west Mousehole to stage a Rock backstop at (11,14), (3) frost-coat the Crate with Ice so it hydroplanes across Laser L1 onto O1, and (4) squeeze back through m onto O2!',
    room: {
      id: 'p42',
      name: 'P42 Grand Clockwork Synthesis',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'ice', 'rock'],
      maxActiveBombs: 1,
      entry: [8, 10],
      condition: 'buttons-and-sensors',
      rows: c.rows(),
      switches: [{ x: 11, y: 13, kind: 'O' }],
      props: [{ id: 'crate', kind: 'crate', x: 11, y: 10 }],
      lasers: [{ id: 'L1', x: 9, y: 11, dir: 'E', level: 0 }],
      sensors: [{ id: 'S1', x: 13, y: 11, level: 0 }],
    },
  };
}

export function buildSuitePartB(): CuratedPuzzleEntry[] {
  return [
    buildP23FireproofEclipse(),
    buildP24SternThruster(),
    buildP25PuddleMaker(),
    buildP26FlyingEmber(),
    buildP27CurveballInGale(),
    buildP28DouseTheBranch(),
    buildP29ElevatorOnTide(),
    buildP30MouseOnTheRocks(),
    buildP31BeetleCurling(),
    buildP32FourSpokeDispatch(),
    buildP33MirrorMerryGoRound(),
    buildP34VaultTheBeam(),
    buildP35TortoiseEclipse(),
    buildP36MeltYourTracks(),
    buildP37ThreeJobsForPine(),
    buildP38FireAndWater(),
    buildP39CalmLeeFlame(),
    buildP40PolarizedPrism(),
    buildP41CryoRelay(),
    buildP42GrandClockwork(),
  ];
}
