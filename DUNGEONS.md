# Shrines & Dungeons: room by room

The layouts, Rube Goldberg puzzle chains, Miniboss gates, and Boss duels of:
1. **Grandma's Basement (Dungeon 0 — `5` rooms):** unlocks the **Magic Bomb Sack (`Bomb`)**.
2. **The `36` Single-Room Shrines (`6` Relic Shrines + `30` Trial Shrines):** self-contained *Breath of the Wild*-style single-room puzzle boxes (spanning `1 × 1` up to `2 × 2` screens with smooth camera scrolling), each with a **Trial Name that is its hint**.
3. **The `4` Major Multi-Room Dungeons (`Ice Cave`, `Rock Quarry`, `Fire Mountain`, `Wind Cliffs`) & the `Iron Tower` (`85` rooms):** multi-bomb regional capstones built around a macro-architectural multi-room gimmick, awarding the **4 Elemental Keys** (**Cinder, Zephyr, Rime, Stone**) that unseal the Iron Tower.

`GAME.md` and `PUZZLE_MECHANICS.md` hold the core rules this builds on.

---

## Architecture & Scope

| Category | Count | Rooms | Size per Room | What You Win |
|---|:-:|:-:|:---:|---|
| **0. Grandma's Basement** (House + Cellar) | 1 | **5** | `1 × 1` (`11 × 13`) | **Magic Bomb Sack (`Bomb`)** |
| **Relic Shrines (`R1–R6`)** (Button-gated bomb unlocks) | 6 | **6** | `1 × 2` or `2 × 1` scrolling | **Fire, Squeak, Wind, Magnet, Ice, Rock** |
| **Trial Shrines (`T01–T30`)** (Self-contained Rube Goldberg trials) | 30 | **30** | `1 × 1` to `2 × 2` scrolling | **`30` Grandma's Sewing Buttons** (`1` per Shrine) |
| **1. Ice Cave** (`Bomb + Fire + Squeak`) | 1 | **10** | `1 × 1` to `1 × 2` | **Cinder Key** (`1/4` Tower Seal) + `1` Button |
| **2. Rock Quarry** (`Bomb + Fire + Wind + Magnet`) | 1 | **15** | `1 × 1` to `2 × 1` | **Zephyr Key** (`2/4` Tower Seal) + `1` Button |
| **3. Fire Mountain** (`Ice + Fire + Wind + Magnet`) | 1 | **20** | `1 × 1` to `2 × 1` | **Rime Key** (`3/4` Tower Seal) + `1` Button |
| **4. Wind Cliffs** (`Rock + Magnet + Wind + Ice`) | 1 | **24** | `1 × 1` to `2 × 1` | **Stone Key** (`4/4` Tower Seal) + `1` Button |
| **5. Iron Tower** (All 7 Bombs) | 1 | **16** | `1 × 1` to `2 × 2` | **Finale (The Sorcerer)** |
| **Total Interior Puzzle Rooms** | | **126** | | (+ `100` Overworld flip-screens) |

## Shared Rules

- **Zero combat filler, zero hearts:**
  - There are **no bats, no chasing trash mobs, and no `clear-enemies` doors**. Every creature in a puzzle room is a deterministic **Clockwork Creature** (Brass Beetle, Mimic Statue, Rail Tortoise, Pack-Otter).
  - **No hearts anywhere:** your own bomb blasts never hurt you (`1`-tile knockback hop); pits, lava, spikes, and flame jets pop you back to the last safe tile (`0.35 s`); boss hits reset the current 1-of-3 puzzle phase.
- **Hybrid camera (`11 × 13` base screen, scrolling inside Shrines & large halls):**
  - Standard rooms are `11 × 13` tiles (`1 × 1`).
  - Single-Room Shrines and centerpiece Dungeon halls can span **`1 × 2` (`11 × 26`)**, **`2 × 1` (`22 × 13`)**, or **`2 × 2` (`22 × 26`)** with smooth pixel-snapped camera follow so an entire 3- to 4-stage Rube Goldberg chain runs in one continuous space without blind screen cuts.
- **Minibosses as Living Puzzle Gates:**
  - In each Major Dungeon, the **Miniboss** sits on the main trunk and acts as an impenetrable **living lock** if approached with brute force. You solve it in a 2- to 3-step Rube Goldberg sequence using the region's bombs, which activates the **midpoint warp pad** back to the dungeon foyer and opens the Act 2 loop.
- **No-Key-Softlock Invariant (Certified by `tests/softlock.test.ts`):**
  1. Whenever a hub has two locked doors (`L1` and `L2`), either `L2` is physically gated behind a crystal barrier or obstacle solved inside the `L1` branch, **or** both branches independently yield a Small Key.
  2. Every consumable puzzle prop (`W` crates, `,` fuse lines, blocks, spheres, frozen crusts, Clockwork Creatures) resets on room exit so a mistimed chain can never soft-lock a room.

---

## 0. Grandma's Basement (Dungeon Zero — gives the Magic Bomb Sack): 5 rooms

**Theme:** the cozy interior of the Mouse House (`1F`) and its cobwebbed stone root cellar (`B1F`).
**Story & purpose:** You start **inside the Mouse House** with no bombs (`B = Roll` only). **Grandma** tells you your brother raised the Iron Tower overnight and scattered her sewing buttons, and sends you down to the basement for the **Magic Bomb Sack (`Bomb`)**.

```text
House Interior (1F)              Grandma's Basement (B1F)
     [ 0 ]                            [ 4 ] == [ 3 ]
   v       v                            ||      L|
(cellar) (out to 5,4)                 [ 2 ] == [ 1 ]^
```

| # | Room | `(x,y)` | Puzzle and contents | Exits |
|:-:|---|---|---|
| 0 | Mouse House Interior | `House (1,3)` | **Start of the game (built).** Grandma stands by her sewing basket; the front door south to the village yard (`5,4`) is sealed by fallen cellar rubble (`%`) until you return with the Bomb. *teach* talk & objective | stair down to 1, front door out to `(5,4)` (blocked by `%`) |
| 1 | Cellar Stairs | `B1F (1,1)` | Where the house stair lands. The return stair up is latched behind a raised red crystal barrier (`R`), and a locked door (**L1**) bars the north workroom. *teach* locked door & crystal latch | stair up to 0 (behind `R`), W 2, N 3 (**L1**) |
| 2 | Root Pantry | `B1F (0,1)` | A `1`-tile spike strip (`!`) guards an alcove floor switch (`O`). Press **B = Roll** to dash across the spikes unharmed onto `O`, dropping **Small Key 1** onto the centre seal ring. *teach* Roll & floor switch | E 1, N 4 (behind `R`) |
| 3 | Grandpa's Workroom | `B1F (1,0)` | Unlocked with **Small Key 1**. Claim the **Magic Bomb Sack (`Bomb`)** on the pedestal, then **A = Pull → B = Drop** a Bomb against the cracked west wall (`%`) to open the passage into 4. *teach* Pull & Drop on `%` | S 1 (**L1**), W 4 (via `%`) |
| 4 | Coal Chute | `B1F (0,0)` | A wooden fence (`=`) separates you from a crystal switch (`C`). **A = Pull → A = Throw** a Bomb north over the fence into `C`, flipping `red → blue` to lower the red barriers in 2 and 1. Return upstairs and bomb the front door rubble out to `(5,4)`. *teach* Throw over `=` & crystal switch | E 3, S 2 |

---

## Part I: The 36 Single-Room Shrines (`6` Relic Shrines + `30` Trial Shrines)

Every Shrine is a **single continuous room** (no keys, no filler corridors) with
a **Trial Name that hints at its Rube Goldberg chain**.

