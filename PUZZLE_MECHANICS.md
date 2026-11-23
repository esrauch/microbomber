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
  magnetic rails, cycling/triggered platforms, buoyant rafts, slick frost/glaze,
  spring pads, raisable pillars, `1 × 1` & `3 × 3` `90°` turntables, blowholes,
  and drop shafts.
- **Scale & Material Filters** split Pip's route from a bomb's route: low fences
  (`=`, thrown bombs pass), slotted bomb grates (rolling bombs & rays pass, Pip
  blocked), mouseholes (Pip passes empty-handed, bombs blocked), and waterfall
  douse veils (Pip walks through, live bombs fizzle unless frozen).
- **Clockwork Creatures** act as autonomous moving puzzle pieces with a single
  deterministic rule (lured, mimic, rail-marcher, fuse-carrier).
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
|---|---|---|:-:|---|
| **Low fence / balustrade (`=`)** | — | — | ✅ | **Airborne Bomb-Only:** blocks Pip, crates, and grounded rolling bombs; **Thrown** bombs (`A → A`), blasts, fans, lasers, magnetic pull, and fire cross over it. |
| **Bomb grate / slotted bars** | — | — | ✅ | **Grounded Bomb-Only:** bars Pip, crates, blocks, and high throws; **rolling/sliding bombs**, blasts, fan gusts, magnetic pull, and lasers pass straight through the floor slots. |
| **Mousehole** | — | — | ✅ | **Mouse-Only (size filter):** tiny Pip squeezes through empty-handed (`heldBomb === null`); blocks carried/thrown/rolling bombs (except a Pack-Otter or chirping Squeak Bomb) and all crates/blocks. |
| **Waterfall douse veil** | cascading ↔ frozen wall | **Ice** freezes solid; sluice shuts off | ✅ | **Mouse-Only (fuse filter):** Pip walks/rolls through unharmed, **dousing any carried or thrown live bomb** on contact—unless frozen into a solid ice wall with **Ice** or drained at the sluice! |
| **Pit (`^`)** | — | **Rock** (`1`-tile plug); `B = Roll` leaps `1`-tile narrow gap | ✅ | Pops Pip back to the last safe tile (`0.35 s`) and **swallows grounded bombs**; crossed by `1`-tile Roll-jumps, Wind blast-jumps, Spring Pads, platforms, and thrown/catapulted bombs. |
| **Spikes (`!`) & Retractable (`X`)** | up ↔ sunk (`X` on `Q`) | **Rock** (stepping stone); `Q` sinks `X`; **Ice-Pip** slides over | ✅ | Knock un-iced Pip back to the near edge; crossed via `B = Roll` (`1`-tile), Rock stepping stones, or sliding across while encased in **Self-Cryo**! |
| **Deep water (`~`) & Currents (`1–4`)** | deep ↔ walkable ice (`3 × 3`); drains to `;` | **Ice** freezes; **Fire / Laser** melts; **Sluice** raises/drains | ✅ | Blocks walking; **floats bombs** (carrying them at `CURRENT_SPEED` on `1–4`), **floats wooden crates (`W`) into flush bridges**, and carries **Floating Rafts**. Heavy stone/iron blocks **sink** onto underwater switches (`Melt-and-Sink`), whereas wooden crates **float** free (`Melt-and-Float`). |
| **Shallow water (`;`)** | shallow ↔ **slick frost**; floods to `~` | **Ice** freezes to slick frost; **Fire / Laser** thaws; **Rock** steps; **Sluice** floods/drains | ✅ | Walkable with wading ripples; **douses ground fire and burning crates**; bombs sit without sinking. Freezing `;` creates **slick curling frost** where bombs, crates, blocks, frozen creatures, and **Ice-Pip** slide until hitting a backstop! |
| **Water level sluice (`Low ↔ High`)** | basin depth `0 ↔ +1` | Sluice switch / crystal / laser sensor | ✅ | *Ocarina* Water Temple + *BotW* Sheh Rata: flooding turns dry `0` → `;` and `;` → `~`, **floating wooden crates and rafts up `+1` elevation level** (bridging `level 1` cliffs, shuttering `level 1` lasers, *or* floating a buoyant crate *off* a submerged `Q` plate!). |
| **Lava & Glazed crust** | molten ↔ slick glaze | **Ice** crusts; **Fire / Laser** melts | ✅ | Fire Mountain's moat and rivers; glazed crust slides thrown/dropped bombs, blocks, and spheres until arrested by a backstop. |
| **Flame jet** | firing on beat ↔ snuffed | **Ice** snuffs; **Rock / Stone** blocks stream | ✅ | Telegraphed vents firing in ripples or beats; ignites wooden crates and `,` fuses along its tongue. |
| **Dry grass / powder trail (`,`)** | dry → burning → bare | **Fire / Laser / burning `W`** ignites; **Ice / `;` / flood** cuts | ✅ | Visible burning delay wire in Rube Goldberg chains (`MAX_FIRE_GENERATION`). |
| **Elevation (`0 / 1 / 2`), Ledges (`H`) & Ramps (`n/s/e/w`)** | — | **Wind** or **Spring Pad** climbs `+1` tier | ✅ | `ELEVATION.md`: cardinal push hops Pip down S/E/W ledges; bombs roll off ledges (`-1` level) and bounce off cliff faces from below; ramps carry Pip up and accelerate bombs downhill. |

