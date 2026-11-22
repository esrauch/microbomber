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
| **Campaign** | **Half of *Oracle* in physical size (~120 rooms total):** a `6 × 6` overworld (~36 screens), **4 Elemental Shrines** scaling along the half-*Oracle* dungeon curve (`10 → 16 → 20 → 24` rooms, introducing two-floor `1F + B1F/2F` layouts from Shrine 2 onward), and **1 Final Tower** (`16` rooms). Because traversal and quest backtracking multiply runtime non-linearly with world size, half the physical size of *Oracle* (~12–15 h) naturally plays in under a quarter of the time (~1.5–2.5 h blind, ~45–60 min known). |
| **World** | One interconnected island in a single state (no time or world swapping): all the depth comes from the bombs and how they combine. |
| **Tone** | An earnest storybook adventure with a light touch. Original world, characters, monsters and lore. |
| **One voice** | The game opens in the **mouse house** with **Grandma**, the only character who speaks in the whole game. Talk to her any time you're home and she says where to go next. Everything else is told without words: the room's objective line, the map, and what you can see. |
| **Bomb economy** | **Bottomless satchel**, limited only by how many bombs can be live at once (`2`, upgradeable to `3`, then `4`). Never grind bushes for ammo; never soft-lock. |
| **Self-blast** | Your own blast does **no damage**, but its **knockback is real**: about `1` tile, so blasting yourself beside a pit, spikes or lava hurts. Enemy attacks and hazards deal real heart damage. |
| **Health and retry** | Start with **3 hearts**, up to **10** (4 boss Heart Containers, plus 6 Heart Shards at 2 per heart). On death, respawn at the **doorway of the room** where you fell. |
| **Saving** | **Autosave on every room change**; reopening the game puts you exactly where you were. |
| **Phone first** | Portrait, touch, a thumb on each side. Designed for five-minute sessions. |
| **Look** | Pure-2D Game Boy Color pixel art in the Oracle of Ages style, held to GBC colour rules: `16 × 16` tiles, `1px` ink outlines, RGB555 colours; each sprite uses one of 8 sprite palettes (3 colours plus transparent), each `8 × 8` quarter of a background tile uses one of its zone's 8 background palettes (4 colours). Recolours are palette swaps (`src/render/gbcPalette.ts`, `gbcArt.ts`). |

## 2. Controls (portrait, two thumbs)

All controls live in a **band below the room**:

- **Left thumb:** a virtual analogue joystick (`360°` movement and roll
  direction).
- **Right thumb:** two fixed-verb buttons, **B** on the left and **A** on the
  right:
  - **B = Roll:** dodges about `2` tiles in `0.25 s` along the stick (or current
    facing when idle), with invulnerability frames during the middle `0.15 s`
    and `0.35 s` recovery. It lays no bomb.
  - **A = Place:** a press puts the equipped bomb on the ground **just in front
    of Pip**, along the cardinal direction Pip faces and centred in Pip's lane.
    Facing a wall up close, it sits against the wall instead.
- **Kick:** walking into a bomb kicks it, and it rolls along the ground.
  **Kicks are orthogonal only:** the bomb rolls straight along the dominant axis
  of the walk, rebounds straight back off walls, rolls down chutes, and drifts
  on currents. A kicked Bomb bomb goes off when it hits an enemy. There
  is no throwing.
- **START:** pauses the game and picks the single equipped bomb that A places
  (or **None**).

Placing a bomb triggers a `0.7 s` cooldown; kicking one doesn't.

**Input forgiveness and feel aids:**

- **Input buffer:** presses during a roll or the `0.7 s` bomb cooldown
  are buffered (`100–150 ms` window) and fire as soon as recovery or cooldown
  ends.
- **Magnetized pickups:** pickups drift toward Pip within about `1` tile.
- **Corner sliding:** walking or rolling into the edge of a doorway or block
  nudges you round it, so you never snag.
- **Generous timing:** at least `0.3 s` of slack on blast-jumps, timed braziers,
  and other timed challenges to forgive touch latency.

## 3. Story and setting: *The Rust of Cinderholm*

Overnight, the **Iron Tower** erupted at the centre of **Cinderholm Isle**,
pulsing a creeping red curse that rusted every sword, axe, shield and iron tool
to dust. Monsters poured from the island's four ancient sanctuaries, and the
village guards were left holding empty hilts.

