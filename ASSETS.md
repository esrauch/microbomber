# `microbomber` — GBC Seamless Pixel-Art & Rube Goldberg Visual Plan (`Oracle of Ages` / `Zelda DX`)

This plan defines the visual architecture, multi-tile kits, sprite specifications, and Rube Goldberg animation language for `microbomber`'s puzzle-first, zero-heart, 7-bomb design (`GAME.md`, `PUZZLE_MECHANICS.md`, `DUNGEONS.md`, `OVERWORLD.md`).

---

## 1. Core Architectural Decisions

### 1.1 `11 × 13` Base Viewport (`176 × 208` Logical Pixels) & Scrolling Shrine Rooms
- **Viewport size:** **`11 × 13` tiles (`176 × 208 px`)**—odd on both axes so doorways, bridges, and altars center cleanly at `(5, 6)`, with a full `2`-tile-deep perimeter leaving a `7 × 9` playable interior on `1 × 1` screens.
- **Hybrid Camera:**
  - **Overworld (`10 × 10` screens):** Crisp `11 × 13` (`1 × 1`) flip-screens.
  - **Single-Room Shrines & Large Dungeon Chambers:** Can span **`1 × 1` (`11 × 13`)**, **`1 × 2` (`11 × 26`)**, **`2 × 1` (`22 × 13`)**, or **`2 × 2` (`22 × 26`)** tiles with **integer pixel-snapped camera follow** clamped to the room bounds, so an entire 3- to 4-stage Rube Goldberg chain runs in one continuous room.

### 1.2 Authentic `2`-Tile-Deep Dungeon Walls & Recessed Archways
- Shrine and Dungeon perimeters use `OoA` / `LADX` **`2`-tile (`32px`) beveled wall construction**:
  - **Outer Ring (`dist = 0` from edge):** Flat dark ceiling/parapet cap with `45°` diagonal miter joints at the corners.
  - **Inner Ring (`dist = 1` from edge):** Sloped masonry wall face (`N, S, E, W` perspectives, `A/B` `32px` staggered stone courses) meeting the interior floor.
  - **Recessed `2`-Tile Doorway Tunnels:** Passages cut cleanly through both rings, framed by carved stone jambs and oriented **`N / S / E / W` archways**, Button-Lock Relic Doors, Small-Key Doors (`D`), Horned Boss Doors (`K`), and Iron Portcullises (`S`).

### 1.3 GBC Colour & Palette Rules (`gbcPalette.ts` & `gbcArt.test.ts`)
- **15-bit `RGB555` colour space** enforced across every palette (`isRgb555`).
- **Backgrounds (`BG`) — Strict `4` Colours per `8 × 8` Quarter-Tile (`≤ 8` Palettes per Zone):**
  - Preserves authentic GBC tile harmony and per-quarter `quads: [TL, TR, BL, BR]` assignment.
  - Terrain palettes (`floor`, `wall`, `foliage`, `water`, `wood`, `red`, `blue`, `steel`) use **chromatic darks** (deep forest pine, rich umber, deep plum-slate, abyssal navy) rather than jet black, so actors and Rube Goldberg chain sparks pop cleanly off painted ground.
- **Sprites (`OBJ`) — `5–6` Colours + Transparent (`'.'` + `'1'..'6'`, `≤ 8` Named Sprite Palettes):**
  - Up to `6` `RGB555` colours per sprite for rich `OoA`-style characters, all 7 bombs, Clockwork Creatures, and bosses.

### 1.4 Semantic Map Characters, Rube Goldberg Kits & Landmark `stamps[]`
- **Solid terrain (`blocks walk`):**
  - `'#'` — Cliff escarpment (Overworld) / `2`-tile beveled stone wall (Shrines & Dungeons)
  - `'Y'` — Forest tree (Overworld, auto-paired into `2 × 2` interlocking canopies and thickets)
- **Walkable ground & liquids:**
  - `'.'` — Meadow grass (Overworld) / Flagstone (Shrines & Dungeons)
  - `':'` — Trodden dirt trail / Village cobble path (`8 × 8` blob-edged)
  - `'_'` — Planked timber footbridge / Causeway stone deck
  - `','` — Dry grass / Alchemical powder fuse line (ignites and spreads fire tile-by-tile)
  - `'~'` / `';'` / `'1'..'4'` — Deep water (floats bombs), shallow water (walkable firebreak), and directional currents
  - `'n' | 's' | 'e' | 'w'` — Carved directional stone chutes (roll bombs and iron spheres downhill)
- **Rube Goldberg mechanism tiles & props:**
  - `'%'` (cracked wall/floor plug), `'^'` (pit), `'='` (low wood fence / stone balustrade), `'B'` (brambles / ice block), `'W'` (wooden crate), `'P'` (stone push-block), `'M'` (metal block / rolling iron sphere), `'C' / 'R' / 'U'` (crystal switch & red/blue barriers), `'T'` (brazier), `'D' / 'K' / 'S'` (doors & shutters), `'O'` (floor button), `'!'` (spikes), `'>'` (stairs / warp pad), magnetic floor rails, polarity switches (`N/S`), wind vanes, sand piles, flame jets, glazed lava crust, and mouseholes.
- **Local Floor Rune Traces (`decals` layer):**
  - Point-to-point stone inlay traces connecting a floor button (`O`), wind vane, or polarity switch to its target shutter, platform, or lift; glows with emissive G-buffer light when energized.

---

## 2. Sprites, All 7 Bombs, Clockwork Creatures & Rube Goldberg VFX (`OBJ`)