### A. The 6 Relic Shrines (Button-Gated Bomb Unlocks)

Each Relic Shrine sits at the threshold of a biome (`OVERWORLD.md`). Presenting
the required number of **Grandma's Sewing Buttons** unseals the door; inside,
you claim the new Bomb on the entry pedestal and solve a two-part scrolling
chamber (`1 × 2` or `2 × 1`) to open the exit altar.

| ID | Shrine & Overworld `(x,y)` | Button Gate | Bomb Unlocked | Size | Trial Name & Rube Goldberg Solve |
|:-:|---|:-:|---|:-:|---|
| **R1** | **Hearth Vault** `(4,6)` *(Bramble Woods)* | **`2` Buttons** | **Fire Bomb** | `1 × 2` | *"The Travelling Spark"* — Part 1: throw Fire over a fence to light a `,` grass fuse line that burns around a corner to a brazier. Part 2: burn a hanging cage's rope so an iron weight drops onto a floor switch while a second fuse line lights a timed brazier in tandem. |
| **R2** | **Chime Grotto** `(4,7)` *(Frost Hollow)* | **`5` Buttons** | **Squeak Bomb** | `2 × 1` | *"Follow the Chirp"* — Part 1: throw a Squeak Bomb over a balustrade to lure a Brass Beetle off a blocker tile onto a floor button, holding it with the `2.5 s` daze puff. Part 2: alternate two Squeak Bombs along an L-corridor to guide a Mimic Statue through a maze onto a permanent latch plate. |
| **R3** | **Bellows Sanctum** `(2,4)` *(Quarry Hills)* | **`10` Buttons** | **Wind Bomb** | `1 × 2` | *"Eye of the Gale"* — Part 1: blast-jump up terraced ledges and blow a sand pile off a floor button. Part 2: pop a Wind Bomb on a chasm lip to leave a **`2.5 s` whirlwind vortex**, then throw a plain Bomb into the vortex to catapult it `4` tiles across the pit into a crystal switch. |
| **R4** | **Lodestone Vault** `(1,5)` *(Quarry Hills)* | **`15` Buttons** | **Magnet Bomb** | `2 × 1` | *"Pull of the Rail"* — Part 1: roll a Bomb down a stone chute and place a Magnet Bomb behind a fence to pull the rolling bomb sideways mid-chute into a cracked `%` wall. Part 2: throw a Magnet Bomb onto a curved magnetic rail so its moving field drags an iron sphere across a parallel trench onto a socket. |
| **R5** | **Rime Well** `(8,4)` *(River Valley)* | **`21` Buttons** | **Ice Bomb** | `1 × 2` | *"Stop the Stream"* — Part 1: set a Bomb floating down a fast water current, then throw an Ice Bomb to freeze the current mid-drift so the bomb stops and detonates right beside a shore crystal. Part 2: crust a lava pool into slick **glaze**, freeze a Brass Beetle into an ice cube, and kick-slide it across the glaze onto a switch. |
| **R6** | **Cairn Sanctum** `(1,2)` *(Wind Cliffs)* | **`28` Buttons** | **Rock Bomb** | `2 × 1` | *"The Portable Wall"* — Part 1: drop a Rock block as a curling backstop on a glazed lane so a blast-shoved block stops dead on a center button. Part 2: place a Rock windbreak inside a howling gust lane so a Fire Bomb can light a brazier in its calm lee without blowing away. |

### B. The 30 Trial Shrines (`1` Grandma's Button Each)

Grouped by the bombs they require. Every Trial Shrine is a self-contained
single-room Rube Goldberg puzzle box (`1 × 1` to `2 × 2` scrolling).

#### Tier 1: Starter Bomb Trials (Millbrook Vale & Bramble Outskirts — unlocks `R1`)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T01** | `(5,3)` Millbrook North | *"A Delayed Flip"* | Bomb | `1 × 1` | Drop a Bomb at the top of an `e → s` stone chute and run across the lowered blue barrier while the bomb rolls; it strikes `C` at the bottom and lowers the red exit barrier behind you. |
| **T02** | `(6,3)` Millbrook East | *"Two Bombs, One Spark"* | Bomb | `1 × 1` | Place Bomb A near a fence, then detonate Bomb B behind it to **blast-shove** Bomb A across a gap into a crystal pocket (`1st` hit shoves, fuse pops on target). |
| **T03** | `(3,5)` Orchard | *"The Raised Backstop"* | Bomb | `1 × 2` | Flip crystal `C` to raise a Red peg `R` in the middle of an open hall → blast-shove a stone block `P` so it stops against `R` → flip `C` again so `R` drops and one more blast seats `P` on button `O`. |

#### Tier 2: Fire Bomb Trials (Bramble Woods & Frost Border — unlocks `R2`)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T04** | `(3,4)` Meadow Fields | *"Twin Fuse Race"* | Bomb + Fire | `2 × 1` | Light a 6-tile `,` grass fuse line with Fire; as it burns toward a distant crystal-caged brazier, run to the midpoint and blast a `%` wall with a Bomb so the flame jumps the gap and lights the brazier. |
| **T05** | `(6,5)` Thorn Thicket | *"The Firebreak"* | Bomb + Fire | `1 × 1` | A dry-grass room where burning the wooden crate on button `O` ruins the solve; blast a stone block into the grass lane first as a firebreak, then ignite the grass to light three braziers while sparing the crate. |
| **T06** | `(3,6)` Old Orchard Wood | *"Drop the Weight"* | Bomb + Fire | `1 × 2` | Burn a rope with Fire to drop a suspended stone block onto the top of a chute; as it slides down, time a Bomb blast at the intersection to shove it east onto a permanent latch button. |
| **T07** | `(6,7)` Frosted Thicket | *"Melt in Order"* | Bomb + Fire | `1 × 2` | Three ordered braziers (`I → II → III`) sit behind different lengths of ice blocks and `,` grass fuse lines; ignite all three lines so the flames arrive in exact `I → II → III` order. |

#### Tier 3: Squeak Bomb Trials (Frost Hollow — unlocks `R3` & prepares for Ice Cave)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T08** | `(4,8)` Snow Fields | *"Beetle Relay"* | Bomb + Squeak | `2 × 1` | Lure a Brass Beetle across a narrow bridge behind a fence with a Squeak Bomb so it steps on button `O1` (lowering barrier `R`), then throw a Bomb through the opened gap into crystal `C`. |
| **T09** | `(3,7)` Old Icehouse | *"Mirror Steps"* | Fire + Squeak | `1 × 2` | Walk a Mimic Statue onto a center turntable, then throw a Squeak Bomb into a side alcove to pull the statue off-axis onto a fire-lit latch plate while Pip walks to the exit. |
| **T10** | `(2,7)` Frost Cistern | *"Bait the Drop"* | Bomb + Fire + Squeak | `1 × 2` | Lure a Brass Beetle under a suspended iron cage with a Squeak Bomb, then burn the rope with Fire so the cage drops and traps the beetle permanently on the floor button. |
| **T11** | `(6,8)` Glacier Edge | *"Mousehole Messenger"* | Bomb + Squeak | `2 × 1` | Throw a Squeak Bomb to lure a Pack-Otter to a mousehole mouth, then drop a live Bomb; the otter carries the ticking Bomb through the mousehole to blast a `%` wall in a sealed glass chamber. |
| **T12** | `(2,8)` Icicle Ravine | *"Chirp and Chute"* | Bomb + Fire + Squeak | `2 × 1` | Lure an Iron Tortoise with a Squeak Bomb so its shell bridges a gap in an overhead chute, then roll a Bomb down the completed chute into a crystal switch. |

