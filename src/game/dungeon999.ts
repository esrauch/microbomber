/**
 * Dungeon 999: The Developer Dungeon (`zone: 'dungeon-999'`, `DUNGEONS.md` §999).
 *
 * A gallery of candidate Shrine rooms. The Lobby holds one warp pad per room; each
 * room hands Pip a campaign-sized kit (2 bombs, blast reach 1 unless noted) and its
 * goal is never something Pip can simply walk onto: every 'O' plate and puzzle
 * brazier sits behind a gate, barrier, fence or pit, and needs the room's chain.
 */
import { type BombKind, type PortalSpec, type RoomSpec } from './types';

/** A trial room and the spot its Lobby pad drops Pip. */
interface Trial {
  room: Omit<RoomSpec, 'zone' | 'portals'>;
  entry: [number, number];
}

const kit = (...bombs: BombKind[]): NonNullable<RoomSpec['kit']> => ({ bombs });

const TRIALS: Trial[] = [
  // Bomb: the chute carries the bomb to the crystal while Pip runs into the pen.
  // Flipping it lowers R ahead but raises U behind, so Pip must already be inside.
  // The wall makes a throw from the bottom of the chute too far from the pen.
  {
    entry: [7.5, 21.5],
    room: {
      rx: 1,
      ry: -1,
      name: '1. A Delayed Flip',
      objective: 'Throw a Bomb onto the chute, then be inside the pen when the crystal flips',
      kit: kit('bomb'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '######O..R..####C#####',
        '###########U####n#####',
        '####...........#n#####',
        '####...........#n#####',
        '####...........#n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####..#########=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####...........=n#####',
        '####>>.........=n#####',
        '####>>.........=n#####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
    },
  },

  // Bomb: the gate opens only while both switches are weighted. Pip is one weight,
  // but he has to be past the gate, so it takes two bombs, far switch first.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 2,
      ry: -1,
      name: '2. Two Switches, One Breath',
      objective: 'Hold both switches with bombs at once and slip through the gate',
      kit: kit('bomb'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '##########O###########',
        '##########G###########',
        '####..............####',
        '####..............####',
        '####Q.....Q.......####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
    },
  },

  // Bomb: the stone block is fenced in. Blasts shove it one tile away from the bomb,
  // through the fence; a thrown bomb lands inside the yard to shove it again.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 3,
      ry: -1,
      name: '3. Shove It Home',
      objective: 'Blast the fenced-in block onto the plate, one shove at a time',
      kit: kit('bomb'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####..............####',
        '####..............####',
        '####..............####',
        '####....=====.....####',
        '####....=P..=.....####',
        '####....=..O=.....####',
        '####....=...=.....####',
        '####....=====.....####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
    },
  },

  // Fire: two braziers behind a fence must catch I then II, each at the end of a bramble
  // fuse. I's fuse is seven tiles long and II's two, so I needs a long head start.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 4,
      ry: -1,
      name: '4. Long Fuse First',
      objective: 'Throw Fire at the bramble fuses so brazier I catches before II',
      kit: kit('fire'),
      condition: 'ordered-torches',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####.TT...........####',
        '####.TT...........####',
        '####..BBBB........####',
        '####.....B....TT..####',
        '####.....B....TT..####',
        '####.....B....B...####',
        '####..........B...####',
        '####..............####',
        '####==============####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
      torches: [
        { x: 5, y: 4, order: 1 },
        { x: 14, y: 7, order: 2 },
      ],
    },
  },

  // Magnet: a ticking Magnet Bomb reels the fenced-in iron block along its row or column
  // until it reaches the bomb or hits something. The pit rules out the short way round.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 1,
      ry: 0,
      name: '5. Pull of the Rail',
      objective: 'Reel the iron block around the pit and onto the plate with Magnet Bombs',
      kit: kit('magnet'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####..............####',
        '####..............####',
        '####..............####',
        '####....=====.....####',
        '####....=M..=.....####',
        '####....=^..=.....####',
        '####....=..O=.....####',
        '####....=====.....####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
    },
  },

  // No bombs: the Mimic copies every step Pip actually takes. Walking into your own
  // walls (or pinning the Mimic against its) shifts the two out of line.
  {
    entry: [8.5, 18.5],
    room: {
      rx: 2,
      ry: 0,
      name: '6. Mirror Steps',
      objective: 'Walk so the Mimic, copying your steps, reaches its plate',
      kit: {
        bombs: [],
      },
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####......==####O.####',
        '####......==####..####',
        '####..##..==####..####',
        '####..##..==####..####',
        '####......==......####',
        '####......==......####',
        '####......==..########',
        '####......==..########',
        '######....==..########',
        '######....==..########',
        '####......==..########',
        '####......==..########',
        '####..##..==..########',
        '####..##..==..########',
        '####......==..########',
        '####......==..########',
        '####....>>==......####',
        '####....>>==......####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
      enemies: [
        {
          kind: 'mimic',
          x: 16.5,
          y: 20.5,
        },
      ],
    },
  },

  // Ice: an Ice Bomb freezes the 3x3 around it into floor, but the currents carry a
  // floating bomb before it bursts. Two patches, laid upstream, make the bridge.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 3,
      ry: 0,
      name: '7. Bridge on the Race',
      objective: 'Freeze a path across both currents to reach the far plate',
      kit: kit('ice'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####..............####',
        '####..O...........####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####44444444444444####',
        '####44444444444444####',
        '####33333333333333####',
        '####33333333333333####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
    },
  },

  // Fire + Rock: in the east gale every bomb drifts until something stops it, so a Fire
  // Bomb dropped under a brazier blows past it. A Rock block downwind catches it.
  {
    entry: [6.5, 12.5],
    room: {
      rx: 4,
      ry: 0,
      name: '8. Catch It in the Gale',
      objective: 'Everything drifts east: stop a Fire Bomb under each brazier with a Rock block',
      kit: kit('fire', 'rock'),
      condition: 'all-torches',
      wind: {
        dx: 2.2,
        dy: 0,
      },
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '##########TT##########',
        '##########TT##########',
        '####..........=...####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>........=...####',
        '##########TT##########',
        '##########TT##########',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
      torches: [
        { x: 10, y: 4 },
        { x: 10, y: 20 },
      ],
    },
  },

  // Bomb + Wind: a Wind Bomb blast-jumps Pip over the fence onto the lip, then its
  // lingering whirlwind catapults a thrown Bomb across the chasm into the crystal.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 1,
      ry: 1,
      name: '9. Eye of the Gale',
      objective: 'Jump the fence with Wind, then catapult a Bomb over the chasm into the crystal',
      kit: kit('bomb', 'wind'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '###############C######',
        '####..............####',
        '####..............####',
        '####^^^^^^^^^^^^^^####',
        '####^^^^^^^^^^^^^^####',
        '####^^^^^^^^^^^^^^####',
        '#####ORR..........####',
        '########==========####',
        '########..........####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
    },
  },

  // Squeak: a Squeak Bomb lures the Brass Beetle only from 4.5 tiles, so it takes a
  // relay of chirps to walk it out of its corner and onto the far plate.
  {
    entry: [10.5, 19.5],
    room: {
      rx: 2,
      ry: 1,
      name: '10. Follow the Chirp',
      objective: 'Relay Squeak Bombs to lead the Brass Beetle onto the plate',
      kit: kit('squeak'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####..^^^^^^^^^^^^####',
        '####..^^^^^^^^^^^^####',
        '####..^^^^^^^^^^^^####',
        '####..^^^^^^^^^^^^####',
        '####..^^^^^^^^^^^^####',
        '####..^^^^^^^^^^^^####',
        '####....O.........####',
        '####..............####',
        '####==============####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####>>............####',
        '####>>............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
      enemies: [
        {
          kind: 'beetle',
          x: 5,
          y: 7,
        },
      ],
    },
  },

  // Ice: the patrolling Iron Tortoise sinks the spike run for a moment each time it crosses
  // the switch, too short to run eight tiles of it. Freeze it on the switch to keep them down.
  {
    entry: [8.5, 14.5],
    room: {
      rx: 3,
      ry: 1,
      name: '11. Tortoise Time',
      objective: 'Freeze the Tortoise on its switch to keep the spikes down, then run the corridor',
      kit: kit('ice'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '#######.......########',
        '#######...Q...########',
        '####==============####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..........#X######',
        '####..........#X######',
        '####..........#X######',
        '####..........#X######',
        '####..........#X######',
        '####..........#X######',
        '####..........#X######',
        '####..........#X######',
        '####..........#O######',
        '####..........########',
        '####>>........########',
        '####>>........########',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
      enemies: [
        {
          kind: 'tortoise',
          x: 8,
          y: 5,
          facing: {
            dx: 1,
            dy: 0,
          },
        },
      ],
    },
  },

  // Elevation: three floor levels. The plate is on the top terrace, reached only by the
  // pillar set in its face, which rises while the switch on the floor below is held. A
  // risen pillar is a wall from below, so Pip has to be standing on it when the switch
  // goes down: throw the Bomb off the ledge from the pillar itself.
  {
    entry: [6.5, 6.5],
    room: {
      rx: 4,
      ry: 1,
      name: '12. Up and Over',
      objective: 'Ride the pillar to the top terrace: its switch is on the floor below the ledge',
      kit: kit('bomb'),
      condition: 'hold-buttons',
      rows: [
        '######################',
        '######################',
        '######################',
        '######################',
        '####............O.####',
        '####......L.......####',
        '####>>............####',
        '####>>............####',
        '####........s.....####',
        '####......Q.......####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '####..............####',
        '######################',
        '######################',
        '######################',
        '######################',
      ],
      levels: [
        '2222222222222222222222',
        '2222222222222222222222',
        '2222222222222222222222',
        '2222222222222222222222',
        '2222222222222222222222',
        '2222222222122222222222',
        '1111111111111111111111',
        '1111111111111111111111',
        '1111111111111111111111',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
        '0000000000000000000000',
      ],
    },
  },
];

/**
 * Lobby pad for trial `i` (0-based): four to a row, left to right and top to bottom.
 * Room n sits at `rx = (n - 1) % 4 + 1`, `ry = floor((n - 1) / 4) - 1`, so the minimap
 * mirrors the pads.
 */
const lobbyPad = (i: number): [number, number] => [4 + 4 * (i % 4), 6 + 4 * Math.floor(i / 4)];

/** The pad that leaves the rig (main.ts leaveDungeon999 restores the campaign). */
const EXIT_PAD: [number, number] = [16, 20];

/** A 22 x 26 hall inside a 4-tile wall, like every screen outside Grandma's House. */
function lobbyRows(): string[] {
  // Each pad is a 2 x 2 flight of stairs from its top-left tile
  const pads = new Set(
    [...TRIALS.map((_, i) => lobbyPad(i)), EXIT_PAD].flatMap(([px, py]) =>
      [0, 1].flatMap((dx) => [0, 1].map((dy) => `${px + dx},${py + dy}`)),
    ),
  );
  return Array.from({ length: 26 }, (_, y) =>
    Array.from({ length: 22 }, (_, x) => {
      if (y < 4 || y > 21 || x < 4 || x > 17) return '#';
      return pads.has(`${x},${y}`) ? '>' : '.';
    }).join(''),
  );
}

const LOBBY: RoomSpec = {
  zone: 'dungeon-999',
  rx: 0,
  ry: 0,
  name: 'Lobby',
  objective: 'Each pad warps to a trial room; the bottom-right pad leaves the rig',
  rows: lobbyRows(),
  portals: [
    ...TRIALS.map(({ room, entry }, i) => ({
      x: lobbyPad(i)[0],
      y: lobbyPad(i)[1],
      targetZone: 'dungeon-999' as const,
      targetRx: room.rx,
      targetRy: room.ry,
      targetX: entry[0],
      targetY: entry[1],
      label: room.name,
    })),
    {
      x: EXIT_PAD[0],
      y: EXIT_PAD[1],
      targetZone: 'overworld',
      targetRx: 2,
      targetRy: 0,
      targetX: 11,
      targetY: 8.5,
      label: 'Exit Dungeon 999',
    },
  ],
};

/** Every 2 x 2 flight of `'>'` in a trial room is a pad back to the Lobby, keyed by its top-left. */
function withReturnPads(room: Trial['room']): RoomSpec {
  const portals: PortalSpec[] = [];
  room.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '>' || row[x - 1] === '>' || room.rows[y - 1]?.[x] === '>') continue;
      portals.push({
        x,
        y,
        targetZone: 'dungeon-999',
        targetRx: 0,
        targetRy: 0,
        targetX: 10.5,
        targetY: 12.5,
        label: 'Back to the Lobby',
      });
    }
  });
  return { zone: 'dungeon-999', ...room, portals };
}

export const DUNGEON_999_ROOMS: RoomSpec[] = [LOBBY, ...TRIALS.map((t) => withReturnPads(t.room))];

/** Pip's arrival point in each trial room, keyed `"rx,ry"`. */
export const DUNGEON_999_ENTRIES: ReadonlyMap<string, [number, number]> = new Map(
  TRIALS.map((t) => [`${t.room.rx},${t.room.ry}`, t.entry]),
);
