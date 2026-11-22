# microbomber roadmap

Burn-down for the "retro look, modern play" decisions in [`GAME.md` §10](GAME.md)
and the full half-of-*Oracle* campaign (`~190` rooms across [`OVERWORLD.md`](OVERWORLD.md)
and [`DUNGEONS.md`](DUNGEONS.md)). Tick items off as they land; `npm run check`
passes at every tick.

Phases 1–6 (Roll, bomb physics, `Pull → Drop / Throw` ergonomics, physics puzzles,
systemic world and AI, PixiJS lighting/shadows, integer GBC framing, pixel font,
and tile-art variety) are built and committed.

---

## Phase 1–6: Core engine & presentation (done)

- [x] **Phase 1–2:** Deterministic `60 Hz` movement, `B = Roll` (i-frames + buffer),
      `A = Pull → B = Drop / A = Throw` over fences, rolling/rebounding bomb physics,
      `1/4`-heart splashback (exempt on enemy hit), and ground fire damage.
- [x] **Phase 3–4:** Contact-radius triggers, sloped chutes, fire spread, water
      currents, wind gusts, systemic enemy FSM, and the 10-room Ice Cave + 9-room
      Prologue vertical slice.
- [x] **Phase 5–6:** Integer device-pixel framing, zone GBC bezels & dialogue strip,
      bundled `CinderholmPixel` font, emissive-only bloom, directional & height-aware
      contact shadows, foot-position depth sorting, and tile-art variety pass.

---

## Phase 7: Core feel, UX & vertical-slice alignment

Lock down core ergonomics and align the existing vertical slice with the finalized
design in `GAME.md`, `DUNGEONS.md` and `OVERWORLD.md` before scaling out content.

- [x] **Bomb-swapping UX:** fast in-play bomb switching (tappable quick-swap bomb
      pill in the control band + `Q` / `Tab` / `Shift` cycling `cycleEquippedBomb(s)`
      without opening the full `START` pause modal), essential once carrying 3–5
      bomb types.
- [x] **Impact feedback:** integer-pixel screen shake, brief hit-stop, and optional
      mobile haptics (`navigator.vibrate`, toggleable in settings) on blasts, boss
      hits and phase shifts.
- [x] **Grandma's Basement (`DUNGEONS.md` §0 — Dungeon Zero, `5` rooms):**
  - [x] Start inside the **Mouse House (`Room 0`)** with no bombs (`Roll` only) and
        Grandma's opening prompt about your brother raising the Iron Tower.
  - [x] Build the `4`-room cellar (`B1F`) teaching floor switches, **Small Key**,
        the **Magic Bomb Sack (`Bomb`)**, `Pull → Drop` on `%` walls, and
        `Pull → Throw` over `=` fences into crystal switches, exiting to the yard.
- [x] **Ice Cave two-room miniboss split (`DUNGEONS.md` §1):**
  - [x] **Ice Golem Phase 1** in `Alchemist Reliquary (2,1)` (fought with Bombs;
        flees west at half HP, unsealing the **Fire Bomb**).
  - [x] **Ice Golem Phase 2** in `Lantern Hall (1,1)` (regrowing ice armour melted
        with Fire; unlocks midpoint warp pad).
- [x] **Automated No-Key-Softlock verifier:** exhaustive BFS + reverse-reachability
      state-space unit test (`tests/softlock.test.ts`) certifying that no player
      choice of locked door or crystal switch can ever soft-lock a dungeon.
- [ ] **Real-phone playtest checkpoint:** verify Roll, `Pull → Drop / Throw`,
      bomb-swap UX, lighting readability, and steady `60 fps` on a phone.

---

## Phase 8: Multi-floor, `10 × 10` grid & collectible infrastructure

Build the shared world systems required by Chapters 1–5 (`OVERWORLD.md`,
`DUNGEONS.md`).

- [ ] **`10 × 10` Overworld grid migration:** shift the 9 built Overworld screens
      `(+2, +2)` (`Mouse House` at `(5,4)`, `Iron Tower` at `(4,1)`, `Ice Cave Arch`
      at `(5,7)`) and update minimap rendering for `10 × 10`.
- [ ] **Multi-floor dungeon support (`1F / 2F / B1F`):** floor-aware `RoomSpec`
      coordinates, minimap floor indicator, stairs/lifts, and harmless vertical
      drop shafts landing at matching `(x, y)` on the floor below.
- [ ] **Island collectibles & upgrades (`GAME.md` §6, `OVERWORLD.md`):**
  - [x] **Heart Pieces (`12` total, `4` per Heart Container):** update from 2-shard
        pairs to 4-piece hearts (`3 → 10` max hearts).
  - [ ] **Grandma's Sewing Buttons (`36`):** pickup sprite, HUD/menu counter, and
        Grandma's reward logic (`1` Heart Piece per `12` buttons returned).
  - [ ] **Mousehole tile:** passable by tiny Pip, impassable to bombs, blocks and
        enemies, for secret cellars and two-way shortcuts.

---

## Phase 9: Campaign buildout (`~190` rooms)

Each chapter ships end-to-end with its new bomb, at most two new terrain pieces,
Overworld biome(s), Shrine, and automated route + no-softlock Vitest suites.

