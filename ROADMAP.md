# microbomber roadmap

Burn-down for the "retro look, modern play" decisions in [`GAME.md` §10](GAME.md).
Tick items off as they land; every phase ends with a phone playtest before the
next starts. `npm run check` passes at every tick.

## Phase 1: Roll and Pull out

Two fixed verbs, tuned before physics and AI are built on top of them.

- [x] **One equipped bomb:** replace `slots: [B, A]` with `equipped: BombKind | null`;
      saves migrate (`equipped = slots[0]`).
- [x] **START menu:** pick the equipped bomb or **None**; the game pauses.
- [x] **B = Roll:** about `2` tiles in `0.25 s` along the stick (or facing when
      idle), i-frames for the middle `0.15 s`, `0.35 s` recovery; slides along walls
      and stops at solids.
- [x] ~~**Roll lays a bomb:** the equipped bomb is left where the roll started.~~
      Built, then removed as the default (2026-11-22); kept as a possible unlock
      (see Later).
- [x] **A = Pull out:** hold to lift and carry, release to throw, quick tap to drop
      at your feet (move today's tap/hold/release logic onto A alone).
- [x] **Analog throw:** aim along the stick's exact angle (360°) with a fixed lob.
- [x] **Arc preview:** a dotted throw arc while carrying (replaces the throw marker).
- [x] **Input buffer:** presses during roll recovery or the bomb cooldown fire when
      they end (`100–150 ms` window).
- [x] **Magnetized pickups:** pickups drift to Pip within about `1` tile.
- [x] **Pip roll frames:** south, north, east (west flipped), wired into `drawPip`.
- [x] **Snappy motion pass:** squash and stretch on landing and popping, eased
      tweens for pickups, doors and push blocks, anticipation on the lift.
- [x] **Control band:** B labelled Roll, A labelled Pull out with the equipped
      bomb's icon.
- [x] **Tests:** roll distance, i-frames, recovery, bomb laying, buffer, migration.
- [x] **Docs:** rewrite `GAME.md` §2 for Roll and Pull out.
- [ ] **Playtest checkpoint:** roll length, i-frame window and buffer feel on a
      phone.

## Phase 2: Bomb physics

- [x] **Fixed timestep:** a `60 Hz` simulation with an accumulator in the main
      loop; `tick` always takes the fixed `dt`, so tests stay deterministic.
- [x] **Bomb bodies:** position, velocity and radius; friction; rebound off solid
      tiles; pits swallow; water stops them (drift comes in Phase 4).
- [x] **Throw lands and rolls:** the lob arc hands off to bounce and roll.
- [x] **Kick:** walking into a grounded bomb sends it rolling.
- [x] **Blast shove:** a radial impulse on bombs, enemies, push blocks and Pip (one
      knockback model for all of them).
- [x] **Chains:** a shoved bomb that's hit again detonates; impact detonation for
      thrown Blackpowder still applies.
- [x] **Grace and traps:** recheck walk-through grace and doorway rules with moving
      bombs (never trapped, never knocked out of a room).
- [x] **Tests:** deterministic scenarios for bounce, roll-out distance, kick, shove
      and chains.
- [ ] **Playtest checkpoint:** friction, bounciness and kick strength.

## Phase 3: Physics puzzles

- [x] **Contact triggers:** switches, braziers, buttons and cracked walls react to
      bombs and blasts by contact radius, not tile.
- [x] **Slopes:** a directional slope tile (rules, art, autotiling) that rolls
      bombs downhill.
- [x] **Ember Crypt rework**, room by room, using rolling and banking:
  - [x] Crypt Foyer
  - [x] Block Antechamber
  - [x] Crystal Crossroads
  - [x] Vault of Sparks
  - [x] Alchemist Reliquary
  - [x] Lantern Hall (miniboss)
  - [x] Bramble Crypt
  - [x] Hall of Three Flames
  - [x] Sanctum Ante-Room
  - [x] Sanctum of Ash (boss)
- [x] **Overworld secrets:** recheck every cracked-wall and bramble secret.
- [x] **Tests:** each puzzle has a scripted solve; the doorway walk test still
      passes.
- [ ] **Playtest checkpoint:** every room solvable and readable on a phone.

## Phase 4: Systemic world and AI

- [x] **Spreading fire:** dry grass and brambles burn tile by tile; crates burn;
      braziers in range light; water and stone stop it.
- [x] **Water currents:** bombs float and drift; current tiles.
- [x] **Wind:** gusts carry smoke, fire and light objects (groundwork for Gale).
- [x] **Enemy state machines:** patrol, notice, chase, recover, with clear
      wind-up telegraphs.
- [x] **Fuse awareness:** enemies flee lit fuses and stumble when hit.
- [x] **World reactions:** bats put out flames, slimes split in fire, shielders
      kick bombs back.
- [x] **Bosses:** Wickgeist and Cinderhull updated for physics bombs and the new AI.
- [x] **Tests:** fire-spread bounds, current drift, AI state transitions.
- [ ] **Playtest checkpoint:** emergent chaos stays fair and readable.

## Mechanic change (2026-11-22): place and kick

- [x] **A = Place:** a press puts the equipped bomb just in front of Pip (cardinal
      facing, centred in the lane); lift, carry, throw and the arc preview are gone.
- [x] **Orthogonal kicks:** walking into a bomb kicks it along the dominant axis
      only; kicked Blackpowder impact-detonates on enemies.
- [x] **Puzzles re-verified:** every Ember Crypt scripted solve passes with place
      and kick.
- [ ] **Playtest checkpoint:** placing and kicking feel on a phone.

## Phase 5: PixiJS renderer (HD-2D lite)

Built 2026-11-22 but **not yet seen running**: headless-browser verification was not
available, so every item below is unit-tested and type-checked only until the first
playtest.

- [~] **PixiJS port:** done as a presentation layer (`src/render/hd/hdView.ts`): the
      Canvas2D renderer still composes the native-resolution albedo frame and a sprite
      G-buffer (`gbcAux.ts`), and PixiJS lights, blooms, grades, adds particles and
      presents. Falls back to Canvas2D without WebGL. Moving the layers themselves
      onto Pixi sprites is still open.
- [x] **Lighting:** normal-mapped point lights from braziers, fire patches, Ember
      flasks, fuse sparks, blast flashes, projectiles, warp pads, the exposed boss
      core and Pip's lantern (dark rooms only); per-zone ambient and sun
      (`lights.ts`). Flames, blasts and sparks are emissive.
- [x] **Auto normal maps:** derived in the shader from albedo luminance (lighter =
      raised, ink = edge) for all tiles and non-hero sprites.
- [~] **Hand normal maps for hero assets:** Pip, Wickgeist and Cinderhull have
      hand-tuned height profiles (per palette index plus a dome) drawn into the
      G-buffer; per-pixel hand-painted maps and the landmark stamps are still open.
- [x] **Bloom and colour grading:** bright pass blurred at native resolution and
      added back; per-zone saturation, contrast and tint in the lighting pass.
- [x] **Particles:** sparks, smoke, debris, embers, dust and splash droplets from
      game events, plus rising embers from fires and braziers (`particles.ts`).
- [x] **Room slides:** eased `0.32 s` push between adjacent rooms with parallax cloud
      shadows in the overworld; portals and respawns still fade.
- [ ] **Performance:** a steady `60 fps` on a mid-range phone.
- [ ] **Playtest checkpoint:** readability of bombs and blast reach under lighting.

## Later and revisit

- [ ] **Impact feedback:** decide on hit-stop, screen shake and haptics once
      physics lands.
- [ ] **Hand-author the remaining normal maps** if we keep this lighting.
- [ ] **Bomb-laying roll (unlockable):** a satchel upgrade or Shrine relic that
      makes rolls leave the equipped bomb behind, with puzzles built for it
      (`GAME.md` §10).
