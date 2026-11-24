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

## Phase 7.5: Puzzle Lab — from pocket puzzles to whole-screen machines

The lab (`tools/puzzle-lab`, `puzzle-lab.html`) is how rooms for Phases 8–10 get
designed and proved. Its job is to deliver what
[`PUZZLE_MECHANICS.md`](PUZZLE_MECHANICS.md) sets out: whole-screen
`3`–`5`-stage machines (Principle 4), "aha" solves, kit restrictions, and
`A → A' → A''` triads (Principle 5). Every state should be visible (Principle 6),
every room resettable (Principle 7), and every primitive testable in Dungeon 999.

**Where it stands (audit of `P01–P50`, 2026-11-23).** All `50` rooms solve,
replay, and pass the critic. They still fall short of the doc:

- **They are pockets, not screens.** The interior is `14 × 18` (`252` cells).
  The rooms use `9`–`62` of those cells, and their mechanisms fit in boxes from
  `4 × 5` to `10 × 9`, walled into the middle of the screen. Each is an
  `11 × 13`-era puzzle. `P42` *Grand Clockwork Synthesis* is a `6 × 4` pocket.
- **They are short.** The solved routes run `1`–`9` macro steps. The solver
  stops at depth `10` and `4000` states, so a real whole-screen machine can't be
  certified. The suite has been sized to the solver, not to the design.
- **The critic counts features, not insight.** The creativity score gives points
  for things that happen (a prop with two jobs, Self-Cryo, a stolen flame). So a
  `3`-step room can rate "masterpiece." Several things go unchecked:
  - that the obvious idea fails;
  - that the solver's solution is the designed one and not a shortcut past a
    stage;
  - that each triad's Act II and Act III defeat the previous act's solve.

  Dungeon 999 already tests "the tempting wrong one"; the lab doesn't.
- **None of it is in the game.** The lab is a separate model, with one tick
  standing for `0.5 s`. Most of its primitives don't exist in
  `src/game/world.ts`: lasers, mirrors, fans, turntables, sluices, rafts,
  springs, grates, veils, crates and carts. Its timings drift from the game's: a
  lab Bomb fuse is `4` ticks (`≈ 2 s`), the game's is `3 s`. No lab room can be
  played.
- **Rooms aren't placed.** The `P` codes don't map to the `R1–R6` / `T01–T30`
  catalogue (`DUNGEONS.md`) or to the bomb unlock order. So nothing says which
  bombs a room may assume, or which primitive it teaches before it twists it.
- **Two principles go unchecked:** that every state is visible (Principle 6),
  and that Pip can always walk out to reset a room he has spoiled (Principle 7).

Design comes first. The lab's model is the spec: rooms are designed and proved
there in full, and only then are the mechanics they need built in the game.
Nothing is built in `world.ts` that a certified room doesn't use.

### Part 1: Design the rooms in the lab

- [ ] **L1. Timings in seconds.**
  - [ ] Fix one seconds-per-tick for the lab. Where the game already has a
        mechanic, take its timing from `world.ts` (`BOMB_FUSES`, `SPEED`,
        whirlwind, freeze, daze, fire per tile, `CURRENT_SPEED`), with a test
        that fails when they drift apart. Where it doesn't, the lab's timing in
        seconds becomes the spec the game must meet later.
  - [ ] The critic reports each solve's tightest timing window in seconds. Rooms
        must leave thinking-pace slack: the puzzle is the plan, not the
        execution.
- [ ] **L2. A solver that scales to a whole screen.**
  - [ ] Search **stages**: split the room into regions joined by gates (fences,
        barriers, `G` gates, ledges, water). Solve each region with macro moves,
        and search across regions on their abstract state (what's open, what's
        where). Add canonical state keys and dominance pruning.
  - [ ] Target: certify a `15`–`25`-macro-step, `4`-stage room in under `5 s`
        in tests.
  - [ ] Keep today's exhaustive search for pocket rooms, and cross-check both
        solvers on them.
