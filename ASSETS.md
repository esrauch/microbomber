# `microbomber` — GBC Seamless Pixel-Art Asset Plan (`Oracle of Ages` / `Zelda DX`)

This plan defines the visual architecture, multi-tile kits, sprite specifications, and room-scale upgrade needed to move `microbomber` from NES-style isolated `16 × 16` squares to the continuous, storybook Game Boy Color craft of *Oracle of Ages* (`OoA`) and *Link's Awakening DX* (`LADX`).

---

## 1. Core Architectural Decisions

### 1.1 `11 × 13` Room Grid (`176 × 208` Logical Pixels)
- Expand `ROOM_W × ROOM_H` from `9 × 11` to **`11 × 13` tiles** (odd on both axes so doorways, bridges, and altars center cleanly at `(5, 6)`, matching GBC *Zelda*'s ~`10`-tile horizontal screen density).
- **Why `11 × 13` is foundational:** A full **`2`-tile-deep perimeter**—whether **`2 × 2` interlocking forest trees**, **`2`-tall rock cliffs**, or **`2`-tile-deep *Oracle* dungeon walls**—still leaves a roomy **`7 × 9` playable interior** with space for **`3 × 2` and `3 × 3` landmarks**.
- Update `SaveData` version (`version: 2`) so stale `9 × 11` local saves cleanly reset instead of spawning out of bounds.

### 1.2 Authentic `2`-Tile-Deep Dungeon Walls & Recessed Archways
- Shrine perimeters use `OoA` / `LADX` **`2`-tile (`32px`) beveled wall construction**:
  - **Outer Ring (`dist = 0` from edge):** Flat dark ceiling/parapet cap with `45°` diagonal miter joints at the corners.
  - **Inner Ring (`dist = 1` from edge):** Sloped masonry wall face (`N, S, E, W` perspectives, `A/B` `32px` staggered stone courses so `16px` repetition disappears) meeting the `7 × 9` floor.
  - **Recessed `2`-Tile Doorway Tunnels:** Passages cut cleanly through both rings (`2` tiles deep), framed by carved stone jambs and oriented **`N / S / E / W` archways**, Key Doors (`D`), Horned Boss Doors (`K`), and Iron Portcullises (`S`).

### 1.3 GBC Colour & Palette Rules (`gbcPalette.ts` & `gbcArt.test.ts`)
- **15-bit `RGB555` colour space** enforced across every palette (`isRgb555`).
- **Backgrounds (`BG`) — Strict `4` Colours per `8 × 8` Quarter-Tile (`≤ 8` Palettes per Zone):**
  - Preserves authentic GBC tile harmony and per-quarter `quads: [TL, TR, BL, BR]` assignment.
  - Terrain palettes (`grass`, `foliage`, `cliff`, `water`, `floor`, `wall`) use **chromatic darks** (deep forest pine, rich umber, deep plum-slate, abyssal navy) rather than jet black, so actors pop cleanly off painted ground.
- **Sprites (`OBJ`) — `5–6` Colours + Transparent (`'.'` + `'1'..'6'`, `≤ 8` Named Sprite Palettes):**
  - Relaxed from `3` to **up to `6` `RGB555` colours per sprite** so characters, bombs, NPCs, and bosses achieve full `OoA` multi-tone richness in clean single-layer definitions (e.g. Pip's amber hood + brass/cyan goggles + peach skin + cobalt tunic + dark ink outline; dark iron bombs with live orange-gold sparks; thorny green-and-amber `Cinderhull` carapace with glowing red eyes).

### 1.4 Semantic Map Characters + Landmark `stamps[]`
Keep `RoomSpec.rows` human-readable in `campaign.ts` by adding semantic terrain characters (mapped to clean walk/solid rules in `world.ts`) alongside explicit multi-tile `stamps`:
- **Solid terrain (`blocks walk`):**
  - `'#'` — Cliff escarpment (Overworld) / `2`-tile beveled stone wall (Shrines)
  - `'Y'` — Forest tree (Overworld, auto-paired into `2 × 2` interlocking canopies!)
- **Walkable ground (`open floor`):**
  - `'.'` — Meadow grass (Overworld) / Dungeon flagstone (Shrines)
  - `':'` — Trodden dirt trail / Village cobble path (`8 × 8` blob-edged against grass)
  - `'_'` — Planked timber footbridge / Causeway stone bridge deck (spans `~` or `^` with connected side rails)
- **Existing interactive tiles:** `'%'` (cracked cliff/wall), `'~'` (water), `'^'` (pit), `'='` (connected wood fence / stone balustrade), `'B'` (connected bramble web), `'W'` (crate), `'P'` (push-block), `'C' / 'R' / 'U'` (crystal orb & pegs), `'T'` (brazier), `'D' / 'K' / 'S'` (oriented doors), `'O'` (button), `'!'` (spikes), `'>'` (stairs / warp).
- **Landmark `stamps?: StampSpec[]` on `RoomSpec`:** Overlays bespoke `3 × 2` and `3 × 3` buildings, arches, and seals at `(x, y)` over underlying `#` / `.` collision tiles.

### 1.5 Proportions, `3/4` Overhead Overlap & Boss Scale
- **Regular Actors (`16 × 18`–`16 × 20`):** Pip, villagers, and standard foes stand on a `16 × 16` foot tile with `2–4px` of crown/hood headroom and soft ground shadows.
- **Overhead Render Pass (`Pass 4`):** Tree crowns, cottage roof eaves, and northern doorway arch lintels render *after* Y-sorted actors so Pip tucks naturally behind roofs, lintels, and forest canopies.
- **Minibosses (`24 × 24`) & Shrine Bosses (`32 × 32` = `2 × 2` tiles):** `Wickgeist` (`24 × 24`) and `Cinderhull` (`32 × 32`) command genuine `OoA` boss presence inside the `7 × 9` sanctum.

### 1.6 Unified Pixel HUD & GBC Framed UI
- Replace all OS emojis (`❤️`, `💔`, `🖤`, `🩷`, `🗝️`, `💣`, `🔥`, `🎯`) in `#topbar` and `#controls` with crisp nearest-neighbor `<canvas>` / `<img>` data-URI sprites baked directly from `gbcArt.ts`.
- Style `#topbar`, the Boss HP bar, and the Storybook Dialogue Box with classic GBC double-lined pixel frames and RGB555-matched colours.

---

## 2. Seamless Multi-Tile Kits (`src/render/art/`)

### Kit A — `CHR8` (`8 × 8` Subtile) Blob Engine
Each blob terrain defines **5 `8 × 8` subtiles** (`Interior`, `H-Edge`, `V-Edge`, `Outer Convex Corner`, `Inner Concave Bend`) plus `flipX / flipY` flags to generate all **47 seamless shapes** with zero internal seams:
1. **Waterbanks (`~`):** Scalloped grass/ochre bank lip + `1px` animated white foam around `3`-frame scrolling azure water ripples.
2. **Crumbling Pit Rims (`^`):** Continuous recessed stone/earth rim; northern edges expose `5px` of vertical rock wall descending into abyss.
3. **Dirt & Cobble Paths (`:`):** Rounded road edges with overlapping grass-blade tufts connecting doorways, village plazas, and bridges.
4. **Shrine Perimeter Floor Trim:** `1`-tile recessed stone border hugging the inner dungeon wall ring around smooth, unboxed interior flagstones (plus subtle worn-crack variants and **`2 × 2` Carved Central Medallions**).

### Kit B — Overworld Foliage & Escarpment Cliffs
1. **`2 × 2` Interlocking Round-Canopy Trees (`Y`, `32 × 32` px):**
   - `treeNW, treeNE, treeSW, treeSE` for standalone `2 × 2` trees, plus **`treeOvlW, treeOvlE`** where stacked vertical tree rows overlap crowns seamlessly (the signature `LADX` / `OoA` forest border!).
   - Isolated `1 × 1` `Y` / `#` cells automatically fall back to a sculpted **Mossy Boulder** or **Cut Stump**—never a lone brick.
2. **`2`-Tall Layered Escarpment Cliffs (`#`):**
   - Upper row renders **Mossy Cliff Brow** (`NW, N, NE, W, Plateau, E`); lower south-facing row renders **Striated Stone Cliff Face** (`SW, FaceA, FaceB, SE`) with `32px` rock crevices + `2px` grass shadow below.
   - **Bombable Cliff Cave Seam (`%`):** `cliffCracked` inset seamlessly into `FaceA / FaceB` with unmistakable dark fracture lines and talus stones (`GAME.md` §7).

### Kit C — Vertical Slice Multi-Tile Landmark Stamps (`stamps[]`)

| Stamp ID | Footprint | Room(s) | Visual Composition |
|---|---|---|---|
| `bram-workshop` | `3 × 2` (`48 × 32`) | `Millbrook Square (3,2)` | Pitched slate-amber roof (overhead eaves), round attic window, brass alembic flue + animated smoke puff, timber-frame front wall & arched door. |
| `rusted-smithy` | `3 × 2` (`48 × 32`) | `Millbrook Square (3,2)` | Weathered red-shingle forge roof, stone chimney, quenched trough & rusted iron anvil beside the `%` rubble pocket. |
| `causeway-bridge` | `5 × 3` / modular `_` | `Spire Causeway (2,1)` | Dressed stone parapet piers & arched causeway deck spanning the moat (`~`) with water ripples visible North & South. |
| `spire-seal-gate` | `5 × 3` + `3 × 3` dais | `Spire Courtyard (2,0)` | Looming rusted-iron Spire gatehouse (`N` wall) + `3 × 3` octagonal carved floor seal with **4 individual Elemental Core pedestals** (`Cinder` lights up gold/flame once reclaimed!). |
| `crypt-mausoleum` | `3 × 2` (`48 × 32`) | `Ember Crypt Arch (3,5)` | Carved sandstone-and-obsidian flame arch set into the canyon cliff, flanked by twin braziers (`T`), framing the `%`-sealed `>` descending stair. |

### Kit D — `2`-Tile Shrine Architecture & Connected Props (`Ember Crypt`)
- **Outer Cap Ring & Inner Sloped Wall Ring:** `45°` mitered outer corners, `45°` mitered inner corners, concave `L`-corners, and `A/B` alternating `N / S / E / W` stone faces.
- **Oriented `2`-Tile Doorway Tunnels (`N / S / E / W`):**
  - Carved outer arch + inner jamb pillars for open passages, Small-Key Doors (`D`), Horned Boss Doors (`K`), and riveted Iron Portcullises (`S`).
  - `Cracked Dungeon Wall (`%`)` oriented to `N / S / E / W` sloped faces with crumbled mortar & floor chips.
- **Connected Linear Props:**
  - **Outdoor Wooden Rail Fence (`=`):** `fenceW ── fenceH ── fenceE` & `fenceN / fenceV / fenceS`.
  - **Indoor Stone Balustrade (`=` in Shrines):** Connected low carved stone rail with square end-finials.
  - **Connected Bramble Web (`B`):** Interlocking thorny vines that bridge across adjacent `B` tiles and anchor onto `#`/`Y` walls.
  - **Connected Timber Footbridge (`_`):** Planked deck + post-and-rope rails (`H` & `V`).

---

## 3. Sprites, VFX & UI Icons (`OBJ`, up to `6` RGB555 Colours Each)

### 3.1 Pip (the Fuse Mouse)

Pip is a **fuse mouse** whose tail is a fuse with a glowing spark (emissive in the G-buffer, like bomb fuses).
- **Poses (`MOUSE_*`, S/N/E, west = east flipped):** upright idle facing the viewer (with spark
  flicker and blink), a 4-frame **four-legged gallop**, a crouch shown for 0.08 s when he starts
  or stops running, lift/throw, item get and a 3-frame fall. Pushing is a slow gallop.
- **Palette (`'mouse'`):** spark yellow, pink ears/paws, fawn fur, brown shade and fuse cord, white
  belly / white-hot spark, ink.
- **Hitbox:** the centred half-size circle (`r = 0.14`); the art (~11 px upright, ~15 px side gallop) overhangs it.

### 3.2 Bombs & Connected Blast VFX
- **Blackpowder Bomb (`10 × 10` body in `16 × 16` cell):** Round dark-slate iron body, big specular rim, and live orange-gold rope spark (`Sizzle 1, Sizzle 2, Crimson Swell, White-Gold Flash`).
- **Ember Bomb (`10 × 10` body in `16 × 16` cell):** Brass-necked ruby alchemical flask with swirling golden liquid flame (`Swirl 1, Swirl 2, Incandescent Swell, Flash`).
- **Connected `+` Cross Explosion (`Blackpowder`):**
  - `blastHub`, `blastArmH`, `blastArmV`, `blastCapN / S / E / W` across `4` frames (`White-Gold Core → Billowing Flame → Soot Ring → Dispersing Puffs`) so `1`–`2` tile `+` blasts form one continuous fiery cross instead of disconnected circles; impact/single-tile blasts use a `4`-frame radial starburst.
- **Ember Hearth Patch (`16 × 16`):** `4`-frame crackling ember bed + dancing flame tongues.

### 3.3 Cast, Enemies & Bosses
- **Cinderholm Cast (`16 × 18`, `2`-frame lively idle):**
  - **Master Bram** (white beard, brass monocle, singed leather sapper apron), **Guard Hal** (weathered cloak & rusted spear hilt), **Keeper Fern** (botanical hood & satchel), and **Carved Runed Stele** (`spire-plaque`).
- **Common Foes (`16 × 18`):**
  - **Moss-Slime (`3` frames):** Glossy emerald jelly with inner leaf/core (`Idle, Squash, Hop`).
  - **Cinder-Bat (`3` frames):** Plum wings + bright ember eyes (`Wings Up, Glide, Tuck`).
  - **Bramble Shielder (`S / N / E` directional sprites):** Armored imp holding an integrated thorn-and-oak buckler on its facing side (plus unshielded state once burned by Ember).
- **Bosses:**
  - **Wickgeist (`24 × 24`):** Hooded lantern phantom swinging a ghostly censer (`2` spectral cyan-indigo frames in darkness; `2` materialized violet-crimson frames recoiling in brazier light).
  - **Cinderhull (`32 × 32` = `2 × 2` tile Shrine Boss):**
    - *Armored:* Gnarled green-and-amber briar carapace (`2`-frame breathing/scuttling motion) with glaring red eyes behind the thorns.
    - *Exposed:* Charred obsidian shell split wide open around a pulsing incandescent orange-white Cinder Core (`2`-frame throb + regrowing thorn flash).

### 3.4 Pixel HUD & Control Icons (`12 × 12` / `16 × 16`)
- `uiHeartFull`, `uiHeartHalf`, `uiHeartEmpty`, `uiHeartShard`, `uiSmallKey`, `uiBossKey`, `uiCinderCore`, `uiThrowArc`, `uiGear`, `uiSoundOn`, `uiSoundOff` — rendered at crisp integer scale in `#topbar`, `#controls`, and settings.

---

## 4. Code & Verification Plan

1. **Modularize Art Sources (`src/render/art/`):**
   - `gbcPalette.ts` — `RGB555` helpers, `8` `4`-colour `BG` palettes per zone, `8` `6`-colour `OBJ` palettes.
   - `chr8.ts` — `8 × 8` subtile primitives, `H/V` flip composer, and `47`-state blob resolver.
   - `overworldArt.ts` — Grass/path/water/pit `CHR8` sets, `2 × 2` trees, `2`-tall cliffs, fences/bridges, and the `5` Vertical Slice landmark stamps.
   - `shrineArt.ts` — `2`-tile mitered dungeon walls, `N/S/E/W` recessed doorway tunnels & doors, floor border + `2 × 2` medallions, stone balustrades, braziers, switches, blocks.
   - `spritesArt.ts` — `6`-colour Pip (`16 × 18`), bombs, connected `+` blasts, NPCs, directional enemies, `24 × 24` `Wickgeist`, `32 × 32` `Cinderhull`, and pixel HUD icons.
2. **Migrate Campaign to `11 × 13` (`src/game/types.ts`, `src/game/campaign.ts`, `src/game/world.ts`, `tests/*.test.ts`):**
   - Reshape all `19` Vertical Slice rooms (`9` Overworld + `10` Ember Crypt) to `11 × 13` with `2 × 2` tree borders, `2`-tall cliffs, winding `:` paths, `_` bridges, `stamps[]` landmarks, and `2`-tile-deep Shrine walls while preserving every puzzle, secret, and test invariant (`doorways.test.ts`, `world.test.ts`, `campaign.test.ts`, `movement.test.ts`).
3. **4-Pass Layered Renderer & Pixel HUD (`src/render/gbc.ts`, `src/main.ts`, `index.html`):**
   - `Pass 1` Ground/Blobs → `Pass 2` Walls/Trunks/Stamp Bases → `Pass 3` Y-Sorted Actors → `Pass 4` Overhead Canopies/Eaves/Lintels + Airborne Bombs + Connected Blasts + Bayer Lantern Mask.
   - Swap `#topbar`, dialogue box, Boss bar, and `#controls` icons to pixel art + GBC double-lined borders.
4. **Automated Magnified Proof Sheets (`tools/make-sprites.ts` & `tests/gbcArt.test.ts`):**
   - `gbcArt.test.ts` verifies `RGB555` compliance, `4`-colour `8 × 8` `BG` quarters, `≤ 6`-colour `OBJ` sprites, and valid stamp dimensions.
   - `npm run make-sprites` outputs both a **Tile & Sprite Contact Sheet** and a **Stitched Full-Room Proof Sheet** (`Millbrook Square`, `Spire Courtyard`, `Ember Crypt Arch`, `Crypt Foyer`, `Crystal Crossroads`, `Lantern Hall`, `Sanctum of Ash`) for `6 ×` visual seam inspection alongside live mobile Playwright screenshots.
