# Inspiration: puzzle mechanics across the Zelda series

A survey of the **dungeon and shrine puzzles** in the games in `inspiration/`:
the primitives they are built from, and how those games teach and combine them.
It feeds `PUZZLE_MECHANICS.md`, our own kit. Overworld, plot and combat are left
out on purpose.

**Sources.** About 400 walkthrough and wiki pages (`inspiration/SOURCES.txt`):
- every dungeon from *The Legend of Zelda* (1986) to *Echoes of Wisdom* (2024)
- all **138** *Breath of the Wild* shrines, plus its four Divine Beasts and the Final Trial
- all **153** *Tears of the Kingdom* shrines, plus its five temples

They were mined two ways: a keyword count of `48` mechanics per game (counts are
indicative only: a keyword also matches names and titles), and reading the
landmark puzzles. Caveats:
- `60` *Tears of the Kingdom* shrine pages and the *Echoes of Wisdom* dungeon pages
  are stubs, so for those this leans on their **trial names** and the game's
  echo catalogue.
- Every example below names the file it comes from.

---

## Part 1: The primitives

Two kinds: what the **environment** does by itself, and what the **player** can
do to it. Most puzzles are one of each.

### 1.1 The environment: substances and forces

| Primitive | What it does | Where it shows up |
|---|---|---|
| **Still water** | Blocks walking; you swim or dive; things float or sink. Its **level** can be raised or lowered as a dungeon-wide state. | *Ocarina* Water Temple: playing Zelda's Lullaby at a Triforce symbol raises the water, *"notice how the block also floats up"* (`1998-ocarina-of-time/water-temple.wiki`). |
| **Moving water** | Currents, waterfalls and whirlpools carry you and objects one way. | *Breath of the Wild* "The Current Solution", "Drifting"; *Tears of the Kingdom* "Against the Flow"; *Recall* sends a raft back *up* a waterfall (`nachoyah-shrine.wiki`). |
| **Ice** | Slippery floors slide you and blocks until they hit something (creating **backstop** routing puzzles); ice blocks melt; water freezes. | Heaviest in *A Link to the Past* (`98` ice/slide mentions), *Ocarina* (`93`) and *Breath of the Wild* (`93`). *Minish Cap* Temple of Droplets (`2004-the-minish-cap/temple-of-droplets.wiki`) and *Seasons* Sword & Shield Dungeon (`temple-remains-and-sword-shield-dungeon.wiki`) use multi-block ice-sliding backstop puzzles. *Breath of the Wild* "The Melting Point", "Melting Ice Hazard". |
| **Lava** | Deadly floor that turns to stone where water or ice lands. | *Wind Waker* Dragon Roost: *"the pots by the entrance are filled with water… throw it in the lava… a rock surface you can jump on"* (`dragon-roost-cavern.wiki`). *Seasons* Sword & Shield Dungeon: carry Magic Ice crystals and drop them down floor holes into lava vents below (`temple-remains-and-sword-shield-dungeon.wiki`). *Tears of the Kingdom* Kadaunar: a wall hydrant streams water onto lava, making Lava Slabs (`kadaunar-shrine.wiki`). |
| **Flammables** | Webs, vines, wooden boxes and grass burn, and fire spreads. | *Ocarina* Deku Tree web; *Breath of the Wild* Tah Muhl "Passing the Flame": vines burned from torches, by weapon or arrow (`tah-muhl-shrine.wiki`). |
| **Wind** | Fans, updrafts and gusts push you, gliders and objects. | Everywhere in the later games (*Breath of the Wild* `132` mentions, *Tears of the Kingdom* `165`; *Wind Waker*'s count is inflated by its own title). *Breath of the Wild* "Directing the Wind", "The Four Winds", "Windmills"; *Tears of the Kingdom* "Ride the Winds", "Turbine Power". |
| **Electricity** | Flows from a source through conductive metal to a switch. | *Breath of the Wild* Hawa Koth: *"position the two metal cubes… so that the green power source is conducting power to the Switch"* (`hawa-koth-shrine.wiki`); "Electric Path", "Metal Connections". |
| **Light** | Sunbeams and reflected light trip sun switches or melt ice; darkness hides the room. | *Ocarina* Spirit Temple: bomb a boulder, *"sun will shine through onto the sun switch"* (`spirit-temple.wiki`). *Minish Cap* Temple of Droplets: open an upstairs skylight so sunlight melts a frozen key below (`temple-of-droplets.wiki`). *Tears of the Kingdom* "Proving Grounds: Lights Out", "Shining in Darkness", "A Reflective Device". |
| **Metal and magnetism** | Metal objects can be grabbed at range; some doors are metal. | *Breath of the Wild* (`216` mentions): "Magnesis Trial", "Metal Doors Open the Way", "Metal Makes a Path". *Seasons* Magnetic Gloves. |
| **Gravity and momentum** | Balls roll, boulders fall, platforms tilt and balance, launched things fly in arcs. | *Breath of the Wild* "Drawing Parabolas", "A Balanced Approach", "Halt the Tilt"; *Tears of the Kingdom* "Gravity and Velocity", "A Route for a Ball", "Forward Force", "Proving Grounds: Low Gravity". |
| **Time** | Past and present versions of a room; objects with a recorded path. | *Oracle of Ages* time travel; *Tears of the Kingdom* Recall: "The Ability to Rewind", "A Retraced Path", "Backtrack". |

### 1.2 The environment: mechanisms

| Primitive | What it does | Where it shows up |
|---|---|---|
| **Floor switch / pressure plate** | Held down by you, a block, a statue or a pot. | Everywhere; *Ages* `53` mentions, *Breath of the Wild* `57`. *Ocarina* Spirit Temple: push a statue *"until it falls and lands on the switch below"*. |
| **Crystal / orb switch** | Hit to toggle raised and lowered blocks across the room (including delayed timed-bomb hits after you cross the pegs). | *A Link to the Past* Dark Palace (`55` mentions in that game, `dark-palace.wiki`); *Link's Awakening* Color Dungeon (`1993-links-awakening/color-dungeon.wiki`). |
| **Cross-floor drop holes & skylights** | Drop yourself, an object, or a beam of light through a hole in `1F` to land inside a sealed enclosure, switch, or lava vent on `B1F`. | *A Link to the Past* Skull Woods (`1991-a-link-to-the-past/skull-woods.wiki`); *Seasons* Sword & Shield Dungeon (`temple-remains-and-sword-shield-dungeon.wiki`: dropping Magic Ice down four holes to cool `B1F` lava); *Minish Cap* Temple of Droplets (`temple-of-droplets.wiki`: skylight levers defrosting ice blocks below). |
| **Eye switch** | Shoot it with an arrow. | *Ocarina* Forest Temple: *"shoot the silver eye… the corridor will untwist"*; another eye twists it back (`forest-temple.wiki`). *Spirit Tracks* desert eye targets. |
| **Sun / light switch** | Fires when light falls on it. | *Ocarina* Spirit Temple. |
| **Melody switch** | Fires when a song is played on it. | *Ocarina* Triforce symbols (Water Temple). |
| **Torch / brazier** | Lit to open a door or light the room; sometimes in order or on a timer. | *A Link to the Past* `69`, *Ocarina* `68`; *Breath of the Wild* "Five Flames", "Swinging Flames", "Blue Flame". |
| **Socket / pedestal** | Accepts a carried token: an orb, a statue, a pearl. | *Breath of the Wild* Ancient Orbs in Concave Slots (`monya-toma-shrine.wiki`); *Wind Waker* statues on the Tower of the Gods altar. |
| **Step-cycling tiles & colour rollers** | Floor tiles that change colour or crumble (`Green → Yellow → Red → Hole`) each time you step on them, or cylinder rollers pushed to repaint a floor. | *Link's Awakening* Color Dungeon (`1993-links-awakening/color-dungeon.wiki`); *Ages* Wing Dungeon & Crown Dungeon (`western-woods-and-wing-dungeon.wiki`, `west-rolling-ridge-and-crown-dungeon.wiki`); *Seasons* Ancient Ruins (`tarm-ruins-and-ancient-ruins.wiki`). |
| **Doors** | Shutters, key doors, barred cells, boss doors, one-way turnstiles, doors that open on "all enemies defeated". | Every game; turnstiles in *Ages* Moonlit Grotto & Crown Dungeon (`crescent-island-and-moonlit-grotto.wiki`). |
| **Movers** | Conveyors, moving and tilting platforms, elevators, carts on switchable rails. | Conveyors: *A Link to the Past* (`23`), *Breath of the Wild* (`11`). Carts with mid-ride lever switches: *Oracle* Unicorn's Cave & Sword & Shield Dungeon (`eyeglass-lake-and-unicorn-s-cave.wiki`, `temple-remains-and-sword-shield-dungeon.wiki`); *Tears of the Kingdom* "Built for Rails". Platforms: *Breath of the Wild* (`29`). |
| **Rotating / reconfigurable room** | Turning or moving part of the dungeon re-routes it. | *Breath of the Wild*: Naboris lets you *"rotate the three cylindrical sections of Naboris' torso by increments of 90 degrees"* (`divine-beast-vah-naboris.wiki`); Ruta's trunk *"constantly spews water, allowing Link to position the stream"* (`divine-beast-vah-ruta.wiki`). *Tears of the Kingdom* "Shape Rotation", "Proving Grounds: Rotation". |
| **Enemies as puzzle mechanisms** | Foes whose movement, body or appetite *is* the puzzle tool: mirror-walking knights, bomb-swallowing Dodongos, foes that walk across invisible floors, or monsters turned into movable weights. | Mirror Armos/Stalfos: *Ages* Crown Dungeon (`west-rolling-ridge-and-crown-dungeon.wiki`) & *Seasons* Explorer's Crypt (`graveyard-and-explorer-s-crypt.wiki`). Moblins revealing invisible floor over a pit: *Ages* Crown Dungeon (`west-rolling-ridge-and-crown-dungeon.wiki`). Bomb-swallowing Dodongos: *Zelda 1*, *Seasons* Snake's Remains (`woods-of-winter-and-snake-s-remains.wiki`). |
| **Hazards that are also tools** | Blade traps, fire bars, beamos, spiked rollers, crumbling floors. | *A Link to the Past*'s trap catalogue (`dungeon-traps.wiki`): Balls, Bumper, Cannons, Fire Bars, Blade Traps, Beamos, Wall Eye, Winder. |
| **Hidden things** | Fake walls, invisible paths, hidden switches. | *Ocarina* Shadow Temple: *"it looks like a dead end… put on the Lens of Truth and go past the wall"* (`shadow-temple.wiki`). *Breath of the Wild* "Buried Secrets", "Secret Stairway", "Blind Spots". |

### 1.3 The player: verbs, grouped by what they do to the world

| Verb family | Examples | Notes |
|---|---|---|
| **Push, pull, lift, throw** | Blocks and statues (*Oracle* `23`/`25` push mentions); pots and bombs | The oldest verbs; the base of every "weight on a switch" puzzle. |
| **Move your body & scale-filter** | Roc's Feather and trampolines (*Seasons*), the Deku Leaf glide (*Wind Waker*), the paraglider, iron boots (sink and walk underwater), Minish shrinking through **mouseholes** (*Minish Cap* `deepwood-shrine.wiki`) | Changes *where you can stand*—and shrinking splits what the hero can pass through from what large objects or bombs can cross. |
| **Carry a property** | A lit Deku Stick (*Ocarina* Deku Tree), a burning arrow or weapon (*Breath of the Wild*), a water-filled pot (*Wind Waker*), a Magic Ice crystal (*Seasons* Sword & Shield Dungeon) | Take fire, water or cold from where it is to where it's needed. |
| **Reach at range** | Arrows (eye switches; fire, ice and light arrows), boomerang, hookshot (*Ocarina* `183`), clawshots, the Seed Shooter's bank shots (*Ages*), slingshot | Hitting switches you can't walk to; bank shots turn walls into tools. |
| **Explode** | Timed Bombs (including delayed crystal flips), Bombchus that follow a path you draw (*Phantom Hourglass*, *Spirit Tracks*), Remote Bombs (*Breath of the Wild* "Bomb Trial", "Two Bombs") | Break walls, trip switches on a fuse delay, launch things. The ancestor of our whole game. |
| **Force at range (the runes)** | Magnesis (grab metal), Stasis (freeze an object and store hits as momentum), Cryonis (raise ice pillars from water) | *Breath of the Wild* turned each item into a rule about *physics*. |
| **Build and attach** | Ultrahand (glue parts into machines), Fuse (attach things to weapons), Autobuild | *Tears of the Kingdom* "The Ability to Create", "A Flying Device", "A Launching Device", "Building Bridges", "Built to Carry". |
| **Rewind and pass through** | Recall (play an object's motion backwards), Ascend (rise up through a ceiling) | *Tears of the Kingdom* "The Ability to Rewind", "The Ability to Rise". |
| **Create objects** | The Cane of Somaria's blocks (*A Link to the Past*), the Sand Rod's pillars (*Spirit Tracks*), **echoes** in *Echoes of Wisdom*: `35` object kinds including Water Block, Trampoline, Old Bed, Boulder, Ice Block, Cloud, Wind Cannon, Flying Tile, Brazier, Spiked Roller | The Somaria lineage: make the block you need. |
| **Control another body** | The Command Melody steering statues and sages (*Wind Waker* Tower of the Gods); possessing Phantoms (*Spirit Tracks*); multiple Links (*Four Swords*) | Two bodies in one room makes "stand here *and* there" puzzles. |
| **Change a global state** | Songs (*Ocarina*: Zelda's Lullaby, the Song of Time), the Wind Waker's wind direction, the Rod of Seasons, the Harp of Ages | One action re-dresses many rooms at once. |
| **See differently** | The Lens of Truth; lighting a dark room | Puzzles about *noticing*. |
| **Swap** | The Switch Hook (*Ages*, `73` swap mentions) | Trade places with the thing you hit. |

---

## Part 2: The puzzle designs

### 2.1 Showing, not telling: how these games teach

1. **A room where only the new thing works.** *Breath of the Wild* gives each
   rune a shrine named for it ("Magnesis Trial", "Stasis Trial", "Cryonis
   Trial", "Bomb Trial"). *Tears of the Kingdom* does the same ("The Ability to
   Create / Combine / Rewind / Rise"). There's one tool and one obvious target,
   and nothing else to try.

2. **The answer is placed next to the question.**
   - In *Ocarina*'s Deku Tree, a lit torch stands beside an unlit one by a locked
     door, so you carry a burning stick across.
   - In *Wind Waker*'s Dragon Roost, water pots stand at the entrance of the lava
     room.
   - In *Ocarina*'s Spirit Temple, sunlight leaks round a boulder in the wall.

   The world sets out the parts; the player connects them.

3. **The goal is visible before the path.** *Breath of the Wild*'s Daqa Koh shows
   the Monk's Pedestal in a raised cell and the electric connector on the
   ceiling. The puzzle is only *how* (`daqa-koh-shrine.wiki`).

4. **The title is the hint.** *Breath of the Wild* and *Tears of the Kingdom*
   name every shrine. `105` and `101` trial names survive in the files, almost
   all distinct: "Stop to Start", "Drawing Parabolas", "Halt the Tilt", "A
   Delayed Puzzle", "Courage to Fall", "Forward or Backward?". Each is a
   one-line design brief, and a nudge when you're stuck.

5. **Teach, then twist, inside one dungeon.** The Deku Stick that lights a torch
   in *Ocarina*'s first rooms burns the floor web later. The *Forest Temple*
   corridor untwists when you shoot one eye and re-twists from another, so the
   same hall becomes two routes.

6. **Take something away.** *Tears of the Kingdom*'s "Proving Grounds" shrines
   (Beginner, Lights Out, Low Gravity, Rotation, Vehicles, Smash…) strip your
   gear or change one rule, so you relearn the basics.

7. **Let other answers work.** *Breath of the Wild*'s "Halt the Tilt" is meant
   for Stasis, but *"it is entirely possible to beat this Trial without using
   Stasis through clever use of the shield jump"* (`shai-utoh-shrine.wiki`). The
   systemic games reward lateral solutions instead of locking them out.

### 2.2 How mechanics are composed (single-room chains)

These are written as chains, as in our `PUZZLE_MECHANICS.md`. Each pattern lists
where it appears.

1. **One substance transforms another.**
   - **Chain:** `water / ice + lava → floor`.
   - *Seasons* (dropped Magic Ice crystals, 2001), *Wind Waker* (thrown water
     pots, 2002) and *Tears of the Kingdom* (a wall hydrant streaming onto lava,
     2023) use the *same* composition across 22 years: first as a multi-floor
     delivery, then a carried consumable, then a fixed machine.
   - Also `fire + vines/webs → passage` and `ice + fire/sunlight → water/key`.

2. **Carry a property across the room.**
   - **Chain:** `lit torch → carried flame → unlit torch → door`.
   - *Ocarina* Deku Tree (a burning stick that burns out, so there's a timer for
     free); *Breath of the Wild* "Passing the Flame".

3. **Deliver a token to a socket.**
   - **Chain:** `orb → path → slot`.
   - *Breath of the Wild* "Drawing Parabolas": tilted platforms throw an Ancient
     Orb along arcs to its Concave Slot.
   - *Wind Waker* Tower of the Gods: statues carried or Command-Melodied onto the
     altar.
   - *Ocarina* Spirit Temple: a statue pushed off a ledge onto a switch.

4. **Catch a moving thing at the right moment (or trigger on a fuse delay).**
   - **Chain:** `timed bomb / moving carrier → cross barrier while fuse ticks → switch flips behind you`.
   - *A Link to the Past* Dark Palace & *Link's Awakening* Color Dungeon: drop a
     live Bomb beside a crystal switch and run across the lowered pegs before the
     blast flips them (`dark-palace.wiki`, `color-dungeon.wiki`).
   - *Oracle of Seasons* Unicorn's Cave: strike a track lever mid-ride from a
     moving mine cart to switch the rails ahead (`eyeglass-lake-and-unicorn-s-cave.wiki`).
   - *Breath of the Wild* "Two Bombs": put a Remote Bomb on a tilted platform and
     detonate it *at its apex* to reach caged crystals (`sho-dantu-shrine.wiki`).
   - *Breath of the Wild* "Stalled Flight": a block rises and falls on a cycle,
     and the electric connection holds only while it's up (`daqa-koh-shrine.wiki`).

5. **Slide a block into a backstop (`Ricochet Robots` routing).**
   - **Chain:** `position backstop block → slide payload block on ice → stops on target`.
   - *The Minish Cap* Temple of Droplets (`temple-of-droplets.wiki`, lines 10–14):
     the Big Key ice block slides right past its sunbeam unless you first slide
     two helper blocks into position as backstops.
   - *Oracle of Seasons* Sword & Shield Dungeon (`temple-remains-and-sword-shield-dungeon.wiki`):
     three ice cubes slid in sequence so each arrests the next on the yellow
     floor tiles.
   - Our `Glazed Crust + Rock Bomb Backstop` (`Dev B5`, Iron Tower `Glaze Works`)
     compresses this into one verb: **create the backstop yourself** with a Rock
     Bomb.

6. **Build a network.**
   - **Chain:** `source → conductor → conductor → sink`.
   - *Breath of the Wild* "The Current Solution": move metal cubes so electricity
     jumps from a generator to a switch.
   - Light does the same with mirrors (*Tears of the Kingdom* "A Reflective
     Device").

7. **Change one global state, re-read every room.**
   - **Chain:** `song → water level → every room changes`.
   - *Ocarina*'s Water Temple (three water levels from Triforce symbols; blocks
     float up with the water).
   - *Breath of the Wild*'s Divine Beasts: one machine you re-pose from its map
     (Naboris' sections rotate 90°; Ruta's trunk repositions a stream).
   - The most memorable dungeons in the set are built this way.

8. **Bend or drop a ray of light across floors.**
   - **Chain:** `open skylight / bomb boulder → light falls onto target below → switch or melt`.
   - *Ocarina* Spirit Temple (Bombchu the boulder, light hits the switch).
   - *Minish Cap* Temple of Droplets (pull upstairs lever, sunlight drops to
     `B1F` and melts the ice block holding the key, `temple-of-droplets.wiki`).
   - *Wind Waker* Earth Temple (mirror shield and reflected light against
     Jalhalla, `earth-temple.wiki`).

9. **Use a second body (or turn an enemy into the tool).**
   - **Chain:** `you hold one switch + partner/enemy holds or breaks the other`.
   - *Wind Waker*'s Command Melody with Medli and Makar.
   - *Spirit Tracks*' Phantoms, including using an enemy's behaviour: *"let it
     see you… it will roll towards you… through the blocks, and destroy them"*
     (the Wrecker Phantom, `the-three-trials-of-the-desert.wiki`).
   - *Ages* Crown Dungeon (`west-rolling-ridge-and-crown-dungeon.wiki`): mirror
     Armos statues that step opposite to you until pinned into place, and Moblins
     whose footsteps reveal an invisible floor over a pit.
   - *Four Swords*' many Links.

10. **Run time backwards.**
    - **Chain:** `object falls → Recall → it carries you back up`.
    - *Tears of the Kingdom* Nachoyah: a raft that fell down a waterfall is
      Recalled to ride back up; clock hands and gears run in opposite directions
      to a portcullis (`nachoyah-shrine.wiki`).

11. **Make the tool the room needs.**
    - **Chain:** `create object → it solves the gap`.
    - *Tears of the Kingdom*'s devices ("A Flying Device", "A Launching Device",
      "Built to Carry", "Building Bridges").
    - *Echoes of Wisdom*'s echoes (a Water Block to swim up through, a
      Trampoline, beds as bridges).
    - *A Link to the Past*'s Somaria blocks.
    - The more powerful the creation, the more a room becomes a *goal* rather
      than a lock.

12. **Trajectories and bank shots.**
    - **Chain:** `launch at an angle → bounce → target`.
    - *Ages*' Seed Shooter in the Moonlit Grotto; *Breath of the Wild* "Drawing
      Parabolas"; *Tears of the Kingdom* "Swing to Hit", "A Precise Strike".

13. **Stored energy.**
    - **Chain:** `freeze an object → hit it → release → it flies`.
    - *Breath of the Wild*'s Stasis launches ("Stasis Trial", "Pushing Power");
      *Tears of the Kingdom* "Force Transfer", "Downward Force".

14. **Perception.**
    - **Chain:** `look differently → a path appears`.
    - *Ocarina* Shadow Temple (Lens of Truth); *Tears of the Kingdom* "Lights Out".

15. **Two systems at once.**
    - The strongest shrines name a pair: "Fire and Ice", "Fire and Water",
      "Ancient Trifecta", "Dual Purpose", "Tandem", "Moving in Parallel".
    - Composition with exactly two parts is the sweet spot the series keeps
      returning to.

### 2.2b Macro-dungeon compositions (how 2D rooms compose into a dungeon)

Beyond single-room chains, the 2D games in `inspiration/` (*Link's Awakening*,
*Oracle of Seasons/Ages*, *A Link to the Past*, *The Minish Cap*) repeat four
multi-room architectural patterns that make a dungeon read as one machine:

1. **The Two-Axis Hub ("Cross Now, Re-Route in Act 2").**
   - *Ages* **Moonlit Grotto** (`crescent-island-and-moonlit-grotto.wiki`: the
     4-spoke crystal wheel hub) and *Seasons* **Dancing Dragon Dungeon**
     (`mount-cucco-and-dancing-dragon-dungeon.wiki`): a central hub room you
     cross on one axis in Act 1, then transform with the midpoint item (or a
     cross-floor drop) in Act 2 to open the perpendicular or vertical route.
   - Feeds our `Rim Crossing / Pit Floor` shaft in Rock Quarry and `Great Forge`
     island stair in Fire Mountain (`DUNGEONS.md`).

2. **Windowing ("See the Lock Three Rooms Before the Key").**
   - Showing a chest, crystal switch, or frozen key across a fence, chasm, or
     lower floor early in Act 1—such as *Link's Awakening*'s **Key Cavern**
     (`key-cavern.wiki`) or *Minish Cap*'s **Temple of Droplets** (`temple-of-droplets.wiki`,
     where you see the frozen Small Key behind a barrier on `B1F` before climbing
     to `1F` to open the skylight). The player builds a mental map of where to
     return before they even find the tool.

3. **Cross-Floor Action at a Distance.**
   - Doing something on `1F` that physically alters `B1F` (or vice versa):
     dropping Magic Ice into four `1F` lava chutes to solidify the `B1F` river in
     *Seasons* **Sword & Shield Dungeon** (`temple-remains-and-sword-shield-dungeon.wiki`),
     or dropping through a `1F` floor hole in *A Link to the Past* **Skull Woods**
     (`skull-woods.wiki`) to land inside a sealed `B1F` room.
   - Feeds Rock Quarry's `2F → 1F` drops and Wind Cliffs' inverted `1F → 2F`
     **Blowhole** (`DUNGEONS.md` §4 Room 6).

4. **Cold Locks Along the Main Trunk.**
   - Planting 2–3 signature obstacles for the dungeon's new item (unlit braziers,
     ice blocks, sand-buried switches, 2-tile gaps) directly along the Act 1
     corridor so that the moment the miniboss drops the new item, the player
     already knows three rooms that just opened up—zero tutorial text required.