- [ ] **L3. A critic that measures the intent.**
  - [ ] Every entry carries its **intended solution** as named stages, plus
        **`1`–`3` tempting wrong plans** (what a player tries first). The
        intended plan must replay, and every tempting plan must fail. The
        solver's shortest solve must pass through every intended stage, so no
        unintended shortcut skips one.
  - [ ] **Triad check:** Act II must reject Act I's solution, and Act III must
        reject both. This is Principle 5's escalation, tested.
  - [ ] Count **stages** (sub-goals reached by separate causal chains) rather
        than macro steps. Require `3`–`5` stages for a full room.
  - [ ] **Walk-out check:** from every state the solver reaches, Pip can still
        get back to the entrance and reset the room (Principle 7).
  - [ ] **Legibility check:** every signal source and its sink are adjacent, in
        line of sight, or joined by a declared rune trace. No hidden state
        (Principle 6).
  - [ ] Re-base the creativity score on these checks. Stop scoring a feature
        just for appearing.
- [ ] **L4. Whole-screen rooms.**
  - [ ] Keep `P01–P50` as a **stage library**, each tagged with its inputs and
        outputs (a lowered barrier, a crate on a plate, a lit brazier, Pip on
        level `1`).
  - [ ] The composer chains `3`–`5` library stages across the full interior,
        with each stage's output gating the next region. Rooms must span at
        least `12 × 14` of the interior.
  - [ ] First targets:
    - a whole-screen Act III for each of the four triads;
    - a real `P42` Grand Synthesis;
    - one whole-screen room per primitive family in `PUZZLE_MECHANICS.md`.
  - [ ] Then the full set: every Relic Shrine (`R1–R6`), every Trial Shrine
        (`T01–T30`), and the puzzle rooms of each Major Dungeon.
  - [ ] The viewer shows each room's stages, the intended plan, and the tempting
        plans failing, and lets you play the room by hand.
- [ ] **L5. Place rooms in the campaign.**
  - [ ] Assign each whole-screen room to an `R` / `T` slot or a dungeon room
        (`DUNGEONS.md`). Its kit must only use bombs unlocked by that slot, and a
        triad's three acts go in consecutive slots.
  - [ ] Coverage report: every primitive is taught plainly (an Act I room)
        before any room twists it.
  - [ ] Backport list: for each primitive, how many placed rooms need it and
        the earliest slot that does. This orders Part 2.

**Design done when** the first-target rooms pass the L3 critic in the lab, all
four triads at full size and the real `P42` among them, and are placed in L5.
The full set can keep growing in the lab while Part 2 runs.

### Part 2: Backport the mechanics to the game

- [ ] **L6. Build what the rooms need, in the order they need it.**
  - [ ] Write each primitive's lab rules down as its spec in
        `PUZZLE_MECHANICS.md` (what moves it, what it blocks, its timing in
        seconds).
  - [ ] Implement primitives in `world.ts` in the backport list's order:
        earliest slot first, then most rooms. This takes over the mover items
        in Phase 9.
  - [ ] For each primitive, a **parity test**: the same scenario in the lab and
        in the game must end the same way.
- [ ] **L7. Rooms into Dungeon 999, then the campaign.**
  - [ ] A lab → `RoomSpec` exporter. Every exported room joins a Dungeon 999
        lab wing with a rig test, like the 999 trials: it replays the intended
        plan at `60 Hz`, shows the tempting plans failing, and checks that no
        walking or single-bomb solve exists.
  - [ ] Once a room holds at `60 Hz`, it moves to its campaign slot (Phase 10).

**Done when** the first-target rooms are playable in Dungeon 999, with every
intended plan and tempting plan holding at `60 Hz`.

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
- [ ] **Two screen sizes (`GAME.md` §1.1, `ASSETS.md` §1.1):**
  - [ ] Per-zone room size: `11 × 13` in Grandma's House and basement, `22 × 26`
        everywhere else, each screen shown whole at the same on-screen size.
  - [ ] Convert every Overworld, Ice Cave and Dungeon 999 room (space doubles,
        objects don't), with `2×` trees and braziers; re-tune the 999 puzzles.
- [ ] **Hybrid scrolling camera for Shrines & large halls (`GAME.md` §1, `ASSETS.md` §1.1):**
  - [ ] Rooms spanning more than one `22 × 26` screen inside Shrines and Major
        Dungeon chambers, with integer pixel-snapped camera follow.
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