#### Tier 4: Wind Bomb Trials (Quarry Hills — unlocks `R4`)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T13** | `(2,3)` Gravel Flats | *"Whirlwind Artillery"* | Bomb + Wind | `1 × 2` | Pop a Wind Bomb on a high terrace to create a `2.5 s` whirlwind vortex, then throw two Bombs into it at different angles to blast two distant `%` pillars across a `4`-tile chasm. |
| **T14** | `(0,4)` Dust Bowl | *"Buried Circuit"* | Fire + Wind | `2 × 1` | Blow three sand piles clear with Wind to expose a buried `,` powder fuse trail linking three timed braziers, then ignite the center of the trail with one Fire Bomb so all three light at once. |
| **T15** | `(2,5)` Sand Dunes | *"Updraft Delivery"* | Squeak + Wind | `1 × 2` | Catapult a Squeak Bomb across a `4`-tile pit via a Wind whirlwind so it lands inside a distant pen and lures a Brass Beetle onto the bridge release switch. |
| **T16** | `(0,6)` Deep Seam | *"Hop the Flip"* | Bomb + Wind | `1 × 2` | Drop a Bomb on a slow chute toward crystal `C`, blast-jump up two terrace tiers with Wind while the bomb rolls, and cross the upper `U` barrier right as `C` flips below. |
| **T17** | `(2,2)` Stone Steps | *"Gale Vane Chain"* | Bomb + Fire + Wind | `2 × 1` | Spin a wind vane with a Wind Bomb to slide a cycling platform across a gap; a burning Fire Bomb riding the platform lights the far brazier before the platform returns. |

#### Tier 5: Magnet Bomb Trials (Quarry Hills & River Border — unlocks `R5` & prepares for Rock Quarry)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T18** | `(1,6)` Rubble Gully | *"Bent Trajectory"* | Bomb + Magnet | `2 × 1` | Roll a Bomb east down a chute; a Magnet Bomb ticking north of a fence curves the rolling bomb `90°` north off the chute into a recessed crystal orb. |
| **T19** | `(2,6)` Boulder Field | *"Rail Tug"* | Fire + Magnet | `2 × 1` | Throw a Magnet Bomb onto an S-shaped magnetic floor rail; as it glides along the rail, its magnetic field drags an iron brazier cart through a stationary Fire hearth patch, lighting the cart as it reaches its socket. |
| **T20** | `(0,7)` Sand Pits | *"Magnetic Ferry"* | Wind + Magnet | `2 × 2` | Blow sand off a magnetic rail with Wind, catapult a Magnet Bomb across a chasm via a Wind whirlwind onto the rail, and let it pull an iron bridge segment into place. |
| **T21** | `(0,8)` Stone Quay | *"Sphere Pinball"* | Bomb + Magnet | `1 × 2` | Pull an iron sphere off a pedestal with a Magnet Bomb onto a chute, then blast-shove the rolling sphere sideways at the bottom with a timed Bomb into a polarity switch. |
| **T22** | `(7,5)` Otter Shallows | *"Attractor Lure"* | Squeak + Magnet | `2 × 1` | Lure a Pack-Otter carrying an iron key-sphere with a Squeak Bomb, then snatch the iron sphere across a fence grating with a Magnet Bomb onto a socket. |

#### Tier 6: Ice Bomb Trials (River Valley, Coast & Fire Mountain Slopes — unlocks `R6`)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T23** | `(6,2)` Upper River | *"Frozen Mid-Drift"* | Bomb + Ice | `1 × 2` | Float a Bomb down a fast river current (`2`), then throw an Ice Bomb from the bank to freeze the current the instant the bomb passes a cracked wall in mid-channel. |
| **T24** | `(8,5)` Lily Marsh | *"Curling Cube"* | Squeak + Ice + Wind | `2 × 1` | Lure a Brass Beetle with a Squeak Bomb, freeze it into an ice cube with Ice, and catapult/slide the cube across a frozen pond with a Wind Bomb onto a switch. |
| **T25** | `(7,7)` Frozen Delta | *"Melt and Sink"* | Bomb + Fire + Ice | `1 × 2` | Freeze a water pool with Ice, blast-shove a stone block to its center tile, then throw a Fire Bomb to melt that tile so the block sinks onto an underwater pressure plate. |
| **T26** | `(8,7)` South Cape | *"Glaze Bank Shot"* | Ice + Magnet | `2 × 1` | Crust a lava lane into slick glaze with Ice, slide an iron sphere down the glaze, and use a Magnet Bomb behind a corner fence to curve the sliding sphere onto a target button. |
| **T27** | `(6,1)` Lava Fields | *"Quench the Ripple"* | Fire + Ice + Wind | `2 × 1` | Snuff two out of four ripple-timed flame jets with Ice so a Wind whirlwind can catapult a Fire Bomb safely through the remaining beat gap into a furnace brazier. |

#### Tier 7: Rock Bomb Master Trials (Wind Cliffs & Iron Plateau — all 7 Bombs)

| ID | Screen `(x,y)` | Trial Name | Bombs | Size | Rube Goldberg Chain |
|:-:|:-:|---|---|:-:|---|
| **T28** | `(8,1)` Ember Slope | *"The Curling Backstop"* | Bomb + Ice + Rock | `2 × 1` | Crust a wide lava hall into slick glaze with Ice, drop a Rock block at `(6,5)` as a backstop, and blast-shove a stone block so it slides across the room and stops against the Rock block on button `O`. |
| **T29** | `(1,0)` Spray Ledges | *"Calm in the Gale"* | Fire + Wind + Rock | `2 × 1` | Place a Rock windbreak to block one of two cross-gust vents so only the north wind vane spins, opening a shutter while a `,` fuse line burns in the Rock block's calm lee to light a brazier. |
| **T30** | `(3,2)` Gear Yard | *"The Sevenfold Chain"* | All 7 Bombs | `2 × 2` | Full Rube Goldberg showcase: blow sand off a mag-rail (Wind) → place a Rock backstop on glazed lava (Ice + Rock) → light a `,` fuse line (Fire) that drops an iron sphere → Magnet Bomb pulls the sphere onto the glaze against the Rock backstop → Squeak Bomb lures a Brass Beetle onto the final switch → Bomb blasts the unsealed vault. |

*(The remaining `6` Buttons of the `36` total come from the **Pack-Otter Fuse Heist** at Crescent Cove `(9,6)`, the **Mouse House Smithy** `(5,4)`, and one master secret room inside each of the **4 Major Dungeons**.)*

---

## Part II: The 4 Major Multi-Room Dungeons & The Iron Tower

Unlike the single-room Shrines, the **4 Major Dungeons** are multi-room
architectural machines (`10 → 15 → 20 → 24` rooms) that combine their region's
bombs around a macro spatial gimmick. Completing each awards one of the **4
Elemental Keys** (**Cinder, Zephyr, Rime, Stone**) for the Iron Tower.

### 1. Ice Cave (combines `Bomb + Fire + Squeak` — awards the **Cinder Key**): 10 rooms

**Macro gimmick:** a frozen glacier sanctuary of dark halls, sliding ice lanes
with crystal-peg backstops, Brass Beetles lured across grates, and ordered/timed
braziers.

```text
 x:   0      1      2
y0  [10]    .      .
y1  [ 9]   [ 6]   [ 5]
y2  [ 8]   [ 3]   [ 4]
y3  [ 7]   [ 1]   [ 2]
           (in)
```

