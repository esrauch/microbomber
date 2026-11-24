# Puzzle mechanics: the primitives and how they compose

The building blocks for every Single-Room Shrine and Major Dungeon room
(`DUNGEONS.md`), each testable on its own in Dungeon 999. A puzzle is a few
**primitives** joined by **signals** and **physical chains**: "a fuse line burns
to a brazier, while a Magnet Bomb pulls an iron bridge into place for a rolling
Bomb".

Each primitive is marked:
- ✅ **definitely in**: already in the game, or committed in `GAME.md` / `DUNGEONS.md`
- 🤔 **maybe in**: worth a Dungeon 999 prototype first
- 🌀 **wild idea**: interesting, unproven, probably cut

## Principles: Rube Goldberg homage, levelled up

The Zelda games in `inspiration/` (`INSPIRATION_PUZZLE_MECHANICS.md`) built their
dungeons and shrines from a small kit:
- bombable walls and push blocks (*Zelda 1*)
- crystal switches, conveyor belts and the Cane of Somaria's blocks (*A Link to the Past*)
- torches, mine carts, magnetic gloves and ice-block backstops (*Oracle of Seasons*, *The Minish Cap*)
- Seed Shooter bank shots and the Switch Hook (*Oracle of Ages*)
- physics-rule shrines with one trial name and one self-contained room (*Breath of the Wild*, *Tears of the Kingdom*)

We keep the **spatial puzzle verbs**, drop filler combat and hearts completely,
and turn every room into a **tactile, clockwork Rube Goldberg machine**:

1. **One actuator family: the 7 Bombs.** Every switch, door, creature and mover
   answers to bombs (**Bomb, Fire, Squeak, Wind, Magnet, Ice, Rock**).
2. **Zero hearts, fearless experimentation.** Your own bomb blasts **never hurt
   you** (they simply give Pip a `1`-tile knockback hop). Pits (`^`), lava, deep
   water (`~`), spikes (`!`) and flame jets pop Pip back to the last safe tile
   (`0.35 s`) instead of draining a health bar. Boss hits reset the current
   1-of-3 puzzle phase rather than killing you.
3. **Zero trash-mob combat; only deterministic "Clockwork Creatures".** There are
   no erratic bats or chasing mobs, and no "kill all enemies" locks. Creatures in
   puzzle rooms move on strict, readable rules (lured by a **Squeak Bomb**,
   mirroring Pip's steps, marching a fixed rail, or carrying a bomb down a
   mousehole).
