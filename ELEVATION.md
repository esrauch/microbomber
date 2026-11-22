# Elevation: Ledges, Ramps and Pillars

How a single room gets up to three floor levels, and how Pip and bombs move
between them, matched to how the Game Boy Color Zeldas do it. The rules live in
`src/game/elevation.ts` (shared by the engine and the autotiler) and `world.ts`;
the tiles are the elevation kit in `src/render/gbcTiles.ts`. Dungeon 999 trial 12,
*Up and Over*, uses all of it, and `tests/elevation.test.ts` pins the rules down.

## 1. How the GBC Zeldas do it

From the *Oracle of Ages / Seasons* disassembly ([oracles-disasm][disasm]: `link.s`
`checkLinkJumpingOffCliff` and `@getLengthOfCliff`, `cliffTiles.s`,
`itemPassableTiles.s`, `commonCode1.s`) and the ZeldaHacking wiki's
[tile behaviour][wiki] page. *Link's Awakening DX* works the same way as far as
play shows; I did not read its code. I couldn't get the tileset images (the
sprite sites refuse downloads), so the look below comes from the tile tables and
from the games themselves.

- **Height is not stored.** Elevation is what particular tiles mean. A raised
  area's edge is a **ring of solid cliff tiles** that belongs to the high ground.
  Each cliff tile is tagged with the one direction it can be jumped off.
- **Every exposed side has an edge tile.** Indoors and in dungeons there are four
  directional ledge tiles (down, left, up, right); the overworld has front faces
  plus left and right side faces. So a raised area always shows its east and west
  edges, not just its front.
- **The hop.** Push in an exact cardinal direction (never a diagonal) into a cliff
  tile tagged for that direction, while blocked by it, and Link hops at once: no
  push delay. He flies over the solid ground in 8-pixel steps until he reaches the
  first open tile, and a longer drop picks a faster speed so the hop always takes
  about the same time, a little under half a second, peaking about 12 pixels up.
  He never lands on a solid tile.