| # | Room | `(x,y)` | Rube Goldberg Puzzle & Contents |
|:-:|---|---|---|
| 1 | Entry Hall | `(1,3)` | Blast the east crate (`W`) or melt the west ice blocks (`B`) with Fire to open the two wings; midpoint warp pad sits before the north locked door (**L1**). |
| 2 | Switch Antechamber | `(2,3)` | Lure a Brass Beetle across a fenced spike grating with a **Squeak Bomb** so it steps onto the floor button (`O`) and holds it while dazed, revealing **Small Key 1**. |
| 3 | Crystal Crossroads | `(1,2)` | Unlocked by **L1**. Roll a Bomb down an angled stone chute while running across the lowered blue barrier so crystal `C` flips *after* you cross, lowering the east red barrier. |
| 4 | Vault of Sparks | `(2,2)` | Use raised crystal pegs (`R`/`U`) as a temporary backstop to blast-shove a stone block (`P`) onto a recessed plate for **Small Key 2**, then bank a Bomb through a `%` seam into crystal `C` to open **L2** north. |
| 5 | Alchemist Reliquary | `(2,1)` | Light two `,` powder fuse lines of unequal length with **Fire** while flipping a crystal damper so both north braziers ignite simultaneously, opening the west shutters to the Miniboss gate (and revealing the dungeon's **Grandma's Button** in a side niche). |
| 6 | Lantern Hall | `(1,1)` | **Miniboss Living Gate: Ice Golem** (below). Solved with **Squeak + Fire + Bomb**; unlocks the **midpoint warp pad** and west shutters. |
| 7 | Frozen Hall | `(0,3)` | Burn a wooden rope support with **Fire** to drop a block as a windbreak, then light two timed braziers before the first fades to open the north shutter. |
| 8 | Hall of Three Flames | `(0,2)` | Throw **Fire Bombs** and route a Brass Beetle with a **Squeak Bomb** across a bridge toggle to light three braziers in strict order (`I → II → III`) for the **Boss Key**. |
| 9 | Sanctum Ante-Room | `(0,1)` | A dark room where lighting a `,` fuse trail illuminates the hidden floor path to the **Boss Door (`K`)**. |
| 10 | Frozen Sanctum | `(0,0)` | **Boss: Ice Wraith** (3-Phase Puzzle Duel, below). Reward: **Cinder Key**. |

#### Miniboss Living Gate: Ice Golem (Room 6)
A hulking construct encased in mirror-thick glacier armour. Plain Bombs clank
harmlessly off its shell, and it refuses to step onto the room's central furnace
grate on its own.
- **Solve (2 cycles):** Throw a **Squeak Bomb** onto the central furnace grate
  to lure the Golem's clockwork core over the vents (dazing it in place for
  `2.5 s`), ignite the furnace grate with a **Fire Bomb** to melt its glacier
  armour off, and drop a **Bomb** to crack its bare core.

#### Boss: Ice Wraith (Room 10)
A lantern phantom that glides through pitch darkness, completely translucent and
immune while the room is dark.
- **3-Phase Puzzle Duel:** Light a corner brazier with **Fire** (or lure the
  Wraith into a burning hearth pool with a **Squeak Bomb**) to materialize it,
  then blast it with a **Bomb**. After each phase (`3` cycles total), it
  unleashes an **Ice Storm** that snuffs all braziers and raises crystal walls
  you must flip to reach the next corner brazier. Getting hit by its frost orbs
  knocks Pip back and snuffs the active brazier (resetting that phase's light
  setup, with zero player hearts).

---

### 2. Rock Quarry (combines `Bomb + Fire + Wind + Magnet` — awards the **Zephyr Key**): 15 rooms

**Macro gimmick:** you enter on the quarry **rim (`2F`)** above a great central
**drop shaft (`5 → 8`)** looking down into the **pit (`1F`)**. In Act 1 you drop
down terraces and shafts into the pit; **Wind** (blast-jumps + `2.5 s`
whirlwinds) and **Magnet** (magnetic crane rails + iron spheres) power the cargo
lift back up in Act 2.

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

| # | Room | `(x,y)` | Rube Goldberg Puzzle & Contents |
|:-:|---|---|---|
| 1 | Quarry Gate | `2F (1,2)` | Terraces step down from the entrance; a sand-buried switch beside the east shutter waits for **Wind** to open the shortcut from 3. |
| 2 | Sand Hall | `2F (0,2)` | Burn scaffold ropes with **Fire** and pull an iron counterweight with **Magnet** to unseal **Small Key 1**; blowing the west sand wall clear with **Wind** reveals the quarry's **Grandma's Button**. |
| 3 | Pulley Top | `2F (2,2)` | Where 15's cargo lift arrives on `2F`. Pop a **Wind Bomb** on the south lip to leave a `2.5 s` whirlwind, then throw a **Magnet Bomb** into it so it catapults across a `3`-tile pit onto a mag-rail and pulls the shutter latch open. |
| 4 | Upper Terrace | `2F (0,1)` | Unlocked by **L1**. Blast-jump up a terrace with **Wind**, pull an iron sphere off a ledge with **Magnet** onto a chute so it smashes a cracked floor plug (`%`), and drop through the new shaft to 9. |
| 5 | Rim Crossing (hub) | `2F (1,1)` | A walkway ringing the central drop shaft down to 8; east is a `2`-tile gap crossable by **Wind** blast-jump once the east crane rail is aligned from below. |
| 6 | Lookout Steps | `2F (2,1)` | Four terraces stepping up north to the **Boss Door (`K`)**; clear sand off each landing with **Wind** while pulling an iron shield-block along a vertical mag-rail with **Magnet** to block falling boulders. |
| 7 | Top Terrace | `2F (2,0)` | **Boss: Boulder Golem** (3-Phase Puzzle Duel, below). Reward: **Zephyr Key**. |
| 8 | Pit Floor (hub) | `1F (1,1)` | Where 5's drop shaft lands you. Its south locked door (**L3** to 14) sits behind a raised blue crystal barrier flipped in room 12, so **Key 2** can only open **L2** (east to 12). |
| 9 | Gravel Chutes | `1F (0,1)` | Roll a Bomb down a switchback stone chute and place a **Magnet Bomb** across a fence to tug the rolling bomb onto the inner branch into crystal `C`, opening 10. |
| 10 | Sand Cellar | `1F (0,0)` | A dark cellar: blow sand off two magnetic floor sockets with **Wind**, pull iron braziers onto them with **Magnet**, and light both with **Fire** for **Small Key 2**. |
| 11 | Quarry Face | `1F (1,0)` | An optional 3-tier cliff puzzle combining a **Wind** whirlwind catapult and a **Magnet** rail to open a shortcut back to 5. |
| 12 | Scaffold Stack | `1F (2,1)` | Unlocked by **L2**. Burn scaffold supports with **Fire** to drop an iron sphere onto a rail, pull it onto a button with **Magnet** for **Small Key 3**, and flip crystal `C` to lower the blue barrier in 8 (exposing **L3**). |
| 13 | Gravel Seam | `1F (2,0)` | Blast-jump the north chasm from 12 with **Wind**, catapult a Bomb via a `2.5 s` whirlwind into a `%` wall, and pulse an iron polarity switch with **Magnet** for the **Boss Key**. |
| 14 | Foreman's Den | `1F (1,2)` | Unlocked by **L3**. A prelude crane-rail puzzle where you align the gantry tracks leading east into the Miniboss hall. |
| 15 | Lift Room | `1F (2,2)` | **Miniboss Living Gate: Mole Foreman** (below). Solved with **Magnet + Wind + Bomb**; unlocks the **midpoint warp pad** and starts the cargo lift up to 3. |