Enter **Pip** (alternatives: Flint, Tallow), an apprentice alchemist-sapper whose
glass-and-brass **Spark Satchel** holds no iron at all: only alchemical bombs.
Guided by **Grandma**, who raised Pip in the **mouse house** at the edge of
**Millbrook**, Pip ventures
into the four Elemental Shrines in order (**Ice Cave → Rock Quarry → Fire
Mountain → Wind Cliffs**). Each Shrine holds the bomb that beats it (**Fire, Wind,
Ice, Rock**): Pip reclaims each **Primeval Core**, learning its bomb along the way, breaks
the fourfold seal on the Tower, and faces the one who raised it: **the Sorcerer**,
an old mouse who mastered all four elements long ago and never gave a name. He
fights the way Pip does, with the same four kinds of bomb.

### Overworld (`6 × 6` screens)

```text
      0           1           2           3           4           5
  ┌───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐
0 │ Windmill  │ Gusty     │ IRON TOWER│ Tower     │ Ash       │ FIRE (3)  │
  │ Bluff     │ Crags     │ (5)       │ Courtyard │ Sluice    │ MOUNTAIN  │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
1 │ WIND      │ High      │ Tower     │ Millbrook │ River     │ Steam     │
  │ CLIFFS (4)│ Bridge    │ Causeway  │ North     │ Ford      │ Falls     │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
2 │ Cliff     │ Old       │ Millbrook │ Mouse     │ Reed      │ Otter     │
  │ Overlook  │ Windmill  │ West      │ House ★   │ Marsh     │ Shallows  │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
3 │ Quarry    │ Sunken    │ Orchard   │ Bramble   │ Driftwood │ CRESCENT  │
  │ Rim       │ Approach  │ Gate      │ Woods     │ Beach     │ COVE      │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
4 │ ROCK      │ Quarry    │ Scorched  │ Cinder    │ Tide      │ Thief     │
  │ QUARRY (2)│ Lift      │ Clearing  │ Trail     │ Pools     │ Burrows   │
  ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
5 │ Deep      │ Frost     │ Old       │ ICE CAVE  │ South     │ Lighthouse│
  │ Seam      │ Cistern   │ Icehouse  │ (1)       │ Cape      │ Point     │
  └───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘
```

Every two or three screens should hold something: a shard, a satchel upgrade,
or a shortcut.

### Campaign flow

1. **Prologue: Millbrook and the Tower Courtyard** (Bomb). Wake in
   the **mouse house** (`3,2`), where Grandma sends Pip out; test the Bomb on
   cracked rubble behind the house, see the fourfold barrier seal the Tower (`2,0`), and blast open
   the cracked **Orchard Gate** (`2,3`).
2. **Chapter 1: Bramble Woods and the Ice Cave** (Fire). Clear the moss-slimes
   out of the woods, and bomb through a cracked rock wall to unseal the
   **Ice Cave** (`3,5`): dark frozen halls, ice blocks and braziers. Reward:
   **Fire Bomb** and the first Core (Cinder).
3. **Chapter 2: the Old Windmill and Rock Quarry** (Wind). Burn away the brambles
   choking the **Old Windmill** (`1,2`) and light its boiler with a Fire Bomb, so
   the windmill hauls the **Quarry Lift** (`1,4`) back up and opens the way down to
   **Rock Quarry** (`0,4`): sand and gravel piles, terraced ledges. Reward:
   **Wind Bomb** and the second Core (Zephyr).
4. **Chapter 3: Crescent Cove and Fire Mountain** (Ice). Wind-hop the broken
   bridge east to **Crescent Cove** (`5,3`), where a band of **Pack-Otters**
   steal the satchel's **fuses**: every bomb is a dud until you corner the otter
   holding its fuse, across `4` tight beach and burrow rooms, each recovered
   fuse helping you corner the next. Winning them back frees the old ferry
   north to **Fire Mountain** (`5,0`): lava streams and flame jets. Reward:
   **Ice Bomb** and the third Core (Rime).
