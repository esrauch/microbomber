# Puzzle mechanics: the primitives and how they compose

The building blocks for every Shrine room (`DUNGEONS.md`), each testable on its
own in Dungeon 999. A puzzle is a few **primitives** joined by **signals**:
"a fuse line burns to a brazier, which starts a platform".

Each primitive is marked:
- ✅ **definitely in**: already in the game, or committed in `GAME.md` / `DUNGEONS.md`
- 🤔 **maybe in**: worth a Dungeon 999 prototype first
- 🌀 **wild idea**: interesting, unproven, probably cut

## Principles: homage, levelled up

The Zelda games in `inspiration/` built their dungeons from a small kit:
- bombable walls and push blocks (*Zelda 1*)
- crystal switches, conveyor belts and the Cane of Somaria's blocks (*A Link to the Past*)
- torches, mine carts and trampolines (*Oracle of Seasons*)
- Seed Shooter bank shots and the Switch Hook (*Oracle of Ages*)

We keep the **verbs** and modernise how they read and feel:

1. **One actuator: the bomb.** Every switch, door and mover answers to bombs
   (blast, fire, wind, ice, rock), not to a different item each time.
2. **Physics, not grid steps.** Bombs roll, bounce, slide and drift on real
   speeds (`BOMB_FRICTION`, `SLOPE_ACCEL`, `CURRENT_SPEED`), so solutions have
   some give: aim is forgiving, and the same room can be solved more than one
   way.
3. **Every state is visible.** Lit or unlit, raised or lowered, on or off, and
   how long is left: a fuse glows down, a timed brazier flickers faster near the
   end, a latched button stays sunk and changes colour. Nothing has to be
   remembered.
4. **Visible wiring (local links only).** A signal from a switch to a specific
   door, bridge, platform or lift runs along a muted stone rune trace in the
   floor (`decals` layer) that glows when live, so the player sees cause and
   effect instead of guessing which switch did what. **Never** draw floor wires
   for room-global rules: crystal switches (`C`) already colour-code every red
   (`R`) and blue (`U`) barrier in the room, and `clear-enemies` shutters read
   universally without floor clutter.
5. **Fair timing, no pixel tests.** Timers are long enough to read, and every
   hazard is telegraphed. Retrying is quick: leave and re-enter, and room-local
   pieces reset.
6. **No soft-locks, by construction (`tests/softlock.test.ts`).** Every
   consumable puzzle piece respawns on room entry, following a strict three-tier
   persistence contract:
   - **Permanent (save-wide):** `%` cracked walls/floors, `B` brambles and ice
     blocks, unlocked `D`/`K` doors, latched `solvedRooms`, fled Phase 1
     minibosses, and collected pickups/keys.
   - **Zone-visit (resets on leaving the Shrine):** `crystalColor` (`red` ↔
     `blue`), so one Shrine's crystal state never bleeds into another.
   - **Room-local (resets on room exit):** `W` wooden crates, `,` dry grass fuse
     lines, `Push blocks`, `Rock blocks`, frozen water and lava crusts, frozen
     enemies, and unlatched timed/ordered braziers.

   > **Open question (persistence):** Currently `src/game/world.ts` persists
   > broken `W` crates and burned `,` grass in `brokenTiles` / `burnedTiles`
   > alongside `%` walls. Before building rooms where a crate or grass line is a
   > puzzle piece you can ruin (`Dev A2.5 Firebreak`, `Scaffold Stack`), switch
   > `W` and `,` to room-local reset. Also decide whether snuffed **Flame jets**
   > and cleared **Sand piles** stay cleared permanently per save (rewarding
   > backtracking) or reset on leaving the Shrine.

## The model: things, movers, signals

- **Things** have a state: a crate is whole or broken; a brazier is lit or out.
- **Movers** carry things around: currents, fans, platforms, slopes, drops,
  glazed crust.
- **Signals** flow from **sources** (a button is pressed, a brazier lights, a
  crystal flips) through optional **logic** (latch, timer, AND, sequence) to
  **sinks** (a door opens, a platform starts, a fan turns on).

Compositions are written as chains: `fuse line → brazier → platform starts`.

## Primitives

### Breakables & props (one-way or resettable changes)

