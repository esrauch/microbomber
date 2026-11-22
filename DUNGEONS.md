# Dungeons: room by room

The layouts, puzzles, minibosses and bosses of every Shrine and the Iron Tower.
`GAME.md` §4 to §5 hold the rules this builds on: the bombs, the Shrine arc, the
lineup. **Fixed decisions:** each Shrine's theme and the bomb found inside it
(Ice Cave gives Fire, Rock Quarry gives Wind, Fire Mountain gives Ice, Wind
Cliffs gives Rock), and the order you play them in.

## Size: half of the Oracle games

The *Oracle of Ages* / *Seasons* dungeons grow from about `20` rooms in the
first to `32–40` in the middle and `46–64` at the end (`GAME.md` §1 and §5). We
build **half**, with no filler rooms.

**Checked against the maps in `inspiration/`** (one cell of a full dungeon map
is one `240 × 176` room, or one square on an in-game map; side-view underground
passages counted as rooms):

| Dungeon (map file) | Rooms counted | How |
|---|:-:|---|
| *Seasons* D1, Gnarled Root Dungeon (`LegendOfZelda-OracleOfSeasons-GnarledRootDungeon.png`) | **19** + `1` passage | exact, on the grid |
| *Seasons* D2, Snake's Remains (`LegendOfZelda-OracleOfSeasons-Snake'sRemains.png`) | **27** + `1` passage | exact, on the grid |
| *Seasons* D3, Poison Moth's Lair (`LegendOfZelda-OracleOfSeasons-PoisonMoth_sLair.png`) | **~28** + `3` passages | by eye (floors sit off the grid), ±2 |
| *Ages* D3 (`2001-oracle-of-ages/maps/LZ7_Ages_DungeonMap3.png`, the in-game map) | **30** (two floors of `15`) | exact, one square per room |
| *Link's Awakening* D3, Key Cavern (`1993-links-awakening/maps/TLoZ_LA_Dungeon_3_map.png`; the engine the Oracle games build on) | **29** + `1` passage | exact, on the grid |

So the first three dungeons run **`20 → 28 → 30`**, and half of that is
`10 → 14 → 15`. Our four Shrines take every other step of the Oracle curve
(Shrine 2 sits where a third dungeon does), so **Ice Cave (`10`) and Rock Quarry
(`15`) are verified at half their counterparts.**

**Not verified:** Fire Mountain (`20`), Wind Cliffs (`24`) and the Iron Tower
(`16`). Full maps for Oracle dungeons 4 to 8 are not in `inspiration/` (nor on
StrategyWiki, where these maps come from), and fetching them from other sites
was declined (2026-11-21). Their counterparts stay estimates: `GAME.md`'s
`32–40` for middle dungeons and `46–64` for late ones, a rise from the counted
`~30` at D3 that halving turns into our `20` and `24`; the final tower's `~32`
is an estimate in the same spirit. If those maps are added to `inspiration/`,
count them and adjust.

| # | Dungeon | Bomb found | Floors | Rooms | Oracle counterpart (×½) | Target time |
|:-:|---|---|---|:-:|---|:-:|
| 0 | Grandma's Basement (House + Cellar) | Bomb (Magic Bomb Sack) | House + `B1F` | **5** (`1` house + `4` cellar) | tutorial cellar (*Seasons* Hero's Cave, 7) | 4–5 min |
| 1 | Ice Cave (built) | Fire | `1F` | **10** | a first dungeon, ~20 | 10–12 min |
| 2 | Rock Quarry | Wind | `2F` rim + `1F` pit | **15** | a third dungeon, ~30 (counted) | 14–16 min |
| 3 | Fire Mountain | Ice | `1F` + `B1F` | **20** | a middle dungeon, ~40 | 18–20 min |
| 4 | Wind Cliffs | Rock | `1F` caves + `2F` tops | **24** | a late dungeon, ~48 | 22–25 min |
| 5 | Iron Tower | (all) | `1F` to `4F` | **16** | the final tower, ~32 | 15–18 min |
| | **Total** | | | **90** | | ~1.5 h |

With the `100`-screen overworld (`OVERWORLD.md`) that makes about `190` rooms,
the half-of-*Oracle* campaign `GAME.md` §1 sets out.

## Shared rules

- **A room is one screen:** `11 × 13` tiles. Coordinates below are `(x, y)` on
  that floor's grid, north at the top, with the entrance at the south.
- **Arc & the Two-Room Miniboss Trope:** Every Shrine follows the same signature
  midpoint rhythm across **two connected rooms**:
  1. **Miniboss Phase 1 (in Room A, the Reliquary / Ante-Arena):** You fight
     Phase 1 of the miniboss using the bombs you already brought into the Shrine
     (or the room's terrain). At half health, the miniboss **flees into the next
     room**, unsealing the **new elemental bomb's chest** in Room A so you can
     claim and test it in peace.
  2. **Miniboss Phase 2 (in Room B, the Inner Arena):** Stepping into Room B
     with your new bomb triggers Phase 2, where the miniboss uses its full
     elemental defence that **only your new bomb can counter**. Defeating Phase 2
     activates the **midpoint warp pad** back to the Shrine foyer and opens the
     Act 2 loop.
- **No-Key-Softlock Invariant (Certified by Unit Tests):** Because small keys
  are fungible (`1 key = 1 locked door`), if two locked doors are ever reachable
  at the same time, a player could spend a key on the "wrong" door. Every
  dungeon must satisfy the **No-Softlock Key Graph Property** (verified via
  exhaustive BFS state-space unit tests over `(room, inventory, openedDoors,
  collectedKeys)`):
  1. Whenever a hub has two locked doors (`L1` and `L2`), either the second
     locked door is physically gated behind an obstacle or switch state solved
     inside the `L1` branch (or behind the Act 2 bomb), **or** both locked
     branches independently yield a small key so opening them in either order
     never dead-ends.
  2. No back-door loop may bypass a locked door in a way that leaves an unspent
     key or strands the Boss Key branch.
- **Controls (`Pull → Drop / Throw`):** Pressing **A (Pull)** takes out the
  equipped bomb and holds it overhead (fuse paused, walk speed halved); while
  overhead, **B (Drop)** sets it ahead of Pip and **A (Throw)** lobs it
  orthogonally over `'='` fences and 1-tile barriers with rolling physics.
  Puzzles that require **Wind** to fling a bomb across a chasm must therefore
  span a **`3–4` tile chasm** (or high terrace wall) that a normal `1.8`-tile
  Throw cannot cross on its own.
- **Lingering Whirlwind (`2.5 s`):** When a **Wind Bomb** pops, it both emits
  its instant `3 × 3` gust (for blast-jumping and clearing sand) *and* leaves a
  **`2.5 s` spinning whirlwind vortex** on its centre tile (mirroring Fire's
  `2.5 s` burning hearth patch). Any Bomb or Fire Bomb thrown or dropped into a
  live whirlwind is catapulted `3–4` tiles downwind across wide chasms.
- **One idea per room:** each room is marked *teach*, *twist* or *combine*.
- **Rewards per Shrine:** a Heart Container (boss), one Heart Piece, and in two
  Shrines a Magic Bomb Sack upgrade (live bombs `2 → 3` in Rock Quarry, `3 → 4` in Wind
  Cliffs). Bomb reach `1 → 2` stays on the overworld (Millbrook West).
- **Pieces we have now:** cracked walls, brambles and crates, braziers (lit,
  timed, ordered), dark rooms, crystal switches with red and blue barriers,
  floor buttons, blocks shoved by blasts, pits, deep and shallow water, sloped
  chutes, shutters, key and boss doors, spikes, warp pads. Each Shrine adds at
  most two new ones.

Legend for the floor maps: `[nn]` a room, `==` a door between rooms, `||` a
north–south door, `L` a locked door, `B` the boss door, `v` a drop or stair
down, `^` a stair or lift up, `.` no room.

---

## 0. Grandma's Basement (Dungeon Zero — gives the Magic Bomb Sack): 5 rooms

**Theme:** the cozy interior of the Mouse House and its cobwebbed stone root
cellar below (`B1F`).
**Story & purpose:** You start **inside the Mouse House** with no bombs at all
(only walking and **B = Roll**). **Grandma** tells you that **your brother is
making trouble again**—he raised the Iron Tower overnight—and you had better go
down into the basement, fetch the **Magic Bomb Sack**, and
make sure he doesn't cause too much trouble.
**What it teaches:** walking, **B = Roll**, floor switches, **Small Keys** and
locked doors, and then **the Bomb** (`A = Pull → B = Drop / A = Throw`) to break
cracked walls and exit into the village yard (`(5,4)`).

```text
House Interior (1F)              Grandma's Basement (B1F)
     [ 0 ]                            [ 4 ]   [ 3 ]
   v       v                                    L|
