# microbomber roadmap

Burn-down for the puzzle-first, Rube Goldberg, zero-heart, 7-bomb campaign
across [`GAME.md`](GAME.md), [`PUZZLE_MECHANICS.md`](PUZZLE_MECHANICS.md),
[`OVERWORLD.md`](OVERWORLD.md), [`DUNGEONS.md`](DUNGEONS.md), and
[`ASSETS.md`](ASSETS.md). Tick items off as they land; `npm run check` passes at
every tick.

---

## Phase 1–7: Core engine, presentation & ergonomic foundation (done)

- [x] **Phase 1–2:** Deterministic `60 Hz` movement, `B = Roll` (i-frames + buffer),
      `A = Pull → B = Drop / A = Throw` over fences, rolling/rebounding bomb physics.
- [x] **Phase 3–4:** Contact-radius triggers, sloped chutes, fire spread, water
      currents, wind gusts, and the initial 10-room Ice Cave + 9-room Prologue
      vertical slice.
- [x] **Phase 5–6:** Integer device-pixel framing, zone GBC bezels & dialogue strip,
      bundled `CinderholmPixel` font, emissive-only bloom, directional & height-aware
      contact shadows, foot-position depth sorting, and tile-art variety pass.
- [x] **Phase 7:** Fast in-play **Quick-Swap Bomb Pill** (`Tap` / `Q` / `Tab`),
      impact feedback (integer-pixel screen shake, brief hit-stop, mobile haptics),
      **Grandma's Basement (Dungeon 0 — `5` rooms)** starting inside the Mouse
      House with Roll only and earning the **Magic Bomb Sack (`Bomb`)**, and the
      exhaustive **Automated No-Key-Softlock Verifier** (`tests/softlock.test.ts`).

---

## Phase 8: Puzzle-First Pivot — Zero Hearts, Clockwork Creatures & Scrolling Shrines

Align the core simulation, HUD, and existing vertical slice (`Grandma's Basement`,
`Prologue Overworld`, and `Ice Cave`) with the finalized puzzle-first design in
`GAME.md` and `PUZZLE_MECHANICS.md`.

- [ ] **Zero-heart, zero-splashback model (`GAME.md` §1):**
  - [ ] Remove self-blast damage and player HP / hearts from the simulation and
        HUD (own blasts deal `0` damage and apply a `1`-tile knockback hop).
  - [ ] Convert pits (`^`), lava, deep water (`~`), spikes (`!`), and flame jets
        to an instant **`0.35 s` positional hop back** to the last safe tile /
        doorway (never a dungeon-foyer death reset).
  - [ ] Convert Boss and Miniboss hits to knock Pip back / daze (`0.6 s`) or
        reset the current 1-of-3 puzzle phase setup.
- [ ] **Deterministic Clockwork Creatures & room-local persistence (`PUZZLE_MECHANICS.md`):**
  - [ ] Remove erratic bats and aggro-chasing trash mobs (`clear-enemies` locks
        removed).
  - [ ] Implement deterministic **Clockwork Creatures**: **Brass Beetle** (lured
        by Squeak Bomb, frozen into a sliding ice cube by Ice), **Mimic Statue /
        Armos** (cardinal lockstep with Pip or lured off-axis), **Rail Tortoise**,
        and **Pack-Otter** (fuse/bomb carrier).
  - [ ] Make `W` wooden crates and `,` dry grass / powder fuse lines reset on
        room exit (room-local) while `%` cracked walls and `B` brambles/ice
        blocks remain permanent per save.
  - [ ] Render **local floor rune traces** (`decals` layer, glowing when active)
        linking buttons, vanes, and polarity switches to their target shutters,
        bridges, platforms, or lifts.
- [ ] **Grandma's Sewing Buttons (`36`) & Elemental Keys (`4`) economy:**
  - [ ] Replace Heart Pieces / Containers with **Grandma's Sewing Buttons**
        (`HUD_BUTTON ×N/36`) as the single collectible currency, plus the **4
        Elemental Keys** (**Cinder, Zephyr, Rime, Stone**) from Major Dungeon
        bosses.
  - [ ] Button-Lock door primitive for the **6 Relic Shrines (`R1–R6`)** (`2, 5,
        10, 15, 21, 28` Buttons) and Grandma's automatic Satchel milestones (`8`
        Buttons → `3` live bombs, `16` Buttons → reach `2`, `24` Buttons → `4`
        live bombs, `36` Buttons → Dungeon 999 master mousehole).
