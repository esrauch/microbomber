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
4. **Continuous scrolling puzzle rooms (`1 × 1` up to `2 × 2`).** While the
   Overworld uses crisp `11 × 13` flip-screens, Single-Room Shrines and large
   Dungeon chambers can span `1 × 2`, `2 × 1` or `2 × 2` screens with smooth
   pixel-snapped camera follow so an entire Rube Goldberg chain plays out in one
   continuous room.
5. **Every state and wire is visible.** Lit or unlit, raised or lowered, magnetic
   `N` or `S`, and how long is left: a fuse spark races down its cord, a Squeak
   Bomb floats musical notes toward the creature it lures, a Magnet Bomb arcs
   blue-gold field lines to metal within reach, and a local signal runs along a
   carved floor rune trace that glows when live. (**Never** draw floor wires for
   room-global rules like Red/Blue crystal barriers.)
6. **No soft-locks, by construction (`tests/softlock.test.ts`).** Every
   consumable puzzle piece respawns on room entry, following a three-tier
   persistence contract:
   - **Permanent (save-wide):** `%` cracked walls/floors, `B` brambles and ice
     blocks, unlocked `D`/`K` doors, latched `solvedRooms`, and collected
     Buttons/Keys.
   - **Zone-visit (resets on leaving the Shrine or Dungeon):** `crystalColor`
     (`red` ↔ `blue`) and `magnetPolarity` (`north` ↔ `south`).
   - **Room-local (resets on room exit):** `W` wooden crates, `,` dry grass fuse
     lines, `Push blocks`, `Metal blocks`, `Iron spheres`, `Rock blocks`, frozen
     water and lava crusts, Clockwork Creature positions, and unlatched
     timed/ordered braziers.

   > **Open question (persistence):** Currently `src/game/world.ts` persists
   > broken `W` crates and burned `,` grass in `brokenTiles` / `burnedTiles`
   > alongside `%` walls. Switch `W` and `,` to room-local reset before building
   > rooms where a crate or grass fuse is a puzzle piece you can ruin (`Dev A2.5
   > Firebreak`, `Scaffold Stack`). Also confirm whether snuffed **Flame jets**
   > and cleared **Sand piles** stay cleared permanently per save or reset on
   > leaving the Dungeon.

## The model: things, movers, creatures, signals

- **Things** have a state: a crate is whole or burned; a brazier is lit or out;
  water is liquid or frozen; an iron block is free or magnetically pulled.
- **Movers** carry things around: slopes/chutes, currents, gust vents, magnetic
  rails, cycling/triggered platforms, glazed lava crust, blowholes, drop shafts.
- **Clockwork Creatures** act as autonomous moving puzzle pieces with a single
  deterministic rule (lured, mimic, rail-marcher, fuse-carrier).
- **Signals** flow from **sources** (a button is weighted, a brazier lights, a
  crystal or polarity switch flips, a vane spins) through optional **logic**
  (latch, timer, AND, sequence) to **sinks** (a shutter opens, a platform or
  bridge moves, a fan or flame jet toggles).

Compositions are written as Rube Goldberg chains:
`fuse line → burns rope → iron sphere drops onto chute → Magnet Bomb pulls it onto button → shutter opens`.

## Primitives

### Breakables & props (one-way or room-resettable changes)

| Primitive | Changed by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Cracked wall / floor plug (`%`)** | Bomb blast | ✅ | *Zelda 1*'s bombable walls (and floor plugs to the floor below in Rock Quarry). Always visibly seamed (`GAME.md` §7): we hide *how* to deliver the bomb, never *whether* it breaks. |
| **Wooden crate (`W`)** | Bomb (breaks), Fire (burns + spreads) | ✅ | Respawns on room exit so crate-weight or firebreak puzzles can never soft-lock. |
| **Brambles (`B`, outdoor)** | Fire, which also spreads | ✅ | Burnable obstacles in the *Oracle* games (Ember Seeds). Ours spread tile to tile. |
| **Ice block (`B`, Ice Cave)** | Fire (melts) | ✅ | The Ice Cave's version of brambles; meltwater, not ash. |
| **Sand pile** | Wind clears it; a Bomb only scatters it back | ✅ | Hides switches, magnetic rails and lift pads. The Moonlit Grotto's dig-it-up idea, done with wind. |
| **Suspended prop / hanging cage** | Fire burns its rope | ✅ | Drops a crate/iron sphere onto a floor button or chute (`Scaffold Stack`), or drops an iron cage into lava as a permanent bridge (`Chain Hoist`). |

