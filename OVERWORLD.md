# Overworld: Cinderholm Isle

The companion to `DUNGEONS.md` and `PUZZLE_MECHANICS.md`: the `10 × 10` flip-screen
island map (`100` screens), its nine biomes, the **`36` Single-Room Shrines**
(`6` Button-gated **Relic Shrines** + `30` **Trial Shrines**), and the **`4`
Major Multi-Room Dungeons** that award the **4 Elemental Keys** for the Iron
Tower.

## Core Overworld Rules

1. **Flip-screen Overworld, scrolling Shrines:** Each of the `100` Overworld
   cells is a `22 × 26`-tile (`352 × 416 px`) **flip-screen**, shown whole
   (`GAME.md` §1.1; only Grandma's House keeps `11 × 13`). Stepping
   into a Shrine archway (`R1–R6` or `T01–T30`) or Major Dungeon (`★`) enters an
   interior puzzle space that can span `1 × 1` up to `2 × 2` screens with smooth
   camera follow.
2. **One currency: Grandma's Sewing Buttons (`36` total):**
   - There are **no hearts, no Heart Pieces, and no random monster drops**.
   - Every **Trial Shrine (`T01–T30`)** awards **`1` Grandma's Button** (`30`
     Buttons), plus **`6` Master Puzzle Buttons** (`1` at the Mouse House Smithy,
     `1` at the Crescent Cove Pack-Otter Fuse Heist, and `1` secret vault inside
     each of the `4` Major Dungeons) = **`36` Buttons**.
