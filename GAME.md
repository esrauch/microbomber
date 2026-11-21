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

- **Left thumb:** a virtual analogue joystick.
- **Right thumb:**
  - **💣 Drop:** tap to drop the selected bomb on your tile.
  - **Throw:** lobs a bomb `2–3` tiles the way you're facing. If you're standing on a live bomb it throws that one; otherwise it throws a fresh one. For bombs that can go off early (Gale), it also **pops** them.
  - **The quick-swap row:** the unlocked bomb icons in a row above the buttons. One tap selects; there's no pause menu.

**One gesture per button.** No holds, flicks, or "tap near a bomb" overloads.

**Precision aids** (a virtual stick can't do one-tile precision on its own):

- **Bombs snap to tile centres.** A ghost marker shows the tile the next bomb will land on (dropped or thrown).
- **Corner sliding:** walking into the edge of a doorway or block nudges you round it, so you never snag.
- **Generous timing:** at least `0.3 s` of slack on blast-jumps, timed torches and anything else timed, because touch input lags.

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

## 6. Upgrades (no submenus)

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