### Terrain, barriers and liquids

| Primitive | States | Changed by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Low fence / balustrade (`=`)** | — | — | ✅ | Blocks walking and grounded rolling bombs; airborne **Thrown** bombs (`A → A`), blasts, gusts, magnetic pull and fire cross it. The primary separator between `B = Drop` and `A = Throw`. |
| **Pit (`^`)** | — | Rock (1-tile gap) | ✅ | Pops Pip back to the last safe tile (`0.35 s`, zero heart loss) and **swallows grounded bombs** without a blast; airborne thrown bombs, magnetic pulls across narrow channels, and blast-jumps pass over. |
| **Spikes (`!`)** | — | Rock (stepping stone) | ✅ | Knock Pip back to the near edge if walked onto; `B = Roll` crosses narrow `1`-tile strips unharmed during its middle `0.15 s` window. |
| **Still water (`~`)** | water ↔ ice | Ice freezes, Fire melts | ✅ | Blocks walking; **floats bombs in place** with a splash (stopping horizontal roll and dousing Fire's ground patch, while still letting a Bomb detonate against an adjacent shore switch or wall). Frozen **water** is normal walkable ice, **not** slick glaze. |
| **Moving water / currents (`1–4`)** | flowing ↔ frozen | Ice freezes, Fire melts | ✅ | Floats and carries bombs (`CURRENT_SPEED`): a bomb ferry. Freezing a current mid-drift locks a bomb or floating block on its mark. |
| **Shallow water (`;`)** | — | Rock (stepping stone) | ✅ | Walkable with wading ripples; puts out ground fire (a natural firebreak). |
| **Lava** | molten ↔ glazed crust | Ice crusts, Fire melts | ✅ | Fire Mountain's moat and rivers; crust holds until Fire melts it or you leave the room. |
| **Ice floor (glazed crust)** | — | — | ✅ | **Scoped strictly to frozen lava crust** in Fire Mountain, its Trial Shrines, Iron Tower `3F`, and the Sorcerer's Ice phase (`GAME.md` §4.5). Thrown/dropped bombs, blast-shoved blocks, and iron spheres **slide until they hit a backstop**. |
| **Flame jet** | firing on beat ↔ snuffed | Ice snuffs; Rock blocks stream | ✅ | Telegraphed vents firing in ripples or fast beats. Touching a flame jet pops Pip back to the safe tile; Ice puts a jet out; Rock shields a lane. |
| **Dry grass / powder trail (`,`)** | dry → burning → bare | Fire ignites; Ice / `;` cuts | ✅ | Fire spreads tile by tile up to `MAX_FIRE_GENERATION`, acting as a visible burning delay wire in Rube Goldberg chains. |
| **Terrace / ledge** | — | Wind (blast-jump up one tier) | ✅ | One-way drops you hop down freely and blast-jump back up with Wind. |
| **Mousehole** | — | — | ✅ | Only tiny Pip (or a chirping Squeak Bomb / Pack-Otter!) fits through; heavy bombs, blocks and large creatures cannot follow. |

### Movers

| Primitive | Behaviour | Changed by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Slope / chute (`n/s/e/w`)** | rolls grounded bombs and iron spheres downhill | — | ✅ | Bowling routes; a chute races the fuse (`SLOPE_ACCEL`, `SLOPE_MAX_SPEED`), and a **Magnet Bomb** beside a chute can pull a rolling bomb or sphere off into a side lane mid-run. |
| **Magnetic rail** | grooved iron floor track | Magnet Bomb snaps & glides along it; polarity switch reverses it | ✅ | A Rube Goldberg delivery track: throw a **Magnet Bomb** onto a rail and it motors around corners while its magnetic aura drags an adjacent metal block or iron sphere along a parallel lane. |
| **Platform, cycling** | moves on a fixed loop across pits/lava | — | ✅ | Ride it across pits, or set a live bomb / metal block on it and let it deliver. **Rule: never used in Wind Cliffs**—combining cross-gusts with moving platforms over pits is pure frustration; keep moving platforms in calm-air rooms. |
| **Platform, triggered** | moves when a signal arrives, then stays or returns | any source | ✅ | A sink: "light the brazier and the ferry platform slides across". **Never used in Wind Cliffs** (same anti-frustration rule). |
| **Fan / gust vent** | a steady wind lane in one direction | always on, or switched on/off | ✅ | Carries bombs, sand and light props; Pip walks normally. A **Rock block** creates calm air in its lee. |
| **Wind Bomb (`3 × 3` gust + `5 s` whirlwind)** | instant `3 × 3` push + `5 s` centre vortex (or early A-pop) | — | ✅ | Instant pop blast-jumps Pip `2` tiles / up `1` tier, clears sand and slides frozen cubes; the **`5 s` lingering whirlwind** catapults any Bomb thrown/dropped into it `3–4` tiles downwind across wide chasms. |
| **Vertical drop shaft** | harmlessly drops Pip, crates, spheres or bombs to `(x, y)` on the floor below | `%` floor plug (optional) | ✅ | Distinct from a Pit (`^`): Rock Quarry's `Rim Crossing` hub shaft and `Upper Terrace` drop. |
| **Blowhole** | a gust straight up, between floors | — | ✅ | Wind Cliffs' room 6: throw a bomb into the vent on `1F` to flip a switch on `2F` before you ever climb there. |
| **Lift** | carries Pip (and objects on its platform) between floors | a switch (often sand-buried or magnetic) | ✅ | Rock Quarry's cargo lift (`1F ↔ 2F`) and Iron Tower's central spine. |
| **Treadmill (conveyor)** | carries anything on it, one way | a switch reverses or stops it | 🤔 | *A Link to the Past*'s conveyor belts (Dark Palace). **Questionable / likely redundant:** we already have **five** "treadmill-in-effect" mechanics—**slopes/chutes**, **water currents**, **gust vents**, **glazed lava crust**, and **magnetic rails**—and each interacts natively with a specific bomb. Keep only if a Dungeon 999 prototype proves a unique puzzle role. |

### Objects & Clockwork Creatures

| Primitive | Moved / Actuated by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Push block (`P`, stone)** | **Bomb blasts** shove it `1` tile (slides on glaze) | ✅ | *Zelda 1*'s push block, moved by explosions rather than walking. Non-magnetic, anchored against wind. |
| **Metal block & Iron sphere** | **Magnet Bomb** pulls it `1–2` tiles toward itself while ticking; Bomb blast shoves it; sphere rolls down chutes & slides on glaze | ✅ | *Seasons*' Magnetic Gloves + *Breath of the Wild*'s metal cubes/balls, actuated by a placed **Magnet Bomb**: pull an iron sphere off a pedestal onto a chute, or drag a metal block across a `1`-tile rail gap onto a floor button. |
| **Rock block** | made by a Rock Bomb (`1` active at a time); shattered by Bomb; **anchored against wind, currents & magnets** | ✅ | *A Link to the Past*'s Cane of Somaria block, as a bomb: a weight, a glaze backstop, a `1`-tile stepping stone, a windbreak, a current dam, a dive-stopper. Making a second crumbles the first. |
| **Brass Beetle (Clockwork Creature)** | marches toward a chirping **Squeak Bomb**; dazed `5 s` by Squeak pop; frozen `8 s` into a sliding ice cube by **Ice** | ✅ | Replaces erratic slimes/bats: a wind-up beetle with twitching brass antennae. Lure it onto a distant floor button behind a fence with a **Squeak Bomb**, or freeze it mid-march with **Ice** and kick/gust the ice cube onto a switch. |
| **Mimic Statue (Armos)** | copies each tile step Pip takes (`N/S/E/W`) if its own way is free, or marches toward a **Squeak Bomb** | ✅ | *Oracle* Crown Dungeon / Explorer's Crypt mimic statues: guide it onto a twin button across a fence, or break synchronization by luring it with a Squeak Bomb while Pip walks free. |
| **Rail Tortoise / Iron Roller** | marches back and forth along a fixed track; **Magnet Bomb** pulls/stalls its iron shell; **Rock** blocks and reverses it | ✅ | A mobile iron shield and moving backstop on a predictable beat. |
| **Pack-Otter (Fuse-Carrier)** | snatches a bomb dropped by its runnel and carries it through a mousehole/pipe to a far chamber | ✅ | Crescent Cove's mischievous otters turned into a Rube Goldberg delivery partner. |
| **The bomb itself** | pulled (`A`), dropped (`B`), thrown (`A` over `=`), rolled, floated, shoved, magnetically pulled, catapulted | ✅ | Holds a momentary switch (`Q`) for one fuse, but is too light to latch a goal plate (`O`); **1st blast shoves** another live bomb (`SHOVE_BOMB_SPEED`, fuse clamped `≥ 0.35 s`) and **2nd blast chain-detonates** it. |

### 7 Bombs × Target interaction matrix

Every bomb has a sharp, non-overlapping primary job in the Rube Goldberg kit:

| Target | 0. Bomb | 1. Fire | 2. Squeak (`5 s` lure) | 3. Wind (`1.6 s` + vortex) | 4. Magnet (`3 s` pull) | 5. Ice (`3 × 3`) | 6. Rock (`2 s`) |
|---|---|---|---|---|---|---|---|
| **Cracked `%` wall/floor** | **Breaks** | — | — | — *(catapults Bomb)* | — *(pulls Bomb in)* | — | — |
| **Wooden crate `W` / Rope** | **Breaks crate** | **Burns crate & rope** | — | — | — | — | — |
| **Brambles / Ice block `B`** | — | **Burns / Melts** | — | — | — | — | — |
| **Sand pile** | Scatters, slumps | — | — | **Blows clear** | — | — | — |
| **Water `~` / Currents `1–4`** | Floats & explodes | Fizzles patch | Floats & chirps | — | — | **Freezes walkable** | Fills `1`-tile `;` shallow |
| **Lava / Flame jet** | Swallowed / — | Melts crust | — | — *(catapults over)* | — *(pulls metal over)* | **Glaze-crusts / Snuffs jet** | Blocks jet stream |
| **Crystal switch `C`** | **Flips** `R ↔ U` | **Flips** `R ↔ U` | — | — *(carries bombs in)* | — *(pulls sphere in)* | — | — |
| **Iron Polarity switch** | — | — | — | — | **Flips** `N ↔ S` | — | — |
| **Brazier `T` / Fuse `,`** | — | **Lights / Ignites** | — | Spins vanes | — | **Puts out / Cuts fuse** | Windbreak for `T` |
| **Stone Push block `P`** | **Shoves `1` tile** | — | — | — | — | — | Backstop |
| **Metal block / Iron sphere** | **Shoves `1` tile** | — | — | — | **Pulls `1–2` tiles toward bomb** | Slides on glaze | Backstop |
| **Rock block** | **Shatters** | — | — | Blocked (windbreak!) | — | — | **Spawns** (crumbles old) |
| **Clockwork Creature** | Shoves / triggers | — | **Lures (`5 s`) & dazes (`5 s`)** | Punts / slides frozen | Pulls Iron Tortoise | **Freezes `8 s` into ice cube** | Blocks path / reverses |

> **Open questions (for Dungeon 999 prototyping):**
> 1. **Magnet Bomb pull timing:** Should the Magnet Bomb pull aligned metal
>    blocks / iron spheres / live iron Bombs **continuously** while its `3 s`
>    fuse ticks (letting you pull a rolling bomb sideways mid-chute!), or in two
>    discrete `1`-tile tugs (on land + on pop)? Continuous pull with visible
>    magnetic field arcs feels much more physical and Rube Goldberg.
> 2. **Squeak Bomb through mouseholes:** Can Pip throw/roll a tiny **Squeak
>    Bomb** *through* a mousehole to lure a creature on the other side of a wall?
>    *(Letting only Pip and the mouse-shaped Squeak Bomb pass through mouseholes
>    is a great thematic fit!)*
> 3. **Moving a frozen creature (`Dev A4.6`):** Confirm in Dungeon 999 that once
>    **Ice** freezes a Brass Beetle into an `8 s` ice cube, Pip can **walk/roll-kick**
>    it (sliding it across floor/glaze onto a button), while `Bomb` or `Fire`
>    shatters/thaws it.

### Signal sources (switches)

| Primitive | Behaviour | Triggered by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Goal plate (`O`)** | latches when `room.condition` solves | Pip, any block/sphere, a lured or frozen Clockwork Creature (never a bomb) | ✅ | The room's finish line. A bomb is too light, so a throw over a fence can't solve a room by itself. |
| **Momentary switch (`Q`) + iron gate (`G`)** | every `G` lies flat exactly while every `Q` is weighted | Pip, a live bomb (`1` fuse), any block/sphere, a lured or frozen Clockwork Creature | ✅ | One switch, five ways to hold it: Pip's feet, a ticking bomb, a shoved stone block, a magnetically pulled iron sphere, or a Squeak-lured Brass Beetle. Pip is a weight too, but he has to be past the gate (Dungeon 999 trials 2 and 11). |
| **Crystal switch (`C`)** | flips red (`R`) ↔ blue (`U`) barriers across the Shrine/Dungeon | `Bomb` or `Fire` blast (or an iron sphere slammed into it) | ✅ | *A Link to the Past*'s crystal switches, triggered by delayed chute/current/chain reactions. |
| **Iron Polarity switch (`N/S`)** | flips magnetic rails, iron gates, or crane magnets | **Magnet Bomb** polarity pulse | ✅ | Gives the Magnet Bomb its own dedicated circuit switch that blasts can't brute-force. |
| **Brazier / torch (`T`)** | lit ↔ out; can be **timed** or **ordered** (`I → II → III`) | Fire lights; Ice puts out; gust lanes block | ✅ | *Oracle* torches lit with Fire or by a burning `,` grass fuse line arriving on a delay. |
| **Fuse line (`,`)** | burns from one end to the other, then fires its end | Fire at either end | ✅ | The visible timing wire of a Rube Goldberg room: light a long powder/grass trail, then run or set up the next stage while the spark travels. |
| **Wind vane** | spins while in a gust or `5 s` whirlwind | gust vents, Wind Bomb | ✅ | A switch only moving air can press (`Wind Cliffs Vane Hall`, `Iron Tower Gate`). |
| **Toggle lever / latching switch** | each strike flips on ↔ off | blast or sphere impact | 🤔 | If needed beyond `Crystal switch` (`C`) and `Polarity switch`, render as a distinct iron **lever**, never a second floor button. |

### Logic (between sources and sinks)

| Primitive | Behaviour | Status |
|---|---|:-:|
| **Latch** | once on, stays on (a solved room or multi-stage lock stays open) | ✅ |
| **Timer** | on for `N` seconds, shown by a draining floor rune line or flickering flame | ✅ |
| **AND (multi-button / dual-bolt door)** | all sources on at once (or both wing bolts released in `Iron Tower`) | ✅ |
| **Sequence (order)** | sources must fire in order (`I → II → III`); a wrong one fizzles and resets | ✅ |
| **OR** | any one source | 🤔 |
| **NOT (inverter)** | a door that *closes* when its button is pressed | 🤔 |

### Signal sinks

| Primitive | Status |
|---|:-:|
| Shutter (`S`) opens; key (`D`) or boss (`K`) door unlocks | ✅ |
| Barriers rise or fall (`R` / `U` crystal colours) | ✅ |
| Magnetic rail or crane reverses polarity (`N ↔ S`) | ✅ |
| Platform starts, stops or reverses *(never in Wind Cliffs)* | ✅ |
| Fan / gust vent or flame jet turns on/off | ✅ |
| Button / Key / Pickup unseals or spawns | ✅ |
| Bridge extends over a pit or lava channel | ✅ |
| Treadmill starts, stops or reverses *(questionable; see Movers)* | 🤔 |
| Water level rises or falls *(macro-dungeon gimmick candidate)* | 🤔 |

### Light and air

| Primitive | Status | Notes |
|---|:-:|---|
| **Dark room** | ✅ | Lit by braziers or a burning `5 s` Fire patch (`Pip`'s moon-ivory lantern keeps immediate footing visible). The Ice Cave's Wraith is translucent and immune in the dark until lured into or caught by brazier light. |
| **Light sources** | ✅ | Braziers, fire patches, fuse sparks, magnetic arcs, blast flashes, warp pads, Pip's lantern; the HD-2D lighting shader gives each a real shadow-casting pool of light. |

## Rube Goldberg Compositions

### ✅ Definitely in (readable 2- to 4-stage chains)

| Chain | Where |
|---|---|
| `chute → rolling bomb → cross lowered barrier while bomb rolls → crystal flips behind you` | Trial Shrines; Ice Cave & Rock Quarry |
| `crystal C → raises R peg as temporary backstop → blast-shove block against R → flip C → block rests on O` | Ice Cave & Trial Shrines |
| `Squeak Bomb behind fence → lures Brass Beetle onto O button → daze puff holds it 2.5s → shutter opens` | Relic Shrine 2 (`Chime Grotto`); Ice Cave |
| `Squeak Bomb lures Brass Beetle into lane → Ice Bomb freezes it into ice cube → kick/slide cube onto button` | Frost Hollow Trial Shrines; Ice Cave |
| `fuse line (,) → burns for 2s tohanging-cage rope → iron sphere drops onto chute → rolls into crystal` | Bramble Woods / Fire Mountain Trial Shrines |
| `Bomb rolls down N→S chute → Magnet Bomb across fence pulls it sideways mid-run → breaks side % wall` | Relic Shrine 4 (`Lodestone Vault`); Rock Quarry |
| `Magnet Bomb snaps onto mag-rail → glides round corner → magnetic aura drags metal block onto O button` | Quarry Hills Trial Shrines; Rock Quarry |
| `current carries Bomb → Ice Bomb freezes current mid-drift → Bomb stops on submerged button` | River Valley Trial Shrines; Dev A4.7 |
| `Wind whirlwind (2.5 s) → throw Bomb/Fire/Magnet in → catapulted 3–4 tiles across chasm` | Relic Shrine 3 (`Bellows Sanctum`); Rock Quarry & Fire Mountain |
| `glazed lava crust → blast-shove block or pull iron sphere → Rock block backstop arrests slide on O` | Fire Mountain `Ingot Press`; Iron Tower `Glaze Works` |
| `cycling platform → drop Squeak or Magnet Bomb on it → moving field lures beetle / pulls sphere across pit` | Calm-air Trial Shrines *(never Wind Cliffs)* |
| `Rock windbreak → calm air in gust lane → Bomb/Fire sits undisturbed → lights brazier or breaks %` | Relic Shrine 6 (`Cairn Sanctum`); Wind Cliffs |
| `blowhole on 1F → bomb carried up to 2F → flips 2F switch or lowers Rope Bridge` | Wind Cliffs `Blowhole` → `Rope Bridge` |

### 🤔 Maybe in (prototype in Dungeon 999 first)

| Chain | Why maybe |
|---|---|
| `treadmill → carries a bomb past a gap → crystal` | Overlaps slopes, currents, gusts, glaze and magnetic rails; test whether a dry belt adds anything those five don't. |
| `switch → water level falls → crystal above water now reachable → freeze the new surface` | Water levels (*Oracle of Ages* / *Ocarina*) are a strong macro-dungeon candidate if one wing of River Valley / Wind Cliffs is built round them. |
| `beam turret → blocked by Rock or reflected onto a sun switch` | Eye-beam turrets blocked by Rock are in `Dev A5.4`; reflective mirrors add another system—Iron Tower only if kept. |
| `turntable → rotates the room's chutes a quarter turn` | *Ages*' Moonlit Grotto wheel room; strong as a macro-dungeon hub, heavy to build. |
| `inverter door → standing on the button closes the exit` | Clever with a delayed fuse line or Squeak-lured beetle, but verify it reads clearly. |

### 🌀 Wild ideas (kept for the spark)

- **Grand Finale 5-Stage Rube Goldberg Room.** Set up a Rock backstop, a frozen
  current patch, and a Magnet Bomb on a rail, then light one `,` grass fuse line
  with Fire and watch the entire chain unlock the Sorcerer's sanctum door without
  touching the stick.
- **Reflection clues.** The water shader shows true mirrors: a rune or safe path
  visible only in its water reflection.
- **Shadow clues.** The lighting casts real shadows: light the right brazier and
  a pillar's shadow points at the secret wall.