5. **Chapter 4: River Ford and Wind Cliffs** (Rock). Freeze **River Ford**
   (`4,1`) and the flooded **High Bridge** (`1,1`) with Ice Bombs to reach
   **Wind Cliffs** (`0,1`), where gusts sweep bombs off the ledges. Reward:
   **Rock Bomb** and the fourth Core (Stone).
6. **Finale: Iron Tower** (all five bombs). Return to the **Tower
   Causeway** (`2,1`), open the four-element gate (light a brazier, spin a vane,
   freeze a moat, weight a pedestal), and climb `8–10` rooms of combined trials
   to face the Sorcerer.

## 4. The bombs

Each bomb has **one primary rule**, taught at its Shrine, and **secondary uses
revealed later** as "aha" moments, never all up front. Every bomb works in both
puzzles and fights, and opens new overworld routes.

**Keep it simple:** plain names (Bomb, Fire, Ice, Wind, Rock), one clear job
each, and only the interactions a player would guess: Fire melts Ice, Ice puts
out Fire, Wind pushes any bomb or block, and a Bomb breaks a Rock block.

### 0. Bomb (starter): it breaks things

- **Fuse and shape:** `1.5 s`, a `+` cross reaching `1` tile (upgradeable to `2`).
- **Primary:** breaks cracked walls and cracked floor blocks.
- **Later:** toggles red/blue crystal switches (kicked down chutes or into them).
  A blast **shoves** any other live bomb caught in it; a bomb that has already
  been shoved once **detonates** when a second blast hits it, so chains take
  setting up.
- **Combat:** `2` damage and knockback. **Impact detonation:** a *kicked*
  bomb of any kind goes off the moment it hits an enemy, so fights stay snappy;
  a bomb left where it was placed keeps its fuse for puzzles and traps.

### 1. Fire: it sets things alight

- **Fuse and shape:** `1.3 s`, a `1`-tile burst that leaves a burning patch for
  `2.5 s`.
- **Primary:** lights torches and braziers (including timed and ordered sets).
- **Later:** burns brambles, thorn gates and wooden crates; melts ice blocks;
  lights dark rooms while it burns.
- **Combat:** burns away wooden shields and wrappings on armoured foes; the
  burning patch holds a chokepoint.

### 2. Wind: it pushes things

- **Fuse and shape:** `0.8 s`, or pop it early by pressing A again; a `3 × 3` gust that
  breaks nothing.
- **Primary: blast-jump.** Standing on or beside a Wind Bomb when it pops
  launches you `2` tiles over pits, narrow water, toggle tiles and up one-tier
  ledges.
- **Later:** launches other live bombs, pots or blocks `3` tiles across chasms;
  spins wind-vane switches; clears poison fog.
- **Combat:** punts enemies `2–3` tiles, into pits or onto spikes; hops you over
  shockwaves and blade traps.

### 3. Ice: it freezes things

- **Fuse and shape:** `1.3 s`, a `3 × 3` ice nova.
- **Primary: freezes liquids.** Water in the blast becomes walkable ice, and
  lava crusts over safely, until Fire melts it or you leave the room. No timer.