(cellar) (out to 5,4)                 [ 2 ] == [ 1 ]^
```

| # | Room | `(x,y)` | What it does | Exits |
|:-:|---|---|---|
| 0 | Mouse House Interior | `House (0,0)` | **Start of the game.** Grandma stands by her sewing basket and tells you your brother is making trouble again—head down the cellar stairs for the magic bomb sack. The front door south to the overworld (`5,4`) is blocked from inside by fallen cellar rubble (`%`) until you return with the Bomb. *teach* talk & objective | cellar stair down to 1, front door out to `(5,4)` (blocked by `%` rubble) |
| 1 | Cellar Stairs | `B1F (1,1)` | Where the house stair lands. Cobwebs, apple barrels and a locked north door (**L1**). *teach* locked door inspection | stair up to 0, W 2, N 3 (**L1**) |
| 2 | Root Pantry | `B1F (0,1)` | Two harmless cellar slimes and a spike strip; **B = Roll** across the narrow gap to step on the floor switch (`O`) in the corner, dropping **Small Key 1** onto the centre seal ring. *teach* Roll, floor switch & **Small Key** | E 1 |
| 3 | Grandpa's Workroom | `B1F (1,0)` | Unlocked with **Small Key 1**. On the pedestal sits the **Magic Bomb Sack** (**unlocks the Bomb**). The door shuts behind you; pull (`A`) and drop (`B`) your first Bomb against the cracked west masonry wall (`%`) to blast open a secret passage into 4. *teach* **Bomb** (`Pull` & `Drop` on `%`) | S 1 (**L1**), W 4 (via `%` cracked wall) |
| 4 | Coal Chute | `B1F (0,0)` | A low wooden fence (`=`) separates you from a crystal switch (`C`) and a pair of cellar slimes. Pull (`A`) and **Throw (`A`)** a Bomb over the fence to flip the crystal (lowering the red barrier back to 1) and blast the slimes. Climb the stairs back up to 0, bomb the rubble blocking the front door, and step outside into Millbrook Vale (`5,4`). *teach* **Throw** over fences & crystal switches | E 3, S 2 (barrier), return via 1 to 0 |

**Keys & No-Softlock Proof:**
- **Key 1** (room 2) opens **L1** (`1 → 3`, the only locked door in the basement).
- Returning to room 0 with the Bomb clears the `%` rubble blocking the front door to Overworld `(5,4)`.

---

## 1. Ice Cave (gives Fire): 10 rooms

Ten rooms on one floor. In Room 5 (**Alchemist Reliquary**) you clash with
**Ice Golem Phase 1** before it freezes over and retreats west into Room 6
(**Lantern Hall**), leaving the **Fire Bomb** behind; you follow it into Room 6
with Fire to melt its regrown ice armour in **Phase 2**.

```text
 x:   0      1      2
y0  [10]    .      .
y1  [ 9]   [ 6]   [ 5]
y2  [ 8]   [ 3]   [ 4]
y3  [ 7]   [ 1]   [ 2]
           (in)
```

| # | Room | `(x,y)` | What it does |
|:-:|---|---|---|
| 1 | Entry Hall | `(1,3)` | Blast the east crate; ice blocks melt later. *teach* |
| 2 | Switch Antechamber | `(2,3)` | A floor switch reveals **Small Key 1**. *teach* |
| 3 | Crystal Crossroads | `(1,2)` | Throw a bomb into a crystal switch to lower the red barriers. *teach* |
| 4 | Vault of Sparks | `(2,2)` | **Small Key 2**, cracked wall, and a thrown bomb into a crystal. *combine* |
| 5 | Alchemist Reliquary | `(2,1)` | **Miniboss Phase 1: Ice Golem** (crack its frost crust with Bombs; at half health it retreats into 6). Claim **the Fire Bomb** and light both north braziers to open the west shutters. *teach* |
| 6 | Lantern Hall | `(1,1)` | **Miniboss Phase 2: Ice Golem.** Full ice armour that Bombs clank off; melt it with Fire, then bomb the bare core to unlock the midpoint warp pad. |
| 7 | Frozen Hall | `(0,3)` | Burn wooden shields, light two timed braziers for the **Heart Piece**. *twist* |
| 8 | Hall of Three Flames | `(0,2)` | Throw Fire Bombs over the water channel to light three braziers in order, I → II → III, for the **Boss Key**. *twist* |
| 9 | Sanctum Ante-Room | `(0,1)` | A crate cache with a heart; the boss door. |
| 10 | Frozen Sanctum | `(0,0)` | **Boss: Ice Wraith.** Translucent and immune in the dark; light a corner brazier with Fire to expose it, then bomb it across 3 Ice Storm snuffs. |

---

## 2. Rock Quarry (gives Wind): 15 rooms

**Theme:** a stone quarry stepping down a hillside in terraces, with wooden
scaffolds, pulleys and a cargo lift, and sand drifting into every corner.
**New pieces:** **sand piles** (only Wind blows them clear; a Bomb scatters them
and they slump back) and **terraces** (one-tile ledges you can drop off but not
climb; Wind's blast-jump goes up one).

**Shape:** you enter on the **rim** (`2F`) and can only go *down* in Act 1,
dropping into the quarry **pit** (`1F`). Wind is the way back *up*. The rim's
centre room looks straight down into the pit, so you always see where you are
going.

```text
2F (rim)                         1F (pit floor)
 x:   0      1      2             x:   0      1      2