4. **Whole-screen `22 × 26` puzzle boxes (`14 × 18` interior), plus scrolling capstones.**
   Doubling the standard room to `22 × 26` tiles (`GAME.md` §1.1, `4×` the floor
   area of Grandma's `11 × 13` rooms) lets an entire **3- to 5-stage multi-lane
   Rube Goldberg machine**—elevation tiers (`0/1/2`), flooded basins, laser
   sightlines, fan lanes, asymmetric gates, and `90°` turntables—play out on **one
   screen at once** with zero blind camera cuts. Multi-screen scrolling (`1 × 2`,
   `2 × 1`, `2 × 2`) stays available for centerpiece Dungeon halls.
5. **Creative "aha!" solutions, kit restrictions & 3-stage escalation triads.**
   Every puzzle room is designed around **dual-role physical affordances** (e.g.
   routing a Laser to its sensor *without* letting it burn the wooden crate you
   also need as a bridge), **deliberate kit restrictions** (*"trivial if you had
   a Fire Bomb—so without Fire, how do you steal flame from the room's Laser?"*),
   and **progressive `A → A' → A''` escalation chains** (Room 1 gives you the
   full kit so the obvious solve works; Room 2 strips that bomb or blocks that
   lane; Room 3 blocks the second trick too). We block 0- and 1-step cheese
   (`tests/dungeon999Shortcuts.test.ts`), never clever multi-step lateral solves.
6. **Every state and wire is visible.** Lit or unlit, raised or lowered, flooded
   or drained, beam live or blocked, magnetic `N` or `S`, and how long is left: a
   fuse spark races down its cord, a laser draws a crisp glowing ray to the exact
   tile that blocks it, a fan streams air motes to the end of its lane (stopping
   at any windbreak), a Squeak Bomb floats musical notes toward the creature it
   lures, a Magnet Bomb arcs blue-gold field lines to metal within reach, and a
   local signal runs along a carved floor rune trace that glows when live.
   (**Never** draw floor wires for room-global rules like Red/Blue crystal
   barriers or room-wide water sluices.)
7. **No soft-locks, by construction (`tests/softlock.test.ts`).** Every
   consumable puzzle piece respawns on room entry, following a three-tier
   persistence contract:
   - **Permanent (save-wide):** `%` cracked walls/floors, outdoor `B` brambles,
     unlocked `D`/`K` doors, latched `solvedRooms`, and collected Buttons/Keys.
   - **Zone-visit (resets on leaving the Shrine or Dungeon):** `crystalColor`
     (`red` ↔ `blue`), `magnetPolarity` (`north` ↔ `south`), and zone-wide water
     sluices.
   - **Room-local (resets on room exit):** Pushable wooden crates (`W`), `,` dry
     grass fuse lines, indoor `B` ice blocks, `Push blocks`, `Metal blocks`,
     `Iron spheres`, `Mirror blocks`, `Rock blocks`, room-local water levels,
     turntable angles, frozen water/frost/lava crusts, frosted crates,
     Clockwork Creature positions, and unlatched timed/ordered braziers.

   > **Open question (persistence):** Currently `src/game/world.ts` persists
   > broken `W` crates and burned `,` grass in `brokenTiles` / `burnedTiles`
   > alongside `%` walls. Switch `W` and `,` to room-local reset before building
   > rooms where a crate or grass fuse is a puzzle piece you can ruin (`Dev A2.5
   > Firebreak`, `Scaffold Stack`). Also confirm whether snuffed **Flame jets**
   > and cleared **Sand piles** stay cleared permanently per save or reset on
   > leaving the Dungeon.

## The model: things, movers, creatures, signals

- **Things** have orthogonal physical properties: a **wooden crate** is
  walk-pushable, buoyant in water, wind/laser-opaque, *and* flammable (unless
  frosted with Ice or doused in water!); water is shallow, deep, or frozen; Pip
  and creatures can be encased in sliding ice (**Self-Cryo**); an iron block is
  heavy, non-flammable, and magnetic.
- **Movers & Rotators** carry or re-orient things: slopes/ramps, currents, fans,
  magnetic rails, **mine carts (`'cart'`) on iron cart tracks (`'t'`)**,
  cycling/triggered platforms, buoyant rafts, slick frost/glaze, spring pads,
  independently triggered multi-tier raisable pillars (`L`, `pillarSpecs`),
  `1 × 1` & `3 × 3` `90°` turntables, blowholes, and drop shafts.
- **Scale & Material Filters** split Pip's route from an item's route: low fences
  (`=`, thrown items pass on level or downward trajectories), slotted grates (`g`,
  rolling items, frost-sliding props & rays pass, Pip and walk-pushing blocked),
  mouseholes (`m`, Pip passes empty-handed, carried items blocked), cart tracks
  (`t`, mine carts roll along tracks, Pip and walk-pushed props cannot step onto
  tracks), and waterfall douse veils (`|`, Pip walks through, carried or cart-borne
  items fizzle unless the veil is frozen or drained).
- **Clockwork Creatures** act as autonomous moving puzzle pieces with a single
  deterministic rule (lured, mimic, rail-marcher).
- **Signals & Height States** flow from **sources** (a button is weighted, a
  brazier lights, the **Laser** hits its **Beam Sensor**, a crystal/polarity/sluice
  switch flips, a vane spins) through optional **logic** (latch, timer, AND,
  sequence, inverter) to **sinks** (a shutter opens, water rises/drains, a
  pillar/platform moves, a turntable rotates `90°`, a fan toggles).

Compositions are written as Rube Goldberg chains:
`push wooden crate into dry trench → flood sluice floats crate to level 1, temporarily eclipsing the Laser so a second crate crosses unburned → burning fuse clears first crate → restored Laser powers Beam Sensor`.

## Primitives

### Breakables & multi-property props (room-resettable unless noted)

| Primitive | Physical properties & changed by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Cracked wall / floor plug (`%`)** | **Bomb** blast breaks (permanent in Campaign, room-local in trials) | ✅ | *Zelda 1*'s bombable walls (and floor plugs to the floor below in Rock Quarry). Always visibly seamed (`GAME.md` §7): we hide *how* to deliver the bomb, never *whether* it breaks. |
| **Pushable wooden crate (`W`)** | **Walk-pushed** `1` tile by Pip; shoved by blasts; **floats** in deep water (`~`/`1–4`) as a bridge & rises `+1` level with floodwater; blocks lasers & wind; **Bomb** breaks; **Fire / `,` fuse / Laser** ignites (`1.8 s` burn + spreads fire, unless doused by water or coated in **Ice**!) | ✅ | *Tears of the Kingdom* Tadarok ("Fire and Water") + *Wind Waker* Tower of the Gods: pushable weight, floating bridge, temporary laser shield, and delayed burn-away fuse relay. |
| **Brambles (`B`, outdoor)** | **Fire** or **Laser** burns & spreads tile to tile | ✅ | Burnable obstacles in the *Oracle* games (Ember Seeds). Ours spread tile to tile. |
| **Ice block (`B`, indoor)** | **Fire** or **Laser** melts into a `1`-tile puddle of **shallow water (`;`)** | ✅ | Melting leaves real meltwater (`;`)—creating a firebreak, dousing an adjacent burning crate, or priming a tile to be re-frozen into slick frost! |
| **Sand pile** | **Wind** or **Fan** clears it; a **Bomb** only scatters it back | ✅ | Hides switches, magnetic rails, spring pads, and sluice drains. |
| **Suspended prop / hanging cage** | **Fire** or **Laser** burns its rope | ✅ | Drops a crate, stone block, or iron sphere onto a floor button, raft, or chute (`Scaffold Stack`), or drops an iron cage into water/lava as a permanent bridge. |

### Terrain, asymmetric gates, elevation and liquids

| Primitive | States | Changed by | Status | Precedent and our twist |
|---|---|---|---|:-:|---|
| **Low fence / balustrade (`=`)** | — | — | ✅ | **Airborne Item-Only:** blocks Pip, crates, and grounded rolling items; **Thrown** items (`A → A`) cross over it onto same-level or lower tiles (hand throws never clear upward ledges), as do gusts, lasers, magnetic pull, and fire. |
| **Slotted grate (`g`)** | — | — | ✅ | **Grounded Item & Frost-Slide Filter:** bars walking Pip, walk-pushed crates/blocks, and high throws; **rolling/sliding items**, **frost-sliding frosted crates (`W`) & blocks**, gusts, magnetic pull, and lasers pass straight through the floor slots. |
| **Mousehole (`m`)** | — | — | ✅ | **Mouse-Only (size filter):** tiny Pip squeezes through empty-handed (`heldBomb === null`); blocks carried/thrown/rolling items (except a chirping Squeak item) and all crates/blocks. |
| **Cart track (`t`)** | fixed or `3 × 3` turntable-mounted | `3 × 3` Turntable rotates track section `90°` CW | ✅ | **Cart-Only Rail:** guides **Mine Carts (`'cart'`)** around `90°` corners, through open gates (`G`), lowered crystal barriers (`R`/`U`), and drained waterfall veils (`\|`). Blocks Pip and walk-pushed props from stepping onto the rails. |
| **Waterfall douse veil (`\|`)** | cascading ↔ frozen wall ↔ drained (`High` sluice) | **Ice** freezes solid; **Sluice** drains/restores | ✅ | **Mouse-Only (douse filter):** Pip walks/rolls through unharmed, **dousing any carried, thrown, or cart-borne item** on contact—unless frozen into a solid ice wall with **Ice** or diverted/drained via the Sluice! |
| **Pit (`^`)** | — | **Rock** (`1`-tile plug); `B = Roll` leaps `1`-tile narrow gap | ✅ | Pops Pip back to the last safe tile (`0.35 s`) and **swallows grounded items**; crossed by `1`-tile Roll-jumps, Wind jumps, Spring Pads, platforms, and thrown/catapulted items. |
| **Spikes (`!`) & Retractable (`X`)** | up ↔ sunk (`X` on `Q`) | **Rock** (`1`-tile plug); `Q` sinks `X`; **Ice-Pip** slides over | ✅ | Knock un-iced Pip back to the near edge; crossed via `B = Roll` (`1`-tile), Rock plugs, or sliding across while encased in **Self-Cryo**! |
| **Deep water (`~`) & Currents (`1–4`)** | deep ↔ walkable ice (`3 × 3`); drains to `;` | **Ice** freezes; **Fire / Laser** melts; **Sluice** raises/drains | ✅ | Blocks walking; **floats items** (carrying them at `CURRENT_SPEED` on `1–4`), **floats wooden crates (`W`) into flush bridges**, and carries **Floating Rafts**. Heavy stone/iron blocks **sink** onto underwater switches (`Melt-and-Sink`), whereas wooden crates **float** free (`Melt-and-Float`). |
| **Shallow water (`;`)** | shallow ↔ **slick frost**; floods to `~` | **Ice** freezes to slick frost; **Fire / Laser** thaws; **Sluice** floods/drains | ✅ | Walkable with wading ripples; **douses ground fire and burning crates**; items sit without sinking. Freezing `;` creates **slick curling frost** where items, frosted crates, blocks, frozen creatures, and **Ice-Pip** slide until hitting a backstop (skimming across `'g'` grates)! |
| **Water level sluice (`Low ↔ High`)** | basin depth `0 ↔ +1` | Sluice switch / crystal / laser sensor | ✅ | *Ocarina* Water Temple + *BotW* Sheh Rata: flooding turns dry `0` → `;` and `;` → `~`, **floating wooden crates and rafts up `+1` elevation level** (bridging `level 1` cliffs, shuttering `level 1` lasers, *or* floating a buoyant crate *off* a submerged `Q` plate!). **Drowning rule:** if the Sluice floods `Low → High` while Pip is standing in deep water without a floating Raft or Crate deck, Pip drowns and the entire room resets. |
| **Lava & Glazed crust** | molten ↔ slick glaze | **Ice** crusts; **Fire / Laser** melts | ✅ | Fire Mountain's moat and rivers; glazed crust slides thrown/dropped items, blocks, and spheres until arrested by a backstop. |
| **Flame jet** | firing on beat ↔ snuffed | **Ice** snuffs; **Rock / Stone** blocks stream | ✅ | Telegraphed vents firing in ripples or beats; ignites wooden crates and `,` fuses along its tongue. |
| **Dry grass / powder trail (`,`)** | dry → burning → bare | **Fire / Laser / burning `W`** ignites; **Ice / `;` / flood** cuts | ✅ | Visible burning delay wire in Rube Goldberg chains (`MAX_FIRE_GENERATION`). |
| **Elevation (`0 / 1 / 2`), Ledges & Ramps (`n/s/e/w`)** | — | **Wind**, **Spring Pad (`J`)**, or **Raisable Pillar (`L`)** climbs `+1` tier | ✅ | `ELEVATION.md`: cardinal push hops Pip down `1`-tier ledges (`2 → 1 → 0`); hand-thrown items cannot fly from low ground (`level 0`) up onto higher cliffs (`level 1/2`), whereas **Spring Pads (`J`)** and **Raisable Pillars (`L`)** lift items and props `+1` tier; ramps carry Pip up and roll items downhill. |

### Movers, rotators, beams and platforms

| Primitive | Behaviour | Changed by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Slope / chute (`n/s/e/w`)** | rolls grounded items, spheres, and **Ice-Pip** downhill | **Turntable** rotates elbow chutes `90°` | ✅ | Bowling routes; a **Magnet** item beside a chute pulls a rolling item or sphere sideways into a branch lane mid-run. |
| **Raisable floor pillar (`L`, `pillarSpecs`)** | flush floor (`baseLevel`) ↔ solid `baseLevel + 1` column (`0 → 1` or `1 → 2`) | per-pillar `trigger: 'red' \| 'blue' \| 'switches'` (`ELEVATION.md` §8) | ✅ | Each pillar has an independent base tier (`0` or `1`) and trigger (`red`, `blue`, or momentary `Q` `switches`), enabling counter-phase `0 → 1 → 2` escalators (`P43`, `P45`), pillar-top **Mirror periscopes** that reflect `level 1/2` Lasers when raised (`P44`), and twin-column laser eclipses (`P46`). Every `'L'` tile enforces plain walkable `'.'` directly north at `(x, y - 1)`. |
| **Spring pad (`J`)** | launches Pip, grounded items, or pushed crates `2` tiles forward and up to `+1` level | **Turntable** or switch (if directional) | ✅ | *Seasons* trampolines: vaults Pip, a crate, or a ticking item over a fence/laser/gap or up onto a `level 1` terrace without needing a Wind item (`P15`, `P26`, `P34`). |
| **Mine cart (`'cart'`) on Cart track (`'t'`)** | rolls along `'t'` rails when loaded with any non-`squeak` item (`cart-load`), following `90°` track corners | `3 × 3` **Turntable** rotates cart + track `90°` CW (`P47`); **Waterfall veil (`\|`)** douses cargo unless drained (`P48`); open gates (`G`) & lowered barriers (`R/U`) pass | ✅ | **Iron courier & rolling shutter:** replaces the old Pack-Otter (`P17`). Carries `Bomb`, `Ice` (`P50`), `Magnet` (`P49`), `Fire`, `Wind`, or `Rock` across track-only tunnels; its fireproof iron body **blocks Lasers** at its elevation (`P48`) and **weights track-end `'Q'` / `'O'` plates** (`P48`, `P50`). *(Future work: step-up boarding tiles allowing Pip to ride in the cart from specific docked positions).* |
| **Fan / gust vent** | continuous directional wind lane (`N/S/E/W`) at its elevation tier | always on, switch-gated, or **Turntable**-rotated | ✅ | Pushes grounded/airborne items, floating crates & **Rafts** on water, frosted cubes & **Ice-Pip** on slick frost, and flame sparks; normal Pip walks against it. Any solid block, crate, Rock block, or risen pillar casts a **calm lee** behind it. |
| **Laser (Unified Fire + Signal Beam)** | one continuous ray (`N/S/E/W`) at elevation `0`, `1`, or `2` that **both** powers **Beam Sensors** *and* burns/melts everything flammable/frozen in its path | blocked by fireproof solids (`P`, Metal, Mine Cart, Rock, Mirror back, risen `L`, pillar-lifted crate); bent `90°` by **Mirrors** (including Mirrors lifted to `level 1` on risen pillars) | ✅ | **One beam, double-edged rule:** every Laser powers any sensor it reaches *while simultaneously* igniting wooden crates & `,` fuses, melting ice, thawing frozen creatures/**Ice-Pip**, and popping un-iced Pip back to his last non-hazard tile (`safeX, safeY`)—so routing a Laser to its goal *without* burning the crate or bridge you need is an automatic puzzle! |
| **Floating raft (pontoon)** | `1 × 1` or `2 × 2` buoyant deck on deep water (`~`) | propelled by **Fans**, **Wind**, **Currents**, or **Blast recoil**; rises `+1` level when flooded | ✅ | Ferries Pip, crates, blocks, and ticking items from pier to pier across deep basins; stops cleanly against docks, stones, or a **Rock block** anchor. |
| **Platform (cycling or triggered)** | moves along an aerial/water track | clock or any signal source | ✅ | Carries Pip, live items, blocks, crates, or laser-blocking shields across chasms (*never combined with cross-winds over pits*). |
| **`90°` Turntables (`1 × 1` Mount & `3 × 3` Floor Dial)** | rotates `90°` CW per pulse | `C` crystal flip, polarity pulse, or Beam Sensor | ✅ | **Two footprints:** `1 × 1` mounts rotate a single Fan, Laser, `90°` Mirror, or Elbow Chute; `3 × 3` floor dials rotate multi-tile `'t'` cart tracks, L-bridges, **and any Pip/crate/block/Mine Cart standing on the dial** (swapping push leverage on wall-pinned crates or redirecting a parked Mine Cart onto a perpendicular rail!). |
| **Magnetic rail (`M`)** | grooved iron floor track | **Magnet** item snaps & glides along it; polarity reverses | ✅ | Motors a Magnet item around corners while its aura drags an adjacent metal block, iron sphere, or live iron item along a parallel lane. |
| **Wind Item (`3 × 3` gust + `5 s` whirlwind)** | instant `3 × 3` push + `+1` tier jump + `5 s` vortex | — | ✅ | Jumps Pip up `1` level or across `2` tiles, propels rafts, clears sand, and leaves a **`5 s` whirlwind** that catapults thrown items `3–4` tiles downwind. |
| **Vertical drop shaft & Blowhole** | cross-floor drop (`2F → 1F`) or updraft (`1F → 2F`) | `%` floor plug / switch | ✅ | Multi-floor dungeon connectors (`DUNGEONS.md`). |

### Objects, Self-Cryo & Clockwork Creatures

| Primitive | Moved / Actuated by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Push block (`P`, stone)** | **Blast impulse** shoves `1` tile (slides on frost/glaze); **sinks** in deep water | ✅ | Heavy, **fireproof**, laser-opaque, wind-proof: shields ice or wooden crates from the Laser without burning, and presses underwater switches when melted through ice. |
| **Mirror block (`90°` prism)** | **Walk-pushed** `1` tile (or `1 × 1` / `3 × 3` **Turntable**-mounted, or **Pillar-lifted**); **Blast** shoves | ✅ | Reflects the Laser `90°` at its current elevation (redirecting *both* its signal and its heat, including at `level 1` when lifted on a risen `'L'` pillar!); fireproof and opaque from its two backed sides so its rear face doubles as a permanent heat shield! |
| **Metal block & Iron sphere** | **Magnet** item pulls continuously; **Blast** shoves; sphere rolls down chutes & slides on frost/glaze; **sinks** in deep water | ✅ | Fireproof laser/wind shield that can be slid remotely across grates/fences/tracks by magnetism (including from a moving **Mine Cart** carrying a Magnet item!) or sunk onto underwater plates. |
| **Mine Cart (`'cart'`)** | Loaded with any non-`squeak` item (`cart-load`); rolls along `'t'` cart tracks; rotated `90°` CW on `3 × 3` turntables | ✅ | Fireproof iron body blocks Lasers at its elevation and weights track-end `'Q'` and `'O'` plates; transports items through rail gates, across turntable roundhouses, and under drained waterfall veils. |
| **Rock block** | spawned by **Rock** item (`1` active at a time); shattered by **Bomb**; **fireproof & anchored against wind, currents, magnets & frost** | ✅ | Instant portable laser shutter, curling backstop, windbreak, raft mooring post, and `1`-tile pit (`^`) / spike (`!`) plug. |
| **Self-Cryo (`Ice-Pip`) & Frosted Crates** | **Ice** item encases **Pip**, a **Wooden Crate**, or a **Creature** in ice (**never** live items!) | ✅ | **Freeze the mouse!** Encased in an ice cube (`~3 s`), **Ice-Pip** slides frictionlessly down chutes/frost/fan-lanes over spikes (`!`) and **absorbs one Laser/Fire hit** to thaw unharmed on the far side! Frosting a Wooden Crate (`W`) lets it slide across frost (and skim over `'g'` grates!) *and* gives it `1` temporary layer of fire/laser armor before catching fire! |
| **Brass Beetle** | marches toward **Squeak** item (`5 s`); dazed `5 s` on pop; frozen `8 s` into sliding cube by **Ice** | ✅ | Lured across grates/mouse-tight ledges onto buttons, or frozen mid-march and slid across frost (and `'g'` grates) onto a plate. |
| **Mimic Statue (Armos)** | copies each step Pip takes (`N/S/E/W`), or marches toward a **Squeak** item | ✅ | Desynchronized via walls, `3 × 3` turntables, elevation ledges, or a Squeak lure. |
| **Rail Tortoise** | marches along a fixed track; **Magnet** stalls/pulls its iron shell; **Rock** reverses it | ✅ | Moving fireproof laser shutter, iron bridge shell, and rhythmic backstop. |
| **The item itself** | pulled (`A`), dropped (`B`), thrown (`A` over `=`, same/lower level only), rolled through `'g'` grates, loaded into a **Mine Cart**, floated, shoved, catapulted *(never frozen)* | ✅ | Holds `Q` (`1` countdown), too light for `O`; **1st pulse shoves** another live item, **2nd pulse chain-triggers** it. |

### 7 Items × Target interaction matrix

Every item has a sharp, non-overlapping primary job in the Rube Goldberg kit (and withholding an item forces creative off-label substitutions):

| Target | 0. Bomb | 1. Fire | 2. Squeak (`5 s` lure) | 3. Wind (`1.6 s` + vortex) | 4. Magnet (`3 s` pull) | 5. Ice (`3 × 3`) | 6. Rock (`2 s`) |
|---|---|---|---|---|---|---|---|
| **Cracked `%` wall/floor** | **Breaks** | — | — | — *(catapults item)* | — *(pulls item in)* | — | — |
| **Pushable Wooden Crate `W`** | **Breaks** *(or shoves if 1 tile off)* | **Ignites (`1.8 s` burn + spreads)** | — | — | — | **Frost-coats (`1`-hit fire armor + slides across `;` & `'g'`)** | Fireproof backstop / shield |
| **Brambles / Ice block `B`** | — | **Burns / Melts `B` → `;`** | — | — | — | — | — |
| **Deep water `~` / Currents `1–4`** | Floats & triggers (recoils raft) | Fizzles patch | Floats & chirps | Propels raft | — | **Freezes walkable (`3 × 3`)** | — |
| **Shallow water `;`** | Sits & triggers | Doused (`;` firebreak) | Sits & chirps | — | — | **Freezes into slick frost!** | — |
| **Pit `^` / Spikes `!`** | — | — | — | Jumps across | — | **Ice-Pip** slides over `!` | **Plugs `1` tile (`rock-fill`)** |
| **Waterfall douse veil `\|`** | Doused on contact | Doused on contact | Doused | — | — | **Freezes into solid ice wall** | — |
| **Mine Cart `'cart'` on `'t'`** | **Loads & rolls (`cart-load`)** | **Loads & rolls** | — | **Loads & rolls** | **Loads & rolls (mobile puller!)** | **Loads & rolls (remote cryo!)** | **Loads & rolls** |
| **Unified Laser (Fire + Signal)** | — | — | — | — | Pulls metal shutter in/out | Frost-coat absorbs beam briefly | **Blocks beam (fireproof shutter!)** |
| **Fan / Gust lane** | Blown downwind | Sparks blown downwind | Blown downwind | Cross-vortex redirect | — | **Ice-Pip** / cubes blown on frost | **Blocks gust (calm lee!)** |
| **Pip (the mouse!)** | `1`-tile knockback hop | — | — | **Jumps `+1` tier / `2` tiles** | — | **Self-Cryo (`Ice-Pip` cube!)** | — |
| **Live ticking Item** | **1st shoves / 2nd chains** | — | — | **Catapults `3–4` tiles** | **Curves / pulls iron item** | Stops drift if water freezes *(countdown continues)* | Backstop |
| **Crystal `C` / Sluice / Turntable** | **Flips / Rotates `90°`** | **Flips / Rotates `90°`** | — | — *(delivers item)* | **Flips Polarity `N ↔ S`** | — | — |
| **Brazier `T` / Fuse `,`** | — | **Lights / Ignites** | — | Spins wind vanes | — | **Snuffs `T` / Cuts `,`** | Windbreak / Laser shield |
| **Stone `P` / Mirror / Metal** | **Shoves `1` tile** | — | — | — | **Pulls Metal `1–2` tiles** | Slides on frost/glaze | Curling backstop |
| **Clockwork Creature** | Shoves | Thaws frozen cube | **Lures & dazes (`5 s`)** | Slides frozen cube | Stalls Rail Tortoise | **Freezes `8 s` into ice cube** | Reverses / blocks path |

### Signal sources, logic & sinks

- **Sources:** Goal plate (`O`, heavy weights, Mine Carts & Pip only; **a crate that is actively burning (`burnTicks > 0`) does NOT satisfy `O`** until doused or prevented from igniting), Momentary switch (`Q`, weights, Mine Carts + live items), Crystal (`C`), Iron Polarity (`N/S`), **Sluice wheel / pump switch** (`Low ↔ High` water), **Turntable trigger** (`+90°` CW on `1 × 1` mounts & `3 × 3` dials), **Beam Sensor** (lit while the unified Laser reaches it), Brazier (`T`, permanent/timed/ordered), Fuse line (`,`), Wind vane.
- **Logic:** Latch, Timer, AND (multi-plate / dual-sensor), Sequence (`I → II → III`), **Inverter (`NOT`)** (e.g. a gate held *open* only while a Beam Sensor is **eclipsed** or while a submerged `Q` switch is **un-floated**, creating natural state-inversion puzzles!).
- **Sinks:** Shutter (`S`), Gate (`G`), Crystal barriers (`R`/`U`), Water level (`Low ↔ High`, also draining/restoring linked Waterfall Veils `|`), Pillar (`L` rise/sink via per-pillar `pillarSpecs` trigger `'red' | 'blue' | 'switches'`), Turntable (`+90°`), Platform ferry, Fan on/off, Laser emitter shutter.

### Settled simulation & human-vs-solver parity rules (`tools/puzzle-lab/`)

Playtesting the 50 primitive rooms established six invariant rules enforced identically in the discrete Puzzle Lab (`tools/puzzle-lab/sim.ts`) and the `60 Hz` backport contract:

1. **`1`-Tile / `1`-Tick Timed Movement Parity:** Whenever any timer is active on the board (live items, burning `,` grass, `burnTicks > 0` on a crate, `icedTicks > 0` on Pip or a creature, or active wind vortices), `moveTo` advances the world clock **`1` tick per `1` tile step** (matching human `WASD` step speed) and recomputes momentary `'Q'` switches, gates `'G'`, and `'switches'`-triggered `'L'` pillars after every single step. Neither the solver nor the player can sprint across a `'Q'`-controlled gate or pillar after stepping off `'Q'`.
2. **No Low-to-High Hand Throws:** Hand-thrown items cannot fly from lower ground (`level 0`) up onto higher cliffs (`dstLevel > launchLevel` stops the throw at the cliff face). Reaching a higher terrace requires an elevation mechanism: a **Spring Pad (`J`)**, a **Wind jump**, a **Raisable Pillar (`L`)**, a **Sluice flood (`Low → High`)**, or a **Ramp (`n/s/e/w`)**.
3. **Full-Room Drowning Reset on Sluice Flood:** If the Sluice transitions `Low → High` while Pip is standing on a tile that becomes deep water (`~`) without a floating Raft or Wooden Crate under him, Pip drowns and the entire room state resets cleanly (`'pip-drown-reset'`).
4. **Slotted Grate (`'g'`) vs. Frosted Curling Filter:** Normal walk-pushing cannot push a Wooden Crate (`W`) or block onto a slotted `'g'` grate, and Pip cannot walk onto `'g'`. However, a **frost-coated Wooden Crate**, frozen Creature cube, or block sliding on slick frost (`;` frozen by `Ice`) **skims smoothly across `'g'` grates**—making frost + slide mandatory whenever a crate must cross a grated fence gap (`P05`, `P06`, `P42`).
5. **Hazard Safe-Tile Integrity (`safeX, safeY`):** Stepping into an active Laser beam or onto spikes (`!`) pops un-iced Pip back to `safeX, safeY`, and `safeX, safeY` is updated only at the end of a tick when Pip is neither on `'!'` nor intersected by any active Laser ray.
6. **Burning Crates Cannot Satisfy Permanent `'O'` Goal Plates:** A wooden crate (`W`) that is actively burning (`burnTicks > 0`) satisfies momentary `'Q'` switches while it burns away (`P18`), but **cannot satisfy a permanent `'O'` goal switch** unless it is doused in `;` shallow water (`P19`, `P37`), frost-armored with `Ice` (`P03`, `P06`), or shielded from the Laser (`P46`).

## Rube Goldberg & "Aha!" Compositions

| Pattern | Example Chain | Why It Rewards Creativity |
|---|---|---|
| **Laser Without Burning the Box** | `Laser must reach Beam Sensor, but its path crosses the wooden crate W you need on O → flood Sluice High (lifting W above the level-0 beam) or shield W behind a Mirror's back-face while moving it, then route the beam cleanly onto the sensor` | The unified Fire+Signal Laser makes every beam both the key *and* a hazard to your props. |
| **No-Fire-Bomb Flame Heist** | `Kit has NO Fire Bomb, yet a brazier T must be lit → push a Mirror (or rotate a 1×1 Turntable) to aim the room's Laser onto a wooden crate W → push the burning crate onto a Fan/Raft to ferry the stolen flame to T before W turns to ash!` | Withholding the "obvious" bomb turns an environmental hazard into your lighter. |
| **Self-Cryo (`Freeze the Mouse!`)** | `stand on frozen ';' frost upwind of spikes '!' and a Laser → drop Ice Bomb at your feet → Fan blows Ice-Pip across the spikes straight into the Laser, which thaws Pip unharmed past the barrier!` | Freezing yourself repurposes your own body as a spike-immune, laser-armored curling puck. |
| **Counter-Phase Multi-Pillar Escalator** | `Red L1 (0→1) and Blue L2 (1→2) stand side by side → throw item onto C while standing on L1 → C flips Red→Blue, lifting L1 to level 1 → step onto L2 at level 1 and flip Blue→Red → L2 lifts to level 2 terrace!` | Independent pillar triggers (`red`, `blue`, `switches`) and base tiers (`0→1`, `1→2`) turn columns into multi-stage vertical locks (`P43`, `P45`). |
| **Pillar-Lifted Periscope Prism** | `push 90° Mirror onto lowered 'switches' pillar L1 at level 0 → weight Q so L1 rises to level 1 → the lifted Mirror intercepts a level-1 Laser and bends it 90° into a level-1 Sensor!` | Combines horizontal prop pushing with vertical pillar actuation to solve 3D sightlines (`P44`). |
| **Roundhouse Turntable & Mobile Magnet/Cryo Cart** | `load Mine Cart with Magnet or Ice item → cart rolls onto 3×3 Turntable Dial → flip C to rotate cart + track 90° CW → reload cart down perpendicular branch so its moving Magnet aura drags a fenced Metal block or its Ice payload freezes a remote river & parks the cart on O!` | Elevates Mine Carts from simple linear couriers into multi-branch mobile actuators (`P47–P50`). |
| **`1 → 2 → 3` Escalation Triad** | `Room A: light T with Fire Bomb → Room B (Fire removed): bounce Laser off Mirror into T → Room C (crate W blocks Laser & is needed whole on O): frost-coat W with Ice so it survives crossing the Laser, seat W on O, and let Laser hit T!` | Lets the player enjoy the trivial win first, then progressively outsmarts them twice. |
| **Buoyancy State-Inversion** | `push crate onto submerged Q switch while Low → cross gate G → delayed bomb on sluice floods basin High → crate floats off Q (closing G behind you) while floating raft lifts you to level 1 O` | What holds Door 1 open prevents reaching Door 2 unless flipped asynchronously (*Sheh Rata* homage). |
| **Split-Track Asymmetric Gates** | `roll Bomb through slotted Bomb Grate onto 3×3 Turntable chute → squeeze Pip empty-handed through Mousehole → hit crystal C to rotate turntable 90° mid-roll → bomb exits into % wall` | Pip and the bomb take separate routes and collaborate across barriers. |
| **Melt-and-Sink vs. Melt-and-Float** | `freeze deep current → blast-shove Stone P and push Wooden W onto ice → rotate Laser to melt ice → Stone P sinks onto underwater Q switch while Wooden W floats downriver as a bridge` | Opposite buoyancy fates from one melt action. |
| **3×3 Turntable Leverage Swap** | `wooden crate is pinned against a wall on the wrong side to push → push it onto 3×3 Turntable & stand beside it → delayed blast flips C, rotating Pip + crate 90° → push crate off along new axis` | Solves classic push-block corner-lock via spatial rotation rather than brute shoves. |
| **Raft Recoil & Rock Mooring** | `spawn Rock block in deep pond as a mooring stop → board Floating Raft → drop Bomb on stern (or toggle Fan) to propel raft across pond until arrested by Rock block beside level-1 dock` | Curling physics on open water, using your own blast or fan lee as propulsion and brake. |
| **Delayed Chute & Crystal Flip** | `drop Bomb down chute → cross lowered barrier while fuse ticks → blast flips C behind you` | Classic timed commitment across a state toggle. |
| **Temporary Crystal Backstop** | `flip C to raise R peg → blast-shove block against R → flip C → shove onto O` | Turns a barrier peg into a removable curling stop. |
| **Mid-Chute Magnetic Curve** | `Bomb rolls down chute → Magnet Bomb behind fence curves it 90° into side % wall` | Continuous physics vector deflection. |
| **Whirlwind Artillery & Rock Lee** | `Wind vortex catapults Bomb 4 tiles across chasm into Rock-sheltered calm pocket` | Combines long-range launch with wind-shadowing. |

---

## Proven 50-Room Primitive Suite (`P01–P50`, Critic-Certified in `tools/puzzle-lab/`)

All 50 primitive rooms in `tools/puzzle-lab/suitePartA.ts`, `tools/puzzle-lab/suitePartB.ts`, and `tools/puzzle-lab/suitePartC.ts` are solver-verified (`tests/puzzleSuite.test.ts`) with automated single-feature and kit-item ablation:

### Part A: Four `1 → 2 → 3` Escalation Triads (`P01–P12`)

| Room | Trial Name | Kit | Core Primitive / Escalation Rule |
|:-:|---|---|---|
| **P01** | *"Bring Your Own Match"* | `Bomb`, `Fire` | Tutorial baseline: clear `%` and light brazier `T` directly with `Fire`. |
| **P02** | *"No Match, Borrow the Ray"* | `Bomb` | `Fire` stripped: shove a `90°` Mirror into the wall Laser to bounce the ray into `T`. |
| **P03** | *"Spare the Messenger"* | `Ice` | Frost-coat wooden crate `W` with `Ice` (`1`-hit thermal armor) so it can be pushed across the active Laser without burning to weight `O`. |
| **P04** | *"Rock the Beam"* | `Rock` | Spawn a fireproof `Rock` shutter in the Laser lane to escort `W` unburned onto `O`; `W` then plugs the corridor, forcing Pip to return empty-handed via the Mousehole (`m`) and clear the shutter so the Laser hits its Sensor. |
| **P05** | *"One Box Too Few"* | `Ice`, `Rock` | Freeze `;` into slick frost and frost-coat `W` so it skims through the slotted `'g'` grate in the `'='` fence across the Laser into a `Rock` backstop on `O`. |
| **P06** | *"Coat of Rime"* | `Ice`, `Rock` | Dead-end overshoot pocket requires placing a `Rock` backstop on the far side of the `'g'` grate before frost-curling `W` across the Laser onto `O`. |
| **P07** | *"Roll the Thorns"* | `Wind` | Tutorial baseline: `1`-tile Roll-jump + Wind jump across narrow spikes (`!`). |
| **P08** | *"Too Wide to Roll"* | `Ice` | Freeze `;` channel into slick frost, then trigger `Self-Cryo` (`Ice-Pip`) in front of a Fan to slide unharmed across a `4`-tile spike hall. |
| **P09** | *"Shut the Shaft"* | `Ice`, `Rock` | An active cross-Laser sweeps the middle of the spike strip and would thaw `Ice-Pip` mid-spikes; drop a `Rock` shutter into the side shaft to eclipse the beam before sliding across as `Ice-Pip`. |
| **P10** | *"Float the Gap"* | `Bomb` | Push `W` into a dry `level 0` trench, flip the Sluice `High`, and walk across the floating `level 1` crate bridge to `O`. |
| **P11** | *"The Floating Switch"* | `Bomb` | *Sheh Rata* buoyancy state-inversion: `W` weights submerged `Q` while `Low` to hold `G` open; trigger a delayed Sluice flood after passing `G` so `W` floats off `Q` and lifts Pip's Raft to `level 1` `O`. |
| **P12** | *"Sink Stone, Float Pine"* | `Bomb`, `Ice` | Freeze deep water `~`, position heavy Stone `P` over a submerged `Q` plate and buoyant `W` over the bridge gap, then flip a `1 × 1` Turntable Laser to melt the ice: `P` sinks onto `Q` while `W` floats as a bridge! |

### Part B: 30 Core Composable Primitive Rooms (`P13–P42`)

| Room | Trial Name | Kit | Proven Causal Mechanism |
|:-:|---|---|---|
| **P13** | *"Empty Pockets"* | `Bomb` | Split-track routing: throw/roll item across `'='` / `'g'` onto a chute toward `C` while Pip squeezes empty-handed through Mousehole `m`. |
| **P14** | *"Bank Off the Cascade"* | `Bomb`, `Ice` | Freeze Waterfall Veil `\|` with `Ice` so a thrown item passes un-doused to `%`. |
| **P15** | *"Spring the Messenger"* | `Bomb` | Hop down one-way ledges, bounce an item off Spring Pad `J` up onto a `level 1` `Q` plate, and ride Pillar `L` back up. |
| **P16** | *"Two-Tier Handshake"* | `Bomb`, `Squeak` | Lure Brass Beetle onto `Q1` with `Squeak`, weight `Q2`, and ride risen Pillar `L` to `level 1` `O`. |
| **P17** | *"Rail Courier"* | `Bomb` | Load a **Mine Cart (`'cart'`)** on Cart Track `'t'` (`cart-load`) so it carries a live Bomb down the rail tunnel into `%` while Pip walks through the parallel Waterfall Veil `\|`. |
| **P18** | *"Burn-Away Timer"* | *Empty Kit* | Push `W` onto `Q1` *inside* an active Laser: while `W` burns (`2` ticks), it temporarily holds `Q1` (opening `G`) and blocks the Laser; once `W` burns to ash, the restored Laser hits its normal (non-inverted) Beam Sensor so Pip on `O` completes the solve! |
| **P19** | *"Snatch from the Ray"* | `Wind` | Push `W` into a Laser (igniting `W`), then use `Wind` to shove the burning crate onto `;` shallow water before it turns to ash, dousing it on `O` and clearing the Laser sightline. |
| **P20** | *"Spin to Unpin"* | `Bomb` | Push a wall-pinned `W` onto a `3 × 3` Turntable Dial, stand beside it, and flip `C` to rotate Pip + `W` `90°` CW onto the perpendicular push axis. |
| **P21** | *"Prism Backhand"* | `Bomb`, `Ice` | Push a `90°` Mirror so its fireproof rear shields `~`, freeze `~` to bring `W` across onto `O1`, then push the Mirror North out of the ray onto `O2` so the Laser hits `T`! |
| **P22** | *"Duck the Ray, Raise the Column"* | `Bomb` | Walk under a `level 1` Laser on `level 0` floor, then weight `Q` so Pillar `L` rises to `level 1` and blocks the inverted Beam Sensor. |
| **P23** | *"Fireproof Eclipse"* | `Bomb`, `Magnet` | Magnet-pull a fireproof Metal Block across a fence into a Laser ray, shielding `W` as you push `W` onto `O`. |
| **P24** | *"Stern Thruster"* | `Bomb`, `Rock` | Spawn a `Rock` mooring post in deep water `~` and use blast impulse / Raft movement to dock beside `O`. |
| **P25** | *"Puddle Maker"* | `Bomb`, `Ice` | Rotate a `1 × 1` Turntable Laser to melt indoor Ice `B` into `;` shallow water, rotate the Laser away, freeze `;` into slick frost, and curl `W` onto `O`. |
| **P26** | *"Flying Ember"* | `Rock` | Ignite `W` in a Laser, bounce the burning crate across a Spring Pad `J` into a Fan lane to light distant braziers `T`, and shutter the ray with `Rock`. |
| **P27** | *"Curveball in the Gale"* | `Bomb`, `Wind` | Pop `Wind` to leave a `5 s` vortex, then throw a Bomb into the vortex so it catapults downwind into `%`. |
| **P28** | *"Douse the Branch"* | `Bomb`, `Fire` | Light a branching `,` grass fuse toward `T`, then trigger the Sluice `High` after `T` lights to drown the branch running toward your `W` crate! |
| **P29** | *"Elevator on the Tide"* | `Bomb`, `Magnet` | Hop from a `level 1` terrace to throw a Magnet item onto `level 1` `Q` (pulling Metal onto `Q`), flood the Sluice `High` to float `W` into a `level 1` bridge, and cross to `O`. |
| **P30** | *"Mouse on the Rocks"* | `Ice`, `Rock` | Place a `Rock` backstop aligned with `O`, freeze `;` into slick frost, and slide `Ice-Pip` in front of a Fan across `!` spikes into the `Rock` stop. |
| **P31** | *"Beetle Curling"* | `Squeak`, `Ice`, `Rock` | Lure a Brass Beetle onto `;` with `Squeak`, freeze it into an `8`-tick sliding ice cube with `Ice`, and curl it into a `Rock` backstop on `O`. |
| **P32** | *"Four-Spoke Dispatch"* | `Bomb`, `Magnet` | Flip `C` to rotate a `3 × 3` Turntable chute `90°`, then curve a rolling item with a rail-mounted `Magnet` item onto `Q`. |
| **P33** | *"Mirror on the Merry-Go-Round"* | `Bomb`, `Ice` | Freeze `~` and push `W` across while a `3 × 3` Dial holds a Mirror's back-face to the Laser; then flip `C` to rotate the Mirror `90°` and reflect the Laser onto its Sensor. |
| **P34** | *"Vault the Beam"* | `Rock` | Block a Laser with a `Rock` shutter, push `W` onto Spring Pad `J1` to vault `W` over the `level 0` Laser onto `O1`, follow via `J2` to `O2`, so both `O` plates and the Sensor are satisfied. |
| **P35** | *"Tortoise Eclipse"* | `Magnet`, `Ice` | Use `Magnet` across a fence to stall an iron Rail Tortoise inside a Laser beam, casting a fireproof shadow while frost-sliding `W` past. |
| **P36** | *"Melt Your Tracks"* | `Bomb`, `Ice` | Freeze `~` to cross, then flip a `1 × 1` Turntable Laser to melt the ice bridge and hit the Sensor. |
| **P37** | *"Three Jobs for Pine"* | `Wind`, `Rock` | With `1`-tile/tick timed parity: place `Rock` to block a Fan, push `W` into a Laser (where `W` catches fire and ignites adjacent `,` grass toward `T`), and immediately `Wind`-shove burning `W` into `;` shallow water on `Q1` so `W` is doused and holds `G` open! |
| **P38** | *"Fire and Water"* | `Bomb`, `Ice` | *TotK* Tadarok homage: blast-shove Stone `P` to shield `W` from a Laser while freezing `~` into a bridge to `O`. |
| **P39** | *"The Ferryman's Paradox"* | `Wind`, `Rock` | Use `Rock` to block a Fan and `Wind` to jump across a pit after pushing `W` into a Laser to light `,` → `T`. |
| **P40** | *"Double Inverted Lock"* | `Bomb`, `Magnet` | Pull Metal into an inverted Laser Sensor while flipping `C` to rotate a second `1 × 1` Laser onto a normal Sensor. |
| **P41** | *"Cryo Relay"* | `Squeak`, `Ice` | Lure a Mimic Statue onto `Q` with `Squeak`, then freeze `;` and slide `Ice-Pip` across `!` spikes to `O`. |
| **P42** | *"Hands Off the Stick"* | `Bomb`, `Ice`, `Rock` | Slotted `'g'` grate in the `'='` fence blocks walk-pushing `W`: place a `Rock` backstop on `O1`, freeze `;` and frost-coat `W` with `Ice` so `W` skims through `'g'` onto `O1` (shielded from Laser `L1` by Mirror `m1`), then blast-shove `m1` North out of `L1` onto `O2` so `L1` lights `,` → `T`! |

### Part C: Multi-Pillar/Elevation (`P43–P46`) & Non-Trivial Mine Cart Rooms (`P47–P50`)

| Room | Trial Name | Kit | Proven Causal Mechanism |
|:-:|---|---|---|
| **P43** | *"Counter-Phase Escalator"* | `Bomb` | Two adjacent pillars with independent triggers and base tiers (`L1`: `0 → 1` on `blue`; `L2`: `1 → 2` on `red`). Stand on `L1`, throw a Bomb onto `C` (`red → blue`) to rise to `level 1`, step onto lowered `L2` (`level 1`), and throw a second Bomb onto `C` (`blue → red`) so `L2` lifts Pip to the `level 2` terrace and `O`! |
| **P44** | *"Periscope Prism"* | `Rock` | Push a `90°` Mirror (`nw`) onto a lowered `'switches'`-triggered Pillar `L1` (`level 0`). Place `Rock` on `Q` (`(8, 13)`): both `L1` and bridge pillar `L2` rise to `level 1`, lifting the Mirror into a `level 1` East Laser so it bends `90°` North into the `level 1` Sensor while Pip crosses `L2` to `O`! |
| **P45** | *"Three-Tier Cascade"* | `Bomb`, `Rock` | Full `0 → 1 → 2` height puzzle: push `W` onto `'switches'` Pillar `L1` (`0 → 1`), drop `Rock` on `Q` to lift `W` to `level 1`, climb `Red` Pillar `L2` (`0 → 1`) onto the `level 1` deck, push `W` off `L1` onto `Blue` Pillar `L3` (`1 → 2`), and throw a Bomb from the `level 1` deck onto `C` (`red → blue`) to lift `W` to `level 2` (blocking a `level 2` inverted Laser) while raising `Blue` Pillar `L4` (`1 → 2`) to walk to `level 2` `O`! |
| **P46** | *"Twin-Column Eclipse"* | `Bomb`, `Rock` | Push `W` onto `Blue` Pillar `L1` (`0 → 1`), flip `C` (`red → blue`) to lift `W` to `level 1`, climb `'switches'` Pillar `L2` (`0 → 1` via `Rock` on `Q`), and push `W` onto a `level 1` `O1` plate swept by a `level 1` Laser—only after raising `L1` / `L2` as a fireproof `level 1` column that eclipses the Laser (since a burning crate cannot satisfy `O1`!). |
| **P47** | *"Roundhouse Switch"* | `Bomb` | A Mine Cart sits on a north-south `'t'` track leading onto a `3 × 3` Turntable Dial (`(11, 11)`). Load the cart (`cart-load`) so it rolls onto the Dial and stops; throw a Bomb onto `C` to rotate the Dial, track, and cart `90°` CW (`S → E`), then load the rotated cart a second time so it rolls East down the branch spur into `%`! |
| **P48** | *"Douse the Express"* | `Bomb` | An East-bound `'t'` track passes straight through an active Waterfall Veil `\|` (which douses the cart's Bomb before it can reach `%`), and a `level 0` Laser crosses the exit corridor to an inverted Sensor. Throw a Bomb onto the Sluice switch (`(8, 9)`): flooding `High` **drains the Waterfall Veil** so the loaded Mine Cart carries its live Bomb dry through `\|` to blast `%`, and the fireproof iron cart parks at the end of the track *inside* the Laser ray—blocking the inverted Sensor so Pip can walk to `O`! |
| **P49** | *"Magnetic Boxcar"* | `Magnet` | A Metal Block sits behind an `'='` fence out of Pip's reach, `2` tiles away from `Q`. Load a **Magnet item** into the Mine Cart (`cart-load`): as the cart rolls East along the `'t'` track and parks at `(11, 10)`, its travelling Magnet aura drags the Metal Block across the fence onto `Q` (`(11, 8)`), opening `G`! |
| **P50** | *"Cryo Boxcar"* | `Ice` | A deep-water moat `~` blocks the East island, and two `O` plates (`O1` on the track end, `O2` on the island) must both be weighted. Load an **Ice item** into the Mine Cart (`cart-load`): the cart rolls along `'t'` to the river's edge, **parks directly on `O1`** (weighting `O1` permanently with its iron body!), and triggers its `3 × 3` Ice payload—freezing the deep-water moat into an ice bridge so Pip can walk across to `O2`! |

---

## Next Stage: Scaling From Single/Dual-Motif Primitives (`P01–P50`) to Whole-Screen `22 × 26` Machines (`ROADMAP.md` Phase 7.5)

With 50 single- and dual-motif primitives proven and playtested (`P01–P50` as our **Stage Library**), scaling up to full shrine and dungeon rooms follows **Phase 7.5 (`L1–L7`)** in [`ROADMAP.md`](ROADMAP.md):

1. **Unified Timings in Seconds (`L1` / `L6` Spec Table):**
   - `1` discrete lab tick = **`0.5 s`** of `60 Hz` game time (`30` frames).
   - **Bomb countdown:** `3.0 s` (`6` ticks; standardizing lab & `world.ts`).
   - **Fire / Wind / Rock / Ice trigger:** `1.0–1.5 s` (`2–3` ticks); **Magnet pull:** `3.0 s` (`6` ticks); **Squeak lure:** `5.0 s` (`10` ticks); **Wind whirlwind:** `5.0 s` (`10` ticks); **Self-Cryo (`Ice-Pip`):** `3.0 s` (`6` ticks); **Frozen creature cube:** `8.0 s` (`16` ticks); **Wooden crate burn duration:** `1.8 s` (`3–4` ticks).
   - **Critic slack check:** Every room reports its tightest timing window in seconds and leaves human thinking-pace slack (`≥ 0.5 s`).
2. **Hierarchical Stage Solver (`L2`):**
   - Partition the `14 × 18` interior into regions joined by gates (`=`, `'g'`, `'m'`, `'t'`, `R/U`, `G`, ledges, water basins), solving macro-moves within each region and searching across regions on abstract stage state so `15–25`-step, `3–5`-stage whole-screen machines certify in `< 5 s`.
3. **Intent-Aware Critic (`L3`):**
   - Each room declares its **intended solution** as named stages (`3–5` stages) plus **`1–3` tempting wrong plans** (naive attempts that must deterministically fail), verifies **Triad escalation** (Act II rejects Act I's solve; Act III rejects both), enforces the **Walk-Out reset check** (Principle 7) from every reachable state, and checks **Signal Legibility** (Principle 6).
4. **Whole-Screen `12 × 14+` Multi-Stage Composition & Campaign Placement (`L4–L5`):**
   - Chain `3–5` stage-library motifs (`P01–P50`) across the full `14 × 18` interior, starting with whole-screen Act III rooms for all four triads, a full-screen `P42` Grand Clockwork Synthesis, and one whole-screen room per primitive family, mapped directly to `R1–R6`, `T01–T30`, and Major Dungeon slots in [`DUNGEONS.md`](DUNGEONS.md) before backporting (`L6–L7`).

### Light, shadow and reflection

- **Dark rooms & HD-2D light pools:** Lit by braziers, `5 s` Fire patches, fuse
  sparks, laser rays, magnetic arcs, and Pip's moon-ivory lantern.
- **Wild spark ideas:** **Grand Finale 5-Stage Hands-Free Chain** (stage a Rock
  backstop, a flooded crate shutter, a Mirror prism, and a Magnet Bomb on a
  rail, then light one `,` fuse and watch the whole room solve itself); **Water
  reflection & shadow clues** using the real waterline mirror and shadow shaders.
