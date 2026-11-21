# microbomber: Game Design

A micro demake of, and homage to, the classic handheld top-down adventures: a
portrait, one-screen-per-room action-puzzle adventure where **your only tool is
bombs**. The closest touchstone is the Game Boy Color era (an item chain where
each new tool opens old places in new ways), shrunk to a phone and a 60–90
minute campaign.

## 1. Core pillars

| Pillar | Decision |
|---|---|
| **One screen per room** | The world is a grid of rooms, each exactly one phone screen. **No scrolling, ever**: walking off an edge cuts to the next room with a quick fade. |
| **Room size** | About **9 × 11 to 10 × 12 tiles**, settled on a real phone. The room sits *above* a dedicated control band, never under the thumbs. (The prototype is still 9 × 15.) |
| **Bombs only** | Every puzzle, fight and route is solved with bombs. Five kinds, earned in order. |
| **Campaign** | **60–90 minutes:** a `6 × 6` overworld (~36 screens), **4 Elemental Shrines** (9–12 rooms each) and **1 Final Spire** (8–10 rooms). |
| **World** | One interconnected island in a single state (no time or world swapping): all the depth comes from the bombs and how they combine. |
| **Tone** | An earnest storybook adventure with a light touch. Original world, characters, monsters and lore. |
| **Bomb economy** | **Bottomless satchel**, limited only by how many bombs can be live at once (`2`, upgradeable to `3`, then `4`). Never grind bushes for ammo; never soft-lock. |
| **Self-blast** | Your own blast does **no damage**, but its **knockback is real**: about `1` tile, so blasting yourself beside a pit, spikes or lava hurts. Enemy attacks and hazards deal real heart damage. |
| **Health and retry** | Start with **3 hearts**, up to **10** (4 boss Heart Containers, plus 6 Heart Shards at 2 per heart). On death, respawn at the **doorway of the room** where you fell. |
| **Saving** | **Autosave on every room change**; reopening the game puts you exactly where you were. |
| **Phone first** | Portrait, touch, a thumb on each side. Designed for five-minute sessions. |
| **Look** | Pure-2D Game Boy Color pixel art in the Oracle of Ages style, held to GBC colour rules: `16 × 16` tiles, `1px` ink outlines, RGB555 colours; each sprite uses one of 8 sprite palettes (3 colours plus transparent), each `8 × 8` quarter of a background tile uses one of its zone's 8 background palettes (4 colours). Recolours are palette swaps (`src/render/gbcPalette.ts`, `gbcArt.ts`). |

## 2. Controls (portrait, two thumbs)

All controls live in a **band below the room**:

- **Left thumb:** a virtual analogue joystick (`360°` movement, roll direction,
  and throw aim).
- **Right thumb:** two fixed-verb buttons, **B** on the left and **A** on the
  right:
  - **B = Roll:** dodges about `2` tiles in `0.25 s` along the stick (or current
    facing when idle), with invulnerability frames during the middle `0.15 s`
    and `0.35 s` recovery; automatically leaves the equipped bomb where the roll
    started whenever the satchel, cooldown, and selection allow.
  - **A = Pull out:**
    - **Tap** drops the equipped bomb at your feet.
    - **Hold** lifts a live bomb underfoot (or pulls out a fresh equipped bomb
      overhead while its fuse keeps burning); you can walk while carrying it.
    - **Release** throws it along the joystick's exact `360°` angle (or facing
      when idle) with a fixed lob. While carrying, a **dotted throw arc**
      previews the trajectory.
- **START:** pauses the game and picks the single equipped bomb (or **None** for
  pure dodge rolls without laying bombs).

Placing or pulling a fresh bomb triggers a `0.7 s` cooldown; lifting a bomb that
is already live underfoot does not.

**Input forgiveness and feel aids:**

- **Input buffer:** presses during roll recovery or the `0.7 s` bomb cooldown
  are buffered (`100–150 ms` window) and fire as soon as recovery or cooldown
  ends.
- **Magnetized pickups:** pickups drift toward Pip within about `1` tile.
- **Corner sliding:** walking or rolling into the edge of a doorway or block
  nudges you round it, so you never snag.
- **Generous timing:** at least `0.3 s` of slack on blast-jumps, timed braziers,
  and other timed challenges to forgive touch latency.