- [ ] **Hybrid scrolling camera for Shrines & large halls (`GAME.md` §1, `ASSETS.md` §1.1):**
  - [ ] Keep `11 × 13` (`1 × 1`) flip-screens on the Overworld while supporting
        `1 × 2` (`11 × 26`), `2 × 1` (`22 × 13`), and `2 × 2` (`22 × 26`)
        continuous scrolling rooms inside Shrines and Major Dungeon chambers with
        integer pixel-snapped camera follow.
- [ ] **Rework vertical slice (`Prologue + R1/R2 + Ice Cave`) to Rube Goldberg puzzles:**
  - [ ] Add **Squeak Bomb** (`2.5 s` clockwork chirp lure + floating `♪` notes +
        `2.5 s` daze puff), **Relic Shrine 1 (`Hearth Vault → Fire`)**, **Relic
        Shrine 2 (`Chime Grotto → Squeak`)**, and the first tier of **Trial
        Shrines (`T01–T12`)**.
  - [ ] Upgrade **Ice Cave (`10` rooms)** to combine **`Bomb + Fire + Squeak`**
        (delayed chute-and-crystal crossings, crystal-peg block backstops,
        lured Brass Beetles, **Ice Golem** Living Puzzle Gate, and **Ice Wraith**
        3-phase duel awarding the **Cinder Key**).

---

## Phase 9: Multi-Floor, `10 × 10` Overworld & Complete 7-Bomb Arsenal

Build the remaining 4 Bombs (**Wind, Magnet, Ice, Rock**), multi-floor machinery,
and Rube Goldberg movers (`PUZZLE_MECHANICS.md`).

- [ ] **`10 × 10` Overworld grid migration & Mouseholes:**
  - [ ] Shift the built Overworld screens `(+2, +2)` (`Mouse House` at `(5,4)`,
        `Iron Tower` at `(4,1)`, `Ice Cave Arch` at `(5,7)`) and update minimap
        rendering for `10 × 10`.
  - [ ] **Mousehole tile:** passable only by tiny Pip, Squeak Bombs, and
        Pack-Otters; impassable to heavy bombs and blocks.
- [ ] **Multi-floor dungeon machinery (`1F / 2F / B1F`):**
  - [ ] Floor-aware `RoomSpec` coordinates, minimap floor indicator, stairs,
        cargo lifts, **Vertical Drop Shafts** (dropping Pip, crates, spheres, or
        bombs to `(x, y)` on the floor below), and upward **Blowholes** (`1F →
        2F`).
  - [ ] **Cycling & Triggered Moving Platforms** (carrying Pip, live bombs, and
        blocks across pits/lava in calm-air rooms; excluded from Wind Cliffs).
- [ ] **The Remaining 4 Special Bombs & Rube Goldberg Movers:**
  - [ ] **Wind Bomb (`R3`, `10` Buttons):** `0.8 s` fuse (or early A-pop),
        `3 × 3` gust, `2`-tile blast-jump over gaps / up **one-way terraces**,
        **sand piles** (blown clear by Wind, slumping back on Bomb), **wind
        vanes**, and the **`2.5 s` lingering whirlwind vortex** that catapults
        thrown bombs `3–4` tiles downwind.
  - [ ] **Magnet Bomb (`R4`, `15` Buttons):** `1.5 s` magnetic pull field with
        animated flux arcs pulling aligned **metal blocks**, **rolling iron
        spheres**, Rail Tortoises, and live cast-iron Bombs `1–2` tiles toward
        itself; snaps onto and glides along **magnetic floor rails**; pops with
        an **`N ↔ S` polarity pulse**.
  - [ ] **Ice Bomb (`R5`, `21` Buttons):** `1.3 s` `3 × 3` frost nova that
        freezes water and currents (stopping drifting bombs/blocks mid-stream),
        crusts **lava** into slick **glazed crust** (sliding bombs, blocks, and
        spheres until they hit a backstop), snuffs **flame jets** and braziers,
        and freezes Clockwork Creatures for `4 s` into kickable **sliding ice
        cubes**.
  - [ ] **Rock Bomb (`R6`, `28` Buttons):** `1.0 s` fuse; spawns one solid
        carved **Rock block** (making a new one crumbles the old; Bomb shatters
        it) acting as a button weight, curling backstop on glaze/chutes,
        `1`-tile stepping stone in `;`/`!`, immovable windbreak in gust lanes,
        current dam, and dive-stopper.