### 2.3 How the series changed

- **From keys to rules.** The 2D and *Ocarina*-era dungeons are lock-and-key:
  each item opens its own kind of door. *Breath of the Wild* and *Tears of the
  Kingdom* swap items for **physics rules** (magnetism, momentum, gluing,
  rewinding) that work on anything.
- **From one big dungeon to many small rooms.** `120` main shrines plus `16` DLC
  in *Breath of the Wild*, and `152` in *Tears of the Kingdom* (the files hold
  `138` and `153` pages, counting general pages). Each is one idea, about 5
  minutes, with a title.
- **From one answer to many.** The systemic games expect sequence breaks and
  creative cheese, and design so they still feel earned.
- **The constants survive.** Weight on a switch, fire across a room, water on
  lava, a token to a socket, and a ray to a switch appear in nearly every game
  from 1986 to 2024.

### 2.4 What this means for microbomber

- **Shrine-sized rooms** are our Dungeon 999 rooms. Give each one a **trial
  name** that is its hint ("Stop to Start"), as the shrines do.
- **Our verb is the explosion**, so the strongest borrowings are those where a
  *blast* or *timed fuse* is the actuator:
  - Bomb at the apex or on a fuse delay across a crystal barrier ("Two Bombs",
    Dark Palace)
  - bomb a boulder or burn a rope to drop a weight/bridge across floors (Spirit
    Temple, Temple of Droplets, Sword & Shield Dungeon)
  - water/ice versus lava (Dragon Roost, Sword & Shield Dungeon, Kadaunar → Ice
    versus lava)
  - ice-sliding backstop puzzles (Temple of Droplets → Glazed Crust + Rock Bomb
    backstops)
  - carry a flame (Deku Tree → Fire Bombs and dry-grass fuse lines)
  - scale-filtered passages (Deepwood Shrine mouseholes → Pip's mouseholes that
    block bombs and blocks)