#### Miniboss Living Gate: Mole Foreman (Room 15)
Rides an armored iron mine-cart gantry over the lift shaft, shovelling sand piles
onto the room's four corner floor switches so the lift cannot run.
- **Solve (2 cycles):** Throw a **Magnet Bomb** onto the side rail to yank his
  iron shield-cart off balance, blow all four sand-buried switches clean with
  **Wind Bombs** to drop the gantry, and hit him with a **Bomb** while dazed.

#### Boss: Boulder Golem (Room 7)
A towering golem of iron-veined quarry stone atop a four-tier terrace, bowling
boulders down the steps.
- **3-Phase Puzzle Duel:** Blast-jump up the terraces with **Wind** between
  boulder waves; on its top tier, drop a **Magnet Bomb** behind it to pull its
  iron-veined torso backward to the cliff lip, then pop a **Wind Bomb** to
  topple it off the terrace so its shattered core lies exposed below for a
  **Bomb**.

---

### 3. Fire Mountain (combines `Ice + Fire + Wind + Magnet` — awards the **Rime Key**): 20 rooms

**Macro gimmick:** `1F` rings the **Great Forge** lava pool around a central
island stair (`1F ↔ B1F`). Freezing lava with **Ice** creates slick **glazed
crust** where bombs, blocks, and magnetically pulled iron spheres slide like
curling stones across the lower forge (`B1F`).

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

| # | Room | `(x,y)` | Rube Goldberg Puzzle & Contents |
|:-:|---|---|---|
| 1 | Mountain Gate | `1F (1,2)` | Blast-jump or crust the entry lava stream and time the slow flame jet north to 4. |
| 2 | Ash Hall | `1F (0,2)` | Snuff a ripple of beat-timed flame jets with **Ice** while pulling an iron shield along a rail with **Magnet** to claim **Small Key 1**. |
| 3 | Chain Hoist | `1F (3,2)` | Throw **Fire** over a fence to burn a hoist rope, dropping an iron cage into a lava channel as a permanent bridge north to 7. |
| 4 | Great Forge (hub) | `1F (1,1)` | A wide lava pool surrounds the central anvil island. **L2** (north to 9) sits behind a blue crystal barrier flipped in 7, so **Key 1** opens **L1** (east to 6). Once **Room 10** is cleared, crust a path across the pool with **Ice** to take the island stair down to 13. |
| 5 | Bellows Room | `1F (0,1)` | Pop a **Wind** whirlwind on the near bank of a `3`-tile lava river and catapult a **Bomb** across onto a switch, opening 8 and unsealing **Small Key 2**. |
| 6 | Furnace Row | `1F (2,1)` | Unlocked by **L1**. Light a `,` powder fuse loop with **Fire** while freezing a steam leak with **Ice** so four timed furnaces ignite together. |
| 7 | Slag Chute | `1F (3,1)` | Roll a Bomb down a chute between flame jets (snuffed with **Ice**) into crystal `C`, lowering the blue barrier in 4 (exposing **L2**) and revealing **Small Key 3** across a lava strip. |
| 8 | Ember Vault | `1F (0,0)` | Crust a path across dark lava with **Ice** and guide an iron sphere with **Magnet** to claim the mountain's **Grandma's Button**. |
| 9 | Salamander Pit | `1F (1,0)` | Unlocked by **L2**. An anteroom of lava channels where you align the quench sluice leading east into 10. |
| 10 | Quench Room | `1F (2,0)` | **Miniboss Living Gate: Fire Salamander** (below). Solved with **Ice + Glaze Slide + Bomb**; unlocks the **midpoint warp pad** and east gate to 11. |
| 11 | Jet Gallery | `1F (3,0)` | Snuff a fast-beat gallery of flame jets with **Ice** to return south to 7 and claim **Small Key 3**. |
| 12 | Lava Falls | `1F (2,2)` | Crust the waterfall pool with **Ice** and spend **Key 3** on **L3** to unlock the direct stair down to 17. |
| 13 | Lower Forge | `B1F (1,0)` | Where 4's island stair lands. *Teach glazed lava crust:* freeze a lava lane with **Ice** and throw a **Bomb** onto the glaze so it slides the full length into crystal `C`. |
| 14 | Ingot Press | `B1F (0,0)` | Freeze a lava floor into glaze with **Ice**, raise a crystal peg `R` as a backstop, and blast-shove an ingot block so it slides onto button `O`. |
| 15 | Smelter | `B1F (2,0)` | Slide an iron sphere across glazed crust and curve it `90°` around an iron pillar with a **Magnet Bomb** into a recessed polarity switch. |
| 16 | Crucible | `B1F (3,0)` | Snuff four rapid flame jets with **Ice**, catapult a **Fire Bomb** via a **Wind** whirlwind to burn a hoist rope, and claim the **Boss Key**. |
| 17 | Slag Pool | `B1F (0,1)` | Freeze a moving slag current with **Ice** so a floating block stops over a submerged plate, then melt that single tile with **Fire** so the block sinks onto the switch. |
| 18 | Drake Stair | `B1F (1,1)` | The **Boss Door (`K`)** east to 19. |
| 19 | Drake's Moat | `B1F (2,1)` | **Boss: Lava Drake** (3-Phase Puzzle Duel, below). |
| 20 | Core Chamber | `B1F (3,1)` | Claim the **Rime Key** and warp back to the entrance. |

#### Miniboss Living Gate: Fire Salamander (Room 10)
Prowls a lava-ringed quench basin wreathed in white-hot flame that vaporizes
ordinary Bombs before they can touch it.
- **Solve (2 cycles):** Crust the lava lane in front of it into slick **glaze**
  with an **Ice Bomb**, catch the salamander in an **Ice Bomb** nova to quench
  its white-hot aura for `4 s`, and throw/slide a **Bomb** across the glazed
  crust straight into its cooled scales.

#### Boss: Lava Drake (Room 19)
Circles a wide lava moat around a central forge island, surfacing to breathe
sweeping torrents of flame.
- **3-Phase Puzzle Duel:** Crust a bridge of **glazed lava** across the moat
  with **Ice Bombs**; when the Drake rears up and inhales, throw an **Ice Bomb**
  into its open jaws to freeze its breath and prop its mouth open, then slide a
  **Bomb** across the glazed crust into its throat (`3` cycles).

---

### 4. Wind Cliffs (combines `Rock + Magnet + Wind + Ice` — awards the **Stone Key**): 24 rooms

**Macro gimmick:** sea caves at the cliff foot (`1F`) connected to ruined
watchtowers on the clifftop (`2F`) by an upward **Blowhole (`6 → 17`)** that
shoots bombs from `1F` to `2F`. Cross-gust wind vents sweep bombs and spheres
off ledges unless you anchor **Rock Bomb** windbreaks and backstops. *(Rule:
**no moving platforms** in Wind Cliffs.)*

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