### 2.1 Pip (the Fuse Mouse)
- Pip is a **fuse mouse** whose tail is a fuse with a glowing spark (emissive in the G-buffer, like bomb fuses).
- **Poses (`MOUSE_*`, S/N/E, west = east flipped):** upright idle (with spark flicker and blink), 4-frame four-legged gallop, crouch transition, `B = Roll` somersault, overhead bomb lift/carry/throw, item-get fanfare pose, and a snappy `0.35 s` hazard hop-back pose (zero hearts, zero death screen).

### 2.2 The 7 Bombs & Signature Rube Goldberg VFX

| Bomb | Sprite (`10 × 10` in `16 × 16`) | Signature Rube Goldberg Animation & VFX |
|---|---|---|
| **0. Bomb** | Round dark-slate cast-iron body, steel collar, live gold rope spark | `4`-frame connected `+` cross blast (`blastHub`, `blastArmH/V`, `blastCapN/S/E/W`), shockwave ring, and radial spark particles. |
| **1. Fire Bomb** | Brass-necked ruby alchemical flask with swirling liquid flame | `1`-tile incandescent burst + `2.5 s` crackling **hearth patch**; ignites `,` fuse lines with a travelling spark front that races tile-to-tile. |
| **2. Squeak Bomb** | Brass wind-up clockwork mouse decoy with turning key & twitching ears | Bounces in place for `2.5 s` emitting floating **pixel music notes (`♪`)** that arc toward any lured Clockwork Creature; pops in a harmless golden confetti + acoustic ring that spins stars over dazed creatures for `2.5 s`. |
| **3. Wind Bomb** | Emerald-cyan glass orb with whirling brass vane fins | Instant `3 × 3` radial gale ring (blast-jumping Pip with a dust puff) + leaves a **`2.5 s` spinning whirlwind vortex** on its centre tile that visibly slingshots any bomb thrown into it `3–4` tiles downwind. |
| **4. Magnet Bomb** | Cobalt-and-brass lodestone sphere with horseshoe poles | While ticking (`1.5 s`), draws animated **blue-gold magnetic flux arcs** to any metal block, iron sphere, or cast-iron Bomb within `3` tiles, physically sliding them toward itself; sparks along grooved magnetic rails; pops with a crisp `N ↔ S` polarity ring. |
| **5. Ice Bomb** | Faceted glacier-cyan crystal prism with frost vapour | `3 × 3` crystalline frost nova; ripples water/currents into solid ice tiles, glazes molten lava with a mirror-slick sheen, snuffs flame jets into steam puffs, and encases Clockwork Creatures in a translucent `16 × 16` **sliding ice cube**. |
| **6. Rock Bomb** | Banded ochre-granite core with mason rune | Swells and locks into a beveled `16 × 16` **carved stone Rock block** with dust chips (and plays a 3-frame stone-crumble animation when a new Rock block replaces the old one or a Bomb shatters it). |

### 2.3 Clockwork Creatures (Replacing Trash-Mob Enemies) & Bosses

There are **no bats or random chasing slimes**. Every creature has crisp mechanical tells:

- **Grandma (`16 × 16`, `'mouse'` palette):** The only character who speaks; stands inside the Mouse House (`basement:1,3`) beside her sewing basket and button jar.
- **Brass Beetle (`16 × 16`, `'villager'` / `'powder'` palette):** Wind-up brass carapace with articulated legs and two copper antennae. When a **Squeak Bomb** chirps, a tiny `!` / `♪` icon pops above its head and its antennae point toward the decoy as it marches tile-by-tile onto switches or into traps.
- **Mimic Statue / Armos (`16 × 18`, `'steel'` / `'spectral'` palette):** Carved stone automaton whose eyes glow cyan when awake, stepping in exact cardinal lockstep (or reverse lockstep) with Pip until lured off-axis by a **Squeak Bomb**.
- **Rail Tortoise / Iron Roller (`16 × 16`, `'powder'` palette):** Riveted iron-shell tortoise that glides along grooved floor tracks; stalls or slides when tugged by a **Magnet Bomb** and reverses cleanly off a **Rock block**.
- **Pack-Otter (`16 × 18`, `'mouse'` palette):** Sleek coastal otter that pops out of runnels, snatches a dropped bomb over its head, and scurries through a mousehole pipe.
- **Miniboss Living Gates (`24 × 24` / `32 × 32`) & Puzzle Bosses (`32 × 32`):**
  - **Ice Golem** & **Ice Wraith** (*Ice Cave*)
  - **Mole Foreman** (on his iron mine-cart gantry) & **Boulder Golem** (*Rock Quarry*)
  - **Fire Salamander** & **Lava Drake** (*Fire Mountain*)
  - **Harpy** & **Storm Bird** (*Wind Cliffs*)
  - **Iron Knight** & **The Sorcerer (Your Brother)** (*Iron Tower*)

### 2.4 Pixel HUD & Control Icons (Zero Hearts!)
- **Top HUD (`#topbar`):**
  - **Grandma's Button Counter:** crisp pixel sewing-button icon (`HUD_BUTTON`) + `×N/36` count.
  - **Elemental Keys & Dungeon Keys:** `HUD_SMALL_KEY`, `HUD_BOSS_KEY`, and the **4 Elemental Key badges** (`HUD_CINDER_KEY`, `HUD_ZEPHYR_KEY`, `HUD_RIME_KEY`, `HUD_STONE_KEY`).
  - **Room / Shrine Trial Title & Minimap:** full non-truncated room name + trial hint and auto-drawn minimap.
- **Control Band (`#controls`):**
  - Virtual pixel stick, live satchel pips (`●●○`), tappable **Quick-Swap Bomb Pill** (`[ICON NAME ↻]`), `START`, and two-state arcade caps (`B·ROLL / B·DROP`, `A·PULL / A·THROW`).
