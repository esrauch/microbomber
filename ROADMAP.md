# microbomber roadmap

Burn-down for the "retro look, modern play" decisions in [`GAME.md` §10](GAME.md).
Tick items off as they land; every phase ends with a phone playtest before the
next starts. `npm run check` passes at every tick.

Phases 1-5 (Roll, bomb physics, physics puzzles, systemic world and AI, the
PixiJS renderer) and the place-and-kick change are built and committed; what is
left from them is under [Future milestones](#future-milestones).

## Phase 6: Make it look professional

Phone screenshots of the Square, Entry Hall, Lantern Hall and Bramble Woods
showed the pixel art is mostly fine; the jank is in the framing, filtering, depth
sorting and dressing. Five changes, in order of impact.

### 6.1 Pixel-perfect framing

The `176 × 208` frame is stretched about `2.05×` on a `375 px` phone, so art
pixels come out at uneven sizes and shimmer in motion.

- [x] **Integer scaling:** present at a whole number of device pixels per art
      pixel (`5×` on a `411 px @ 2.625×` phone) and centre it; nearest-neighbour
      only.
- [x] **Bezel instead of dead bands:** fill the empty space above and below the
      playfield with a GBC-style frame in the zone's palette.
- [x] **Dialogue strip:** move dialogue into a fixed text area in the bezel so it
      never covers the play area.
- [x] **Tests:** the integer-scale chooser for common phone and desktop sizes.

### 6.2 One pixel-art UI language

The HUD, dialogue, boss bar and controls use the system font and generic rounded
web buttons (`ASSETS.md` §1.6 specifies the GBC double-lined box; it was never
built).

- [x] **Decide the font:** a bundled open-licence (OFL) pixel font, or one we
      draw (authored in-repo `8 × 8` GBC TrueType SFNT `CinderholmPixel`).
- [x] **Pixel font everywhere:** HUD, dialogue, boss bar, START menu.
- [x] **Pixel-art controls:** B and A buttons with pressed states, and a pixel
      joystick ring and knob.
- [x] **No truncated text:** the objective line wraps or scrolls instead of
      ending in an ellipsis.
- [x] **One box style:** every panel uses the same double-lined GBC frame.

### 6.3 Re-tune lighting and bloom

Bloom keys off brightness, so sunlit sand and grass glow and the overworld looks
hazy and smeared. Outdoor lighting is flat. The crypt and dark-room torch pools
already work.

- [x] **Emissive-driven bloom:** bloom only flames, blasts, sparks and warp pads
      (the G-buffer's emissive channel), not bright ground.
- [x] **Shadows:** a stronger directional sun outdoors, soft contact shadows under
      characters, bombs and props, and darkening along wall bases.
- [x] **Cleaner light pools:** remove the muddy red-brown cast from the lantern and
      keep shadows in the zone's ink colour rather than grey.

### 6.4 Draw order and grounding

A bomb placed north of Pip, and a slime, draw on top of his head; Pip stands on
top of the floor medallion; nothing has a shadow.

- [x] **Sort by foot position:** every actor, bomb and prop sorts by where it
      touches the ground, so things north of Pip draw behind him.
- [x] **Decals below actors:** floor medallions and chute arrows always draw
      beneath actors.
- [x] **Height-aware shadows:** every actor and bomb casts a shadow that follows
      its height, including bombs mid-hop.
- [x] **Tests:** the depth-sort order for stacked actors, bombs and props.

### 6.5 Tile-art variety pass

The biggest art job.

- [x] **Tree borders:** `3-4` canopy variants plus an edge treatment, so walls
      stop repeating one canopy.
- [x] **Water:** natural autotiled shorelines with animated foam, replacing the
      capsule pond.
- [x] **Crypt floors:** flagstone variants and occasional decals (cracks, moss,
      scorch, rugs) to break up the flat fields.
- [x] **Chutes:** carved stone troughs with motion lines instead of conveyor
      chevrons.
- [x] **Grounded buildings:** a foundation and path apron under the workshop and
      smithy.

### Phase 6 checkpoint

- [x] **Screenshot review:** retake the four rooms (and a blast mid-explosion,
      which the first pass missed) on a phone-sized viewport and compare.
- [ ] **Playtest checkpoint:** does it look and feel like a finished game on a
      real phone?

## Future milestones

Left over from earlier phases, not yet scheduled.

### Playtests on a real phone

- [ ] **Roll:** roll length, i-frame window and input-buffer feel.
- [ ] **Bomb physics:** friction, bounciness and kick strength.
- [ ] **Place and kick:** how placing in front of Pip and kicking feel.
- [ ] **Physics puzzles:** every Ice Cave room solvable and readable.
- [ ] **Systemic world and AI:** fire spread, wind and enemy reactions stay fair
      and readable.
- [ ] **Lighting:** bombs and blast reach stay readable under the lit renderer.

### Renderer

- [ ] **Move the layers onto Pixi sprites:** today the Canvas2D code (`gbc.ts`)
      still composes the native-resolution albedo frame and the sprite G-buffer
      (`gbcAux.ts`) and PixiJS lights and presents it; move ground, props,
      Y-sorted actors, overhead and ceiling onto Pixi itself.
- [ ] **Performance:** a steady `60 fps` on a mid-range phone.
- [ ] **Hero normal maps:** Pip, Wickgeist and Cinderhull have hand-tuned height
      profiles (per palette index plus a dome); hand-paint per-pixel maps for them
      and for the landmark stamps.
- [ ] **Hand-author the remaining normal maps** if we keep this lighting.

### Game feel and design

- [ ] **Impact feedback:** decide on hit-stop, screen shake and haptics.
- [ ] **Bomb-laying roll (unlockable):** a satchel upgrade or Shrine relic that
      makes rolls leave the equipped bomb behind, with puzzles built for it
      (`GAME.md` §10).