| # | Room | `(x,y)` | Rube Goldberg Puzzle & Contents |
|:-:|---|---|---|
| 1 | Sea Cave Mouth | `1F (2,2)` | A steady gust vent blows east across the cave; place a **Rock** windbreak or throw a bomb upwind so the gust curves it into crystal `C`. |
| 2 | Spray Steps | `1F (1,2)` | Freeze sea spray into walkable ice ledges with **Ice** and drop a **Rock** stepping stone into a tide channel for **Small Key 1**. |
| 3 | Gull Roost | `1F (3,2)` | Place a **Rock** windbreak to calm a gust lane, light a `,` fuse line with **Fire**, and let the vent carry a Bomb into a `%` wall north to 8. |
| 4 | Tide Hall (hub) | `1F (2,1)` | Four cross-gust vents sweep the centre; **L2** (north to 11) sits behind a blue crystal barrier flipped in 15 (via **L1** `8 → 9`). A **Rock** windbreak calms the centre intersection. |
| 5 | Driftwood Store | `1F (0,2)` | Blast-jump outcrops with **Wind** and pull an iron crate with **Magnet** to open the west passage north to 7. |
| 6 | Blowhole | `1F (1,1)` | *Cross-floor action:* throw a Bomb into the upward **Blowhole** vent on `1F`; the vertical gale shoots it up to `2F` Room 17, where its blast flips the switch that lowers 17's Rope Bridge. |
| 7 | Kelp Cellar | `1F (0,1)` | A dark sea cave: shield three braziers from sea gusts with a **Rock** block and light them with **Fire** to reveal the path to 13. |
| 8 | Wreck Hold | `1F (3,1)` | Pull an iron ballast block along a rusted rail with **Magnet** and lock it behind a **Rock** backstop against a headwind for **Small Key 2**. |
| 9 | Lighthouse Base | `1F (4,1)` | Unlocked by **L1**. The spiral stair up to 15 on `2F` (and north to 14). |
| 10 | Echo Cave | `1F (1,0)` | Drop **Rock** stepping stones into `1`-tile channels and lure a Brass Beetle across with a **Squeak Bomb** for the cliffs' **Grandma's Button**. |
| 11 | Harpy's Roost | `1F (2,0)` | Unlocked by **L2**. A wind-swept cliff ledge leading east into the Miniboss gallery. |
| 12 | Gust Gallery | `1F (3,0)` | **Miniboss Living Gate: Harpy** (below). Solved with **Rock + Bomb**; unlocks the **midpoint warp pad** and south shortcut to 8. |
| 13 | Stone Bridge Cave | `1F (0,0)` | Combine **Rock** stepping stones, an **Ice**-frozen current, and a **Wind** blast-jump across sea gaps for **Small Key 3**. |
| 14 | Undertow | `1F (4,0)` | Dam a fast tide current with a **Rock** block so a magnetically pulled iron sphere stops on a submerged switch, opening a shortcut to 9. |
| 15 | Watchtower Stair | `2F (3,1)` | Where 9's stair lands on `2F`. Flip crystal `C` across the gap (lowering 4's blue barrier to **L2**), then drop a **Rock** stepping stone into the west channel to cross into 16. |
| 16 | Cliff Path | `2F (2,1)` | Cliffside gales sweep bombs toward the abyss; place **Rock** windbreaks to hold Bombs against a line of `%` boulders guarding the **Boss Door (`K`)** north to 22. |
| 17 | Rope Bridge | `2F (1,1)` | The bridge lowered from below by 6's **Blowhole** bomb; patch its missing plank gap with a **Rock** stepping stone to reach **L3** (west to 18). |
| 18 | Ruined Watchtower | `2F (0,1)` | Unlocked by **L3**. A 4-button Rube Goldberg vault: one stone block shoved by **Bomb**, one iron sphere pulled by **Magnet**, one Brass Beetle lured by **Squeak**, and one **Rock** block → unseals the **Boss Key**. |
| 19 | Nesting Ledges | `2F (2,2)` | Blast-jump terraces with **Wind** and curve a bomb along a gust lane into 20. |
| 20 | Vane Hall | `2F (1,2)` | Two wind vanes sit in twin gust lanes; block the wrong vent with a **Rock** block so only the target vane spins, opening 21. |
| 21 | Lookout | `2F (0,2)` | Overlooks the Storm Bird's crag (one-way drop from 18 → 21 so **L3** can never be bypassed). |
| 22 | Storm Stair | `2F (2,0)` | Unlocked by the **Boss Door (`K`)**; climb the final windswept terraces west to 23. |
| 23 | Clifftop | `2F (1,0)` | **Boss: Storm Bird** (3-Phase Puzzle Duel, below). |
| 24 | Core Chamber | `2F (0,0)` | Claim the **Stone Key** and warp back to the cave mouth. |

#### Miniboss Living Gate: Harpy (Room 12)
Swoops down the gallery's howling wind lanes at high speed, blowing ordinary
bombs away with its wings.
- **Solve (2 cycles):** Raise a **Rock Bomb** pillar in its dive lane as it
  winds up; the Harpy slams headfirst into the stone block and drops dazed to
  the floor for a **Bomb**.

#### Boss: Storm Bird (Room 23)
Perches on the north crag, beating gales that blow every bomb and sphere back
toward the southern drop.
- **3-Phase Puzzle Duel:**
  - **Phase 1:** Raise a **Rock** windbreak in front of its perch so a **Bomb**
    dropped in the block's calm lee stays put and detonates under its beak.
  - **Phase 2:** It takes wing and bowls cyclone orbs down the lanes; place a
    **Rock** block (or pull an iron bumper with **Magnet**) to deflect a cyclone
    orb laterally into its low-hovering wing, grounding it in a heap of feathers
    to be bombed.
  - **Phase 3:** Combines Perch Gales and Squall sweeps at higher speed.

---

### 5. Iron Tower (All 7 Bombs — opened by the **4 Elemental Keys**): 16 rooms

**Macro gimmick:** four `2 × 2` floors (`1F–4F`) around a **Central Lift Spine**.
On each floor, from the **Landing (`1,1`)**, two parallel Rube Goldberg trial
wings branch **West (`0,1`)** and **North (`1,0`)**—solvable in either order—each
releasing one of the two iron bolts on that floor's **Apex Room (`0,0`)**.

```text
Each floor (1F..4F) is a 2x2 square around the central shaft:

   x:    0          1
y0   [Apex ^] == [North Wing]
        ||            ||
y1   [West Wing] == [Landing]
```