y0   .      .     [ 7]boss       y0  [10]   [11]   [13]
                    B                  ||     ||     ||
y1  [ 4] L= [ 5] == [ 6]         y1  [ 9] == [ 8] L= [12]
     v      v|      ||                        L|
y2  [ 2] == [ 1] == [ 3]^        y2   .     [14] == [15]^
            (in)
```

| # | Room | `(x,y)` | Act | Puzzle and contents | Exits |
|:-:|---|---|:-:|---|---|
| 1 | Quarry Gate | `2F (1,2)` | 1 | *teach* terraces: you enter on the top tier and drop down a ledge; side stairs lead back up, so you can't trap yourself. A sand pile sits on a floor switch beside the east shutter; a Bomb scatters it and it slumps back (*teach* sand). | W 2, N 5, E 3 (shutter, Act 2) |
| 2 | Sand Hall | `2F (0,2)` | 1 | Burn the scaffold crates with Fire to reach a chest: **Small Key 1**. Sand piles line the west wall; in Act 2 Wind blows one clear to open an alcove: **Magic Bomb Sack upgrade (`2 → 3` live bombs).** | E 1 |
| 3 | Pulley Top | `2F (2,2)` | 2 | The cargo lift arrives here from 15. Blow the sand off the floor switch to open the shutter to 1 (a shortcut home). Pop a Wind Bomb on the south lip to leave a `2.5 s` whirlwind, then throw a Bomb into it to catapult across a `3`-tile pit onto a cracked wall. *combine* | W 1, N 6, lift to 15 |
| 4 | Upper Terrace | `2F (0,1)` | 1 | Three terraces step down southward; rock-throwing goblins on the tiers. Bomb the cracked floor block on the lowest tier to open a **drop** to 9. *teach* (drops between floors) | E 5 (**L1**), drop to 9 |
| 5 | Rim Crossing (hub) | `2F (1,1)` | 1–2 | A walkway rings a great square drop shaft that shows the quarry floor below. Jump in: you land in 8 (the only way down without a key). East is a 2-tile gap, crossable only by blast-jump (Act 2). | S 1, W 4 (**L1**), E 6 (gap), drop to 8 |
| 6 | Lookout Steps | `2F (2,1)` | 2 | *twist* terraces: four tiers stepping *up* to the north; blast-jump up each, with sand piles to clear off the landing spots first. | W 5 (gap), S 3, N 7 (**boss door**) |
| 7 | Top Terrace | `2F (2,0)` | 2 | **Boss: Boulder Golem** (below). | S 6 |
| 8 | Pit Floor (hub) | `1F (1,1)` | 1–2 | Where the hub shaft lands you. Its south locked door (**L3** to 14) sits behind a raised blue crystal barrier flipped in room 12, so **Key 2** can only be spent on **L2** (east to 12). | W 9, E 12 (**L2**), N 11, S 14 (**L3**, behind blue barrier) |
| 9 | Gravel Chutes | `1F (0,1)` | 1 | Throw a bomb over a fence onto sloped chutes so it rolls downhill into a crystal switch, lowering the red barrier to 10. *twist* (chutes) | E 8, N 10 |
| 10 | Sand Cellar | `1F (0,0)` | 1 | A dark cellar: light its two braziers with Fire; a chest appears: **Small Key 2**. | S 9 |
| 11 | Quarry Face | `1F (1,0)` | 2 | A cliff of three terraces with a ledge at the top. Blast-jump up tier by tier and gust the sand off the top ledge: **Heart Piece**. | S 8 |
| 12 | Scaffold Stack | `1F (2,1)` | 1 | Burn the scaffold supports so a crate drops onto a floor button, revealing **Small Key 3**, and throw a bomb into the crystal switch to lower the blue barrier in 8 (exposing **L3**). North is a 2-tile chasm (Act 2). | W 8 (**L2**), N 13 (gap) |
| 13 | Gravel Seam | `1F (2,0)` | 2 | Blast-jump the chasm from 12. A cracked wall sits beyond a `3`-tile chasm; pop a Wind Bomb whirlwind and throw a Bomb into it to catapult across: **Boss Key**. *combine* | S 12 |
| 14 | Foreman's Den | `1F (1,2)` | 1 | **Miniboss Phase 1: Mole Foreman** (below). At half health he flees east into 15 and drops **the Wind Bomb** chest; blow the sand off the east door switch to pursue him. | N 8 (**L3**), E 15 |
| 15 | Lift Room | `1F (2,2)` | 1–2 | **Miniboss Phase 2: Mole Foreman** (below). Defeating him unlocks the midpoint warp pad; clear the sand-buried cargo lift switch with Wind to ride the lift up to 3. *teach* Wind | W 14, lift to 3 |

**Keys & No-Softlock Proof:**
- **Key 1** (room 2) opens **L1** (`5 → 4`, the only reachable locked door on `2F`).
- **Key 2** (room 10) opens **L2** (`8 → 12`); **L3** (`8 → 14`) is physically blocked by a raised blue crystal barrier in room 8 until you flip the crystal switch inside room 12, and room 12 has no back door to room 15.
- **Key 3** (room 12) opens **L3** (`8 → 14`, Foreman's Den).
- **Boss Key** (room 13) opens the boss door (`6 → 7`).

**Act 1 route:** 1 → 2 (Key 1) → 1 → 5 → 4 (L1) → drop to 9 → 10 (Key 2) → 9 → 8
→ 12 (L2, Key 3 + flip crystal) → 8 → 14 (L3, Miniboss Phase 1 + Wind) → 15
(Miniboss Phase 2 + Lift).
**Act 2 route:** 15 (lift) → 3 → 6 → back down via 5's shaft → 8 → 12 → 13
(Boss Key) → 12 → 8 → 14 → 15 (lift) → 3 → 6 → 7. Optional: 11 (Heart Piece),
2's sand alcove (Magic Bomb Sack upgrade), 3's shortcut to 1.

### Miniboss: Mole Foreman (Two-Room Fight: Rooms 14 & 15)

A mole in a hard hat who runs the quarry; at mouse scale, he is huge.

- **Phase 1 (Room 14, Foreman's Den — using Bomb + Fire):** he rides a wooden
  scaffold over the den, tossing gravel bombs. Burn the two wooden scaffold
  props with **Fire** so the scaffold tips and dumps him to the floor, dazed,
  then hit him with a **Bomb**. After two hits, he panics and **flees east into
  Room 15**, dropping the **Wind Bomb** chest in the centre of Room 14. Claim
  Wind and blow the sand pile off the east shutter switch to follow him.
- **Phase 2 (Room 15, Lift Room — testing Wind):** he mounts the iron lift
  gantry (immune to Fire) and shovels sand piles onto the four floor switches
  round the room. A regular Bomb only scatters sand back onto the switches; your
  new **Wind Bomb** blows the switches clean. With all four switches clear, the
  gantry drops him to the floor, dazed—bomb him twice to finish him and unlock
  the midpoint warp pad and cargo lift.
- He never digs into the floor himself, so it isn't a burrowing fight (see the
  homage note below).

### Boss: Boulder Golem

A golem of piled stone holding the top terrace, which steps down in four tiers
to where you enter.

- **Phase 1:** it rolls boulders down the tiers. Dodge between them, and
  blast-jump up one tier at a time between volleys.
- **Phase 2:** on its tier it backs towards the edge. Gust it with Wind; each
  gust pushes it a tile. At the edge, a last gust topples it off.
- **Phase 3:** it lands shattered at the foot of the terraces, its glowing core
  bare. Drop down and throw or drop a Bomb onto the core twice before it
  rebuilds.
- **Reward:** Heart Container, then the **Zephyr Core** in a chamber behind the
  terrace (part of room 7, not a separate room).

### Inspiration notes

- *Seasons*, **Poison Moth's Lair:** the new item (Roc's Feather) arrives
  halfway, and you go back through earlier rooms with it; and drops between
  floors carry you down. We borrow that *structure*: dropping in Act 1, climbing
  back with Wind in Act 2.
- *Ages*, **Moonlit Grotto:** a central **hub room** you pass again and again.
  Our hub pit (5 over 8) plays that role.
- **Homage check:** Moonlit Grotto's miniboss, **Subterror**, burrows in sand
  and is dug up with a shovel. That is why the Mole Foreman never burrows: he
  buries *switches*, and you uncover *them*.

---

## 3. Fire Mountain (gives Ice): 20 rooms

**Theme:** a volcano with an old forge dug into it: dark basalt, glowing lava,
furnaces, iron grates and chains. **New pieces:** **lava** (deadly; Ice crusts
it into floor until you leave the room, or Fire melts it) and **flame jets**
(fire on a beat; Ice puts one out for good). **Act 2 twist:** frozen crust is
*glazed*, so thrown/dropped bombs and shoved blocks on it slide until they hit
something (the only glazed floors in a Shrine).

**Shape:** `1F` is the upper forge around a **Great Forge** hub: a lava pool
with an island in its middle. In Act 1 you circle the pool; in Act 2 you crust
a path to the island, whose stair leads down to the lower forge (`B1F`) and the
boss.

```text
1F (upper forge)                          B1F (lower forge)
 x:   0      1      2      3              x:   0      1      2      3
