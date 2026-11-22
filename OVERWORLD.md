# Overworld: Cinderholm Isle

The companion to `DUNGEONS.md`: the island map, its biomes, and how the bombs
open it up in order. `GAME.md` holds the rules (bombs, story, pillars). **Fixed
decisions** this builds on: the four Shrines, their themes and the bomb found in
each (Ice Cave gives Fire, Rock Quarry gives Wind, Fire Mountain gives Ice, Wind
Cliffs gives Rock), the Iron Tower finale, Grandma as the only voice, and one
world in one state (no time or season swapping).

## Size: half of the inspirations

Counted from the world maps in `inspiration/` (one cell of a world map is one
screen):

| Game (map file) | Screens | How counted |
|---|:-:|---|
| *The Legend of Zelda*, Hyrule (`1986-the-legend-of-zelda/maps/LegendOfZeldaHyruleMap.png`) | **128** | exact: a `16 × 8` grid of `256 × 168` screens |
| *Oracle of Seasons*, Holodrum (`2001-oracle-of-seasons/maps/LZ7_JewelsMap.png`, the in-game map) | **256** | exact: a `16 × 16` grid (grey squares are unvisited, not missing) |
| *Oracle of Ages*, Labrynna present (`2001-oracle-of-ages/maps/LZ7_map*A*.png`, seven regional maps) | **~157** | `45 + 15 + 31 + 11 + 14 + 29 + 12`, non-blank cells of `162 × 130` |
| *Oracle of Ages*, Labrynna past (`LZ7_map*Z*.png`) | **~158** | `48 + 15 + 28 + 11 + 15 + 29 + 12` |

Our island is one world, so it is measured against one world: half of Holodrum
is `128`, half of one Ages era is about `79`, and half of the two Oracle worlds'
average (`~207`) is about **`103`**. **Cinderholm is a `10 × 10` grid of `100`
screens**: about half the Oracle games, and a little under Zelda 1's whole
Hyrule.

Caveats: the Ages regional maps may not cover every corner of the world (Ambi's
Palace grounds, `12` screens, are left out of the count above), and Subrosia,
Seasons' underworld, is not counted. Neither changes the conclusion that `100`
is the right order of size; it replaces the earlier `6 × 6` plan (`36`
screens), which was nearer a sixth than a half.