- **Keep to pairs.** The series' best compositions combine *two* systems. That
  matches our "simple, one job per bomb" rule.
- **Homage, not copy.** Take the composition (water on lava, backstop on ice),
  never the room. A Dragon Roost pot puzzle becomes "freeze the lava with an Ice
  Bomb before the fuse of the Bomb you're carrying runs out".

### 2.5 What we leave behind (anti-patterns in the corpus)

Studying `inspiration/` also shows which classic Zelda friction points aged
poorly and how `PUZZLE_MECHANICS.md` replaces them:

| Classic Zelda pattern in `inspiration/` | Why it aged poorly | Our rule in `PUZZLE_MECHANICS.md` |
|---|---|---|
| **Unmarked bombable walls** (*Zelda 1* `underworld-quest-1-dungeon-8.wiki`) | Trial-and-error bombing every wall tile in a dungeon | **Always-seamed `%` walls** (`GAME.md` §7): hide *how* to deliver the bomb, never *whether* a wall breaks |
| **Off-screen riddle orders & ghost memorisation** (*Link's Awakening* `bottle-grotto.wiki` kill order; *Ages* `west-rolling-ridge-and-crown-dungeon.wiki` Armos path) | Forces backtracking to read a plaque or trial-and-error guesswork | **Every state is visible on screen**: `I / II / III` carved on braziers, floor rune traces for local links, flickering timer warnings |
| **Hamiltonian step-every-tile-once floors** (*Ages* `western-woods-and-wing-dungeon.wiki`, `color-dungeon.wiki`) | Static grid arithmetic that halts momentum and resets on one misstep | **Physics, not grid steps**: rolling, bouncing, sliding and drifting bombs with forgiving contact radii |
| **Full-dungeon slippery walking** (*A Link to the Past* Ice Palace; *Ocarina* Ice Cavern) | Makes basic footsteps feel broken in every corridor | **Scoped Glazed Crust** (Fire Mountain lava crust only): slides *bombs and blocks* like curling stones without ruining walking elsewhere |
| **Constant pause-menu item swapping** (*Oracle* Seed Satchel + Feather + Bracelet on two buttons; *Ocarina* Iron Boots) | Breaks flow every 10 seconds in late dungeons | **One actuator (the Bomb)** + in-play quick-swap pill (`Q` / tap) + fixed `B = Roll` / `A = Pull → Drop/Throw` |