## 3. Story and setting: *The Rust of Cinderholm*

Overnight, the **Ironblight Spire** erupted at the centre of **Cinderholm Isle**,
pulsing a creeping red curse that rusted every sword, axe, shield and iron tool
to dust. Monsters poured from the island's four ancient sanctuaries, and the
village guards were left holding empty hilts.

Enter **Pip** (alternatives: Flint, Tallow), an apprentice alchemist-sapper whose
glass-and-brass **Spark Satchel** holds no iron at all: only alchemical bombs.
Guided by retired Master Sapper **Bram** of **Millbrook Village**, Pip ventures
into the four Elemental Shrines in order (**Fire → Air → Ice → Earth**),
reclaims each Shrine's **Primeval Core** (learning its bomb along the way), breaks
the fourfold seal on the Spire, and topples its architect, **Lord Verdigris**
(alternative: the Rust Regent).

### Overworld (`6 × 6` screens)

```text
      0           1           2           3           4           5
  ┌───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐
0 │ Windmill  │ Gusty     │ IRONBLIGHT│ Spire     │ Frozen    │ GLACIER   │
  │ Bluff     │ Crags     │ SPIRE (5) │ Courtyard │ Sluice    │ GROTTO (3)│
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
1 │ GALE      │ High      │ Spire     │ Millbrook │ River     │ Mist      │
  │ EYRIE (2) │ Bridge    │ Causeway  │ North     │ Ford      │ Falls     │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
2 │ Cliff     │ Old       │ Millbrook │ Millbrook │ Reed      │ Otter     │
  │ Overlook  │ Windmill  │ West      │ Square ★  │ Marsh     │ Shallows  │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
3 │ Quarry    │ Sunken    │ Orchard   │ Bramble   │ Driftwood │ CRESCENT  │
  │ Rim       │ Approach  │ Gate      │ Woods     │ Beach     │ COVE      │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
4 │ BASALT    │ Quarry    │ Scorched  │ Cinder    │ Tide      │ Thief     │
  │ VAULT (4) │ Lift      │ Clearing  │ Trail     │ Pools     │ Burrows   │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
5 │ Deep      │ Magma     │ Ruined    │ EMBER     │ South     │ Lighthouse│
  │ Seam      │ Cistern   │ Kiln      │ CRYPT (1) │ Cape      │ Point     │
  └───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘
```

Every two or three screens should hold something: a shard, a satchel upgrade,
a shortcut, a hint, or a character.

### Campaign flow

1. **Prologue: Millbrook and the Spire Courtyard** (Blackpowder Bomb). Wake in
   Bram's workshop (`3,2`), test the Blackpowder Bomb on cracked rubble behind
   the smithy, see the fourfold barrier seal the Spire (`2,0`), and blast open
   the cracked **Orchard Gate** (`2,3`).
2. **Chapter 1: Bramble Woods and Ember Crypt** (Fire). Rescue the groundskeeper
   cornered by moss-slimes, and bomb through a cracked crypt wall to unseal
   **Ember Crypt** (`3,5`). Reward: **Ember Bomb** and the first Core (Cinder).
3. **Chapter 2: the Old Windmill and Gale Eyrie** (Air). Burn away the brambles
   choking the **Old Windmill** (`1,2`) and light its boiler with an Ember Bomb,
   spinning up updraft vents along Windmill Bluff to reach **Gale Eyrie**
   (`0,1`). Reward: **Gale Bomb** and the second Core (Zephyr).
4. **Chapter 3: Crescent Cove and Glacier Grotto** (Ice). Gale-hop the broken
   bridge east to **Crescent Cove** (`5,3`), where a band of **Pack-Otters**
   steal the satchel's **fuses**: every bomb is a dud until you corner the otter
   holding its fuse, across `4` tight beach and burrow rooms, each recovered
   fuse helping you corner the next. Winning them back earns the ferryman's
   key north to **Glacier Grotto** (`5,0`). Reward: **Frost Bomb** and the third
   Core (Rime).
5. **Chapter 4: Frozen Sluice and Basalt Vault** (Earth). Freeze **River Ford**
   (`4,1`) and the flooded **Quarry Lift** (`1,4`) with Frost Bombs, then
   Gale-hop down the terraced quarry cliffs to **Basalt Vault** (`0,4`). Reward:
   **Basalt Bomb** and the fourth Core (Stone).