---

## Phase 10: Campaign Buildout (`36` Shrines, `4` Major Dungeons, `100` Overworld Screens & `Iron Tower`)

Each region ships end-to-end with its Overworld screens, Relic Shrine(s),
Single-Room Trial Shrines, Major Multi-Room Dungeon, and automated route +
no-softlock Vitest suites.

- [ ] **10.1 `Bramble Woods` & `Frost Hollow` (`23` Overworld screens, `R1–R2`, `T01–T12`, `Ice Cave`):**
  - [ ] Complete all `Bramble Woods` and `Frost Hollow` screens, Trial Shrines
        `T01–T12`, and `Ice Cave` (`Cinder Key`).
- [ ] **10.2 `Quarry Hills` (`15` Overworld screens, `R3–R4`, `T13–T21`, `Rock Quarry`):**
  - [ ] `Old Windmill (3,3)` boiler puzzle, `Quarry Lift (1,4)`, Relic Shrines
        `R3` (**Wind**) & `R4` (**Magnet**), Trial Shrines `T13–T21`, and **Rock
        Quarry** (`15` rooms, `2F` rim + `1F` pit, **Mole Foreman** Living Gate,
        **Boulder Golem** boss + **Zephyr Key**).
- [ ] **10.3 `River Valley`, `Coast` & `Fire Mountain Slopes` (`34` Overworld screens, `R5`, `T22–T28`, `Fire Mountain`):**
  - [ ] Relic Shrine `R5` (**Ice**), **Pack-Otter Fuse Heist** across `4` Coast
        screens (`Crescent Cove`, `Tide Pools`, `Driftwood Beach`, `Thief
        Burrows`), Trial Shrines `T22–T28`, and **Fire Mountain** (`20` rooms,
        `1F + B1F`, glazed lava crust curling puzzles, **Fire Salamander**
        Living Gate, **Lava Drake** boss + **Rime Key**).
- [ ] **10.4 `Wind Cliffs Coast` (`9` Overworld screens, `R6`, `T29`, `Wind Cliffs`):**
  - [ ] Frozen `River Ford (7,3)` shortcut, `Windmill Bluff (0,2)` waterfall
        stair, Relic Shrine `R6` (**Rock**), Trial Shrine `T29`, and **Wind
        Cliffs** (`24` rooms, `1F + 2F`, `Blowhole`, cross-gust windbreaks,
        **Harpy** Living Gate, **Storm Bird** boss + **Stone Key**).
- [ ] **10.5 `The Iron Plateau`, `Iron Tower` (`16` rooms) & `Dungeon 999`:**
  - [ ] `10` Iron Plateau screens, Trial Shrine `T30` (*"The Sevenfold Chain"*),
        the **Fourfold Seal** (`4` Elemental Keys), and the **`2 × 2` Iron
        Tower** (`1F–4F`, **Iron Knight** Living Gate, and **The Sorcerer**
        6-element mirror boss duel).
  - [ ] **Dungeon 999 (Developer Test Rig):** `?dev=999` (and 36-Button basement
        mousehole) with wings `A0–A7`, `B1–B21`, and `Toys`.

---

## Phase 11: Real-Phone Polish, Audio & Release Verification

- [ ] **Rube Goldberg visual & audio polish:** travelling fuse sparks, magnetic
      flux arcs, Squeak Bomb floating `♪` notes, glazed-crust curling trails,
      and per-element synthesized Web Audio cues.
- [ ] **Full-campaign automated verification:** end-to-end headless playtest
      suite solving all `36` Shrines, all `4` Major Dungeons, and the `Iron
      Tower`, plus `tests/softlock.test.ts` certification across every dungeon.
- [ ] **Real-phone playtest sign-off:** steady `60 fps`, crisp scrolling camera
      in `1 × 2` / `2 × 2` Shrines, and one-thumb-per-side comfort across the
      full campaign.
