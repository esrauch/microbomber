# microbomber: Game Design

A micro demake of, and homage to, the classic handheld top-down adventures and
*Breath of the Wild*'s physics shrines: a portrait action-puzzle adventure where
**your only tool is bombs**, **there is almost no combat**, and **every Shrine
and Dungeon is a clockwork Rube Goldberg puzzle box**.

## 1. Core pillars

| Pillar | Decision |
|---|---|
| **Puzzle-first, no filler combat** | There are **no erratic chasing trash mobs** (no bats, no "kill all enemies" doors). Every creature in a puzzle room is a deterministic **Clockwork Creature** (lured beetles, mimic statues, rail tortoises, pack-otters) that acts as a moving puzzle piece. |
| **Zero hearts anywhere** | **No health bar, no Heart Pieces, no Heart Containers.** Your own bomb blasts **never hurt you** (just a crisp `1`-tile knockback hop). Hazards (pits `^`, lava, deep water `~`, spikes `!`, flame jets) pop you back to the last safe ledge/threshold (`0.35 s`). Boss hits reset the current 1-of-3 puzzle phase rather than killing you. |
| **Hybrid camera (flip-screen Overworld, scrolling Shrines)** | The Overworld is a `10 × 10` grid of crisp `11 × 13`-tile (`176 × 208 px`) **flip-screens**. Inside **Shrines and Major Dungeon halls**, rooms can span **`1 × 1` (`11 × 13`) up to `1 × 2`, `2 × 1` or `2 × 2` screens** with smooth pixel-snapped camera follow so an entire multi-stage Rube Goldberg chain runs in one continuous room. |
| **Bombs only (7 kinds)** | Every switch, mechanism, creature and boss is solved with bombs: **Bomb, Fire, Squeak, Wind, Magnet, Ice, Rock**. |
| **BotW Shrines + 4 Major Dungeons** | **`100` Overworld screens** (`OVERWORLD.md`), **Grandma's Basement** (`5` rooms, Dungeon Zero), **`36` Single-Room Shrines** (`6` Button-gated **Relic Shrines** that unlock the bombs + `30` **Trial Shrines** that reward Grandma's Buttons), **`4` Major Multi-Room Dungeons** (`Ice Cave 10`, `Rock Quarry 15`, `Fire Mountain 20`, `Wind Cliffs 24`, each combining its region's bombs around a macro architectural gimmick to win one of the **4 Elemental Keys**), and the **Iron Tower** finale (`16` rooms, `DUNGEONS.md`). |
| **One currency: Grandma's Buttons** | **Grandma's Sewing Buttons (`36`)** are the single collectible currency. Every Trial Shrine awards `1` Button (plus `6` hidden in overworld/dungeon master puzzles). **Relic Shrines (bomb unlocks)** are gated by your **Button count**; once unlocked, that new Bomb gates the rest of the biome and its Major Dungeon. Grandma also stitches your **Magic Bomb Sack upgrades** at Button milestones. |
| **One voice** | You start **inside the Mouse House** with **Grandma**, the only character who speaks in the game. She tells you that **your brother is making trouble again**—he raised the Iron Tower overnight—and sends you down to **Grandma's Basement** for the **Magic Bomb Sack**. Talk to her any time you're home for advice and satchel stitching. |
| **Bomb economy** | **Bottomless Magic Bomb Sack**, limited only by how many bombs can be live at once (`2`, upgraded by Grandma to `3`, then `4`). Never grind bushes for ammo; never soft-lock. |
| **Saving** | **Autosave on every room change and pickup**; reopening the game puts you right where you were. |
| **Phone first** | Portrait, touch, a thumb on each side above a dedicated control band. Designed for five-minute sessions. |
| **Look** | Pure-2D Game Boy Color pixel art in the *Oracle of Ages* style (`16 × 16` tiles, `1px` ink outlines, RGB555 colours, 8 BG palettes of 4 colours per zone, 8 OBJ palettes of 6 colours) lit by an **HD-2D WebGL shader** (normal-mapped point lights, directional shadows, water mirror reflections, emissive-only bloom, and polished Rube Goldberg chain animations). |

## 2. Controls (portrait, two thumbs)

All controls live in a **band below the room**:

- **Left thumb:** a virtual analogue joystick (`360°` movement and roll
  direction).
- **Right thumb:** two context-sensitive buttons, **B** on the left and **A** on
  the right, plus a fast **Quick-Swap Bomb Pill** above them:
  - **When empty-handed (`B = Roll`, `A = Pull`):**
    - **B = Roll:** dashes about `2` tiles in `0.25 s` along the stick (or current
      facing when idle), crossing `1`-tile spike strips (`!`) and beat-timed flame
      gaps during its middle `0.15 s` window (`0.35 s` recovery). It lays no bomb.
    - **A = Pull:** pulls the equipped bomb from your Magic Bomb Sack and holds it
      **over Pip's head**. While held overhead, the fuse timer is paused and Pip's
      walking speed is halved.
  - **While holding a bomb overhead (`B = Drop`, `A = Throw`):**
    - **B = Drop:** sets the bomb on the ground just ahead of Pip and starts its
      fuse.
    - **A = Throw:** lobs the bomb in the nearest **orthogonal direction**. A
      thrown bomb hops over low `'='` fences and `1`-tile barriers, then rolls
      along the ground with friction, rebounds off walls, rolls down chutes,
      slides on glazed crust, rides magnetic rails, and drifts on currents.
- **Quick-Swap Pill (`Tap` / `Q` / `Tab`):** cycles directly through your
  unlocked bombs in play without pausing (even while holding a bomb overhead).
- **START:** pauses the game and opens the full **Spark Satchel** subscreen to
  inspect your bombs, Button count, and Elemental Keys (or equip **None**).

Dropping or throwing a bomb triggers a `0.7 s` cooldown before you can pull the
next.

**Input forgiveness and feel aids:**

- **Input buffer:** presses during a roll or the `0.7 s` bomb cooldown are
  buffered (`100–150 ms` window) and fire as soon as recovery or cooldown ends.
- **Magnetized pickups:** pickups drift toward Pip within about `1` tile.
- **Corner sliding:** walking or rolling into the edge of a doorway or block
  nudges you round it, so you never snag.
- **Generous timing:** at least `0.35 s` of slack on blast-jumps, timed
  braziers, delayed crystal crossings, and Rube Goldberg chain windows.

## 3. Story and setting: *The Tower of Cinderholm*

Overnight, the **Iron Tower** rose at the centre of **Cinderholm Isle**, and
clockwork contraptions sealed the island's four ancient domains.

You play **Pip**, waking up **inside the Mouse House** at the edge of
**Millbrook**. **Grandma** tells you that **your brother is making trouble
again**—he raided Grandpa's workshop notes, mastered the island's alchemical
bombs, and raised the Iron Tower himself, scattering Grandma's `36` **Sewing
Buttons** across the island's Shrines. She sends you down into **Grandma's
Basement** (**Dungeon Zero**) to fetch the **Magic Bomb Sack** and bring your
brother down from the Tower.

### The Progression Loop: Buttons → Relic Shrines → Biomes → Elemental Keys

1. **Trial Shrines award Grandma's Buttons:** Scattered across every biome are
   **`30` Single-Room Trial Shrines** (and `6` overworld master puzzles). Solving
   a Trial Shrine's Rube Goldberg puzzle awards **`1` Grandma's Button**.
2. **Button counts unlock the `6` Relic Shrines:** At the threshold of each new
   region stands a **Relic Shrine** sealed by a Button-Lock door (`2`, `5`, `10`,
   `15`, `21`, `28` Buttons). Reaching the required Button count opens the Relic
   Shrine, where you claim one of the **6 Special Bombs** (**Fire, Squeak, Wind,
   Magnet, Ice, Rock**).
3. **The new Bomb opens the rest of the biome & its Major Dungeon:** Every biome's
   inner roads, deeper Trial Shrines, and **Major Multi-Room Dungeon** are
   physically gated by that Bomb's mechanic.
4. **The `4` Major Dungeons award the `4` Elemental Keys:** Conquering the four
   multi-room regional capstones (**Ice Cave, Rock Quarry, Fire Mountain, Wind
   Cliffs**) earns the **Cinder Key, Zephyr Key, Rime Key, and Stone Key**, which
   unlock the fourfold seal on the **Iron Tower** (`4,2`).

### Overworld (`10 × 10` screens)

A ring of nine biomes round Millbrook Vale, with `36` Shrines (`6` Relic Shrines
+ `30` Trial Shrines) and `4` Major Dungeons (`★`), and the Iron Tower a short
walk north of the Mouse House (`⌂`). Full map and screen table: **`OVERWORLD.md`**.

```text
       0  1  2  3  4  5  6  7  8  9
  0    W  W  W  T  T  T  F  F  F  F     V Millbrook Vale (start, ⌂)
  1    W★ W  W  T  T★ T  F  F★ F  F     B Bramble Woods (Relic 1: Fire)
  2    W  W  Q  T  T  T  R  F  F  F     I Frost Hollow (Relic 2: Squeak; Ice Cave ★)
  3    W  Q  Q  V  T  V  V  R  F  C     Q Quarry Hills (Relic 3: Wind, Relic 4: Magnet; Rock Quarry ★)
  4    Q  Q  Q  V  V  V⌂ V  R  R  C     R River Valley (Relic 5: Ice)
  5    Q★ Q  Q  V  V  B  B  R  R  C     C Coast (Crescent Cove otter heist)
  6    Q  Q  Q  B  B  B  B  R  C  C     F Fire Mountain slopes (Fire Mountain ★)
  7    Q  Q  I  I  I  I★ B  R  C  C     W Wind Cliffs coast (Relic 6: Rock; Wind Cliffs ★)
  8    Q  I  I  I  I  I  I  R  C  C     T The Iron Plateau (Iron Tower ★)
  9    I  I  I  I  I  I  C  C  C  C
```

## 4. The 7 Bombs

Each bomb has **one primary rule**, taught in its **Relic Shrine**, and
**secondary Rube Goldberg interactions** discovered across Trial Shrines and
Major Dungeons. **Your own blasts never deal damage to you**—a close blast simply
gives Pip a `1`-tile knockback hop.

### 0. Bomb (starter — Grandma's Basement): it breaks & shoves

- **Fuse and shape:** `1.5 s`, a `+` cross reaching `1` tile (upgraded to `2` at
  `16` Buttons).
- **Primary:** breaks cracked `%` walls and cracked floor plugs; shoves heavy
  stone `Push blocks` (`P`) `1` tile along the blast axis.
- **Chain & physics rules:**
  - Flip crystal switches (`C`, `red ↔ blue`).
  - Weigh down a floor button (`O`) for `1.5 s` (one fuse duration).
  - **2-Hit Bomb Shove & Chain:** the `1st` blast to hit another live bomb
    **shoves** it across the floor (`SHOVE_BOMB_SPEED`, clamping its fuse to
    `≥ 0.35 s`); a `2nd` blast hitting an already-shoved bomb **chain-detonates**
    it immediately.

### 1. Fire Bomb (Relic Shrine 1 — `2` Buttons): it ignites & melts

- **Fuse and shape:** `1.3 s`, a `1`-tile burst that leaves a **`2.5 s` burning
  hearth patch** on its centre tile.
- **Primary:** lights torches and braziers (`T`: permanent, timed, or ordered
  `I → II → III`) and ignites dry-grass / powder fuse lines (`,`), which burn
  tile-by-tile (`MAX_FIRE_GENERATION`) to trigger distant mechanisms on a delay.
- **Interactions:** burns wooden crates (`W`), bramble thickets (`B`), and
  hanging-cage ropes (dropping suspended weights or bridges); melts ice blocks
  and frozen water/lava crust; illuminates dark rooms while burning.

### 2. Squeak Bomb / Lure Bomb (Relic Shrine 2 — `5` Buttons): it lures & dazes

- **Fuse and shape:** `2.5 s` wind-up clockwork chirp, ending in a **harmless
  confetti & acoustic stun puff** (`1.5`-tile radius; breaks nothing).
- **Primary: clockwork lure.** While ticking (`2.5 s`), its mechanical mouse
  chirp pulls **Clockwork Creatures** (Brass Beetles, waking Mimic Statues,
  Pack-Otters) and **Bosses** toward its tile—guiding them onto floor buttons
  (`O`), across ice chutes, into drop shafts, or under suspended cages.
- **Interactions:** when it pops at `2.5 s`, any creature within `1.5` tiles is
  **dazed in place for `2.5 s`** (holding down any button it stands on or leaving
  a miniboss open to a follow-up Bomb).

### 3. Wind Bomb (Relic Shrine 3 — `10` Buttons): it launches & catapults

- **Fuse and shape:** `0.8 s` (or pop early by pressing `A` again); emits a
  `3 × 3` gust that breaks nothing and leaves a **`2.5 s` spinning whirlwind
  vortex** on its centre tile.
- **Primary: blast-jump & whirlwind catapult.**
  - Standing on or beside a Wind Bomb when it pops **blast-jumps Pip `2` tiles**
    across pits/water or **up `1`-tier terrace ledges**.
  - Any Bomb, Fire, Squeak, or Magnet Bomb thrown or dropped into the **`2.5 s`
    lingering whirlwind vortex** is catapulted `3–4` tiles downwind across wide
    chasms.
- **Interactions:** blows sand piles clear (revealing buried buttons, rails, and
  lift switches), spins wind-vane switches, and slides frozen ice-cube creatures.

### 4. Magnet Bomb (Relic Shrine 4 — `15` Buttons): it attracts metal & rides rails

- **Fuse and shape:** `1.5 s` magnetic hum, ending in a non-destructive
  **magnetic polarity pulse** (`2`-tile radius).
- **Primary: continuous magnetic pull.** While ticking (`1.5 s`), it projects
  cardinal magnetic lines up to `3` tiles that **pull aligned metal blocks,
  rolling iron spheres, Rail Tortoises, and other live cast-iron Bombs** `1–2`
  tiles toward itself (across gaps, chutes, or glazed floors).
- **Interactions:**
  - Thrown onto a **magnetic floor rail**, the Magnet Bomb **snaps to the rail
    and glides along it** round corners like a motorized payload.
  - Its final polarity pulse toggles **iron polarity switches (`N ↔ S`)** and
    strips magnetic latches on iron gates.

### 5. Ice Bomb (Relic Shrine 5 — `21` Buttons): it freezes, glazes & snuffs

- **Fuse and shape:** `1.3 s`, a `3 × 3` ice nova.
- **Primary: phase-change liquids & stop currents.**
  - Freezes still water (`~`) and moving currents (`1–4`) into walkable ice
    until Fire melts it or you leave the room—**freezing a current mid-drift
    locks a floating bomb or block on its exact tile**.
  - Crusts molten lava into slick **glazed crust** (in Fire Mountain, Iron Tower
    `3F`, and the Sorcerer's Ice phase), where thrown bombs, shoved blocks, and
    iron spheres **slide frictionlessly like curling stones until they hit a
    backstop**.
- **Interactions:** snuffs flame jets and lit braziers (`T`); freezes Clockwork
  Creatures solid for `4 s` into **frictionless ice cubes** that Pip can kick or
  Wind can slide onto floor switches.

### 6. Rock Bomb (Relic Shrine 6 — `28` Buttons): it creates a solid block

- **Fuse and shape:** `1.0 s`; turns its centre tile into **one solid stone
  Rock block**. Making a new Rock block crumbles the old one; a plain **Bomb**
  blast shatters it.
- **Primary: portable architecture.**
  - **Permanent weight** on a floor button (`O`).
  - **Curling backstop** on glazed lava crust or at the end of a chute so a
    sliding block, bomb, or iron sphere stops dead on its target tile.
  - **Stepping stone** when dropped into a `1`-tile channel of shallow water
    (`;`), pit gap, or spikes (`!`).
  - **Immovable windbreak & current dam:** anchored against wind gusts and water
    currents, creating a pocket of calm air behind it where a bomb or flame can
    sit undisturbed, or dazing a diving/charging boss that slams into it.

### Signature Rube Goldberg Combinations

| Combo | Rube Goldberg Chain |
|---|---|
| **Squeak + Ice** | Lure a Brass Beetle onto a slick lane with a Squeak Bomb, then freeze it solid with Ice so it slides into a caged floor button. |
| **Wind + Bomb / Fire** | Pop a Wind Bomb to leave a `2.5 s` whirlwind vortex, then throw a Bomb or Fire Bomb into the vortex to catapult it `4` tiles across an abyss onto a crystal or brazier. |
| **Magnet + Chute / Glaze** | Roll a plain Bomb down a north–south chute, and drop a Magnet Bomb across a fence to pull the rolling bomb sideways mid-run into a side pocket. |
| **Ice + Rock** | Glaze a lava floor with Ice, place a Rock block mid-room as a curling backstop, and blast-shove a block so it slides against the Rock block right on top of a switch. |
| **Fire + Magnet + Bomb** | Light a `,` grass fuse line with Fire while a Magnet Bomb pulls an iron bridge segment into place just in time for a rolling Bomb to cross it. |

## 5. Shrines, Major Dungeons & Bosses

Full room-by-room plans and Trial Shrine catalogue: **`DUNGEONS.md`**.

### Two Tiers of Puzzle Spaces

1. **`36` Single-Room Shrines (`6` Relic Shrines + `30` Trial Shrines):**
   - Modelled on *Breath of the Wild*'s Ancient Shrines: each is a **single
     self-contained puzzle room** (`1 × 1` up to `2 × 2` screens with smooth
     camera scrolling) whose **Trial Name is its hint** (e.g., *"A Delayed
     Flip"*, *"Pull of the Rail"*, *"Curling Backstop"*).
   - **6 Relic Shrines** are gated by **Grandma's Button counts** (`2, 5, 10, 15,
     21, 28` Buttons); each awards a **new Bomb** and teaches its primary rule.
   - **30 Trial Shrines** require the region's Bomb(s) to reach and solve; each
     awards **`1` Grandma's Sewing Button**.
2. **`4` Major Multi-Room Dungeons + Grandma's Basement + Iron Tower:**
   - **Multi-bomb regional capstones** (`10 → 15 → 20 → 24` rooms) built around a
     **dungeon-wide multi-room / multi-floor architectural gimmick** (two-axis
     hubs, cross-floor drop shafts, blowholes, central lava islands).
   - **Minibosses are Living Puzzle Gates:** encountered on the main trunk in
     Act 1, completely immune to brute force, and solved in a 2-step Rube
     Goldberg puzzle using the region's bombs to unlock Act 2 and the midpoint
     warp pad.
   - **Bosses are 3-Phase Puzzle Duels** (zero player hearts; boss hits reset the
     current phase setup). Defeating a Major Dungeon's boss awards one of the
     **4 Elemental Keys** (**Cinder Key, Zephyr Key, Rime Key, Stone Key**).

### Major Dungeon Lineup

| # | Dungeon | Rooms | Bombs Combined | Macro Gimmick | Miniboss (Living Gate) | Boss (3-Phase Puzzle Duel) | Reward |
|:-:|---|:-:|---|---|---|---|:---:|
| 0 | **Grandma's Basement** | **5** (House + `B1F`) | Roll → **Bomb** | Cellar loop under the Mouse House | — | — | **Magic Bomb Sack (`Bomb`)** |
| 1 | **Ice Cave** | **10** (`1F`) | **Bomb + Fire + Squeak** | Dark glacier halls, crystal-peg backstops, lured Brass Beetles & timed/ordered braziers | **Ice Golem:** lure it onto a grate with Squeak, melt its glacier armour with Fire, crack its core with Bomb | **Ice Wraith:** translucent in the dark; light corner braziers with Fire (or lure it into the light pool with Squeak) and bomb it across 3 Ice Storm snuffs | **Cinder Key** |
| 2 | **Rock Quarry** | **15** (`2F` rim + `1F` pit) | **Bomb + Fire + Wind + Magnet** | `2F → 1F` central drop shaft, terraced cliffs, sand-buried switches, magnetic crane rails & cargo lift | **Mole Foreman:** pull his iron shield-cart off its rail with Magnet, blow his 4 sand-buried gantry switches clear with Wind, bomb him dazed | **Boulder Golem:** blast-jump terraces, use Magnet + Wind to topple it off the top ledge, bomb its exposed core | **Zephyr Key** |
| 3 | **Fire Mountain** | **20** (`1F + B1F`) | **Ice + Fire + Wind + Magnet** | Great Forge lava pool around a central island stair, glazed lava crust curling slides & beat-timed flame jets | **Fire Salamander:** quench its white-hot flame aura with Ice and slide a Bomb across glazed crust into its core | **Lava Drake:** crust bridges across its lava moat with Ice, freeze its open jaws mid-breath with Ice, slide/throw a Bomb into its throat | **Rime Key** |
| 4 | **Wind Cliffs** | **24** (`1F + 2F`) | **Rock + Magnet + Wind + Ice** | `1F` sea caves with an upward **Blowhole** to `2F` clifftops, cross-gust vents, magnetic spheres & Rock windbreaks | **Harpy:** raise a Rock pillar in its high-speed dive lane so it slams headfirst and drops dazed, then bomb it | **Storm Bird:** place Rock windbreaks to hold Bombs in its gale and deflect rolling cyclone orbs into its wings | **Stone Key** |
| 5 | **Iron Tower** | **16** (`1F–4F` `2 × 2` shaft) | **All 7 Bombs** | Four `2 × 2` floors around a central lift spine, opened by the **4 Elemental Keys** | **Iron Knight:** strip its magnetic plates with Magnet + Fire, daze its charge into a Rock pillar, bomb its core | **The Sorcerer (Your Brother):** cycles elemental bomb shields; counter each with its opposing bomb in a clockwork mirror duel | **Finale** |

## 6. Collectibles & Upgrades (The Button Economy)

With zero hearts, no money, and a bottomless Magic Bomb Sack, **every single
secret on Cinderholm Isle matters**:

- **Grandma's Sewing Buttons (`36` total):**
  - **`30`** from the `30` Single-Room **Trial Shrines** (`1` Button each).
  - **`6`** from Overworld & Dungeon master puzzles (including the Pack-Otter
    fuse heist at Crescent Cove).
  - **What Buttons unlock:**
    1. **The `6` Relic Shrines (New Bombs):** gated at **`2`, `5`, `10`, `15`,
       `21`, `28` Buttons**.
    2. **Grandma's Satchel Stitching (automatic milestones when you visit or hit
       the count):**
       - **`8` Buttons:** Live Bombs **`2 → 3`**.
       - **`16` Buttons:** Bomb Blast Reach **`1 → 2` tiles** (Alchemist's Seam).
       - **`24` Buttons:** Live Bombs **`3 → 4`**.
       - **`36` Buttons:** **Golden Thread Cape & Dungeon 999 Master Key**
         (unlocks the soot-black mousehole in Grandma's Basement to the Developer
         Dungeon).
- **The `4` Elemental Keys (`Cinder`, `Zephyr`, `Rime`, `Stone`):**
  - Won from the bosses of the `4` Major Dungeons; slotted into the **Fourfold
    Seal** at **Tower Courtyard (`4,2`)** to unseal the **Iron Tower**.
- **Mousehole Shortcuts:**
  - Permanent two-way micro-passages that only tiny Pip fits through, linking
    outer biomes back to Millbrook Vale.

## 7. Secrets, Signposting & Rube Goldberg Polish

- **Bombable walls (`%`) always show it:** crack lines and a distinct mortar
  seam. We hide *how* to deliver the bomb, never *whether* a wall breaks.
- **Visible floor rune wiring (local links only):** point-to-point links from a
  floor button, wind vane, or polarity switch to a specific shutter, bridge,
  platform, or lift run along carved stone rune traces that light up when
  energized.
- **Compelling Rube Goldberg visual animations:** every chain step has a clear
  anticipation, travel, and payoff beat—sparks racing along a burning `,` fuse
  line, magnetic field arcs tugging an iron sphere onto a rail, a Squeak Bomb's
  bouncing music notes turning a Brass Beetle's antennae, and glazed-crust curling
  trails with crisp hit-stop on impact.
- **No-Softlock Invariant (`tests/softlock.test.ts`):** certified by exhaustive
  state-space BFS + reverse reachability across keys, doors, crystal flips, and
  warps.