6. **Finale: Ironblight Spire** (all five bombs). Return to the **Spire
   Causeway** (`2,1`), open the four-element gate (light a brazier, spin a vane,
   freeze a moat, weight a pedestal), and climb `8–10` rooms of combined trials
   to face Lord Verdigris.

## 4. The bombs

Each bomb has **one primary rule**, taught at its Shrine, and **secondary uses
revealed later** as "aha" moments, never all up front. Every bomb works in both
puzzles and fights, and opens new overworld routes.

### 0. Blackpowder (starter): it breaks things

- **Fuse and shape:** `1.5 s`, a `+` cross reaching `1` tile (upgradeable to `2`).
- **Primary:** breaks cracked walls and cracked floor blocks.
- **Later:** toggles red/blue crystal switches (thrown across pits or fences);
  sets off any other bomb caught in its blast.
- **Combat:** `2` damage and knockback. **Impact detonation:** a *thrown*
  Blackpowder bomb goes off the moment it hits an enemy, so fights stay snappy;
  a *dropped* one keeps its fuse for puzzles and traps.

### 1. Ember (Fire): it sets things alight

- **Fuse and shape:** `1.3 s`, a `1`-tile burst that leaves a burning patch for
  `2.5 s`.
- **Primary:** lights torches and braziers (including timed and ordered sets).
- **Later:** burns brambles, thorn gates and wooden crates; melts ice blocks;
  lights dark rooms while it burns.
- **Combat:** burns away wooden shields and wrappings on armoured foes; the
  burning patch holds a chokepoint.

### 2. Gale (Air): its wind pushes things

- **Fuse and shape:** `0.8 s`, or pop it early with Throw; a `3 × 3` gust that
  breaks nothing.
- **Primary: blast-jump.** Standing on or beside a Gale Bomb when it pops
  launches you `2` tiles over pits, narrow water, toggle tiles and up one-tier
  ledges.
- **Later:** launches other live bombs, pots or blocks `3` tiles across chasms;
  spins wind-vane switches; clears poison fog.
- **Combat:** punts enemies `2–3` tiles, into pits or onto spikes; hops you over
  shockwaves and blade traps.

### 3. Frost (Ice): it freezes things

- **Fuse and shape:** `1.3 s`, a `3 × 3` frost nova.
- **Primary: freezes liquids.** Water in the blast becomes walkable ice for
  `10 s` (renewed by another Frost blast); lava crusts over safely for the same
  time.
- **Later:** glazes the floor so pushed blocks and thrown bombs **slide until
  they hit something**.
- **Combat:** freezes small and medium enemies solid for `4 s`, into pushable
  ice blocks: a temporary weight for a button, a battering ram, or something to
  shatter with Blackpowder or Ember for better heart drops.

### 4. Basalt (Earth): it makes a block

- **Fuse and shape:** `1.0 s`; turns its centre tile into **one solid, pushable
  basalt block**. Making a new block crumbles the old one; Blackpowder shatters
  it.
- **Primary:** a block wherever you need one: the extra weight for a button,
  the stopper for a sliding block, the shield against an eye-beam or flame jet.
- **Later:** dropped into a one-tile channel of shallow water or spikes, it
  becomes a stepping stone until you make another.
- **Combat:** portable cover from projectiles; charging enemies daze themselves
  against it.

### Combinations (Shrines 2–4 and the Spire)

| Combo | In puzzles and fights |
|---|---|
| **Frost + Basalt** | Glaze the floor, then place a basalt block as a backstop so a sliding block or bomb stops exactly on a button. |
| **Gale + Ember / Blackpowder** | Drop a live bomb, then pop a Gale Bomb behind it to fling it `4–5` tiles across a chasm onto a far cracked wall or unlit brazier. |
| **Gale + Basalt** | Make a basalt pillar mid-chasm, then blast-jump onto it and off again to cross `4` tiles. |
| **Frost + Ember** | Freeze a row of water, push a block across, then melt one tile with Ember to drop the block onto a submerged switch. |

### Reserve ideas (for playtesting or a secret post-game bomb)

1. **Ricochet:** glides fast and bounces off walls and angled blocks up to `3`
   times before going off, for hitting switches round corners. (Angled blocks
   may cover this without a sixth bomb.)