**Whole game:** `100` overworld screens plus `90` interior/dungeon rooms
(`DUNGEONS.md`, including the Mouse House & Grandma's Basement) is about `190`
rooms. A first-time overworld screen takes `10–30 s`, so the island adds about
`40–60 min` of travel and secrets to the dungeons' `~1.5 h`: about `2–3 h`
blind.

## The island at a glance

`★` marks a Shrine or the Tower, `⌂` the Mouse House (where you start).

```text
       0      1      2      3      4      5      6      7      8      9
  0    W      W      W      T      T      T      F      F      F      F
  1    W★     W      W      T      T★     T      F      F★     F      F
  2    W      W      Q      T      T      T      R      F      F      F
  3    W      Q      Q      V      T      V      V      R      F      C
  4    Q      Q      Q      V      V      V⌂     V      R      R      C
  5    Q★     Q      Q      V      V      B      B      R      R      C
  6    Q      Q      Q      B      B      B      B      R      C      C
  7    Q      Q      I      I      I      I★     B      R      C      C
  8    Q      I      I      I      I      I      I      R      C      C
  9    I      I      I      I      I      I      C      C      C      C
```

| Code | Biome | Screens | Shrine | Opened by |
|:-:|---|:-:|---|---|
| `V` | **Millbrook Vale**: farmland, the village, the Mouse House | 9 | | (start) |
| `B` | **Bramble Woods**: thick woods and thorn thickets | 7 | | Bomb (the Orchard Gate) |
| `I` | **Frost Hollow**: a frozen glen of snowfields and ice walls | 16 | Ice Cave `(5,7)` | Bomb, then Fire for most of it |
| `Q` | **Quarry Hills**: dusty badlands, dunes and stone terraces | 15 | Rock Quarry `(0,5)` | Fire (the windmill and its lift) |
| `R` | **River Valley**: a river from the north, marshes, a delta | 9 | | Wind (the broken High Bridge) |
| `C` | **Coast**: beaches, coves, tide pools, a lighthouse | 13 | | Wind |
| `F` | **Fire Mountain slopes**: ash fields, lava, hot springs | 12 | Fire Mountain `(7,1)` | the ferry (after the Coast chapter) |
| `W` | **Wind Cliffs coast**: sea cliffs, gull ledges, a ruined watch | 9 | Wind Cliffs `(0,1)` | Ice (frozen falls) |
| `T` | **The Iron Plateau**: a bare iron-grey plateau round the Iron Tower | 10 | Iron Tower `(4,1)` | Rock (windbreaks), then all four bombs |
| | **Total** | **100** | | |

The nine screens already built keep their arrangement, moved `(+2, +2)` from the
old `6 × 6` plan: Tower Courtyard `(4,2)`, Tower Causeway `(4,3)`, Millbrook
North `(5,3)`, Millbrook West `(4,4)`, Mouse House `(5,4)`, Orchard Gate `(4,5)`,
Bramble Woods `(5,5)`, Cinder Trail `(5,6)`, Ice Cave Arch `(5,7)`.

## How it fits together

- **You start inside the Mouse House (`5,4`)**, where **Grandma** tells you your
  brother is making trouble again and sends you down to **Grandma's Basement**
  (**Dungeon Zero**, `DUNGEONS.md` §0) to fetch the **Magic Bomb Sack**. Once you learn Small Keys and the Bomb down in the cellar, you
  step outside into the village yard, and the **Iron Tower stands a short walk
  north**: you see the sealed goal from the Tower Courtyard in the first
  minutes.
- **Every biome borders the vale**, so the island is a ring of regions round the
  village, and each Shrine is in its biome's far corner: you cross the biome to
  reach it.
- **Natural escarpments prevent sequence breaks across biome borders:**
  - A high cliff escarpment separates **Millbrook Vale / Bramble Woods** (col `3`)
    from **Quarry Hills** (col `2`); only the high road from **Old Windmill
    `(3,3)`** to the **Quarry Lift `(1,4)`** descends into the quarry basin
    until you have **Wind** to blast-jump the cliff terraces.
  - An **ice wall** seals the western border between **Frost Hollow** (`(1,8)`)
    and **Quarry Hills** (`(1,7)`) until **Fire** is earned in the Ice Cave.
  - **Tower Causeway `(4,3)`** and **Tower Courtyard `(4,2)`** sit on a walled
    stone bridge flanked by deep chasms, isolating them from the outer **Iron
    Plateau (`T`)** until you climb **Gale Steps `(2,0)`** with **Rock** in
    Chapter 5.
  - At the southern mouth of the river, **River Estuary `(7,9)`** is deep
    fast-flowing water where the river meets the sea (crossable only by **Wind**
    or **Ice**), so the Chapter 1 mousehole from **Hollow's End `(5,9)`** to
    **South Beach `(6,9)`** lands in a self-contained cliff cove and cannot
    leak early into Chapter 3's **Coast (`C`)**.
- **Each bomb opens the next biome and changes the old ones.** Fire burns
  brambles and melts ice walls everywhere; Wind jumps gaps and ledges; Ice
  freezes rivers and falls; Rock blocks gusts and fills gaps. Going home past
  old screens always shows something new.
- **Two-way hub shortcuts, not warp menus.** Each chapter opens a permanent
  two-way shortcut between its outer region and **Millbrook Vale** (the Quarry
  Lift `(1,4)`, the North Beach ↔ Hot Springs ferry + a rope footbridge lowered
  from the east bank at `(7,3)`, the frozen River Ford `(7,3)`, and the
  windbreak pass on the Iron Plateau), plus each Shrine's warp pad from its
  miniboss back to its entrance. Dying on the overworld returns you to the
  **Mouse House `(5,4)`**, just 2–3 screens from every unlocked shortcut.
- **Grandma** inside the Mouse House always says where to go next (`GAME.md` §1,
  "One voice"). Nobody else talks.

## Progression

| Chapter | You carry | Route | The gate you pass | Shrine |
|---|---|---|---|---|
| Prologue | (none) → Bomb | Wake inside the **Mouse House**, talk to Grandma → descend into **Grandma's Basement** (**Dungeon 0**): learn Small Key & get the **Magic Bomb Sack** → step out to Mouse House yard `(5,4)` → Tower Courtyard `(4,2)` (see the sealed Tower) → Orchard Gate `(4,5)` | basement locked door & cracked cellar wall, then the east cracked gate in Orchard Gate `(4,5)` | **Grandma's Basement** → Bomb |
| 1 | Bomb | Bramble Woods `(5,5)` → Cinder Trail `(5,6)` → Ice Cave Arch `(5,7)` | the one path into Frost Hollow not walled with ice | **Ice Cave** → Fire |
| 2 | + Fire | Millbrook North `(5,3)` → Old Windmill `(3,3)`: burn the brambles choking it, light its boiler with Fire, and its sails haul the Quarry Lift `(1,4)` back up → Quarry Hills → Rock Quarry `(0,5)` | brambles, the boiler (a brazier) | **Rock Quarry** → Wind |
| 3 | + Wind | Mill Pond `(6,4)` → High Bridge `(7,4)`: blast-jump its broken span → Reed Marsh → Crescent Cove `(9,4)`, where the Pack-Otters steal your fuses (`GAME.md` campaign flow) → corner the 4 otters (throw/drop heavy **dud bombs** in `(9,4)` to recover your **Wind** fuse, blast-jump `(8,6)` Tide Pools for **Fire**, burn `(9,5)` Driftwood Beach barricades for **Bomb**, and crack `(9,6)` Thief Burrows) → the old ferry from North Beach `(9,3)` to Hot Springs `(9,2)` → Fire Mountain `(7,1)` | the broken bridge, the 4-room otter fuse chase (`Dud → Wind → Fire → Bomb`) | **Fire Mountain** → Ice |
| 4 | + Ice | Ash Sluice `(9,1)` back west → freeze the River Ford `(7,3)` → Millbrook → Quarry Road `(1,3)` → freeze the falls at Windmill Bluff `(0,2)` into an ice stair → Wind Cliffs `(0,1)` | the river, the falls | **Wind Cliffs** → Rock |
| 5 | + Rock | Gale Steps `(2,0)` east onto the Iron Plateau: storm gusts sweep the plateau and gaps split it; build windbreaks and stepping stones → Tower Causeway `(4,3)`: the four-element gate → Iron Tower `(4,1)` | gusts and gaps, then the gate (light a brazier, spin a vane, freeze a moat, weigh a pedestal) | **Iron Tower** |

Every chapter's gate needs the bomb from the chapter before, so the order is
fixed, with no sequence breaks to design round. Optional screens open in any
order once their bomb is in hand.

## Biomes, screen by screen

`*` marks a screen with a reward (see **Rewards** below). The rule from `GAME.md`
§3 holds: something every two or three screens.

### Millbrook Vale (`V`, 9 screens): the start

Rolling farmland, hedges and the small village.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(5,4)` | **Mouse House** ⌂ | Doors into the **Mouse House Interior & Grandma's Basement** (**Dungeon Zero**, where you start and get the Magic Bomb Sack); the old smithy outside, whose cracked wall hides a **Heart Piece**; east gate to Mill Pond `(6,4)`. (built) `*` |
| `(5,3)` | Millbrook North | The village square; paths north to the Tower, east to Millbrook East `(6,3)`, and west to the windmill. (built) |
| `(4,4)` | Millbrook West | A bramble cage hiding the **Bomb reach `1 → 2`** upgrade (Fire). (built) `*` |
| `(6,3)` | Millbrook East | The village's east lane and well; a mousehole into a cellar: a **Button**. `*` |
| `(3,3)` | **Old Windmill** | Choked by brambles; its boiler is a brazier; lit, it powers the Quarry Lift. |
| `(3,4)` | Meadow Fields | Open meadow with dry grass that burns in lines (Fire); a high cliff wall along the west edge overlooks Quarry Hills below. |
| `(6,4)` | Mill Pond | A pond and a waterwheel; the path east to the High Bridge. |
| `(3,5)` | Orchard | Apple trees above the western quarry cliff; a cracked wall into a cave: a **Button**. `*` |
| `(4,5)` | Orchard Gate | The cracked gate east into Bramble Woods `(5,5)` (and south brambles to Mossy Hollow `(4,6)`): the Prologue's goal. (built) |

### Bramble Woods (`B`, 7 screens)

Dark mossy woods and thorn thickets; moss-slimes. In Chapter 1 you only pass
through; Fire later opens its side paths.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(5,5)` | Bramble Woods | Moss-slimes; a **Heart Piece** on a ledge behind brambles (Fire). (built) `*` |
| `(5,6)` | Cinder Trail | The canyon path south to the Ice Cave. (built) |
| `(6,5)` | Thorn Thicket | A bramble maze (Fire) round a **Button**. `*` |
| `(3,6)` | Old Orchard Wood | Wild apple trees; a cave behind brambles (Fire): a **Button**. `*` |
| `(4,6)` | Mossy Hollow | A ring of stones round a floor switch; weigh it with a shoved block and a cave opens: a **Button**. `*` |
| `(6,6)` | Fern Glade | A quiet clearing; a **mousehole shortcut** east to the River Mouth `(7,6)`. `*` |
| `(6,7)` | Frosted Thicket | Where the woods meet the frost: icy brambles (Fire melts and burns). |

### Frost Hollow (`I`, 16 screens): Shrine 1

A frozen glen below the woods: snowfields, a frozen pond, icicle ravines and an
old icehouse. **Ice walls** (the overworld form of the Ice Cave's ice blocks)
seal most of it; only the path to the Ice Cave is open before Fire.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(5,7)` | **Ice Cave Arch** ★ | The Shrine's entrance. (built) |
| `(5,8)` | Frost Hollow | The glen's heart; ice walls on three sides (Fire). |
| `(4,7)` | Snow Glen | Snowman-shaped drifts hiding a cave (Bomb): a **Button**. `*` |
| `(3,7)` | Old Icehouse | A ruined icehouse; melt its ice door (Fire): a **Heart Piece**. `*` |
| `(2,7)` | Frost Cistern | A frozen cistern; melt one tile so a block drops onto a sunken switch (Fire), opening a cave: a **Button**. `*` |
| `(1,8)` | Frozen Pond | Skating slimes; the pond's centre holds a **Button** under the ice (Fire). `*` |
| `(2,8)` | Icicle Ravine | Icicles fall when bombed; a path forms below. |
| `(3,8)` | Hollow Path | The road west through the glen; ice-shielded goblins patrol the narrows. |
| `(4,8)` | Snow Fields | Open snow and wind-blown drifts that push rolling bombs sideways. |
| `(6,8)` | Glacier Edge | The glacier's face; a cracked seam (Bomb): a **Button**. `*` |
| `(0,9)` | Frost Shore | The frozen shore where sea waves crash against ice shelves; skating slimes. |
| `(1,9)` | Iceberg Bay | Icebergs to blast-jump between (Wind) to a **Button** on the last one. `*` |
| `(2,9)` | Snowdrift | Drifts over a buried switch; blow them off (Wind) to open a cave: a **Button**. `*` |
| `(3,9)` | Glacier Foot | A frozen waterfall feeding a slick ice-chute channel. |
| `(4,9)` | Cold Springs | A warm spring in the ice; a fairy to refill hearts. |
| `(5,9)` | Hollow's End | The glen's southern edge; a **mousehole shortcut** to South Beach `(6,9)`. `*` |

### Quarry Hills (`Q`, 15 screens): Shrine 2

Dusty badlands west of the vale: dunes, gravel flats, terraced cliffs and
abandoned scaffolds. **Sand piles** and **terraces**, the Rock Quarry's two
pieces, first appear here, so the Shrine's lesson starts outside.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(0,5)` | **Rock Quarry** ★ | The quarry's rim: the Shrine's entrance. |
| `(1,4)` | **Quarry Lift** | The cargo lift down into the hills; dead until the Old Windmill turns. |
| `(1,3)` | Quarry Road | The road from the windmill to the lift; later the way to Windmill Bluff. |
| `(2,3)` | Gravel Flats | Rock-throwing goblins on terraces. |
| `(2,2)` | Stone Steps | Terraces climbing north (Wind) to a ledge cave: a **Heart Piece**. `*` |
| `(0,4)` | Dust Bowl | Sand piles over a stair (Wind); a cellar below: a **Button**. `*` |
| `(2,4)` | Scaffold Camp | An empty workers' camp; crates to burn (Fire). |
| `(1,5)` | Quarry Floor | Cut stone blocks; shove one onto a floor button and a chest opens: a **Button**. `*` |
| `(2,5)` | Sand Dunes | Dunes that hide and show paths as you blow them (Wind). |
| `(0,6)` | Deep Seam | A cracked seam deep into the hill (Bomb): a **Button**. `*` |
| `(1,6)` | Rubble Gully | Rubble to bomb; a mousehole behind it: a **Button**. `*` |
| `(2,6)` | Boulder Field | Boulders to gust aside (Wind). |
| `(0,7)` | Sand Pits | Pits to blast-jump. |
| `(1,7)` | Gravel Shore | Where the hills meet the frozen shore. |
| `(0,8)` | Stone Quay | An old loading quay; a **Button** across a gap (Wind). `*` |

### River Valley (`R`, 9 screens)

A river runs from the mountain in the north-east, through marsh and reeds, to a
frozen delta in the south. Its one bridge is broken; Wind crosses it, and Ice
later freezes the river into fords.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(7,4)` | **High Bridge** | The broken bridge: blast-jump its gap (Wind). |
| `(6,2)` | Upper River | The river below the mountain; freeze its falls (Ice) to reach the cave behind them: a **Button**. `*` |
| `(7,3)` | **River Ford** | A deep ford; freeze it (Ice) for the shortcut home from the east. |
| `(8,4)` | Reed Marsh | Reeds to burn in lines (Fire), uncovering a mousehole: a **Button**. `*` |
| `(7,5)` | Otter Shallows | Shallow water; the otters' first lookout. |
| `(8,5)` | Lily Marsh | Lily pads to blast-jump (Wind) to an islet: a **Button**. `*` |
| `(7,6)` | River Mouth | The mousehole from Fern Glade comes out here. |
| `(7,7)` | Frozen Delta | The delta, frozen solid; a cave in the ice (Fire): a **Button**. `*` |
| `(7,8)` | Ice Falls | A frozen fall over the southern cliffs. |

### Coast (`C`, 13 screens)

Beaches, coves and tide pools along the east and south. **Crescent Cove** is the
Pack-Otters' hideout (Chapter 3), and the old ferry leaves from North Beach.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(9,4)` | **Crescent Cove** | The Pack-Otters' cove: the fuse chase starts here. Corner the first otter in a tide channel by dropping one heavy **dud bomb** to block its escape and throwing a second dud bomb down the other lane to bonk it—recovering your **Wind** fuse. |
| `(9,6)` | **Thief Burrows** | The otters' burrows: use all three recovered bombs (**Bomb + Fire + Wind**) to flush the fourth otter, unlock the North Beach ferry, and claim a **Heart Piece** behind the back ledge. `*` |
| `(9,5)` | Driftwood Beach | Driftwood barricades to burn with your recovered **Fire** fuse to corner the third otter and win back your **Bomb** fuse. |
| `(8,6)` | Tide Pools | Pools and crabs; blast-jump across the pools with your recovered **Wind** fuse to corner the second otter and win back your **Fire** fuse. |
| `(9,3)` | **North Beach** | The ferry dock: the ferry runs to Hot Springs once the otters are beaten. |
| `(8,7)` | South Cape | A headland; a cracked rock (Bomb): a **Button**. `*` |
| `(9,7)` | Shipwreck | A wreck to search; burn its hatch (Fire): a **Button**. `*` |
| `(8,8)` | Seal Rocks | Rocks to blast-jump across. |
| `(9,8)` | Lighthouse Point | A dark lighthouse; light its lamp (Fire) and the gallery door opens: a **Button**. `*` |
| `(6,9)` | South Beach | Where the Hollow's mousehole comes out: a cliff-walled hidden cove with a fairy (blocked from `(7,9)` by the deep estuary). |
| `(7,9)` | River Estuary | Where the river pours into the southern sea; a `2`-tile deep current channel crossable only with **Wind** (blast-jump) or **Ice** (freeze). |
| `(8,9)` | Coral Bay | Coral to blast (Bomb): a **Button**. `*` |
| `(9,9)` | Far Reef | The island's far corner; a lone rock reached by blast-jump (Wind): a **Button**. `*` |

### Fire Mountain slopes (`F`, 12 screens): Shrine 3

The volcano's flanks: ash fields, smoke vents, lava streams and hot springs. The
mountain's two pieces, **lava** and **flame jets**, first appear here, and you
cross them with Wind before Ice tames them.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(7,1)` | **Fire Mountain** ★ | The forge gate in the mountainside: the Shrine's entrance. |
| `(9,2)` | **Hot Springs** | Where the ferry lands; warm pools and a fairy. |
| `(8,2)` | Cinder Pass | Thin lava streams to blast-jump (Wind). |
| `(7,2)` | Steam Falls | Falls over hot rock: steam hides a cave until Ice cools it: a **Button**. `*` |
| `(8,3)` | Ash Foothills | Ash drifts; a cracked wall (Bomb): a **Button**. `*` |
| `(6,0)` | Ash Ridge | A ridge walk with flame jets on a beat. |
| `(6,1)` | Lava Fields | A lava field to crust over (Ice) to an island: a **Button**. `*` |
| `(7,0)` | Smoke Vents | Vents that puff on a beat. |
| `(8,0)` | Caldera Rim | The crater's rim; a view down into the mountain. |
| `(8,1)` | Ember Slope | Burning brambles; a **Button** behind flame jets (Ice puts them out). `*` |
| `(9,0)` | Obsidian Shore | Black glass beach where lava meets the sea. |
| `(9,1)` | Ash Sluice | An old forge sluice; frozen with Ice, the way home west. |

### Wind Cliffs coast (`W`, 9 screens): Shrine 4

The island's north-west: sea cliffs, gull ledges and a ruined watchtower. The
Shrine's **gusts** blow across the clifftops outside too, carrying any bomb you
set down.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(0,1)` | **Wind Cliffs** ★ | The sea-cave mouth at the cliff foot: the Shrine's entrance. |
| `(0,2)` | **Windmill Bluff** | Falls down the bluff; frozen (Ice), an ice stair up to the cliffs. |
| `(0,3)` | Cliff Overlook | A view over the sea; the bluff's lower path. |
| `(1,2)` | Gusty Crags | Gusts across the path that carry bombs off. |
| `(0,0)` | Gull Point | Gull nests; a cracked rock (Bomb): a **Button**. `*` |
| `(1,0)` | Spray Ledges | Sea spray to freeze into ledges (Ice) up to a **Button**. `*` |
| `(1,1)` | Cliff Path | The path along the clifftop; fill its gaps with Rock to reach a **Button**. `*` |
| `(2,0)` | Gale Steps | Steps up into the wind, east to the Iron Plateau. |
| `(2,1)` | Watch Ruin | A ruined watchtower; a four-button door (Rock and bombs): a **Button**. `*` |

### The Iron Plateau (`T`, 10 screens): the finale

The bare plateau round the Iron Tower: scrap iron, toppled machines and storms
blowing off the Tower. Storm **gusts** sweep it and **gaps**
split it, so you need Rock's windbreaks and stepping stones to cross; then the
four-element gate opens the Tower.

| `(x,y)` | Screen | What's there |
|---|---|---|
| `(4,1)` | **Iron Tower** ★ | The Tower's door. |
| `(4,2)` | Tower Courtyard | The Fourfold Seal: each Core slots in here. (built) |
| `(4,3)` | Tower Causeway | The four-element gate (`GAME.md` campaign flow). (built) |
| `(3,0)` | West Barrens | Storm gusts; windbreaks (Rock). |
| `(4,0)` | North Barrens | Behind the Tower; a scrap heap to gust aside (Wind) behind a windbreak (Rock): a **Button**. `*` |
| `(5,0)` | East Barrens | Gaps over a deep chasm (Rock). |
| `(3,1)` | Iron Field | Toppled iron giants; a cracked one hides a cave (Bomb): a **Button**. `*` |
| `(5,1)` | Scrap Heaps | Scrap to gust aside (Wind). |
| `(3,2)` | Gear Yard | Great iron gears; one turns with a gust (Wind) to open a gate: a **Button**. `*` |
| `(5,2)` | Seal Stones | Standing stones round the seal; a fairy before the finale. |

## Rewards: what the secrets hold

There is no money, no shop and no ammo (the Magic Bomb Sack never runs out), so every
secret on the island (`*`) is one of four things, and nothing else:

| Reward | How many | Where |
|---|:-:|---|
| **Button** | `36` | Grandma's lost sewing buttons, scattered over the island the night the Tower rose. Bring them home: every `12` she sews you a **Heart Piece** (`3` in all). |
| **Heart Piece** | `5` hidden + `3` from Grandma = `8` | A quarter heart; four make a heart. Mouse House `(5,4)`, Bramble Woods `(5,5)`, Old Icehouse `(3,7)`, Stone Steps `(2,2)`, Thief Burrows `(9,6)`. |
| **Bomb reach `1 → 2`** | `1` | Millbrook West `(4,4)` (Fire), as built. The other two Magic Bomb Sack upgrades are in Shrines (`DUNGEONS.md`). |
| **Mousehole shortcut** | `2` | Fern Glade `(6,6)` ↔ River Mouth `(7,6)`, Hollow's End `(5,9)` ↔ South Beach `(6,9)`. Three more mouseholes lead to buttons (Millbrook East, Rubble Gully, Reed Marsh). |

That is `44` marked screens of `100`, a reward about every two screens.
Fairies (hearts refilled) and progression gates are listed but not marked: they
are services and the main road, not secrets.

**Hearts add up to `10`:** `3` to start, `+4` from Shrine bosses' Heart
Containers, `+3` from `12` Heart Pieces (one in each of the `4` Shrines, `5`
hidden on the island, `3` from Grandma).

**Buttons by biome** (so every region pays off, and the late regions too):
Millbrook Vale `2`, Bramble Woods `3`, Frost Hollow `6`, Quarry Hills `5`,
River Valley `4`, Coast `5`, Fire Mountain slopes `4`, Wind Cliffs coast `4`,
Iron Plateau `3`.

## Inspiration notes

- *Oracle of Seasons*, **Holodrum** (`inspiration/2001-oracle-of-seasons/`):
  the game starts in **Horon Village** and spreads out in regions around it;
  changing the season changes the same screens. We start in the vale and spread
  out the same way, but **our bombs change the screens** (brambles burn, ice
  melts, rivers freeze) instead of the seasons, since the island stays in one
  state.
- *Oracle of Ages*, **Labrynna** (`inspiration/2001-oracle-of-ages/`): **Lynna
  City** is the central hub, the largest regional map (`45` screens present)
  with routes out to every region. Millbrook Vale plays that role at a fifth of
  the size.
- *Link's Awakening*, **Koholint** (`inspiration/1993-links-awakening/`): the
  last dungeon is the **Wind Fish's Egg**, a fixed landmark on the island. Our
  **Iron Tower** works the same way: visible from the start, sealed until the
  end.
- *The Legend of Zelda*, **Hyrule** (`inspiration/1986-the-legend-of-zelda/`): a
  `16 × 8` open world where you can wander far early. We are more gated (each
  biome waits for its bomb) to keep a short game focused, but keep the ring of
  optional caves.
- **Homage check:** the island, its names and its routes are our own. The
  Pack-Otters' fuse chase echoes the Oracle "chase the thief to get your item
  back" beat (the Subrosian Treasure Grove in *Seasons*, where the Strange
  Brothers take Roc's Feather), so it stays a chase across our own beach rooms,
  with fuses rather than an item.

## Build order

1. **Move the nine built screens** to their new coordinates `(+2, +2)` and set
   the grid to `10 × 10` (with ocean beyond the edges).
2. **Chapter 2's ring:** Old Windmill, Quarry Hills and the Quarry Lift, ready
   for the Rock Quarry.
3. **Frost Hollow's Fire-locked screens** (ice walls), so the first Shrine's bomb
   immediately opens new ground.
4. **River Valley and Coast** with the otter chase, then the Fire Mountain
   slopes, then the Wind Cliffs coast and the Iron Plateau, each alongside its
   Shrine.