| # | Room | Floor & `(x,y)` | Bombs Combined & Rube Goldberg Puzzle |
|:-:|---|:-:|---|
| 1 | Tower Gate (Landing) | `1F (1,1)` | Unsealed by the **4 Elemental Keys** (**Cinder, Zephyr, Rime, Stone**). Houses the **Central Lift Warp Pad** (`1F ↔ 2F ↔ 3F ↔ 4F` as each floor is reached). |
| 2 | Frozen Gust (West Wing) | `1F (0,1)` | Place a **Rock** windbreak in a gust lane so **Fire** can melt an ice block while a **Squeak Bomb** lures a Brass Beetle onto the west bolt switch. *(Fire + Squeak + Rock)* |
| 3 | Brazier Moat (North Wing) | `1F (1,0)` | Crust a lava moat with **Ice** and pull a lit iron brazier cart along a rail with **Magnet** to ignite ordered braziers `I → II → III`, releasing the north bolt. *(Fire + Ice + Magnet)* |
| 4 | Dark Landing (Apex) | `1F (0,0)` | Unlocks once 2 and 3 are solved. Light a 4-way `,` powder fuse star in the dark while a **Wind** whirlwind jumps the flame across a center pit to open `2F`. *(Fire + Wind)* |
| 5 | Sand Lift (Landing) | `2F (1,1)` | Links the `2F` warp stop. Melt glazed crust over sand piles with **Fire**, then blow the sand clear with **Wind** to expose magnetic rail switches opening both wings. *(Fire + Wind + Magnet)* |
| 6 | Terrace Bank (West Wing) | `2F (0,1)` | Blast-jump terraces with **Wind**, slide a Bomb along a glazed ledge (`Ice`), and curve it with a **Magnet Bomb** into a corner crystal for the west bolt. *(Wind + Ice + Magnet)* |
| 7 | Rubble Chasm (North Wing) | `2F (1,0)` | Catapult a **Squeak Bomb** via a **Wind** whirlwind across a `4`-tile chasm to lure an Iron Tortoise onto a magnetic bridge switch, releasing the north bolt. *(Wind + Squeak + Magnet)* |
| 8 | Knight's Hall (Apex) | `2F (0,0)` | **Miniboss Living Gate: Iron Knight** (below). Defeating it opens `3F` and activates the `2F`–`3F` lift stop. |
| 9 | Forge Landing | `3F (1,1)` | Links the `3F` warp stop. Crust a lava pool with **Ice** and flip a crystal switch to shift the beat of four flame jets, opening the two wings. *(Ice + Bomb)* |
| 10 | Glaze Works (West Wing) | `3F (0,1)` | A `2 × 1` glazed-crust curling puzzle: place a **Rock** backstop, pull an iron sphere with **Magnet** across the glaze against the Rock block, and freeze a current with **Ice** to release the west bolt. *(Ice + Rock + Magnet)* |
| 11 | Crucible Bridge (North Wing) | `3F (1,0)` | Freeze a lava river with **Ice**, blast-shove a block to the center, and melt one crust tile with **Fire** so it sinks onto a submerged switch for the north bolt. *(Ice + Fire + Bomb)* |
| 12 | Slag Apex | `3F (0,0)` | Snuff rapid flame jets with **Ice**, lure a Mimic Statue with **Squeak**, and catapult a **Bomb** via a **Wind** whirlwind to open `4F`. *(Ice + Squeak + Wind + Bomb)* |
| 13 | Gale Landing | `4F (1,1)` | Links the `4F` warp stop. Anchor a **Rock** windbreak and pull an iron storm-shutter open with **Magnet** to enter the final wings. *(Rock + Magnet)* |
| 14 | Broken Bridge (West Wing) | `4F (0,1)` | Drop **Rock** stepping stones, blast-jump alternating gusts with **Wind**, and freeze a spray waterfall with **Ice** to release the west Boss Seal. *(Rock + Wind + Ice)* |
| 15 | Gale Braziers (North Wing) | `4F (1,0)` | Light a `,` fuse line behind a **Rock** windbreak, dropping an iron sphere that a **Magnet Bomb** pulls onto a chute into the north Boss Seal. *(Fire + Rock + Magnet)* |
| 16 | Sorcerer's Roof (Apex) | `4F (0,0)` | Unlocks once both 14 and 15 are solved. **Boss: The Sorcerer (Your Brother)** (below). |

#### Miniboss Living Gate: Iron Knight (Room 8)
A clockwork suit of heavy iron plate patrolling a lava-rimmed hall.
- **Solve (2 cycles):** Throw a **Magnet Bomb** to wrench its magnetic shield
  plate aside, raise a **Rock Bomb** pillar in its charge path so it slams and
  staggers, and drop a **Bomb** into its open visor.

#### Boss: The Sorcerer — Your Brother (Room 16)
Pip's older brother, who raided Grandpa's notes and cycles through all **6
special bomb styles**, wearing each as a clockwork barrier and throwing that
bomb's hazards across the roof. Break each shield with its **counter bomb**,
then hit him with a plain **Bomb** while stunned:

| Brother shifts into | His hazard | Your counter bomb | Rube Goldberg interaction |
|---|---|---|---|
| **Fire** | Burning hearth rings & fuse trails | **Ice Bomb** | Quenches his flames and freezes his hearth ring |
| **Squeak** | Sends wind-up Brass Beetles marching at you | **Squeak Bomb** | A louder chirp lures his own beetles back into his shield, dazing him |
| **Wind** | Gale barrier that blows bombs away | **Rock Bomb** | Spawns an anchored stone windbreak; a Bomb dropped in its lee detonates beside him |
| **Magnet** | Orbiting iron spheres that deflect blasts | **Magnet Bomb** | Pulls his own iron spheres out of orbit and slams them back into his barrier |
| **Ice** | Glazes the roof so bombs slide past him | **Fire Bomb** | Melts the glaze and shatters his frost ward |
| **Rock** | Surrounds himself with stone ramparts | **Wind Bomb** | Leave a `2.5 s` whirlwind vortex to catapult a Bomb right over his ramparts into his sanctum |

---

## 999. The Developer Dungeon (`zone: 'dungeon-999'`)

A gallery of candidate Shrine rooms. Each of the `11` trials is a puzzle room, or
a part of one, that could ship in the campaign, solved with a campaign-sized kit.
None of them can be solved by walking onto something: every goal plate (`O`) and
puzzle brazier sits behind a gate, barrier, fence, pit or current, and pressing it
takes the room's chain.

### 1. Rules of the Rig

- **A Lobby of pads.** The Lobby `(0, 0)` holds one warp pad (`>`) per trial,
  four to a row in roster order, and an exit pad at `(8, 9)` that leaves the rig.
  Every trial has a pad back to the Lobby. Trial `n` sits at
  `rx = (n - 1) % 4 + 1`, `ry = floor((n - 1) / 4) - 1`, so the minimap mirrors
  the pads.
- **A campaign-sized kit per room.** Each trial hands Pip only the bombs it is
  about (`room.kit`), with the campaign's starting satchel: `2` live bombs, Bomb
  reach `1`. The Lobby hands over everything (all `7` bombs, `4` live, reach `2`)
  for free play.
- **Rooms reset.** Leaving or re-entering a room resets its broken, burned and
  frozen tiles, blocks, creatures, switches and crystal colour, so a botched
  attempt is one pad away from a fresh one.
- **Zero damage.** Own blasts only shove Pip; a pit, current or spike pops him
  back to where he came in.
- **Ways in, and out:**
  1. **URL flag:** `?dev=999` starts in the Lobby; `?room=999:<x>,<y>` starts at
     one trial's arrival point (for example `?room=999:1,-1` for trial 1).
  2. **Settings:** tap the build stamp `5` times to show (or hide) the
     **`⚙ ENTER DUNGEON 999`** button. It stays hidden for players unless the URL
     has `?dev`.
  3. **In-game 100% reward (planned):** all **`36` Grandma's Sewing Buttons**
     unseal the soot-black mousehole behind **Coal Chute `B1F (0,0)`**.
  4. **Out:** the Lobby's exit pad restores the campaign exactly as it was on the
     way in.
- **The campaign is never touched.** Entering sets the campaign state aside; the
  rig's state is never autosaved, and `?dev=999` keeps your real save as it is.
- **Live Dev Telemetry Overlay:** Pip's tile and speed, the equipped bomb,
  crystal polarity, the leading bomb's `(x, y, vx, vy, z, fuse)`, and the last
  measured roll / throw / catapult distance.

### 2. Rules the rig settled

Building real rooms forced four engine decisions, now in the game:

- **Momentary switch `Q` and iron gate `G`.** A gate lies flat exactly while
  every `Q` in the room is weighted, and rises the moment one is not. A gate that
  rises on Pip lets him step out either side, but not further in.
- **A bomb is too light to latch a plate.** A ticking bomb holds a `Q` for one
  fuse, but only Pip, a block or a creature presses an `O`. (Before this, any
  bomb thrown onto a fenced-off plate solved the room.)
- **The Mimic copies whole steps.** Each tile Pip steps into, the Mimic steps the
  same way from its own tile if it is free, then glides there. It stays on the
  grid, so walking into your own wall, or pinning it against its wall, shifts the
  two out of line by exactly one tile.
- **Spawns can face a way.** `EnemySpawn.facing` sets where a creature starts
  looking; an Iron Tortoise patrols along it.

### 3. Roster