3. **The Button → Relic Shrine → Biome → Elemental Key Loop:**
   - **Button counts open the `6` Relic Shrines (`R1–R6`):** Each Relic Shrine sits
     at the threshold of a biome and has a **Button-Lock Door** (`2, 5, 10, 15,
     21, 28` Buttons).
   - **Each Relic Shrine unlocks a new Bomb:** **Fire (`R1`), Squeak (`R2`),
     Wind (`R3`), Magnet (`R4`), Ice (`R5`), Rock (`R6`)** (after **Bomb** in
     Grandma's Basement).
   - **The new Bomb opens the rest of the biome & its Major Dungeon:** Every
     biome's inner roads, deeper Trial Shrines, and Major Dungeon are physically
     gated by that Bomb's Rube Goldberg mechanic.
   - **The `4` Major Dungeons award the `4` Elemental Keys** (**Cinder, Zephyr,
     Rime, Stone**) that unlock the **Iron Tower (`4,1`)**.
   - **Grandma's Satchel Milestones:** At **`8`, `16`, `24`, and `36` Buttons**,
     Grandma automatically upgrades your Magic Bomb Sack (`2 → 3` live bombs,
     Blast Reach `1 → 2`, `3 → 4` live bombs, and the Golden Thread / Dungeon 999
     key).

## The Island at a Glance (`10 × 10` Screens)

- `⌂` **Mouse House (`5,4`)** (and **Grandma's Basement**, Dungeon 0 → **Bomb**)
- `R1–R6` **Relic Shrines** (Button-gated → unlock **Fire, Squeak, Wind, Magnet, Ice, Rock**)
- `★` **Major Multi-Room Dungeons** (`Ice Cave`, `Rock Quarry`, `Fire Mountain`, `Wind Cliffs`, and `Iron Tower`)

```text
       0      1      2      3      4      5      6      7      8      9
  0    W      W      W      T      T      T      F      F      F      F
  1    W★     W      W      T      T★     T      F      F★     F      F
  2    W      W[R6]  Q      T      T      T      R      F      F      F
  3    W      Q      Q      V      T      V      V      R      F      C
  4    Q      Q      Q[R3]  V      V      V⌂     V      R      R[R5]  C
  5    Q★     Q[R4]  Q      V      V      B      B      R      R      C
  6    Q      Q      Q      B      B[R1]  B      B      R      C      C
  7    Q      Q      I      I      I[R2]  I★     B      R      C      C
  8    Q      I      I      I      I      I      I      R      C      C
  9    I      I      I      I      I      I      C      C      C      C
```

| Code | Biome | Screens | Relic Shrine (Bomb) | Major Dungeon (Elemental Key) | Trial Shrines |
|:-:|---|:-:|---|---|:-:|
| `V` | **Millbrook Vale** | 9 | **Grandma's Basement** `(5,4)` → **Bomb** | — | `T01–T04` (`4`) |
| `B` | **Bramble Woods** | 7 | **R1 Hearth Vault** `(4,6)` (`2` Btn) → **Fire** | — | `T05–T07` (`3`) |
| `I` | **Frost Hollow** | 16 | **R2 Chime Grotto** `(4,7)` (`5` Btn) → **Squeak** | **Ice Cave ★** `(5,7)` → **Cinder Key** | `T08–T12` (`5`) |
| `Q` | **Quarry Hills** | 15 | **R3 Bellows Sanctum** `(2,4)` (`10` Btn) → **Wind**<br>**R4 Lodestone Vault** `(1,5)` (`15` Btn) → **Magnet** | **Rock Quarry ★** `(0,5)` → **Zephyr Key** | `T13–T21` (`9`) |
| `R` | **River Valley** | 9 | **R5 Rime Well** `(8,4)` (`21` Btn) → **Ice** | — | `T22–T25` (`4`) |
| `C` | **Coast** | 13 | *(Pack-Otter Fuse Heist)* | — | `T26` (`1`) |
| `F` | **Fire Mountain slopes** | 12 | — | **Fire Mountain ★** `(7,1)` → **Rime Key** | `T27–T28` (`2`) |
| `W` | **Wind Cliffs coast** | 9 | **R6 Cairn Sanctum** `(1,2)` (`28` Btn) → **Rock** | **Wind Cliffs ★** `(0,1)` → **Stone Key** | `T29` (`1`) |
| `T` | **The Iron Plateau** | 10 | — | **Iron Tower ★** `(4,1)` → **Finale** | `T30` (`1`) |
| | **Total** | **100** | **`6` Relic Shrines** (+ Basement) | **`4` Major Dungeons** (+ Tower) | **`30` Trial Shrines** |

## Progression

| Stage | Button Gate | New Bomb Unlocked | What That Bomb Opens on the Overworld | Capstone Major Dungeon |
|---|:-:|---|---|---|
| **Prologue** | `0` | **Bomb** *(Grandma's Basement)* | Blasts the Smithy cache `(5,4)`, the Orchard Gate `(4,5)`, and opens **Trial Shrines `T01–T03`** (+ Smithy Button = `4` Buttons reachable) | — |
| **Stage 1** | **`2` Buttons** | **Fire Bomb** *(R1 Hearth Vault, `4,6`)* | Burns bramble thickets across `Bramble Woods` (`T04–T07`), melts the outer ice seal into `Frost Hollow`, and ignites the **Old Windmill** boiler `(3,3)` | — |
| **Stage 2** | **`5` Buttons** | **Squeak Bomb** *(R2 Chime Grotto, `4,7`)* | Lures Clockwork Brass Beetles and Mimic Statues across frozen grates in `Frost Hollow` (`T08–T12`) and unlocks the inner chambers of the **Ice Cave** | **Ice Cave ★ `(5,7)`** *(Bomb + Fire + Squeak)* → **Cinder Key** |
| **Stage 3** | **`10` Buttons** | **Wind Bomb** *(R3 Bellows Sanctum, `2,4`)* | Accessed via the Fire-lit **Old Windmill → Quarry Lift `(1,4)`**; blast-jumps quarry terraces, clears sand-buried switches (`T13–T17`), and crosses **High Bridge `(7,4)`** | — |
| **Stage 4** | **`15` Buttons** | **Magnet Bomb** *(R4 Lodestone Vault, `1,5`)* | Pulls iron bridge spans and rides magnetic crane rails across deep `Quarry Hills` (`T18–T22`), opening the **Rock Quarry** gate | **Rock Quarry ★ `(0,5)`** *(Bomb + Fire + Wind + Magnet)* → **Zephyr Key** |
| **Stage 5** | **`21` Buttons** | **Ice Bomb** *(R5 Rime Well, `8,4`)* | Freezes river currents (`T23–T25`), completes the **Crescent Cove Pack-Otter Heist** for the ferry to **Fire Mountain** (`T26–T28`), crusts lava fields, and freezes the **Windmill Bluff `(0,2)`** waterfall stair | **Fire Mountain ★ `(7,1)`** *(Ice + Fire + Wind + Magnet)* → **Rime Key** |
| **Stage 6** | **`28` Buttons** | **Rock Bomb** *(R6 Cairn Sanctum, `1,2`)* | Anchors windbreaks and stepping stones across `Wind Cliffs` (`T29`) and the storm-swept `Iron Plateau` (`T30`), opening **Wind Cliffs** and the **Tower Causeway** | **Wind Cliffs ★ `(0,1)`** *(Rock + Magnet + Wind + Ice)* → **Stone Key** |
| **Finale** | **`4` Elemental Keys** | *(All 7 Bombs)* | Unseals the **Fourfold Seal** at **Tower Courtyard `(4,2)`** | **Iron Tower ★ `(4,1)`** → **The Sorcerer** |

---

## Biomes, Screen by Screen

### Millbrook Vale (`V`, 9 screens): the start

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(5,4)` | **Mouse House** ⌂ | Doorway into **Mouse House Interior & Grandma's Basement** (**Dungeon 0 → Magic Bomb Sack**); outside sits the **Old Smithy**, whose `%` rubble puzzle awards **`1` Grandma's Button**. (built) `*` |
| `(5,3)` | Millbrook North | Village square; entrance to **Trial Shrine `T01` (*"A Delayed Flip"*)** → **`1` Button**. (built) `*` |
| `(4,4)` | Millbrook West | A bramble-and-fuse puzzle yard leading west toward the Orchard and Meadow Fields. (built) |
| `(6,3)` | Millbrook East | The village well; entrance to **Trial Shrine `T02` (*"Two Bombs, One Spark"*)** → **`1` Button**. `*` |
| `(3,3)` | **Old Windmill** | Choked by brambles; lighting its boiler brazier with **Fire** hauls the **Quarry Lift `(1,4)`** back into service. |
| `(3,4)` | Meadow Fields | Dry grass fuse-line fields overlooking the western cliff; entrance to **Trial Shrine `T04` (*"Twin Fuse Race"*)** → **`1` Button**. `*` |
| `(6,4)` | Mill Pond | A waterwheel pond and the road east to High Bridge `(7,4)`. |
| `(3,5)` | Orchard | Apple rows above the quarry escarpment; entrance to **Trial Shrine `T03` (*"The Raised Backstop"*)** → **`1` Button**. `*` |
| `(4,5)` | Orchard Gate | The cracked `%` gate east into Bramble Woods `(5,5)` and south to **Relic Shrine `R1` `(4,6)`**. (built) |

### Bramble Woods (`B`, 7 screens): Relic Shrine 1 (`Fire Bomb`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(4,6)` | **Hearth Vault (`R1`)** | **Relic Shrine 1 (requires `2` Buttons):** unlocks the **Fire Bomb** (*"The Travelling Spark"*). |
| `(5,5)` | Bramble Woods | Thorny groves and dry-grass fuse trails; burning the north brambles opens a shortcut back to Millbrook. (built) |
| `(5,6)` | Cinder Trail | The canyon trail south to Ice Cave Arch `(5,7)`. (built) |
| `(6,5)` | Thorn Thicket | Entrance to **Trial Shrine `T05` (*"The Firebreak"*)** → **`1` Button**. `*` |
| `(3,6)` | Old Orchard Wood | Entrance to **Trial Shrine `T06` (*"Drop the Weight"*)** → **`1` Button**. `*` |
| `(6,6)` | Fern Glade | A **mousehole shortcut** east to River Mouth `(7,6)`. |
| `(6,7)` | Frosted Thicket | Where woods meet frost; entrance to **Trial Shrine `T07` (*"Melt in Order"*)** → **`1` Button**. `*` |

### Frost Hollow (`I`, 16 screens): Relic Shrine 2 (`Squeak Bomb`) & Ice Cave (`★`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(4,7)` | **Chime Grotto (`R2`)** | **Relic Shrine 2 (requires `5` Buttons):** unlocks the **Squeak Bomb** (*"Follow the Chirp"*). |
| `(5,7)` | **Ice Cave Arch** ★ | Entrance to Major Dungeon 1: **Ice Cave** (`Bomb + Fire + Squeak` → **Cinder Key** + `1` Button). (built) `*` |
| `(5,8)` | Frost Hollow | Ice walls on three sides (melted by **Fire**) and a Brass Beetle gate (lured by **Squeak**). |
| `(3,7)` | Old Icehouse | Melt its ice seal with **Fire** to enter **Trial Shrine `T09` (*"Mirror Steps"*)** → **`1` Button**. `*` |
| `(2,7)` | Frost Cistern | Entrance to **Trial Shrine `T10` (*"Bait the Drop"*)** → **`1` Button**. `*` |
| `(1,8)` | Frozen Pond | A frozen pond locking the western ice wall into Quarry Hills `(1,7)`. |
| `(2,8)` | Icicle Ravine | Entrance to **Trial Shrine `T12` (*"Chirp and Chute"*)** → **`1` Button**. `*` |
| `(3,8)` | Hollow Path | Clockwork Mimic Statues guard the narrows; lure them aside with a **Squeak Bomb**. |
| `(4,8)` | Snow Fields | Entrance to **Trial Shrine `T08` (*"Beetle Relay"*)** → **`1` Button**. `*` |
| `(6,8)` | Glacier Edge | Entrance to **Trial Shrine `T11` (*"Mousehole Messenger"*)** → **`1` Button**. `*` |
| `(0,9)` | Frost Shore | Frozen sea shelves along the southwest coast. |
| `(1,9)` | Iceberg Bay | Floating ice floes linking the southern shore. |
| `(2,9)` | Snowdrift | Wind-swept snowdrifts hiding a chute shortcut. |
| `(3,9)` | Glacier Foot | A frozen waterfall feeding an ice-chute channel. |
| `(4,9)` | Cold Springs | Steaming spring in the snowfields. |
| `(5,9)` | Hollow's End | A **mousehole shortcut** east to South Beach `(6,9)`. |

### Quarry Hills (`Q`, 15 screens): Relic Shrines 3 (`Wind`) & 4 (`Magnet`) & Rock Quarry (`★`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(2,4)` | **Bellows Sanctum (`R3`)** | **Relic Shrine 3 (requires `10` Buttons):** unlocks the **Wind Bomb** (*"Eye of the Gale"*). |
| `(1,5)` | **Lodestone Vault (`R4`)** | **Relic Shrine 4 (requires `15` Buttons):** unlocks the **Magnet Bomb** (*"Pull of the Rail"*). |
| `(0,5)` | **Rock Quarry** ★ | Entrance to Major Dungeon 2: **Rock Quarry** (`Bomb + Fire + Wind + Magnet` → **Zephyr Key** + `1` Button). `*` |
| `(1,4)` | **Quarry Lift** | The two-way cargo lift from the Old Windmill down into the quarry basin. |
| `(1,3)` | Quarry Road | The high road from the lift north toward Windmill Bluff `(0,2)`. |
| `(2,3)` | Gravel Flats | Entrance to **Trial Shrine `T13` (*"Whirlwind Artillery"*)** → **`1` Button**. `*` |
| `(2,2)` | Stone Steps | Terraces climbing north (Wind); entrance to **Trial Shrine `T17` (*"Gale Vane Chain"*)** → **`1` Button**. `*` |
| `(0,4)` | Dust Bowl | Entrance to **Trial Shrine `T14` (*"Buried Circuit"*)** → **`1` Button**. `*` |
| `(2,5)` | Sand Dunes | Entrance to **Trial Shrine `T15` (*"Updraft Delivery"*)** → **`1` Button**. `*` |
| `(0,6)` | Deep Seam | Entrance to **Trial Shrine `T16` (*"Hop the Flip"*)** → **`1` Button**. `*` |
| `(1,6)` | Rubble Gully | Magnetic rail gorge; entrance to **Trial Shrine `T18` (*"Bent Trajectory"*)** → **`1` Button**. `*` |
| `(2,6)` | Boulder Field | Entrance to **Trial Shrine `T19` (*"Rail Tug"*)** → **`1` Button**. `*` |
| `(0,7)` | Sand Pits | Entrance to **Trial Shrine `T20` (*"Magnetic Ferry"*)** → **`1` Button**. `*` |
| `(1,7)` | Gravel Shore | Where Quarry Hills meets Frost Hollow's melted ice border. |
| `(0,8)` | Stone Quay | Magnetic crane dock; entrance to **Trial Shrine `T21` (*"Sphere Pinball"*)** → **`1` Button**. `*` |

### River Valley (`R`, 9 screens): Relic Shrine 5 (`Ice Bomb`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(8,4)` | **Rime Well (`R5`)** | **Relic Shrine 5 (requires `21` Buttons):** unlocks the **Ice Bomb** (*"Stop the Stream"*). |
| `(7,4)` | **High Bridge** | A broken bridge span across the river: cross with a **Wind** blast-jump or pull its iron draw-beam with **Magnet**. |
| `(6,2)` | Upper River | Entrance to **Trial Shrine `T23` (*"Frozen Mid-Drift"*)** → **`1` Button**. `*` |
| `(7,3)` | **River Ford** | Freeze the river ford with **Ice** to open a permanent central shortcut back to Millbrook Vale. |
| `(7,5)` | Otter Shallows | Entrance to **Trial Shrine `T22` (*"Attractor Lure"*)** → **`1` Button**. `*` |
| `(8,5)` | Lily Marsh | Entrance to **Trial Shrine `T24` (*"Curling Cube"*)** → **`1` Button**. `*` |
| `(7,6)` | River Mouth | Eastern exit of the Fern Glade `(6,6)` mousehole shortcut. |
| `(7,7)` | Frozen Delta | Entrance to **Trial Shrine `T25` (*"Melt and Sink"*)** → **`1` Button**. `*` |
| `(7,8)` | Ice Falls | Cascades pouring south into the River Estuary `(7,9)`. |

### Coast (`C`, 13 screens): The Pack-Otter Fuse Heist

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(9,4)` | **Crescent Cove** | **Pack-Otter Fuse Heist (Step 1):** mischievous Pack-Otters snatch your fuses! Drop one heavy **dud bomb** to block a tide runnel and throw a second dud to corner the first otter, recovering your **Squeak & Wind** fuses. |
| `(8,6)` | Tide Pools | **Fuse Heist (Step 2):** lure the second otter across the pools with **Squeak** and blast-jump after it with **Wind** to recover your **Fire & Magnet** fuses. |
| `(9,5)` | Driftwood Beach | **Fuse Heist (Step 3):** pull an iron crab-trap with **Magnet** and burn the driftwood barricade with **Fire** to recover your **Bomb & Ice** fuses. |
| `(9,6)` | **Thief Burrows** | **Fuse Heist (Step 4):** combine your recovered bombs to corner the otter chief, unlocking the **North Beach Ferry `(9,3)`** and winning **`1` Grandma's Button**. `*` |
| `(9,3)` | **North Beach** | The ferry dock north to Hot Springs `(9,2)`. |
| `(8,7)` | South Cape | Entrance to **Trial Shrine `T26` (*"Glaze Bank Shot"*)** → **`1` Button**. `*` |
| `(9,7)` | Shipwreck | An iron-hulled wreck with a magnetic rail shortcut. |
| `(8,8)` | Seal Rocks | Basalt sea stacks linked by Wind blast-jumps. |
| `(9,8)` | Lighthouse Point | A coastal beacon whose magnetic lens guides the North Beach ferry. |
| `(6,9)` | South Beach | Eastern exit of the Hollow's End `(5,9)` mousehole, isolated by the deep estuary `(7,9)` until Wind/Ice. |
| `(7,9)` | River Estuary | Deep `2`-tile river current meeting the sea (crossable only with **Wind** or **Ice**). |
| `(8,9)` | Coral Bay | Shallow tide reefs and current channels. |
| `(9,9)` | Far Reef | The southeastern point of Cinderholm Isle. |

### Fire Mountain Slopes (`F`, 12 screens): Fire Mountain (`★`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(7,1)` | **Fire Mountain** ★ | Entrance to Major Dungeon 3: **Fire Mountain** (`Ice + Fire + Wind + Magnet` → **Rime Key** + `1` Button). `*` |
| `(9,2)` | **Hot Springs** | Where the North Beach ferry lands on the volcano's flank. |
| `(8,2)` | Cinder Pass | Narrow lava channels crossed with **Wind** or **Ice** crust. |
| `(7,2)` | Steam Falls | Boiling falls cooled into an ice bridge with **Ice**. |
| `(8,3)` | Ash Foothills | Basalt terraces and magnetic ore seams. |
| `(6,0)` | Ash Ridge | Upper ridge walk with beat-timed flame jets. |
| `(6,1)` | Lava Fields | Entrance to **Trial Shrine `T27` (*"Quench the Ripple"*)** → **`1` Button**. `*` |
| `(7,0)` | Smoke Vents | Volcanic vents flanking the forge arch. |
| `(8,0)` | Caldera Rim | Overlooks the Great Forge crater below. |
| `(8,1)` | Ember Slope | Entrance to **Trial Shrine `T28` (*"The Curling Backstop"*)** → **`1` Button**. `*` |
| `(9,0)` | Obsidian Shore | Black-glass coast where lava meets the sea. |
| `(9,1)` | Ash Sluice | Freeze the forge sluice with **Ice** to open the western return road to River Ford `(7,3)`. |

### Wind Cliffs Coast (`W`, 9 screens): Relic Shrine 6 (`Rock Bomb`) & Wind Cliffs (`★`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(1,2)` | **Cairn Sanctum (`R6`)** | **Relic Shrine 6 (requires `28` Buttons):** unlocks the **Rock Bomb** (*"The Portable Wall"*). |
| `(0,1)` | **Wind Cliffs** ★ | Entrance to Major Dungeon 4: **Wind Cliffs** (`Rock + Magnet + Wind + Ice` → **Stone Key** + `1` Button). `*` |
| `(0,2)` | **Windmill Bluff** | Freeze the bluff waterfall with **Ice** to climb up from Quarry Road `(1,3)`. |
| `(0,3)` | Cliff Overlook | Lower sea-cliff ledge above Quarry Hills. |
| `(0,0)` | Gull Point | Northwestern headland swept by cross-gusts. |
| `(1,0)` | Spray Ledges | Entrance to **Trial Shrine `T29` (*"Calm in the Gale"*)** → **`1` Button**. `*` |
| `(1,1)` | Cliff Path | Place **Rock** windbreaks and stepping stones along the cliff road to `(0,1)`. |
| `(2,0)` | Gale Steps | The eastern ascent onto the Iron Plateau (`(3,0)`), gated by **Rock** windbreaks. |
| `(2,1)` | Watch Ruin | Ruined clifftop watchtower overlooking the Iron Tower. |

### The Iron Plateau (`T`, 10 screens): The Iron Tower (`★`)

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(4,1)` | **Iron Tower** ★ | Entrance to the **Iron Tower** finale (`16` rooms, all 7 Bombs). |
| `(4,2)` | Tower Courtyard | The **Fourfold Seal**: slot the **Cinder, Zephyr, Rime, and Stone Keys** here to open the Tower gate. (built) |
| `(4,3)` | Tower Causeway | Walled stone bridge north from Millbrook Vale. (built) |
| `(3,0)` | West Barrens | Storm gusts and magnetic rails leading east from Gale Steps `(2,0)`. |
| `(4,0)` | North Barrens | Behind the Iron Tower's spire. |
| `(5,0)` | East Barrens | Chasm gaps crossed with **Rock** stepping stones and **Wind** whirlwinds. |
| `(3,1)` | Iron Field | Toppled clockwork colossi flanking the plateau. |
| `(5,1)` | Scrap Heaps | Magnetic scrap yards and rail switches. |
| `(3,2)` | Gear Yard | Entrance to **Trial Shrine `T30` (*"The Sevenfold Chain"*)** → **`1` Button**. `*` |
| `(5,2)` | Seal Stones | Standing stones overlooking the Tower Courtyard. |

---

## Summary of All 36 Grandma's Sewing Buttons

| Source | Count | Details |
|---|:-:|---|
| **Single-Room Trial Shrines (`T01–T30`)** | **`30`** | `1` Button awarded at the exit altar of each Trial Shrine (`DUNGEONS.md` Part I.B). |
| **Major Dungeon Secret Vaults (`4`)** | **`4`** | `1` optional Rube Goldberg side-vault inside **Ice Cave (`2,1`)**, **Rock Quarry (`0,2`)**, **Fire Mountain (`0,0`)**, and **Wind Cliffs (`1,0`)**. |
| **Mouse House Smithy (`5,4`)** | **`1`** | Behind the cracked `%` forge wall in Millbrook Vale (`Prologue`). |
| **Pack-Otter Fuse Heist (`9,6`)** | **`1`** | Awarded at **Thief Burrows (`9,6`)** upon recovering all stolen fuses in Chapter 3. |
| **Total** | **`36`** | Unlocks `R1` (`2`), `R2` (`5`), `R3` (`10`), `R4` (`15`), `R5` (`21`), `R6` (`28`), plus Satchel upgrades at `8`, `16`, `24`, and Dungeon 999 at `36`. |