- **No way up but stairs.** No cliff tile can be climbed; stairs cut through the
  edge are the way up. (Oracle dungeons do have a few north-facing ledges you can
  hop off; we won't.)
- **Thrown things count levels.** A thrown item carries an *elevation level*.
  Passing a cliff tile the way it can be jumped raises it by one; passing the other
  way lowers it; going below where it started blocks the item. So you can throw a
  bomb off a ledge, and a shot can come back up one level, but nothing thrown from
  below gets up into a cliff face.
- **Raisable floors.** Dungeon floor tiles can rise into solid blocks on a switch,
  and Link can land on a raised one when hopping down even though it's solid. That
  is our pillar.

## 2. The model

- **Three levels, no stored height.** A room may carry a `levels` layer beside its
  `rows`: one digit per tile, `0`, `1` or `2`. Rooms without it are all level `0`,
  so nothing existing changes. Neither Pip nor bombs store a persistent `level` or
  `z` height: a grounded object's level is always read directly from the tile under
  its centre (`levelAt`, or the cliff top above a two-level lower face), and `b.z` /
  `s.hopZ` exist only as temporary vertical arcs during a throw, ledge fall or hop.
- **Edges are derived.** A tile whose neighbour is lower becomes an edge tile: it
  stays part of the high ground and is **solid**. Which sides drop picks the art:
  front face (`ledgeS`), side faces (`ledgeE`, `ledgeW`), north rim (`ledgeN`),
  outer corners (`ledgeSE`, `ledgeSW`, `ledgeNE`, `ledgeNW`) and inner corners
  (`ledgeInnerSE` and so on, where the lower ground is only diagonal). So a raised
  area needs at least one row of walkable top inside its ring.
- **Two-level drops are two tiles tall.** Where level `2` drops straight to level
  `0`, the tile below the front face is a second face tile (`ledgeFaceLower`, with
  `E` / `W` ends). It is solid too, and the hop clears both.
- **North edges are never hoppable.** The north rim is a wall from both sides.
- **Ramps are slopes cut through an edge.** A slope letter (`n`, `s`, `e`, `w`)
  placed on an edge tile replaces it with a ramp (`rampN`, `rampS`, `rampE`,
  `rampW`) joining the two levels. On flat ground the same letters keep the trough
  chute art. One tile carries Pip up and rolls bombs down: the bomb ramp we
  planned.
- **Pillars.** A pillar tile `L` is floor while down and a block one level up once
  risen, like Oracle's raisable floors. It needs no `levels` layer: a room with
  pillars and no layer is all level `0`, and a risen pillar is level `1`. Only the
  pillar tile changes; the ground around it keeps its edges whether it is up or
  down, and level checks keep Pip and bombs from crossing between them. From the
  top of a risen pillar there is no seam to raised ground beside it.

## 3. Rules for Pip and for bombs

| Situation | Pip | Bombs |
|---|---|---|
| **Same level** | Walks. | Rolls, slides, is thrown, as now. |
| **Into a south, east or west edge** | Pushing straight at it (not diagonally) hops him off at once, over the face, onto the first open tile. About half a second, whatever the drop. | A bomb rolling into the edge goes over it and falls, landing beyond the face with a small bounce, fuse still running. |
| **Into a north rim, or a face from below** | Blocked, like a wall. | Blocked: a bomb thrown at a face from below bounces off it. |
| **Thrown from the high ground** | — | Goes off the edge (one level down per edge crossed) and lands below. It can come back up at most as many levels as it went down. |
| **Ramp** | Walks up and down, drifting gently downhill as on chutes now. | Rolls downhill and speeds up. A thrown bomb climbs one ramp if it's moving fast enough, and rolls back if not. |
| **Pillar** | Rides it up and down; hops off a risen one. | Ride it; so do blocks and creatures. |
| **Blasts** | — | An edge is a wall to blast arms and line of sight. A blast reaches the floor below only past the edge, never up a face. |

A bomb that slows to a stop on an edge tile tips over the drop, since an edge is
no place to rest. Wind's blast-jump stays the one way to climb a single level
without a ramp or pillar.

## 4. Puzzles it opens up

- **Long ramp as a timer.** A bomb dropped at the top of a ramp winds down across
  the room into a crystal while Pip walks to where the flip matters.
- **Drop it, don't throw it.** A crystal sits below a ledge reachable only from
  above. Roll a ticking bomb off the edge onto it.
- **One-way rooms.** Ledges you hop down and can't climb make a room an ordered
  descent through three levels; the way back up is a ramp you have to earn.
- **Bomb elevator.** A switch raises a pillar; ride up with a bomb, or send a block
  up to hold a plate that only exists on the high ground.
- **The pillar as a gate you stand on.** Lowered, it's the way across; raised, it's
  a wall from below and a stepping stone from above.

## 5. Assets (done)

All in `src/render/gbcTiles.ts`. Ledge tiles use the zone's `floor` palette so the
top of a raised area matches the floor around it; ramps use `wall`, pillars `steel`.

| Tiles | Use |
|---|---|
| `ledgeS`, `ledgeE`, `ledgeW`, `ledgeN` | Edge tiles: front face (lit lip, masonry courses, dark foot), side faces, north rim. |
| `ledgeSE`, `ledgeSW`, `ledgeNE`, `ledgeNW` | Outer corners, the front face wrapping onto the side. |
| `ledgeInnerSE`, `ledgeInnerSW`, `ledgeInnerNE`, `ledgeInnerNW` | Inner corners, where the lower ground is only diagonal. |
| `ledgeFaceLower`, `ledgeFaceLowerE`, `ledgeFaceLowerW` | The second face tile under a two-level drop. |
| `rampN`, `rampS`, `rampE`, `rampW` | Ramps rising toward the named side: lit treads toward the top and an uphill chevron. |
| `liftUp`, `liftDown`, `liftFace` | Pillar top, its socket (and top while down), and the steel face that grows under it as it rises. |

The proof render shows a level-2 area, a level-1 area wrapping round below it with
inner corners, a two-level drop, ramps cut through the faces, Pip mid-hop with his
shadow below, and both pillar states.

## 6. Building it

Done:

1. The `levels` layer, with edges derived in one place for the engine and the
   autotiler. Edge tiles read as `'H'` and are solid; the hop is an exact cardinal
   push, immediate, over the solid strip to the first open lower tile, `0.45 s`
   with a `0.75`-tile arc and Pip's shadow left on the ground.
2. Ramps for Pip and bombs. In a room with levels every slope letter draws as a
   ramp.
3. Bombs read their level from the tile under them: they go down over edges with a
   short fall bounce (`b.z`), never up a face or down a north rim, and blasts stop
   at edges.
4. Pillars (below).
5. Dungeon 999 trial 12, *Up and Over*: the bomb-elevator puzzle.

Still to do:

- Hops landing on a risen pillar (Oracle's raisable floors) work by the level rules but
  have no test yet.
- HD lighting: edges already cast shadow as walls; higher tops should catch more
  light.
- More trials: drop it, the long-ramp timer, a one-way descent.

## 7. Open question

- (settled) Pillars take switches, a crystal colour or a clock.

[disasm]: https://github.com/Stewmath/oracles-disasm
[wiki]: https://wiki.zeldahacking.net/oracle/Tile_behaviour

## 8. Pillars

A pillar has two resting states that are only traversal rules: down, a flush floor
tile; up, a block that is a wall from below and joins raised ground beside it with
no seam. Between them is the one thing that needs modelling: the move.

- **Triggers** (`room.pillars`): the room's switches (all `Q` held, the default),
  a crystal colour (`'red'` or `'blue'`), or a clock (`{ down, up, offset }`
  seconds).
- **Travel.** `PILLAR_TRAVEL` (`1.2 s`) each way, with a rumble the whole way and
  a thump on arrival. A move always finishes; a trigger that flips mid-move is
  answered once it stops.
- **Riders are settled once, when it starts.** Anything whose centre is on the tile
  rides; anything only overlapping its edge is nudged off to its own side.
- **Riders are locked.** They can't step off until it stops, and a bomb keeps its
  fuse. Riders take the pillar's new level when it arrives.
- **It is solid while moving.** Nothing steps on, nothing rolls in; a thrown bomb
  bounces off.
- **The look.** The 16×16 top plate (`liftUp`) climbs half a tile (`8 px`, to
  `py - 8`) while the solid block-coursed column face (`liftFace`, anchored with a
  dark foot at `py + 15`) grows under it. When higher ground sits directly north of
  the pillar at `(x, y - 1)`, its `8 px` vertical cliff wall (`ledgeS`) is drawn in
  `py - 8 .. py - 1` above the lowered socket and is progressively covered up as
  the top plate rises over it. Riders and their contact shadows are drawn raised
  with the plate (translating both albedo and the `aux` G-buffer), and the `8 px`
  lift tapers smoothly across any walkable same-level tile join so stepping between
  a risen pillar and flat-`y` high ground never pops.
- **Room-layout rule (the tile north of `'L'`).** Because both the `8 px` north
  cliff wall (when lowered) and the top half of the raised 16×16 plate
  (`py - 8 .. py - 1`) visually occupy the south half of `(x, y - 1)`, the tile
  directly north of a pillar `(x, y - 1)` must be plain walkable floor (`'.'`). If a
  wall (`'#'`) or special tile (`'O'`, `'Q'`, `'!'`, `'X'`, `'G'`, etc.) sits to
  the north of `'L'`, it must be placed at least one slot further north (`(x, y - 2)`)
  or to the side so the north cliff face and raised plate never draw over it.