- **Puts out fire:** burning patches and lit braziers in the blast go out.
- **Later (Fire Mountain only):** frozen lava crust is glazed, so kicked bombs
  and shoved blocks on it **slide until they hit something**. No other Shrine's
  floors glaze (the Sorcerer's Ice form is the one exception).
- **Combat:** freezes small and medium enemies solid for `4 s`, into pushable
  ice blocks: a temporary weight for a button, a battering ram, or something to
  shatter with a Bomb or Fire for better heart drops.

### 4. Rock: it makes a block

- **Fuse and shape:** `1.0 s`; turns its centre tile into **one solid, pushable
  rock block**. Making a new block crumbles the old one; Bomb shatters
  it.
- **Primary:** a block wherever you need one: the extra weight for a button,
  the stopper for a sliding block, the shield against an eye-beam or flame jet.
- **Later:** dropped into a one-tile channel of shallow water or spikes, it
  becomes a stepping stone until you make another.
- **Combat:** portable cover from projectiles; charging enemies daze themselves
  against it.

### Combinations (Shrines 2–4 and the Tower)

| Combo | In puzzles and fights |
|---|---|
| **Ice + Rock** | Glaze the floor, then place a rock block as a backstop so a sliding block or bomb stops exactly on a button. |
| **Wind + Fire / Bomb** | Drop a live bomb, then pop a Wind Bomb behind it to fling it `4–5` tiles across a chasm onto a far cracked wall or unlit brazier. |
| **Wind + Rock** | Make a rock pillar mid-chasm, then blast-jump onto it and off again to cross `4` tiles. |
| **Ice + Fire** | Freeze a row of water, push a block across, then melt one tile with Fire to drop the block onto a submerged switch. |

### Reserve ideas (for playtesting or a secret post-game bomb)

1. **Ricochet:** glides fast and bounces off walls and angled blocks up to `3`
   times before going off, for hitting switches round corners. (Angled blocks
   may cover this without a sixth bomb.)
2. **Swap:** when it goes off, trades places with the pot, statue or enemy on
   its tile. (Overlaps Wind's pit-crossing.)
3. **Remote:** no fuse; sits until you trigger it or another blast hits it, for
   simultaneous switches and landmines.
4. **Crawler:** scurries straight ahead through small gaps. (Largely covered now:
   the tiny mouse hero goes through mouseholes himself.)

## 5. Shrines and bosses

### Shrine template (Half-*Oracle* curve: `10 → 16 → 20 → 24` rooms, no filler)

- **Scaled like half of *Oracle of Ages / Seasons*:** *Oracle* dungeons grow from ~20 rooms in Dungeon 1 to ~32–40 in mid dungeons and ~46–64 in late dungeons. Our four Shrines follow half that curve: **10 rooms** in *Ice Cave* (`1F`), **16 rooms** in *Rock Quarry* (`1F + 2F`), **20 rooms** in *Fire Mountain* (`1F + B1F`), **24 rooms** in *Wind Cliffs* (`1F + 2F`), plus **16 rooms** in *Iron Tower* (`1F..4F`).
- **Graduated mechanics (no kitchen-sink Dungeon 1):** *Ice Cave* uses simple single floor switches, crystal barriers, braziers, and dark rooms — saving directional treadmills/chutes and multi-switch block-shoving puzzles for the later Shrines.
- **Automatic minimap:** visited rooms and locked doors appear in a small corner
  map, with the current objective ("Ice Cave ▸ south-west"). No map or
  compass chests.
- **Act 1:** teaches the Shrine's gimmick with small keys, crystal
  barriers and earlier bombs, then a **miniboss** (which opens a warp back to
  the entrance) and the **new bomb's chest**.
- **Act 2:** teaches the new bomb, then revisits
  Act 1 rooms or a second floor (`B1F` / `2F`) in a new light for a secret upgrade and the **Boss Key**, then a
  **puzzle boss**, then a **Heart Container** and the Core.

### Lineup

| # | Shrine (bomb found) | Rooms | Gimmicks | Miniboss | Boss |
|---|---|:-:|---|---|---|
| 1 | **Ice Cave** (Fire) | **10** (`1F`) | Single floor switches, dark rooms, timed and ordered braziers, ice blocks to melt | **Ice Wraith:** a lantern phantom, invisible in the dark; light the braziers with Fire to expose it. | **Ice Golem:** a husk in regrowing ice armour; melt it with Fire, then blast the bare core with a Bomb before it freezes over. |
| 2 | **Rock Quarry** (Wind) | **16** (`1F + 2F`) | Sand and gravel piles to blow away, terraced ledges, bottomless pits, crumbling floors | **Sand Mole:** burrows under sand piles; blow the sand off with Wind, then bomb it. | **Boulder Golem:** holds the top terrace; gust it off its ledge, or blow bombs up the tiers into its back. |
| 3 | **Fire Mountain** (Ice) | **20** (`1F + B1F`) | Lava streams to crust over, flame jets to put out, glazed crust slides | **Fire Salamander:** wreathed in flame; an Ice blast snuffs it so a Bomb can hurt it. | **Lava Drake:** circles a lava moat; freeze crust bridges to reach it, and ice its breath. |
| 4 | **Wind Cliffs** (Rock) | **24** (`1F + 2F`) | Gusts that carry bombs (blocked by rock windbreaks), gaps to fill, cliff tiers, multi-button doors | **Harpy:** a diving slammer; raise a rock pillar so it dazes itself, then bomb it. | **Storm Bird:** beats gusts that blow bombs back at you; raise windbreaks so a bomb can sit under its nose, then pillar its dive. |
| 5 | **Iron Tower** | **16** (`1F..4F`) | Four 4-room elemental floors combining all five bombs | **Iron Knight:** a hulking suit of rusted armour; blast its plates off one by one, then bomb the empty suit's core. | **The Sorcerer:** an old mouse who throws your own bombs, cycling Fire, Wind, Ice, Rock; answer each with its counter bomb, then hit him with a Bomb while he's stunned. |

### Shrine plans

Every Shrine follows one arc. **Act 1** is solved with the bombs you already
carry, while the Shrine's own obstacles keep blocking the way forward. The
**miniboss** guards the new bomb's chest. **Act 2** teaches the new bomb, sends
you back past the obstacles that stopped you, and ends at the **Boss Key** and a
boss that is a test of the new bomb. Each Shrine adds **at most two new puzzle
pieces**, and every room has one idea: teach it, twist it, then combine it.

#### 1. Ice Cave (Fire), built

- **Look:** pale glacier stone and blue ice rock, braziers for warmth, an old
  icehouse's storerooms inside.
- **Pieces:** ice blocks (melted by Fire), braziers (timed and ordered), dark
  rooms; plus keys, crystal barriers and floor switches.
- **Miniboss: Ice Wraith.** Invisible in the dark; light the braziers with Fire
  to expose it, then bomb it.
- **Boss: Ice Golem.** Ice armour that regrows; melt it with Fire, then blast the
  bare core with a Bomb before it freezes over.
- **Opens outside:** brambles across the island burn away.

#### 2. Rock Quarry (Wind)

- **Look:** terraced stone steps cut into a hillside, wooden scaffolds and pulleys,
  sand drifting into every corner.
- **New pieces:**
  1. **Sand piles:** soft mounds that block a tile. A Bomb only scatters them back;
     Wind blows them clear, and whatever was buried (a switch, a key, a stair)
     shows.
  2. **Terraces:** one-tile ledges you can drop down but not climb. Wind's
     blast-jump takes you up one tier or across a `2`-tile pit.
- **Act 1 (Bomb, Fire):** drop down the terraces to reach the bottom of the
  quarry, burning scaffold crates and bombing cracked walls; sand-buried
  switches you can see but not reach keep shutting doors behind you.
- **Miniboss: Sand Mole.** Burrows from pile to pile. Bombs make it dive; only
  when you've blown its last pile away with your first Wind Bomb is it caught in
  the open. *(The Wind chest sits in its den.)*
- **Act 2 (Wind):** blast-jump back up the terraces you dropped down, clear the
  buried switches, and gust bombs across pits onto far cracked walls.
- **Boss: Boulder Golem.** Holds the top terrace and rolls boulders down the
  steps at you. Phase 1: blast-jump up to its tier and gust it back to the edge.
  Phase 2: push it off the edge; it shatters below, exposing a core to bomb.
- **Opens outside:** pits and gaps on the west cliffs, and ledges up to the
  Old Windmill.

#### 3. Fire Mountain (Ice)

- **Look:** dark basalt and glowing lava, an old forge dug into the volcano:
  furnaces, chains, iron grates.
- **New pieces:**
  1. **Lava:** deadly to step in. Ice crusts it over into floor until you leave
     the room (or Fire melts it).
  2. **Flame jets:** vents that fire on a beat. Ice puts a jet out for good;
     before that you time your run.
- **Act 1 (Bomb, Fire, Wind):** time runs past flame jets, blast-jump over thin
  lava streams, and gust bombs across wide ones onto switches; Fire lights the
  forge braziers that work its gates.
- **Miniboss: Fire Salamander.** Wreathed in flame, so Bombs bounce off. Ice
  snuffs the flames for a few seconds; then bomb it. *(The Ice chest is
  behind it, so the fight teaches Ice by using it.)*
- **Act 2 (Ice):** crust over the lava rivers that blocked Act 1, put out the
  flame jets for good, and on the lower floor (`B1F`) slide bombs across glazed
  crust into switches.
- **Boss: Lava Drake.** Swims a lava moat round an island. Phase 1: crust a path
  across the moat while it surfaces and breathes fire. Phase 2: Ice its breath
  to cool its throat, then kick a bomb into its mouth.
- **Opens outside:** the river and the falls to the north freeze into paths.

#### 4. Wind Cliffs (Rock)

- **Look:** sea-cliff caves and ledges, ruined watchtowers, rope bridges, gulls.
- **New pieces:**
  1. **Gusts:** steady wind from vents that carries rolling bombs, sand and loose
     objects (the mouse walks normally). A block in its path makes calm air
     behind it.
  2. **Gaps:** one-tile channels and pits. A Rock block dropped in becomes a
     stepping stone.
- **Act 1 (Bomb, Fire, Wind, Ice):** ride the gusts to carry bombs to far
  targets, freeze sea spray into ledges, and blast-jump between outcrops, while
  gusts that blow the wrong way keep sweeping your bombs off their marks.
- **Miniboss: Harpy.** Dives at you in a straight line. Bombs miss it in the
  air; whatever it slams into dazes it. *(The Rock chest is mid-fight: raise a
  pillar in its path, then bomb it while it's dazed.)*
- **Act 2 (Rock):** build windbreaks so bombs stay where you put them in rooms
  the gusts ruled, fill gaps into stepping stones, and weigh down multi-button
  doors with blocks.
- **Boss: Storm Bird.** Perches on the clifftop and beats its wings into gusts
  that blow every bomb back at you. Phase 1: raise a windbreak in front of it so
  a bomb can sit under the calm and go off. Phase 2: it takes off and dives;
  raise a pillar so it slams into it, then bomb it.
- **Opens outside:** the windswept pass to the Tower Causeway.

#### 5. Iron Tower (all bombs)

- **Shape:** four floors of four rooms, one per element, each reprising its
  Shrine's pieces with one combination twist (for example, freeze lava, then
  glaze it into a slide; or windbreak a gust, then gust a bomb past it).
- **Miniboss: Iron Knight.** A hulking suit of rusted armour that marches and
  swings. Each blast knocks a plate off; once it's bare, bomb the empty suit's
  core. (Kept plain on purpose: the counter-the-element test is saved for the
  Sorcerer.)
- **Boss: the Sorcerer** (a mirror fight). An old mouse in a long robe who
  fights like Pip: in each element he throws that element's bombs and wears it
  as a shield. You answer with the **counter bomb** to break the shield, then
  hit him with a plain Bomb while he's stunned.

  | He shifts into | He attacks with | Your counter | It works because |
  |---|---|---|---|
  | **Fire** | Fire Bombs that leave burning patches | **Ice** | Ice puts his flames out |
  | **Wind** | Gusts that blow your bombs away | **Rock** | A Rock Bomb lands as a block the gust can't move; a Bomb set behind it stays put and goes off beside him |
  | **Ice** | Ice novas that glaze the floor, so your bombs slide past him | **Fire** | Fire melts the glaze and his ice shield |
  | **Rock** | Rock walls raised around himself | **Wind** | Wind topples the walls and blows him into the open |

  - **Fixed order** (Fire, Wind, Ice, Rock), the same every time, so it's
    learnable. Before each shift his robe changes colour and he holds a cast pose
    for a second.
  - **Faster each loop:** the first loop is slow and readable; each loop after
    shortens his windows and adds a bomb to his volleys. About two loops of hits
    beat him.
  - **The wrong bomb** is simply absorbed into his shield (a Fire Bomb on the
    Fire shield fizzles), so a mistake costs time, not hearts.
  - **Homage check:** duelling a double is a Zelda staple (a dark reflection, or
    returning a sorcerer's volleys). We keep only the duel; the verb is ours, and
    the counter-the-element rule is the whole game's lesson in one fight.

## 6. Upgrades

Hidden behind cracked overworld walls, in optional Shrine rooms, and in short
island puzzles:

- **Heart Containers (`4`):** one per Shrine boss (`3 → 7` hearts).
- **Heart Shards (`6`, two per heart):** one in each Shrine and two in secret
  overworld caves (`7 → 10` hearts).
- **Satchel upgrades (`3`):** `2 → 3` live bombs; `3 → 4` live bombs; and
  Bomb's reach `1 → 2` tiles.

## 7. Secrets and signposting

- **Bombable walls always show it:** crack lines and a slightly different tone.
  The game hides *where* secrets are, never *whether* a wall can be bombed, so
  nobody carpet-bombs the island.
- A reward every two or three overworld screens keeps the map worth exploring.
- **Mouseholes, used sparingly:** small gaps only the tiny mouse fits through,
  never a bomb or block, for the odd shortcut or secret. Always visible, like
  cracked walls.

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

1. **A vertical slice first:** the Prologue and the **Ice Cave** in full (about
   15 rooms, two bombs, one boss). Tune the controls, fuse feel, room size and
   control band on a real phone before building more.
2. Then Shrines 2–4 in order, each adding one bomb and its combinations.
3. Then the Tower and the finale.

## 10. Retro look, modern play (decided 2026-11-21)

The palette, the obvious grid map and the pixel art stay a strong homage to GBC
Zelda. Everything else (movement, rendering, animation, physics, AI, world
interactions) may go well beyond what even the GBA could do.

### Decisions

| Area | Decision |
|---|---|
| **Feel priorities** | **Input forgiveness** (buffer presses for `100–150 ms`, magnetized pickups, read intent over exact timing) and **snappy motion** (squash and stretch, eased tweens on pickups, doors and blocks, anticipation frames; nothing moves linearly). |
| **Buttons** | Two fixed verbs, replacing the B / A item slots of §2. **B = Roll:** a short, snappy dodge (about `2` tiles in `0.25 s`, i-frames for the middle `0.15 s`, `0.35 s` recovery); it lays no bomb (see the bomb-laying roll below). **A = Place:** puts the equipped bomb on the ground just in front of Pip (decided 2026-11-22, replacing pull out and throw). **Kick:** walking into a bomb kicks it, orthogonally only. **START** picks the one equipped bomb, or **none**. |
| **Kicking** | Replaces throwing (2026-11-22): bombs travel by being kicked along the ground in the 4 cardinal directions, then roll, rebound and ride chutes and currents by physics. |
| **Bomb physics** | **Full physics:** kicked bombs roll to a stop with friction and rebound off walls; blasts shove bombs, enemies and pushable objects outward; walking into a bomb kicks it. |
| **Puzzles** | **Designed for physics:** roll bombs down slopes into cracks, bank them off walls, ride currents. Switches and braziers trigger on contact radius, not tile. |
| **World** | **Spreading fire** (dry grass and brambles burn tile by tile, crates burn, braziers light in range, water and stone stop it), **dynamic light** (every flame, fuse, blast and lantern casts light and shadow; dark rooms become lighting puzzles), **water and wind** (bombs float and drift on currents; wind carries smoke, fire and light objects). |
| **Enemy AI** | **Systemic:** clear telegraphs and state machines (patrol, notice, chase, recover), fleeing lit fuses, stumbling when hit, and reacting to the world (bats put out flames, slimes split in fire, shielders kick bombs back). |
| **Rendering** | **HD-2D lite on WebGL via PixiJS:** pixel art with real-time normal-mapped lighting, bloom and colour grading. **Normal maps are auto-generated** from each sprite's and tile's palette indices, except hero assets (Pip, bosses, landmark stamps), which are hand-authored. If we keep this lighting, hand-author the rest later. |
| **Transitions** | Rooms **slide** between screens with easing and **parallax** depth layers (canopy, clouds). |

### Possible future gimmick: the bomb-laying roll

A roll that leaves the equipped bomb where it started was tried in Phase 1 and
dropped as the default (2026-11-22). Keep it as a possible **unlockable** (a
satchel upgrade or a Shrine relic) used by specific puzzles, such as laying a
bomb mid-dodge beside a cracked wall while a hazard sweeps past, rather than as
standard roll behaviour.

### Build order

Tracked as a burn-down checklist in [`ROADMAP.md`](ROADMAP.md).

1. **Roll and Pull out** with input forgiveness, so physics and AI get tuned
   against the real controls.
2. **Bomb physics** (bounce, roll, kick, blast shove) and the fixed-timestep
   simulation it needs to stay deterministic in tests.
3. **Physics puzzles:** rework the Ice Cave rooms to use rolling and banking.
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