y0  [ 8]   [ 9]== [10]== [11]            y0  [14]== [13]== [15]== [16]
      ||    L|             ||                   ||            ||
y1  [ 5] == [ 4] L= [ 6] == [ 7]         y1  [17] == [18] B= [19] == [20]
             ||                 
y2  [ 2] == [ 1] == [12] == [ 3]          (13 sits under 4's island)
            (in)    (L3 v)
```

| # | Room | `(x,y)` | Act | Puzzle and contents | Exits |
|:-:|---|---|:-:|---|---|
| 1 | Mountain Gate | `1F (1,2)` | 1 | *teach* lava: a one-tile lava stream crosses the room; blast-jump it with Wind. A flame jet guards the north door on a slow beat. | W 2, E 12, N 4 |
| 2 | Ash Hall | `1F (0,2)` | 1 | *teach* flame jets: a corridor of jets firing in a ripple; walk the gaps. At the end: **Small Key 1**. | E 1 |
| 3 | Chain Hoist | `1F (3,2)` | 1 | An iron cage hangs on a rope over a lava channel. Throw a Fire Bomb over the fence to burn the rope: the cage drops into the lava and becomes a bridge to the far ledge, with a fairy and a way north to 7. *combine* (Fire + lava) | W 12, N 7 |
| 4 | Great Forge (hub) | `1F (1,1)` | 1–2 | A lava pool fills the middle, with an anvil island and a stair. Its north locked door (**L2** to 9) is blocked by a raised blue crystal barrier until you flip the crystal switch in room 7, so **Key 1** must go to **L1** (east to 6). Act 2: crust a path across the pool to the island stair down to 13. | S 1, W 5, E 6 (**L1**), N 9 (**L2**, behind blue barrier), island to 13 |
| 5 | Bellows Room | `1F (0,1)` | 1 | A three-tile lava river. Pop a Wind Bomb on the near bank to leave a `2.5 s` whirlwind, then throw a Bomb into it to catapult across onto a floor switch; the shutter to 8 opens and a chest appears: **Small Key 2**. *combine* (Wind + Bomb) | E 4, N 8 |
| 6 | Furnace Row | `1F (2,1)` | 1 | Four furnaces (braziers); light all four with Fire before the first burns out, and an iron grate lifts. *twist* (timed braziers) | W 4 (**L1**), E 7 |
| 7 | Slag Chute | `1F (3,1)` | 1 | Sloped chutes run past flame jets; drop or throw a bomb onto the chute between jets so it rolls into a crystal switch, lowering the blue barrier in 4 (exposing **L2**) and revealing **Small Key 3** behind an Act 2 lava strip. | W 6, N 11, S 3 |
| 8 | Ember Vault | `1F (0,0)` | 2 | A dark vault lit only by its lava; a ledge across lava holds the **Heart Piece**. Crust a path to it. | S 5 |
| 9 | Salamander Pit | `1F (1,0)` | 1 | **Miniboss Phase 1: Fire Salamander** (below). At half health it dives through the east grate into 10, leaving **the Ice Bomb** chest behind; crust the east lava strip with Ice to pursue it. | S 4 (**L2**), E 10 |
| 10 | Quench Room | `1F (2,0)` | 1–2 | **Miniboss Phase 2: Fire Salamander** (below). Snuff its white-hot flame aura with Ice and bomb it to unlock the midpoint warp pad, then crust the east lava strip to exit to 11. *teach* Ice | W 9, E 11 (over the lava) |
| 11 | Jet Gallery | `1F (3,0)` | 2 | A gallery of flame jets on a fast beat, too fast to run. Ice puts each out for good; the gallery leads south to 7, where you crust the lava pocket to claim **Small Key 3**. *twist* | W 10, S 7 |
| 12 | Lava Falls | `1F (2,2)` | 1–2 | A lava fall pours across the room; you pass along its edge to 3 in Act 1. In Act 2, crust its pool and spend **Key 3** on **L3** to reach a stair down to 17 (a shortcut to the boss floor). | W 1, E 3, stair to 17 (**L3**) |
| 13 | Lower Forge | `B1F (1,0)` | 2 | Where the island stair lands. Your first *glazed crust*: crust a lava lane and throw a bomb onto it; it slides the whole lane into a crystal. *teach* glaze | W 14, E 15 |
| 14 | Ingot Press | `B1F (0,0)` | 2 | Shove a block with a blast onto glazed crust; it slides until it stops on a floor button. *twist* (blocks slide too) | E 13, S 17 |
| 15 | Smelter | `B1F (2,0)` | 2 | Throw a bomb onto glazed crust so it banks off iron pillars to hit a switch round a corner. *combine* | W 13, E 16 |
| 16 | Crucible | `B1F (3,0)` | 2 | Flame jets ring a chest; put them out with Ice and crust the lava moat: **Boss Key**. | W 15, S 20 |
| 17 | Slag Pool | `B1F (0,1)` | 2 | Where 12's stair lands. Freeze a lava channel to stop a slag-block current, then melt one tile with Fire so the block drops onto a sunken button. *combine* (Ice + Fire) | N 14, E 18, stair to 12 |
| 18 | Drake Stair | `B1F (1,1)` | 2 | The boss door. Pots and a heart. | W 17, E 19 (**boss door**) |
| 19 | Drake's Moat | `B1F (2,1)` | 2 | **Boss: Lava Drake** (below). | W 18, E 20 |
| 20 | Core Chamber | `B1F (3,1)` | 2 | Heart Container and the **Rime Core**; a warp back to the gate. | W 19, N 16 |

**Room count:** 1F has 12 rooms (1 to 12) and B1F has 8 (13 to 20): **20**.

**Keys & No-Softlock Proof:**
- **Key 1** (room 2) and **Key 2** (room 5) are both available on `1F`, while **L2** (`4 → 9`) is gated behind the blue crystal barrier flipped in room 7 (which lies behind **L1**, `4 → 6`). Even if the player collects both Key 1 and Key 2 before opening **L1**, **L1** is the only unlocked-barrier door available first, and **L3** (`12`'s stair) sits across an uncrusted lava pool requiring Act 2's **Ice Bomb** ( plus **Key 3** in room 7 is also gated behind an Ice-crusted lava strip).
- Thus **Key 1** and **Key 2** always open **L1** (`4 → 6`) and **L2** (`4 → 9`), **Key 3** (room 7, Act 2) opens **L3** (`12 → 17`), and **Boss Key** (room 16) opens the boss door (`18 → 19`).

**Act 1 route:** 1 → 2 (Key 1) → 1 → 4 → 5 (Key 2) → 4 → 6 (L1) → 7 (flip
crystal) → 6 → 4 → 9 (L2, Miniboss Phase 1 + Ice) → 10 (Miniboss Phase 2). Room
3 (from 12) is an optional loop to 7 with a fairy.
**Act 2 route:** 10 → 11 → 7 (Key 3) → 6 → 4 (crust to the island) → 13 → 14 →
17 → 18 … then 13 → 15 → 16 (Boss Key) → 20 → … → 18 → 19. Optional: 8 (Heart
Shard); 12 (L3) → 17 is the quick way down once you have Ice and Key 3.

### Miniboss: Fire Salamander (Two-Room Fight: Rooms 9 & 10)

A big lizard wreathed in flame, prowling a pit edged with lava. Bombs bounce off
its flames.

- **Phase 1 (Room 9, Salamander Pit — using Wind + Bomb):** you arrive with
  Bomb, Fire and Wind. Whenever it inhales to spit fire, pop a **Wind Bomb** to
  blow its flame cloak off for a moment, then throw a **Bomb** onto its bare
  scales. After two hits it dives under the east lava grate into Room 10,
  unsealing the **Ice Bomb** chest in Room 9. Claim Ice and crust the east lava
  strip to follow it.
- **Phase 2 (Room 10, Quench Room — testing Ice):** inside the quenching room it
  burns white-hot (Wind can no longer blow its flames out, and lava pools divide
  the floor). Crust the lava pools with **Ice** to manoeuvre, and hit the
  salamander directly with an **Ice Bomb** nova to quench its white-hot cloak
  and stun it; then throw a **Bomb** to damage it. Two cycles finish it and
  unlock the midpoint warp pad.

### Boss: Lava Drake

A long drake that swims a lava moat round the room's central island.

- **Phase 1:** it surfaces at random points and breathes a line of fire across
  the room. Crust a path of floor across the moat with Ice to reach the island
  (each crust holds until you leave).
- **Phase 2:** from the island, wait for it to rear up and breathe. Throw an
  **Ice Bomb** into its open jaws to freeze the breath and cool its throat; it
  stalls with its mouth open.
- **Phase 3:** throw a **Bomb** into its mouth (or slide one across the glazed
  crust) while it's stalled. Three cycles. Each cycle it melts some of your
  crust, so you re-freeze your path.

### Inspiration notes

- *Seasons*, **Dancing Dragon Dungeon:** a mine laid out in the shape of a
  dragon, where the item you find late (the slingshot) turns rooms you rode
  through earlier into new puzzles. Our hub (4) does the same: a pool you circle
  in Act 1 becomes the way down in Act 2. We use no mine carts; the "ride" is a
  bomb sliding on glazed crust.
- *Ages*, **Moonlit Grotto:** a hub whose state changes partway through (the
  wheel room's platform falls to the floor below). Our Great Forge island stair
  is the same idea in our terms.
- **Homage check:** a fire lizard and a lava serpent are genre staples, but our
  verbs (snuff with Ice, throw/slide a bomb into its mouth while frozen open,
  re-freeze a crust path) belong to our bombs.

---

## 4. Wind Cliffs (gives Rock): 24 rooms

**Theme:** sea caves at the foot of a cliff (`1F`) and ruined watchtowers on
the clifftop (`2F`), with rope bridges, gulls and sea spray. **New pieces:**
**gusts** (steady wind from vents that carries rolling bombs, sand and loose
objects; the mouse walks normally; a block makes calm air behind it) and
**gaps** (one-tile channels and pits that a Rock block turns into a stepping
stone).

**Shape:** a wide cave floor with a **Tide Hall** hub; a **blowhole** carries
bombs straight up to the clifftop, so Act 1 shoots from below what Act 2 climbs
to. The lighthouse stair links the floors.

```text
1F (sea caves)                                  2F (clifftop)
 x:  0      1      2      3      4               x:  0      1      2      3
y0 [13]   [10]   [11]== [12]   [14]           y0 [24]   [23]   [22]    .
     ||     ||     L|     ||     ||                       boss   B||
y1 [ 7] == [ 6] == [ 4] == [ 8] L= [ 9]^       y1 [18] L= [17] == [16] == [15]v
             ^blowhole ||                             ||      ||
y2 [ 5] == [ 2] == [ 1] == [ 3]                y2 [21] == [20] == [19]
                   (in)
```

| # | Room | `(x,y)` | Act | Puzzle and contents | Exits |
|:-:|---|---|:-:|---|---|
| 1 | Sea Cave Mouth | `1F (2,2)` | 1 | *teach* gusts: a vent blows across the room. Throw a bomb upwind and the gust curves it into a crystal switch. | W 2, E 3, N 4 |
| 2 | Spray Steps | `1F (1,2)` | 1 | Sea spray pours down the walls; Ice freezes it into ledges to walk on. A chest on the top ledge: **Small Key 1**. | E 1, W 5 |
| 3 | Gull Roost | `1F (3,2)` | 1 | Burn the driftwood nests (Fire); a gust carries a thrown bomb across a `3`-tile gap onto a high cracked wall to open the way to 8. *combine* (Fire + gust) | W 1, N 8 |
| 4 | Tide Hall (hub) | `1F (2,1)` | 1–2 | Four vents whose gusts cross in the middle, sweeping any bomb you place. Its north locked door (**L2** to 11) sits behind a raised blue crystal barrier flipped in room 15 (at the top of the lighthouse stair), so **Key 1** must open **L1** (`8 → 9`) first. Act 2: a Rock windbreak calms the centre for good. | S 1, W 6, E 8, N 11 (**L2**, behind blue barrier) |
| 5 | Driftwood Store | `1F (0,2)` | 1 | Crates and pits; blast-jump between outcrops to a crate cache with a fairy. | E 2, N 7 |
| 6 | Blowhole | `1F (1,1)` | 1 | A blowhole vent shoots straight up. A bomb thrown into it is carried up to 2F, where it hits the switch that lowers the rope bridge in 17. *twist* (gusts across floors) | E 4, W 7, N 10 |
| 7 | Kelp Cellar | `1F (0,1)` | 1 | A dark cave: light three braziers with Fire to see the hidden stepping-stones across the water. | E 6, S 5, N 13 |
| 8 | Wreck Hold | `1F (3,1)` | 1 | A shipwreck's hull; shove a block with a blast onto a floor button against a gust that keeps pushing it back. A chest: **Small Key 2**. | W 4, S 3, E 9 (**L1**) |
| 9 | Lighthouse Base | `1F (4,1)` | 1–2 | The spiral stair up to the clifftop (15). Act 1 reaches it with **Key 1** to climb to 15 and flip the crystal; Act 2 uses it as the route up. | W 8 (**L1**), N 14, stair to 15 |
| 10 | Echo Cave | `1F (1,0)` | 2 | Gaps everywhere. *teach* Rock stepping stones: drop Rock into one-tile channels to cross. **Heart Piece** at the far end. | S 6 |
| 11 | Harpy's Roost | `1F (2,0)` | 1 | **Miniboss Phase 1: Harpy** (below). At half health it flees east into 12, leaving **the Rock Bomb** chest behind; drop a Rock stepping stone across the east gap to pursue it. | S 4 (**L2**), E 12 |
| 12 | Gust Gallery | `1F (3,0)` | 1–2 | **Miniboss Phase 2: Harpy** (below). Raise Rock pillars in its dive line to daze and defeat it (unlocking the midpoint warp pad), then raise windbreaks so bombs sit on three floor buttons at once to open the south shortcut to 8. *teach* windbreaks | W 11, S 8 (shutter) |
| 13 | Stone Bridge Cave | `1F (0,0)` | 2 | Chains of gaps over the sea; stepping stones plus a blast-jump between them. A chest: **Small Key 3**. *combine* (Rock + Wind) | S 7 |
| 14 | Undertow | `1F (4,0)` | 2 | A channel where the current drags blocks; wall it off with Rock so a shoved block stops on a button. **Magic Bomb Sack upgrade (`3 → 4` live bombs).** | S 9 |
| 15 | Watchtower Stair | `2F (3,1)` | 1–2 | Where the lighthouse stair lands. In Act 1 you throw a bomb across the gap into a crystal switch (lowering the blue barrier in 4 to expose **L2**), while the west path dead-ends at a channel that needs a Rock stepping stone in Act 2. | stair to 9, W 16 (gap) |
| 16 | Cliff Path | `2F (2,1)` | 2 | Gusts along the cliff edge sweep bombs over the drop. Windbreaks keep them on the path while you bomb a line of cracked boulders. | E 15, W 17, S 19, N 22 (**boss door**) |
| 17 | Rope Bridge | `2F (1,1)` | 1–2 | The bridge lowered by 6's blowhole bomb (Act 1, seen from below); in Act 2 you cross it, filling its broken planks with stepping stones. | E 16, W 18 (**L3**), S 20 |
| 18 | Ruined Watchtower | `2F (0,1)` | 2 | Locked by **L3**. A four-button door: two blocks shoved by blasts, one Rock block and one bomb held under a windbreak. **Boss Key**. *combine* | E 17 (**L3**), S 21 |
| 19 | Nesting Ledges | `2F (2,2)` | 2 | Gull nests on ledges; burn them for hearts; terraces you blast-jump up. | N 16, W 20 |
| 20 | Vane Hall | `2F (1,2)` | 2 | Wind-vane switches spun by gusts; block one vent with Rock so only the right vane turns, opening the west door to 21. *twist* | E 19, W 21, N 17 |
| 21 | Lookout | `2F (0,2)` | 2 | A crumbling lookout over the sea with a view of the boss's perch; pots and a fairy before the boss (south of 18 is a one-way ledge drop from 18 → 21 so 21 never bypasses **L3**). | E 20, one-way drop from 18 |
| 22 | Storm Stair | `2F (2,0)` | 2 | The boss door, then a climb up the last terraces into the wind. | S 16, W 23 |
| 23 | Clifftop | `2F (1,0)` | 2 | **Boss: Storm Bird** (below). | E 22, W 24 |
| 24 | Core Chamber | `2F (0,0)` | 2 | Heart Container and the **Stone Core**; a warp back to the cave mouth. | E 23 |

**Keys & No-Softlock Proof:**
- **Key 1** (room 2) and **Key 2** (room 8) are both in Act 1, while **L2** (`4 → 11`) is gated behind the blue crystal barrier in room 4 that can only be flipped from room 15 (behind **L1**, `8 → 9`). Thus the player must open **L1** first, flip the crystal in 15, and then open **L2** (`4 → 11`).
- **Key 3** (room 13) requires the **Rock Bomb** (from room 11) to cross the sea gaps, and opens **L3** (`17 → 18`). Room 21's connection to 18 is a one-way southward ledge drop (`18 → 21`), so **L3** cannot be bypassed from below.
- **Boss Key** (room 18) opens the boss door (`16 → 22`).

**Act 1 route:** 1 → 2 (Key 1) → 1 → 3 → 8 (Key 2) → 9 (L1) → up to 15 (flip
crystal, dead end at gap) → back → 4 → 6 (blowhole bomb lowers 17's bridge) →
11 (L2, Miniboss Phase 1 + Rock) → 12 (Miniboss Phase 2). Side rooms: 5, 7.
**Act 2 route:** 12 → 8 → 4 → 6 → 7 → 13 (Key 3) → back to 9 → 15 (fill the
gap) → 16 → 17 → 18 (L3, Boss Key) → 17 → 16 → 22 → 23. Optional: 10 (Heart
Shard), 14 (Magic Bomb Sack upgrade), 19 to 21.

### Miniboss: Harpy (Two-Room Fight: Rooms 11 & 12)

A diving harpy in a high sea cave.

- **Phase 1 (Room 11, Harpy's Roost — using Ice / Wind + Bomb):** it swoops in
  low circuits over shallow tide pools and dives at you. Freeze the tide pool in
  its flight path with **Ice** (or punt it into the cave wall with a **Wind
  Bomb** as it swoops) so it skids and tumbles, dazed; then hit it with a
  **Bomb**. After two hits it screeches and **flees east into Room 12**,
  unsealing the **Rock Bomb** chest in Room 11. Claim Rock and drop a stepping
  stone into the east channel to follow it.
- **Phase 2 (Room 12, Gust Gallery — testing Rock):** in the dry wind gallery
  there are no tide pools, and cross-gusts blow Wind Bombs off course. The Harpy
  now dives straight down the wind lanes at high speed; raise a **Rock Bomb**
  pillar in its dive line so it slams headfirst into the stone block and drops,
  dazed, then bomb it twice to finish it and unlock the midpoint warp pad.

### Boss: Storm Bird

A great storm bird on the clifftop, beating its wings into gales that blow
every bomb back at you.

- **Phase 1 (Perch Gale — Rock Windbreak):** it perches on the north crag and
  fans a continuous gale across the clifftop. Raise a **Rock** windbreak in
  front of it; a Bomb dropped in the calm lee behind the block stays put and
  detonates under its beak.
- **Phase 2 (Eye of the Squall — Redirecting Tornados with Rock):** it takes wing
  and sends rolling cyclone orbs down the clifftop lanes while bombarding you
  with feather darts. Place a **Rock** block to deflect its cyclone orb laterally
  into the bird's own low-hovering wing (or trap a Bomb against the block as it
  sweeps past), grounding it in a heap of feathers so you can bomb it.
- **Phase 3:** it alternates between Perch Gales and Squall sweeps, faster, and
  its gales crumble your Rock blocks after a few seconds so you must place fresh
  ones each volley.

### Inspiration notes

- *Seasons*, **Poison Moth's Lair:** **Mothula** flies circuits above pits while
  you fight from platforms. Our Storm Bird keeps the "airborne boss you ground
  first" idea but grounds it with *your own* blocks, not platforms.
- *Ages*, **Wing Dungeon** and the cliff areas: floors you see before you can
  reach them. The blowhole that bombs 2F from 1F is our version: you change the
  clifftop in Act 1 before you ever stand on it.
- **Homage check:** no feathers, no jumping item, no moving platforms; the
  verbs are gusts, windbreaks and stepping stones.

---

## 5. Iron Tower (all bombs): 16 rooms

**Theme:** the Sorcerer's tower, dark iron and old stone, each floor tinted
by the Shrine it echoes. **No new pieces:** every room combines pieces you
already know. **No keys:** each floor is a **`2 × 2` square of 4 rooms** around
the tower's **central lift spine**.

**Shape:** Instead of a 16-room single-file snake, each floor (`1F` to `4F`) is
a `2 × 2` square:
- From each floor's **Landing** (`(1,1)`), two parallel trial wings branch
  **West** (`(0,1)`) and **North** (`(1,0)`). You can solve the two wings in
  **either order**; each wing releases one of the two iron bolts on the
  **Apex Room** (`(0,0)`), which holds the stair up to the next floor (or the
  miniboss / final boss).
- Reaching `2F`, `3F` and `4F` unlocks that floor's stop on the **Central Lift
  Warp Pad** in `1F` Room 1, so dying in the upper tower and respawning in the
  `1F` foyer lets you warp straight back to the highest floor you reached.

```text
Each floor (1F..4F) is a 2x2 square around the central shaft:

   x:    0          1
y0   [Apex ^] == [North Wing]
        ||            ||
y1   [West Wing] == [Landing]

1F (Ice Cave reprise):    [4]^ == [3]     2F (Rock Quarry reprise): [8]^ == [7]
                           ||      ||                                ||      ||
                          [2]  == [1](in)                           [6]  == [5]v

3F (Fire Mtn reprise):    [12]^== [11]    4F (Wind Cliffs & Boss):  [16] == [15]
                           ||      ||                                B||     ||
                          [10] == [9]v                              [14] == [13]v
```

| # | Room | Floor & `(x,y)` | Role & Puzzle |
|:-:|---|:-:|---|
| 1 | Tower Gate (Landing) | `1F (1,1)` | The four-element gate (`GAME.md` campaign flow): light a brazier, spin a vane, freeze a moat, weigh a pedestal. Also houses the **Central Lift Warp Pad** (`1F ↔ 2F ↔ 3F ↔ 4F` as each floor is reached). |
| 2 | Frozen Gust (West Wing) | `1F (0,1)` | *Ice Cave reprise A:* ice blocks to melt, but each sits in a gust that blows your Fire Bomb off target; raise a Rock windbreak first. Releases West bolt on 4. (Fire + Rock) |
| 3 | Brazier Moat (North Wing) | `1F (1,0)` | *Ice Cave reprise B:* ordered braziers across a lava gap; crust the gap with Ice to throw Fire into brazier III in time. Releases North bolt on 4. (Fire + Ice) |
| 4 | Dark Landing (Apex) | `1F (0,0)` | Unlocks once both 2 and 3 are solved. A dark room where lighting all four corner braziers lowers the crystal barrier to the `2F` stair. |
| 5 | Sand Lift (Landing) | `2F (1,1)` | *Rock Quarry reprise:* arrives from 4 and links the `2F` warp stop. Sand-buried switches under glazed crust; melt the crust with Fire, then blow the sand clear with Wind to open both wings. (Fire + Wind) |
| 6 | Terrace Bank (West Wing) | `2F (0,1)` | Terraces where you blast-jump up and throw a sliding bomb along glazed tiers into a crystal. Releases West bolt on 8. (Wind + Ice) |
| 7 | Rubble Chasm (North Wing) | `2F (1,0)` | **Miniboss Phase 1: Iron Knight** (below). At half armour it retreats west into 8. |
| 8 | Knight's Hall (Apex) | `2F (0,0)` | **Miniboss Phase 2: Iron Knight** (below). Requires both 6's bolt and 7's retreat. Defeating it opens the stair to `3F` and activates the midpoint warp stop. |
| 9 | Forge Landing | `3F (1,1)` | *Fire Mountain reprise:* links the `3F` warp stop. Lava and flame jets whose beat is tied to a crystal switch; crust a bridge to open the West and North wings. (Ice + Bomb) |
| 10 | Glaze Works (West Wing) | `3F (0,1)` | A glazed-crust slide where only a Rock backstop stops a blast-shoved block on its button. Releases West bolt on 12. (Ice + Rock) |
| 11 | Crucible Bridge (North Wing) | `3F (1,0)` | Freeze a lava river, shove a block across, then melt one crust tile with Fire so it sinks onto a submerged switch. Releases North bolt on 12. (Ice + Fire) |
| 12 | Slag Apex | `3F (0,0)` | Unlocks once both 10 and 11 are solved. Put out four rapid flame jets with Ice and catapult a Bomb via a Wind whirlwind to open the `4F` stair. (Ice + Wind + Bomb) |
| 13 | Gale Landing | `4F (1,1)` | *Wind Cliffs reprise:* links the `4F` warp stop. Cross-gusts sweep the landing; place a Rock windbreak to open the West and North wings. |
| 14 | Broken Bridge (West Wing) | `4F (0,1)` | Stepping stones and blast-jumps over a chasm with alternating gusts. Releases West seal on the Boss Door (14 → 16). (Rock + Wind) |
| 15 | Gale Braziers (North Wing) | `4F (1,0)` | Gust vents carry thrown Fire Bombs across a `4`-tile abyss into distant braziers; use a Rock block to trim the wind lane. Releases North seal on the Boss Door (15 → 16). (Fire + Rock + gust) |
| 16 | Sorcerer's Roof (Apex) | `4F (0,0)` | Unlocks once both 14 and 15 are solved (pots and a fairy stand by the threshold). **Boss: the Sorcerer** (below and `GAME.md` §5). |

### Miniboss: Iron Knight (Two-Room Fight: Rooms 7 & 8)

A hulking suit of iron armour that marches and swings a great iron blade.

- **Phase 1 (Room 7, Rubble Chasm):** each Bomb blast knocks one heavy plate off
  (shield, then breastplate); heating its joints with **Fire** first makes a
  single Bomb blast strip both plates at once. Once its outer plates crack off,
  it **retreats west into Room 8**.
- **Phase 2 (Room 8, Knight's Hall):** in the main hall it charges across a
  lava-rimmed floor. Daze its charge against a **Rock** block (or crust the
  lava moat with **Ice** to flank its backplate), blast off its helmet, and
  bomb the exposed core inside the empty suit.

### Boss: the Sorcerer (Your Brother)

Pip's older brother, who raided the cellar before you and mastered all four
Shrine elements: the mirror of Pip. He cycles Fire, Wind, Ice and Rock in a
fixed order, throwing that element's bombs and wearing it as a shield. Break
the shield with its **counter**, then hit him with a plain Bomb while he's
stunned:

| He shifts into | He attacks with | Your counter |
|---|---|---|
| Fire | Fire Bombs that leave burning patches | Ice |
| Wind | gusts that blow your bombs away | Rock (a block the gust can't move, then drop a Bomb behind it) |
| Ice | ice novas that glaze the floor, so your bombs slide | Fire |
| Rock | rock walls raised around himself | Wind |

Each loop is faster and adds a bomb to his volleys; about two loops beat him. A
wrong bomb fizzles into his shield and costs time, not hearts.

### Inspiration notes

- *Ages*, **Black Tower**, and *Seasons*, **Onox's Castle:** a final climb
  through floors that recall the whole journey before the last fight. We keep
  the climb and the recap, but use one floor per Shrine, so it reads as a lesson
  review.
- **Homage check:** the mirror duel is a Zelda staple; the counter-the-element
  rule is ours.

---

## Build order

0. **Grandma's Basement (Dungeon Zero):** Mouse House interior (`Room 0`) and
   the 4-room basement teaching Roll, floor switch, Small Key, and the Magic
   Bomb Sack (`Pull → Drop / Throw`).
1. **Rock Quarry first:** sand piles, terraces, the hub pit, the cargo lift,
   the Mole Foreman and the Boulder Golem. It also builds the multi-floor
   machinery (drops, stairs, lifts) the later Shrines need.
2. **Fire Mountain:** lava, crust and glaze, flame jets, then its two fights.
3. **Wind Cliffs:** gusts, Rock blocks, windbreaks, stepping stones, the
   blowhole between floors, then its two fights.
4. **Iron Tower:** combinations only, then the Iron Knight and the Sorcerer.

Each Shrine is playable end to end before the next is started, with a test
that walks its key route (as the Ice Cave's tests do).