2. **Swap:** when it goes off, trades places with the pot, statue or enemy on
   its tile. (Overlaps Gale's pit-crossing.)
3. **Remote:** no fuse; sits until you trigger it or another blast hits it, for
   simultaneous switches and landmines.
4. **Crawler:** scurries straight ahead and slips through mouseholes too small
   for a thrown bomb.

## 5. Shrines and bosses

### Shrine template (9–12 rooms, no filler)

- **Automatic minimap:** visited rooms and locked doors appear in a small corner
  map, with the current objective ("Ember Crypt ▸ south-west"). No map or
  compass chests.
- **Act 1 (`4–5` rooms):** teaches the Shrine's gimmick with small keys, crystal
  barriers and earlier bombs, then a **miniboss** (which opens a warp back to
  the entrance) and the **new bomb's chest**.
- **Act 2 (`4–6` rooms):** a room that teaches the new bomb, then revisits `1–2`
  Act 1 rooms in a new light for a secret upgrade and the **Boss Key**, then a
  **puzzle boss**, then a **Heart Container** and the Core.

### Lineup

| # | Shrine | Gimmicks | Miniboss | Boss |
|---|---|---|---|---|
| 1 | **Ember Crypt** | Dark rooms, timed and ordered braziers, bramble webs | **Wickgeist:** a lantern phantom, invisible in the dark; light the braziers with Ember to expose it. | **Cinderhull:** an armoured husk wrapped in regrowing thorn-vines; burn the wraps with Ember, then blast the bare core with Blackpowder before they grow back. |
| 2 | **Gale Eyrie** | Bottomless pits, cliff tiers, wind-vane bridges, crumbling floors | **Swoopclaw:** a diving harpy whose slams crack the floor; blast-jump to safe tiles and punt bombs up when it roosts. | **The Squall Matron:** a storm-bird riding four nest platforms that drift on the wind; gust the platforms together to strand her, then bomb her while she's grounded. |
| 3 | **Glacier Grotto** | Flooded rooms, water-level gates, ice-slide tracks, angled ice bumpers | **Rimeback:** a crab whose shell guards its front; glaze the floor and bank a sliding bomb off the bumpers into its back. | **The Berggeist:** a slime that splits into skaters across a moat; freeze the moat and the skaters into blocks, slide them back together, and shatter the merged core. |
| 4 | **Basalt Vault** | Multi-button doors, eye-beam turrets, synchronised statues, slide-and-stop puzzles | **The Ironclad Bull:** an invulnerable charger; make a basalt pillar so it stuns itself, then bomb it. | **The Prism Golem:** sweeps beams round a shielded core; block beams with basalt, freeze its track with Frost, and bank blasts behind its guard. |
| 5 | **Ironblight Spire** | `8–10` rooms combining all five bombs | **The Rust Warden:** a duellist who copies your last bomb's element; answer each with its opposite. | **Lord Verdigris**, in four phases: Ember (light the braziers to reveal him), Gale (vault the pits and punt bombs up), Frost (bridge the moat, bank a shot), Basalt (shield from beams, then a multi-bomb finish). |

## 6. Upgrades

Hidden behind cracked overworld walls, in optional Shrine rooms, and in short
island puzzles:

- **Heart Containers (`4`):** one per Shrine boss (`3 → 7` hearts).
- **Heart Shards (`6`, two per heart):** one in each Shrine and two in secret
  overworld caves (`7 → 10` hearts).
- **Satchel upgrades (`3`):** `2 → 3` live bombs; `3 → 4` live bombs; and
  Blackpowder's reach `1 → 2` tiles.

## 7. Secrets and signposting

- **Bombable walls always show it:** crack lines and a slightly different tone.
  The game hides *where* secrets are, never *whether* a wall can be bombed, so
  nobody carpet-bombs the island.
- A reward every two or three overworld screens keeps the map worth exploring.

## 8. The homage line

A clear homage, not a copy:

- **Echo freely:** the genre and its feel: an overworld of rooms; dungeons with
  keys, locked doors, crystal switches and bosses; cracked walls hiding secrets;
  heart containers; a chain of tools that each open new ways through old places.
- **Make our own:** every name, character, place, item, enemy, boss, story beat,
  map, and piece of art or music. No trademarked or recognisable names from any
  existing series, and no puzzle, boss or sequence recreated beat for beat: keep
  the *verb*, invent the situation.

The walkthroughs and maps in `inspiration/` (not in git) are for studying pacing
and puzzle structure, not for copying layouts.

## 9. Build order

1. **A vertical slice first:** the Prologue and **Ember Crypt** in full (about
   15 rooms, two bombs, one boss). Tune the controls, fuse feel, room size and
   control band on a real phone before building more.
2. Then Shrines 2–4 in order, each adding one bomb and its combinations.
3. Then the Spire and the finale.

## 10. Retro look, modern play (decided 2026-11-21)

The palette, the obvious grid map and the pixel art stay a strong homage to GBC
Zelda. Everything else (movement, rendering, animation, physics, AI, world
interactions) may go well beyond what even the GBA could do.

### Decisions

| Area | Decision |
|---|---|
| **Feel priorities** | **Input forgiveness** (buffer presses for `100–150 ms`, magnetized pickups, read intent over exact timing) and **snappy motion** (squash and stretch, eased tweens on pickups, doors and blocks, anticipation frames; nothing moves linearly). |
| **Buttons** | Two fixed verbs, replacing the B / A item slots of §2. **B = Roll:** a short, snappy dodge (about `2` tiles in `0.25 s`, i-frames for the middle `0.15 s`, `0.35 s` recovery) that leaves the equipped bomb where the roll started. **A = Pull out:** hold to lift the equipped bomb and carry it, release to throw; a quick tap drops it at your feet. **START** picks the one equipped bomb, or **none** for pure dodge rolls. |
| **Throwing** | Aimed along the joystick's exact angle (360°) with a fixed lob; the bomb lands, then bounces and rolls by physics. A dotted arc previews the throw while carrying. |
| **Bomb physics** | **Full physics:** thrown bombs bounce and roll to a stop with friction and wall rebounds; blasts shove bombs, enemies and pushable objects outward; walking into a bomb kicks it. |
| **Puzzles** | **Designed for physics:** roll bombs down slopes into cracks, bank them off walls, ride currents. Switches and braziers trigger on contact radius, not tile. |
| **World** | **Spreading fire** (dry grass and brambles burn tile by tile, crates burn, braziers light in range, water and stone stop it), **dynamic light** (every flame, fuse, blast and lantern casts light and shadow; dark rooms become lighting puzzles), **water and wind** (bombs float and drift on currents; wind carries smoke, fire and light objects). |
| **Enemy AI** | **Systemic:** clear telegraphs and state machines (patrol, notice, chase, recover), fleeing lit fuses, stumbling when hit, and reacting to the world (bats put out flames, slimes split in fire, shielders kick bombs back). |
| **Rendering** | **HD-2D lite on WebGL via PixiJS:** pixel art with real-time normal-mapped lighting, bloom and colour grading. **Normal maps are auto-generated** from each sprite's and tile's palette indices, except hero assets (Pip, bosses, landmark stamps), which are hand-authored. If we keep this lighting, hand-author the rest later. |
| **Transitions** | Rooms **slide** between screens with easing and **parallax** depth layers (canopy, clouds). |

### Build order

Tracked as a burn-down checklist in [`ROADMAP.md`](ROADMAP.md).

1. **Roll and Pull out** with input forgiveness, so physics and AI get tuned
   against the real controls.
2. **Bomb physics** (bounce, roll, kick, blast shove) and the fixed-timestep
   simulation it needs to stay deterministic in tests.
3. **Physics puzzles:** rework the Ember Crypt rooms to use rolling and banking.
4. **Systemic world and AI:** fire spread, wind and water, enemy reactions.
5. **PixiJS renderer:** lighting, hand-authored normal maps, bloom, parallax
   room slides.

### Open risks

- **Scope:** the physics-puzzle redesign and hand-authored hero normal maps are
  the biggest art and design costs; hand-authoring every normal map later would
  roughly double the art again.
- **Physics and tests:** full physics needs a fixed timestep (the simulation
  currently takes a variable `dt`) so tests stay deterministic.
- **Readability:** with grid snapping gone, the HD-2D lighting and snappy motion
  must keep bomb positions and blast reach legible on a small phone screen.
- **Impact feedback:** hit-stop, screen shake and haptics weren't chosen as
  priorities; revisit once physics lands, since blasts without them may feel weak.