| Primitive | Changed by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Cracked wall / floor block (`%`)** | Bomb blast | ✅ | *Zelda 1*'s bombable walls (and floor holes to the floor below in Rock Quarry). Always visibly seamed (`GAME.md` §7): we hide *where*, never *whether*. |
| **Wooden crate (`W`)** | Bomb (breaks), Fire (burns) | ✅ | Two bombs, one obstacle: which one depends on what's behind or beside it. Respawns on room exit so crate puzzles can never soft-lock. |
| **Brambles (`B`, outdoor)** | Fire, which also spreads | ✅ | Burnable obstacles in the *Oracle* games (Ember Seeds). Ours spread tile to tile. |
| **Ice block (`B`, Ice Cave)** | Fire (melts) | ✅ | The Ice Cave's version of brambles; meltwater, not ash. |
| **Sand pile** | Wind clears it; a Bomb only scatters it back | ✅ | Hides switches, alcoves and lift pads. The Moonlit Grotto's dig-it-up idea, done with wind. |
| **Suspended prop / hanging cage** | Fire burns its rope | ✅ | Drops a crate onto a floor button (`Scaffold Stack`) or an iron cage into lava as a permanent bridge (`Chain Hoist`). |

### Terrain, barriers and liquids

| Primitive | States | Changed by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Low fence / balustrade (`=`)** | — | — | ✅ | Blocks walking and grounded rolling bombs; airborne **Thrown** bombs (`A → A`), blasts, gusts and fire cross it. The primary separator between `B = Drop` and `A = Throw`. |
| **Pit (`^`)** | — | Rock (1-tile gap) | ✅ | Hurts on fall (`1/2` heart) and **swallows grounded bombs** without a blast; airborne thrown bombs and blast-jumps pass over. |
| **Spikes (`!`)** | — | Rock (stepping stone) | ✅ | Hurt on contact; `B = Roll` i-frames (`0.15 s` middle window) cross narrow `1`-tile strips unharmed. |
| **Still water (`~`)** | water ↔ ice | Ice freezes, Fire melts | ✅ | Blocks walking; **floats bombs in place** with a splash (stopping horizontal roll and dousing Fire's ground patch, while still letting a Bomb detonate against an adjacent shore switch or wall). Frozen **water** is normal walkable ice, **not** slick glaze. |
| **Moving water / currents (`1–4`)** | flowing ↔ frozen | Ice freezes, Fire melts | ✅ | Floats and carries bombs (`CURRENT_SPEED`): a bomb ferry. Freezing a current mid-drift stops a bomb on its mark. |
| **Shallow water (`;`)** | — | Rock (stepping stone) | ✅ | Walkable with wading ripples; puts out ground fire (a natural firebreak). |
| **Lava** | molten ↔ glazed crust | Ice crusts, Fire melts | ✅ | Fire Mountain's moat and rivers; crust holds until Fire melts it or you leave the room (no hidden timer). |
| **Ice floor (glazed crust)** | — | — | ✅ | **Scoped strictly to frozen lava crust** in Fire Mountain, Iron Tower `3F`, and the Sorcerer's Ice phase (`GAME.md` §4.3). Thrown/dropped bombs and blast-shoved blocks **slide until they hit something**. *A Link to the Past*'s slippery floors, used to aim bombs and blocks rather than make walking miserable elsewhere. |
| **Flame jet** | firing on beat ↔ snuffed | Ice snuffs; Rock blocks stream | ✅ | Fire Mountain's second signature piece: telegraphed vents firing in ripples or fast beats. Ice puts a jet out; in `Iron Tower 3F` a crystal switch shifts its beat. |
| **Dry grass (`,`)** | dry → burning → bare | Fire | ✅ | Fire spreads tile by tile up to `MAX_FIRE_GENERATION`. Also acts as a visible physical fuse line. |
| **Terrace / ledge** | — | Wind (blast-jump up one tier) | ✅ | One-way drops you hop down freely and blast-jump back up with Wind, like the *Oracle* games' ledges with Roc's Feather. |
| **Mousehole** | — | — | ✅ | Only tiny Pip fits through: bombs, blocks and enemies cannot follow. |

### Movers

| Primitive | Behaviour | Changed by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Slope / chute (`n/s/e/w`)** | rolls grounded bombs downhill | — | ✅ | Bowling routes; a chute races the fuse (`SLOPE_ACCEL`, `SLOPE_MAX_SPEED`). |
| **Platform, cycling** | moves on a fixed loop across pits/lava | — | ✅ | Ride it across pits, or set a live bomb on it and let it deliver. **Rule: never used in Wind Cliffs**—combining cross-gusts with moving platforms over pits is pure frustration; keep moving platforms in calm-air rooms. |
| **Platform, triggered** | moves when a signal arrives, then stays or returns | any source | ✅ | A sink: "light the brazier and the ferry platform slides across". **Never used in Wind Cliffs** (same anti-frustration rule). |
| **Fan / gust vent** | a steady wind lane in one direction | always on, or switched on/off | ✅ | Carries bombs, sand and light props; Pip walks normally. A **Rock block** creates calm air in its lee. *Minish Cap*'s Gust Jar, turned into a room fixture. |
| **Wind Bomb (`3 × 3` gust + `2.5 s` whirlwind)** | instant `3 × 3` push + `2.5 s` centre vortex (or early A-pop) | — | ✅ | Instant pop blast-jumps Pip `2` tiles / up `1` tier, clears sand and punts enemies; the **`2.5 s` lingering whirlwind** catapults any Bomb or Fire Bomb thrown/dropped into it `3–4` tiles downwind across wide chasms. |
| **Vertical drop shaft** | harmlessly drops Pip, crates or bombs to `(x, y)` on the floor below | `%` floor plug (optional) | ✅ | Distinct from a damaging Pit (`^`): Rock Quarry's `Rim Crossing` hub shaft and `Upper Terrace` drop. |
| **Blowhole** | a gust straight up, between floors | — | ✅ | Wind Cliffs' room 6: throw a bomb into the vent on `1F` to flip a switch on `2F` before you ever climb there. |
| **Lift** | carries Pip between floors | a switch (often sand-buried) | ✅ | Rock Quarry's cargo lift (`1F ↔ 2F`) and Iron Tower's central spine. |
| **Treadmill (conveyor)** | carries anything on it, one way | a switch reverses or stops it | 🤔 | *A Link to the Past*'s conveyor belts (Dark Palace). **Questionable / likely redundant:** we already have **four** "treadmill-in-effect" mechanics—**slopes/chutes**, **water currents**, **gust vents**, and **glazed lava crust**—and each interacts natively with an elemental bomb. Keep only if a Dungeon 999 prototype proves a unique puzzle role none of those four can do cleanly. |

### Objects

| Primitive | Moved by | Status | Precedent and our twist |
|---|---|:-:|---|
| **Push block (`P`)** | **Bomb blasts** shove it `1` tile (slides on glaze) | ✅ | *Zelda 1*'s push block, but tiny Pip pushes with explosions, so aim and timing matter. |
| **Rock block** | made by a Rock Bomb (`1` active at a time); shoved `1` tile or shattered by Bomb; **anchored against wind & currents** | ✅ | *A Link to the Past*'s Cane of Somaria block, as a bomb: a weight, a glaze backstop, a `1`-tile stepping stone, a windbreak, a current dam, a beam/flame shield. Making a second crumbles the first. |
| **Frozen enemy** | frozen for `4 s` by Ice; slid by Pip's walk/roll kick or Wind; shattered by Bomb or Fire | ✅ | A temporary weight or battering ram that also counts as a defeat (with bonus heart drops when shattered). |
| **The bomb itself** | pulled (`A`), dropped (`B`), thrown (`A` over `=`), rolled, floated, shoved, catapulted | ✅ | Holds a floor button for one fuse; **1st blast shoves** another live bomb (`SHOVE_BOMB_SPEED`, fuse clamped `≥ 0.35 s`) and **2nd blast chain-detonates** it; thrown bombs detonate on enemy contact. |

> **Open question (wind vs heavy blocks):** `Rock blocks` must never drift in
> gusts or currents (that is their job in `Gust Gallery`, `Undertow`, `Storm
> Bird`, and `The Sorcerer`). Should standard stone `Push blocks` (`P`) *also*
> ignore wind (cleanest single rule: stone = heavy, gusts only move bombs, sand,
> enemies and light crates—updating Wind Cliffs' `Wreck Hold` to a sliding crate
> or bomb-in-wind puzzle), or should `P` slide in gusts while only `Rock` is
> rooted? Test in Dungeon 999 (`Wind Tunnel`).
>
> **Open question (moving a frozen enemy):** Because tiny Pip cannot walk-push
> stone blocks and `Bomb` / `Fire` shatter a frozen enemy (`Dev A4.6`, `B10`),
> verify in `A4.6` that letting Pip **walk/roll-kick a frozen enemy** like a
> frictionless ice cube (plus `Wind` shoving it) feels intuitive and readable.

### Bomb × Target interaction matrix

To keep systemic rules predictable ("only the obvious interactions", `GAME.md`
§4), every bomb's blast has a sharp, non-overlapping job:

| Target | Bomb | Fire | Wind (`0.8 s` + vortex) | Ice (`3 × 3`) | Rock (`1.0 s`) |
|---|---|---|---|---|---|
| **Cracked `%` wall / floor** | **Breaks** | — | — *(catapults Bomb)* | — | — |
| **Wooden crate `W`** | **Breaks** | **Burns** (+ spreads) | — | — | — |
| **Brambles / Ice block `B`** | — | **Burns / Melts** | — | — | — |
| **Sand pile** | Scatters, slumps back | — | **Blows clear** | — | — |
| **Water `~` / Currents `1–4`** | Floats & explodes | Fizzles ground patch | — | **Freezes walkable** | Fills `1`-tile `;` shallow |
| **Lava / Flame jet** | Swallowed / — | Melts crust | — *(catapults over)* | **Glaze-crusts / Snuffs jet** | Blocks jet stream |
| **Crystal switch `C`** | **Flips** `R ↔ U` | **Flips** `R ↔ U` | — *(carries bombs in)* | *Open Q below* | — |
| **Brazier `T` / Fuse `,`** | — | **Lights / Ignites** | Blows out flame? *(Open Q)* | **Puts out / Cuts fuse** | Windbreak for `T` |
| **Push block `P`** | **Shoves `1` tile** | — | *Open Q above* | — | — |
| **Rock block** | **Shatters** (or shoves?) | — | Blocked (windbreak!) | — | **Spawns** (crumbles old) |
| **Frozen enemy (`4 s`)** | **Shatters** (dmg + drop) | **Shatters** (dmg + drop) | **Slides / Punts** | Refreshes freeze | Backstop |

> **Open questions (matrix edge cases):**
> 1. **Bomb vs Rock block (`DUNGEONS.md` `B9` vs `line 97`):** Does a plain
>    `Bomb` blast **shatter** a Rock block on the first hit (`GAME.md` §4.4,
>    `Dev B9 Shatter`), or shove it `1` tile first and shatter on the second?
>    *(If it shatters on the first hit, Rock blocks are positioned directly by
>    where you drop/throw the Rock Bomb rather than blast-shoved afterward—much
>    faster in play, worth confirming in `A5.1–A5.6`.)*
> 2. **Crystal switch `C` vs non-blast bombs:** Keep `Wind` from flipping `C`
>    directly (otherwise Wind's `3 × 3`, `0.8 s` pop trivializes `Throw` crystal
>    puzzles). Confirm whether `Ice` (`3 × 3`) should flip `C` or leave `C`
>    strictly to `Bomb` and `Fire` blasts.
> 3. **Gusts vs lit braziers (`Dev B7 Shielded Flame`):** Ambient **gust vents**
>    prevent lighting / blow out an unshielded brazier inside their wind lane
>    until a `Rock` windbreak calms the air (`B7`, `Iron Tower Frozen Gust`),
>    whereas already-solved room braziers stay latched. Confirm whether a player's
>    own `Wind Bomb` also snuffs unlatched braziers or leaves them lit to avoid
>    accidental resets.

### Signal sources (switches)

| Primitive | Behaviour | Triggered by | Status | Precedent and our twist |
|---|---|---|:-:|---|
| **Floor button (`O`, momentary)** | on while weighted (or latched when `room.condition` solves) | Pip, a live bomb (`1` fuse), a block, a frozen enemy | ✅ | A bomb holds it for one fuse, a block forever: the same button gives two puzzles. |
| **Crystal switch (`C`)** | flips red (`R`) ↔ blue (`U`) barriers across the Shrine | `Bomb` or `Fire` blast | ✅ | *A Link to the Past*'s crystal switches. Ours flip from any `Bomb`/`Fire` blast, including chain reactions and bombs carried by chutes, currents or platforms. |
| **Brazier / torch (`T`)** | lit ↔ out; can be **timed** or **ordered** (`I → II → III`) | Fire lights; Ice puts out; gust lanes block | ✅ | *Oracle* torches lit with Ember Seeds. Ours can also be put *out* as a signal, and timed ones flicker faster near the end. |
| **Fuse line (`,`)** | burns from one end to the other, then fires its end | Fire at either end | ✅ | A physical wire you can see burning: dry grass, a powder trail, a rope. Cut it with shallow water or Ice; light it far from where it ends. |
| **Wind vane** | spins while in a gust or whirlwind | gust vents, Wind Bomb | ✅ | A switch only moving air can press (`Wind Cliffs Vane Hall`, `Iron Tower Gate`). |
| **Enemies cleared** | the room's enemies are gone | combat | ✅ | Use sparingly: combat as a lock, not a puzzle. |
| **Toggle lever / latching switch** | each strike/step flips on ↔ off | blast or step | 🤔 | **Questionable:** two floor-stepped buttons (`momentary` vs `toggle`) risk muddying `O` when `Crystal switch` (`C`) already owns binary toggling and `Floor button + Latch` covers stay-open doors. If kept after Dungeon 999 testing, render it as a distinct iron **lever** rather than a floor button. |

### Logic (between sources and sinks)

| Primitive | Behaviour | Status |
|---|---|:-:|
| **Latch** | once on, stays on (a solved room stays solved) | ✅ |
| **Timer** | on for `N` seconds, shown by a draining rune line or flickering flame | ✅ |
| **AND (multi-button / dual-bolt door)** | all sources on at once (or both wing bolts released in `Iron Tower`) | ✅ |
| **Sequence (order)** | sources must fire in order (`I → II → III`); a wrong one fizzles and resets | ✅ |
| **OR** | any one source | 🤔 |
| **NOT (inverter)** | a door that *closes* when its button is pressed | 🤔 |

### Signal sinks

| Primitive | Status |
|---|:-:|
| Shutter (`S`) opens; key (`D`) or boss (`K`) door unlocks | ✅ |
| Barriers rise or fall (`R` / `U` crystal colours) | ✅ |
| Platform starts, stops or reverses *(never in Wind Cliffs)* | ✅ |
| Fan / gust vent turns on or off, or changes direction | ✅ |
| Chest / pickup unseals or spawns | ✅ |
| Bridge extends over a pit or lava channel | ✅ |
| Treadmill starts, stops or reverses *(if treadmills survive prototyping)* | 🤔 |
| Water level rises or falls | 🤔 |

### Light and air

| Primitive | Status | Notes |
|---|:-:|---|
| **Dark room** | ✅ | Lit by braziers or a burning `2.5 s` Fire patch (`Pip`'s moon-ivory lantern keeps immediate footing visible). The Ice Cave's Wraith is translucent and immune in the dark. |
| **Light sources** | ✅ | Braziers, fire patches, fuse sparks, blast flashes, warp pads, Pip's lantern; the HD-2D lighting shader gives each a real shadow-casting pool of light. |

## Compositions

### ✅ Definitely in (simple, readable chains)

| Chain | Where |
|---|---|
| `bomb on button → shutter stays open for one fuse` | Dev A1.9; Wind Cliffs `Gust Gallery` / `Ruined Watchtower` |
| `roll across spikes → step on button → Small Key spawns` | Dev A0.1; Grandma's Basement `Root Pantry` |
| `fuse line → brazier → shutter` | Dev A2.4; Overworld `Meadow Fields` |
| `chute → rolling bomb → crystal → barrier drops` | Dev A1.4; Rock Quarry `Gravel Chutes` |
| `current → drifting bomb → cracked wall` | Dev A1.6; Wind Cliffs `Undertow` |
| `freeze the current → drifting bomb stops on a button` | Dev A4.7 |
| `Wind whirlwind (2.5 s) → throw Bomb/Fire in → catapulted 3–4 tiles across chasm` | Dev A3.4 / B2; Rock Quarry `Pulley Top` & `Gravel Seam`, Fire Mountain `Bellows Room` |
| `glazed crust → sliding block → Rock backstop → button` | Dev B5; Iron Tower `Glaze Works` |
| `ordered braziers (I → II → III) → Boss Key / bridge` | Dev A2.3; Ice Cave `Hall of Three Flames`, Iron Tower `Brazier Moat` |
| `cycling platform → bomb set on it → delivered over a pit → crystal` | Calm-air rooms only *(never Wind Cliffs)* |
| `sand pile → Wind → buried button revealed → lift runs` | Dev A3.2; Rock Quarry `Lift Room` |
| `Rock windbreak → calm air → bomb sits → cracked wall / button` | Dev A5.3; Wind Cliffs `Tide Hall` & `Gust Gallery` |
| `blowhole on 1F → bomb carried up to 2F → crystal / bridge switch` | Wind Cliffs `Blowhole` → `Rope Bridge` |

### 🤔 Maybe in (prototype in Dungeon 999 first)

| Chain | Why maybe |
|---|---|
| `treadmill → carries a bomb past a gap → crystal` | Overlaps slopes, currents, gusts and glaze; test whether a dry mechanical belt adds anything those four don't. |
| `blast → block onto treadmill → carried onto a button → platform starts` | Same treadmill overlap check; `glazed crust + blast` (`Fire Mountain Ingot Press`) already delivers sliding blocks onto buttons. |
| `lever / toggle switch → fan on → gust carries bombs to a target` | Only if a distinct blast-struck lever earns its keep alongside `Crystal switch` (`C`). |
| `switch → water level falls → crystal above water now reachable → freeze the new surface` | Water levels (*Oracle of Ages* water dungeons) are a big sink; worth it only if one area is built round them. |
| `beam turret → mirror → beam onto a brazier, which lights it` | Eye-beam turrets blocked by Rock are in `Dev A5.4`; reflective mirrors add a sixth system—maybe cut or Iron Tower only. |
| `bomb on a trampoline → bounces up a ledge → crystal on the ledge` | *Seasons*' trampolines (Explorer's Crypt). Fun, but overlaps Wind's whirlwind & blowhole. |
| `turntable → rotates the room's chutes a quarter turn` | *Ages*' Moonlit Grotto wheel room; strong as a hub, heavy to build. |
| `bomb dispenser (powder keg) → endless bombs in one room` | Lets a room exceed the `2–4` live-bomb cap; may muddy the satchel rule. |
| `inverter door → standing on the button closes the exit` | Clever, but "button closes door" reads backwards. |
| `steam → Fire on frozen water → a short-lived steam cloud that blocks a beam` | A Fire + Ice combination beyond the obvious ones; risks violating "only the obvious interactions". |
| `iron blocks → only a Bomb blast moves them, not Wind` | Unnecessary if standard stone `Push` and `Rock` blocks already ignore wind (see open question above). |

### 🌀 Wild ideas (probably cut, kept for the spark)

- **Rube Goldberg finale rooms.** One bomb sets off a whole room's chain
  (chute, fuse line, platform, fan, crystal), and you place three objects
  beforehand. The Iron Tower's last puzzle?
- **Reflection clues.** The water shader shows true mirrors: a rune readable only
  in its reflection, or a switch you aim at by its reflection.
- **Shadow clues.** The lighting casts real shadows: light the right brazier and
  a pillar's shadow points at the secret wall.
- **Drawn routes.** Trace a path on the touchscreen for a crawling bomb to
  follow (*Phantom Hourglass*'s Bombchus), the reserve "Crawler" from `GAME.md`.
- **Swap bomb.** Trades places with the block or pot it hits (*Ages*' Switch
  Hook), the reserve "Swap" from `GAME.md`.
- **Echo of the last ten seconds.** A ghost mouse replays your last moves and
  can hold a button for you (a nod to *Echoes of Wisdom*'s copies).
- **Weather rooms.** Wind direction changes on a slow cycle, so the same room
  plays differently each minute.

## Inspiration notes

Precedents above come from the walkthroughs and wikis in `inspiration/`:

- *A Link to the Past*: conveyor belts and crystal switches (`dark-palace.wiki`);
  Cane of Somaria blocks you can lift (`gameplay.wiki`).
- *Oracle of Seasons*: mine carts on switchable tracks
  (`eyeglass-lake-and-unicorn-s-cave.wiki`); a button that creates a trampoline
  (`graveyard-and-explorer-s-crypt.wiki`); Magnetic Gloves pulling a spiked ball
  into a boss (`bosses.wiki`).
- *Oracle of Ages*: the Switch Hook swapping places
  (`east-rolling-ridge-and-mermaid-s-cave.wiki`); Seed Shooter bank shots in the
  Moonlit Grotto (`crescent-island-and-moonlit-grotto.wiki`).
- *The Minish Cap*: the Gust Jar's wind (`bosses.wiki`).
- *Phantom Hourglass*: Bombchus that follow a drawn path (`goron-island.wiki`).
- *A Link Between Worlds*: the Tornado Rod lifting you over rolling logs
  (`enemies.wiki`).

**Homage check:** we take the verb (push, toggle, carry, light, slide) and
always change the situation: a bomb does the pushing, a gust does the carrying,
a fuse line is the wire, and the room shows its own logic.