| # | Room `(x, y)` | Kit | Candidate for | The trick | What fails |
|:-:|---|---|---|---|---|
| **1** | **A Delayed Flip** `(1, -1)` | Bomb | `T01` | Throw a Bomb into the fenced chute; it rolls to the crystal while Pip runs into the pen. The flip lowers `R` ahead and raises `U` behind, so Pip must already be in the pen. | Throwing from below the wall: the way round to the pen is longer than the `3 s` fuse. |
| **2** | **Two Switches, One Breath** `(2, -1)` | Bomb | Tier 1 trial | The gate needs both switches held. Pip is a weight, but he has to be past the gate: a bomb on each, far switch first, then walk through. | Near switch first: its bomb bursts before Pip reaches the gate. |
| **3** | **Shove It Home** `(3, -1)` | Bomb | `T03`, `T02` | The block is fenced in. A dropped bomb shoves it through the fence; a thrown one lands in the yard behind it. East, east, south. | Any single bomb (a shove moves one tile). |
| **4** | **Long Fuse First** `(4, -1)` | Fire | `T07`, `T04` | Ordered braziers at the ends of a `7`-tile and a `2`-tile bramble fuse behind a fence. Light the long fuse, wait, then the short one. | Both fuses back to back: II catches first, the braziers sputter, and the burned fuses are gone. |
| **5** | **Pull of the Rail** `(1, 0)` | Magnet | `R4`, `T21` | A ticking Magnet Bomb reels the iron block along its row or column until it reaches the bomb or hits something. East along the top, then south onto the plate. | South first: the pit stops the block. |
| **6** | **Mirror Steps** `(2, 0)` | none | `T09`, `R2` | The Mimic copies Pip's steps in its own maze. Walking into your own walls, or pinning it against its walls, shifts it into line with the gaps. | Walking straight up: the Mimic is stuck at the foot of its maze. |
| **7** | **Bridge on the Race** `(3, 0)` | Ice | `R5`, `T23` | Each Ice Bomb freezes a `3 × 3` patch, but floats with the current first. Lay one patch on the eastbound race, then one on the westbound, upstream of where you need it. | One patch (the river is four rows wide). |
| **8** | **Catch It in the Gale** `(4, 0)` | Fire + Rock | `R6`, `T28` | In the east gale every bomb drifts until something stops it. A Rock block downwind of each brazier catches the Fire Bomb under it. | Fire under a brazier on its own blows past. |
| **9** | **Eye of the Gale** `(1, 1)` | Bomb + Wind | `R3`, `T13` | A Wind Bomb blast-jumps Pip over the fence onto the lip. A second one's whirlwind catapults a thrown Bomb over the chasm into the crystal, which lowers the double `R` to the plate. | A plain throw from the lip falls into the chasm. |
| **10** | **Follow the Chirp** `(2, 1)` | Squeak | `R2`, `T08` | A Squeak Bomb lures the Brass Beetle from only `4.5` tiles, so it takes a relay: one chirp to the middle, one on the plate. | A chirp on the plate alone is out of earshot. |
| **11** | **Tortoise Time** `(3, 1)` | Ice | Tier 6 trial | The patrolling Iron Tortoise holds the switch for about a second per crossing, too short to run six gates. Freeze it on the switch for `4 s`. | Waiting at the gates for a crossing. |

### 4. How the rig keeps rooms honest

- **No walking solve** (`tests/dungeon999.test.ts`): from where Pip arrives, no
  plate is reachable on foot, and standing on any reachable tile solves nothing.
- **No single-bomb solve** (`tests/dungeon999Shortcuts.test.ts`): from every
  tile Pip can walk to, drop and throw each kit bomb in all four directions and
  let it play out. Nothing may solve the room.
- **Intended solve, and the tempting wrong one** (`tests/dungeon999.test.ts`):
  each trial is played through as designed, and the naive attempt is shown to
  fail.
- **Mechanics proving ground** (`tests/sevenBombs.test.ts`): the first 999
  rooms, kept as a test fixture, still pin down how each of the `7` bombs, the
  movers and the Clockwork Creatures behave.

### 5. Room maps (generated from `src/game/dungeon999.ts`)

Each room is `11` tiles wide by `13` tall, the game's room size. These maps are
copied from the code; when a room changes, regenerate them rather than editing
by hand. `>` is a warp pad, `O` a goal plate, `Q` a momentary switch, `G` an iron
gate, `M` a metal block, `P` a push block, `R` / `U` the red and blue crystal
barriers, `B` brambles, and `1`–`4` currents (north, south, east, west).

#### Lobby `(0, 0)`

```text
###########
###########
##.......##
##>.>.>.>##
##.......##
##>.>.>.>##
##.......##
##>.>.>..##
##.......##
##......>##
##.......##
###########
###########
```

#### 1. A Delayed Flip `(1, -1)` · kit: Bomb

```text
###########
###########
##O.R.##C##
#####U##n##
##.....#n##
##.....#n##
##.....=n##
##.....=n##
##.#####n##
##.....=n##
##>....=n##
###########
###########
```

#### 2. Two Switches, One Breath `(2, -1)` · kit: Bomb

```text
###########
###########
#####O#####
#####G#####
##.......##
##...Q...##
##.......##
##.......##
##.......##
##.......##
##Q.....>##
###########
###########
```

#### 3. Shove It Home `(3, -1)` · kit: Bomb

```text
###########
###########
##.......##
##.=====.##
##.=P..=.##
##.=..O=.##
##.=...=.##
##.=====.##
##.......##
##.......##
##>......##
###########
###########
```

#### 4. Long Fuse First `(4, -1)` · kit: Fire

```text
###########
###########
##.T.....##
##.BBBB..##
##....B.T##
##....B.B##
##....B.B##
##=======##
##.......##
##.......##
##>......##
###########
###########
```

#### 5. Pull of the Rail `(1, 0)` · kit: Magnet

```text
###########
###########
##.......##
##.=====.##
##.=M..=.##
##.=^..=.##
##.=..O=.##
##.=====.##
##.......##
##.......##
##>......##
###########
###########
```

#### 6. Mirror Steps `(2, 0)` · kit: no bombs

```text
###########
###########
##...=##O##
##.#.=##.##
##...=...##
##...=.####
###..=.####
##...=.####
##.#.=.####
##...=.####
##>..=...##
###########
###########
```

#### 7. Bridge on the Race `(3, 0)` · kit: Ice

```text
###########
###########
##O......##
##.......##
##4444444##
##4444444##
##3333333##
##3333333##
##.......##
##.......##
##>......##
###########
###########
```

#### 8. Catch It in the Gale `(4, 0)` · kit: Fire + Rock

```text
###########
###########
#####T#####
##.......##
##.......##
##.......##
##.......##
##.......##
##.......##
##.......##
##>##T#####
###########
###########
```

#### 9. Eye of the Gale `(1, 1)` · kit: Bomb + Wind

```text
###########
###########
######C####
##.......##
##^^^^^^^##
##^^^^^^^##
##^^^^^^^##
##.ORR...##
####=====##
####.....##
##>......##
###########
###########
```

#### 10. Follow the Chirp `(2, 1)` · kit: Squeak

```text
###########
###########
##.^^^^^^##
##.^^^^^^##
##.^^^^^^##
##......O##
##.......##
##=======##
##.......##
##.......##
##>......##
###########
###########
```

#### 11. Tortoise Time `(3, 1)` · kit: Ice

```text
###########
###########
##...Q...##
##=======##
##......G##
##.....#G##
##.....#G##
##.....#G##
##.....#G##
##.....#G##
##>....#O##
###########
###########
```