### Movers, rotators, beams and platforms

| Primitive | Behaviour | Changed by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Slope / chute (`n/s/e/w`)** | rolls grounded bombs, spheres, and **Ice-Pip** downhill | **Turntable** rotates elbow chutes `90°` | ✅ | Bowling routes; a **Magnet Bomb** beside a chute pulls a rolling bomb or sphere sideways into a branch lane mid-run. |
| **Raisable floor pillar (`L`)** | flush floor (`0`) ↔ solid `+1` column (`1.2 s` travel) | `Q` switches, `C` crystal colour, or clock (`ELEVATION.md` §8) | ✅ | Lifts Pip, ticking bombs, crates, blocks, and creatures up `+1` level; while risen, acts as high ground from above and a solid wall/laser-blocker/windbreak from below. |
| **Spring pad (bounce tile)** | launches Pip, grounded bombs, or pushed crates `2` tiles forward and up to `+1` level | **Turntable** or switch (if directional) | ✅ | *Seasons* trampolines: vaults Pip or a ticking bomb over a fence/laser/gap or up onto a `level 1` terrace without needing a Wind Bomb. |
| **Fan / gust vent** | continuous directional wind lane (`N/S/E/W`) at its elevation tier | always on, switch-gated, or **Turntable**-rotated | ✅ | Pushes grounded/airborne bombs, floating crates & **Rafts** on water, frosted cubes & **Ice-Pip** on slick frost, and flame sparks; normal Pip walks against it. Any solid block, crate, Rock block, or risen pillar casts a **calm lee** behind it. |
| **Laser (Unified Fire + Signal Beam)** | one continuous ray (`N/S/E/W`) at elevation `0`, `1`, or `2` that **both** powers **Beam Sensors** *and* burns/melts everything flammable/frozen in its path | blocked by fireproof solids (`P`, Metal, Rock, Mirror back, risen `L`); bent `90°` by **Mirrors** | ✅ | **One beam, double-edged rule:** every Laser powers any sensor it reaches *while simultaneously* igniting wooden crates & `,` fuses, melting ice, thawing frozen creatures/**Ice-Pip**, and popping un-iced Pip back—so routing a Laser to its goal *without* burning the crate or bridge you need is an automatic puzzle! |
| **Floating raft (pontoon)** | `1 × 1` or `2 × 2` buoyant deck on deep water (`~`) | propelled by **Fans**, **Wind**, **Currents**, or **Bomb blast recoil**; rises `+1` level when flooded | ✅ | Ferries Pip, crates, blocks, and ticking bombs from pier to pier across deep basins; stops cleanly against docks, stones, or a **Rock block** anchor. |
| **Platform (cycling or triggered)** | moves along an aerial/water track | clock or any signal source | ✅ | Carries Pip, live bombs, blocks, crates, or laser-blocking shields across chasms (*never combined with cross-winds over pits*). |
| **`90°` Turntables (`1 × 1` Mount & `3 × 3` Floor Dial)** | rotates `90°` CW per pulse | `C` crystal flip, polarity pulse, or Beam Sensor | ✅ | **Two footprints:** `1 × 1` mounts rotate a single Fan, Laser, `90°` Mirror, or Elbow Chute; `3 × 3` floor dials rotate multi-tile tracks, L-bridges, **and any Pip/crate/block standing on the dial** (swapping which side of a wall-pinned crate Pip can push!). |
| **Magnetic rail** | grooved iron floor track | **Magnet Bomb** snaps & glides along it; polarity reverses | ✅ | Motors a Magnet Bomb around corners while its aura drags an adjacent metal block, iron sphere, or live iron Bomb along a parallel lane. |
| **Wind Bomb (`3 × 3` gust + `5 s` whirlwind)** | instant `3 × 3` push + `+1` tier blast-jump + `5 s` vortex | — | ✅ | Blast-jumps Pip up `1` level or across `2` tiles, propels rafts, clears sand, and leaves a **`5 s` whirlwind** that catapults thrown bombs `3–4` tiles downwind. |
| **Vertical drop shaft & Blowhole** | cross-floor drop (`2F → 1F`) or updraft (`1F → 2F`) | `%` floor plug / switch | ✅ | Multi-floor dungeon connectors (`DUNGEONS.md`). |

### Objects, Self-Cryo & Clockwork Creatures

| Primitive | Moved / Actuated by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Push block (`P`, stone)** | **Bomb blasts** shove `1` tile (slides on frost/glaze); **sinks** in deep water | ✅ | Heavy, **fireproof**, laser-opaque, wind-proof: shields ice or wooden crates from the Laser without burning, and presses underwater switches when melted through ice. |
| **Mirror block (`90°` prism)** | **Walk-pushed** `1` tile (or `1 × 1` / `3 × 3` **Turntable**-mounted); **Bomb** shoves | ✅ | Reflects the Laser `90°` (redirecting *both* its signal and its heat!); fireproof and opaque from its two backed sides so its rear face doubles as a permanent heat shield! |
| **Metal block & Iron sphere** | **Magnet Bomb** pulls continuously; **Bomb** shoves; sphere rolls down chutes & slides on frost/glaze; **sinks** in deep water | ✅ | Fireproof laser/wind shield that can be slid remotely across grates/fences by magnetism or sunk onto underwater plates. |
| **Rock block** | spawned by **Rock Bomb** (`1` active at a time); shattered by **Bomb**; **fireproof & anchored against wind, currents, magnets & frost** | ✅ | Instant portable laser shutter, curling backstop, windbreak, raft mooring post, and `1`-tile shallow/spike/pit stepping stone. |
| **Self-Cryo (`Ice-Pip`) & Frosted Crates** | **Ice Bomb** encases **Pip**, a **Wooden Crate**, or a **Creature** in ice (**never** bombs!) | ✅ | **Freeze the mouse!** Encased in an ice cube (`~3 s`), **Ice-Pip** slides frictionlessly down chutes/frost/fan-lanes over spikes (`!`) and **absorbs one Laser/Fire hit** to thaw unharmed on the far side! Frosting a Wooden Crate (`W`) lets it slide on frost *and* gives it `1` temporary layer of fire/laser armor before catching fire! |
| **Brass Beetle** | marches toward **Squeak Bomb** (`5 s`); dazed `5 s` on pop; frozen `8 s` into sliding cube by **Ice** | ✅ | Lured across grates/mouse-tight ledges onto buttons, or frozen mid-march and slid across frost onto a plate. |
| **Mimic Statue (Armos)** | copies each step Pip takes (`N/S/E/W`), or marches toward a **Squeak Bomb** | ✅ | Desynchronized via walls, `3 × 3` turntables, elevation ledges, or a Squeak lure. |
| **Rail Tortoise** | marches along a fixed track; **Magnet** stalls/pulls its iron shell; **Rock** reverses it | ✅ | Moving fireproof laser shutter, iron bridge shell, and rhythmic backstop. |
| **Pack-Otter** | snatches a bomb by its runnel and carries it through a mousehole/waterway | ✅ | Carries live bombs through Mouse-only tunnels Pip can't bring a bomb through himself. |
| **The bomb itself** | pulled (`A`), dropped (`B`), thrown (`A` over `=`), rolled through grates, floated, blast-shoved, catapulted *(never frozen)* | ✅ | Holds `Q` (`1` fuse), too light for `O`; **1st blast shoves** another live bomb (`≥ 0.35 s` fuse), **2nd blast chain-detonates** it. |

### 7 Bombs × Target interaction matrix

Every bomb has a sharp, non-overlapping primary job in the Rube Goldberg kit (and withholding a bomb forces creative off-label substitutions):

| Target | 0. Bomb | 1. Fire | 2. Squeak (`5 s` lure) | 3. Wind (`1.6 s` + vortex) | 4. Magnet (`3 s` pull) | 5. Ice (`3 × 3`) | 6. Rock (`2 s`) |
|---|---|---|---|---|---|---|---|
| **Cracked `%` wall/floor** | **Breaks** | — | — | — *(catapults Bomb)* | — *(pulls Bomb in)* | — | — |
| **Pushable Wooden Crate `W`** | **Breaks** *(or shoves if 1 tile off)* | **Ignites (`1.8 s` burn + spreads)** | — | — | — | **Frost-coats (`1`-hit fire armor + slides!)** | Fireproof backstop / shield |
| **Brambles / Ice block `B`** | — | **Burns / Melts `B` → `;`** | — | — | — | — | — |
| **Deep water `~` / Currents `1–4`** | Floats & explodes (recoils raft) | Fizzles patch | Floats & chirps | Propels raft | — | **Freezes walkable (`3 × 3`)** | — |
| **Shallow water `;`** | Sits & explodes | Doused (`;` firebreak) | Sits & chirps | — | — | **Freezes into slick frost!** | Fills `1`-tile stepping stone |
| **Waterfall douse veil** | Doused on contact | Doused on contact | Doused *(or Otter carries)* | — | — | **Freezes into solid ice wall** | — |
| **Unified Laser (Fire + Signal)** | — | — | — | — | Pulls metal shutter in/out | Frost-coat absorbs beam briefly | **Blocks beam (fireproof shutter!)** |
| **Fan / Gust lane** | Blown downwind | Sparks blown downwind | Blown downwind | Cross-vortex redirect | — | **Ice-Pip** / cubes blown on frost | **Blocks gust (calm lee!)** |
| **Pip (the mouse!)** | `1`-tile knockback hop | — | — | **Blast-jumps `+1` tier / `2` tiles** | — | **Self-Cryo (`Ice-Pip` cube!)** | — |
| **Live ticking Bomb** | **1st shoves / 2nd chains** | — | — | **Catapults `3–4` tiles** | **Curves / pulls iron Bomb** | Stops drift if water freezes *(fuse keeps ticking)* | Backstop |
| **Crystal `C` / Sluice / Turntable** | **Flips / Rotates `90°`** | **Flips / Rotates `90°`** | — | — *(delivers bomb)* | **Flips Polarity `N ↔ S`** | — | — |
| **Brazier `T` / Fuse `,`** | — | **Lights / Ignites** | — | Spins wind vanes | — | **Snuffs `T` / Cuts `,`** | Windbreak / Laser shield |
| **Stone `P` / Mirror / Metal** | **Shoves `1` tile** | — | — | — | **Pulls Metal `1–2` tiles** | Slides on frost/glaze | Curling backstop |
| **Clockwork Creature** | Shoves | Thaws frozen cube | **Lures & dazes (`5 s`)** | Slides frozen cube | Stalls Rail Tortoise | **Freezes `8 s` into ice cube** | Reverses / blocks path |

### Signal sources, logic & sinks

- **Sources:** Goal plate (`O`, heavy weights & Pip only), Momentary switch (`Q`, weights + live bombs), Crystal (`C`), Iron Polarity (`N/S`), **Sluice wheel / pump switch** (`Low ↔ High` water), **Turntable trigger** (`+90°` CW on `1 × 1` mounts & `3 × 3` dials), **Beam Sensor** (lit while the unified Laser reaches it), Brazier (`T`, permanent/timed/ordered), Fuse line (`,`), Wind vane.
- **Logic:** Latch, Timer, AND (multi-plate / dual-sensor), Sequence (`I → II → III`), **Inverter (`NOT`)** (e.g. a gate held *open* only while a Beam Sensor is **eclipsed** or while a submerged `Q` switch is **un-floated**, creating natural state-inversion puzzles!).
- **Sinks:** Shutter (`S`), Crystal barriers (`R`/`U`), Water level (`Low ↔ High`), Pillar (`L` rise/sink), Turntable (`+90°`), Platform ferry, Fan on/off, Laser emitter shutter.

## Rube Goldberg & "Aha!" Compositions

| Pattern | Example Chain | Why It Rewards Creativity |
|---|---|---|
| **Laser Without Burning the Box** | `Laser must reach Beam Sensor, but its path crosses the wooden crate W you need on O → flood Sluice High (lifting W above the level-0 beam) or shield W behind a Mirror's back-face while moving it, then route the beam cleanly onto the sensor` | The unified Fire+Signal Laser makes every beam both the key *and* a hazard to your props. |
| **No-Fire-Bomb Flame Heist** | `Kit has NO Fire Bomb, yet a brazier T must be lit → push a Mirror (or rotate a 1×1 Turntable) to aim the room's Laser onto a wooden crate W → push the burning crate onto a Fan/Raft to ferry the stolen flame to T before W turns to ash!` | Withholding the "obvious" bomb turns an environmental hazard into your lighter. |
| **Self-Cryo (`Freeze the Mouse!`)** | `stand on frozen ';' frost upwind of spikes '!' and a Laser → drop Ice Bomb at your feet → Fan blows Ice-Pip across the spikes straight into the Laser, which thaws Pip unharmed past the barrier!` | Freezing yourself repurposes your own body as a spike-immune, laser-armored curling puck. |
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

### Light, shadow and reflection

- **Dark rooms & HD-2D light pools:** Lit by braziers, `5 s` Fire patches, fuse
  sparks, laser rays, magnetic arcs, and Pip's moon-ivory lantern.
- **Wild spark ideas:** **Grand Finale 5-Stage Hands-Free Chain** (stage a Rock
  backstop, a flooded crate shutter, a Mirror prism, and a Magnet Bomb on a
  rail, then light one `,` fuse and watch the whole room solve itself); **Water
  reflection & shadow clues** using the real waterline mirror and shadow shaders.