### 9.1 Chapter 1: `Bramble Woods` & `Frost Hollow` (`OVERWORLD.md`)
- [ ] Remaining `Bramble Woods` (`7` screens) and `Frost Hollow` (`16` screens)
      with overworld ice walls, skating slimes, icicle ravines, `Old Icehouse`
      Heart Piece, buttons, and `Hollow's End ↔ South Beach` mousehole.

### 9.2 Chapter 2: `Quarry Hills` & Shrine 2 — `Rock Quarry` (`15` rooms, **Wind Bomb**)
- [ ] **Wind Bomb:** `0.8 s` fuse (or early A-pop), `3 × 3` gust, `2`-tile
      blast-jump over gaps/up ledges, and `2.5 s` lingering whirlwind vortex that
      catapults thrown Bombs/Fire `3–4` tiles downwind.
- [ ] **New pieces:** **sand piles** (scattered back by Bomb, blown clear by Wind)
      and **one-way terraces** (drop down freely, blast-jump up one tier).
- [ ] **Overworld (`15` screens):** `Old Windmill (3,3)` boiler puzzle, `Quarry
      Lift (1,4)` two-way shortcut, `Quarry Hills` screens, `Stone Steps` Heart Piece.
- [ ] **Rock Quarry (`2F` rim + `1F` pit, `15` rooms):** Rim Crossing drop shaft,
      cargo lift, Magic Bomb Sack upgrade (`2 → 3` live bombs), **Mole Foreman** (Phases
      1 & 2 across rooms 14–15), and **Boulder Golem** boss + Zephyr Core.

### 9.3 Chapter 3: `River Valley`, `Coast`, `Fire Mountain Slopes` & Shrine 3 — `Fire Mountain` (`20` rooms, **Ice Bomb**)
- [ ] **Pack-Otter Fuse Heist (`Coast`, `4` screens):** dud-bomb throw/drop bonk in
      `Crescent Cove (9,4)` → recover **Wind** → `Tide Pools (8,6)` for **Fire** →
      `Driftwood Beach (9,5)` for **Bomb** → `Thief Burrows (9,6)` Heart Piece &
      `North Beach ↔ Hot Springs` ferry.
- [ ] **Overworld (`34` screens):** `River Valley` (`9`), `Coast` (`13`, including
      `River Estuary (7,9)`), and `Fire Mountain slopes` (`12`).
- [ ] **Ice Bomb:** `1.3 s` fuse, `3 × 3` ice nova that freezes water, crusts lava
      into walkable **glazed crust** (sliding bombs & blocks in Fire Mountain),
      puts out fire/flame jets, and freezes small enemies for `4 s`.
- [ ] **New pieces:** **lava** (crusts with Ice, melts with Fire) and **flame jets**
      (beat-timed fire vents snuffed permanently by Ice).
- [ ] **Fire Mountain (`1F + B1F`, `20` rooms):** Great Forge island hub, glazed
      crust puzzles, **Fire Salamander** (Phases 1 & 2 across rooms 9–10), and
      **Lava Drake** boss + Rime Core.

### 9.4 Chapter 4: `Wind Cliffs Coast` & Shrine 4 — `Wind Cliffs` (`24` rooms, **Rock Bomb**)
- [ ] **Overworld (`9` screens):** frozen `River Ford (7,3)` shortcut, `Windmill
      Bluff (0,2)` frozen waterfall stair, and `Wind Cliffs coast` screens.
- [ ] **Rock Bomb:** `1.0 s` fuse; spawns one solid pushable **rock block**
      (making a new one crumbles the old; Bomb shatters it) acting as weight,
      stopper, windbreak, and stepping stone in 1-tile channels/gaps.
- [ ] **New pieces:** **steady gust vents** (blocked by Rock windbreaks) and
      **gaps** + the cross-floor **blowhole** (`1F → 2F`).
- [ ] **Wind Cliffs (`1F` caves + `2F` clifftop, `24` rooms):** Tide Hall hub,
      blowhole bridge puzzle, Magic Bomb Sack upgrade (`3 → 4` live bombs), **Harpy**
      (Phases 1 & 2 across rooms 11–12), and **Storm Bird** boss + Stone Core.

### 9.5 Chapter 5: `The Iron Plateau` & Finale — `Iron Tower` (`16` rooms, all bombs)
- [ ] **Overworld (`10` screens):** storm-swept `Iron Plateau` screens, four-element
      gate on `Tower Causeway (4,3)`, and Fourfold Seal in `Tower Courtyard (4,2)`.
- [ ] **Iron Tower (`1F..4F`, `16` rooms):** four `2 × 2` elemental floors around
      the **Central Lift Warp Pad**, **Iron Knight** miniboss (Phases 1 & 2 across
      rooms 7–8), **The Sorcerer (Your Brother)** 4-element mirror duel, and
      ending sequence.

---

## Phase 10: Audio, renderer & post-launch polish

- [ ] **Music & ambience:** GBC-style chiptune themes (Millbrook, Overworld,
      Shrine, Miniboss, Boss, Iron Tower, Ending) + mute/volume persistence.
- [ ] **Renderer optimization (if needed for mid-range phones):** move Canvas2D
      albedo/G-buffer layers (`gbc.ts`, `gbcAux.ts`) directly onto Pixi sprites
      and hand-paint hero normal maps.
- [ ] **Optional relic (`GAME.md` §10):** unlockable **bomb-laying roll** charm for
      late-game / post-game secret trials.
