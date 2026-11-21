# Fuse Mouse hero (tiny-actor mode)

The half-size experiment's hero becomes the **fuse mouse**: upright on his hind legs when
idle (facing the viewer by default), **galloping on all four legs** when moving. His tail
is a fuse with a live spark at the tip. Prototype frames were approved from a scratch sheet;
this file is the resumable checklist for the real asset set.

## Decisions

- Shown only in tiny mode (`ACTOR_SCALE < 1`, Settings toggle or `?tiny=1`); full-size Pip
  is unchanged.
- **Hitbox stays the centred circle** (`PLAYER_RADIUS * 0.5`). The art overhangs it,
  especially the ~15 px side gallop; nothing in `world.ts` changes.
- Sprites live on the usual 16x16 canvas, drawn at Pip's anchor (`x*16-8`, `y*16-10`), feet
  on the bottom row. West is east flipped.
- **Palette `mouse`:** 1 spark yellow, 2 ear/paw pink, 3 grey fur, 4 dark grey shade and fuse
  cord, 5 white belly (and white-hot spark flicker), 6 ink. Pip and the mouse are never on
  screen together, so at most 8 sprite palettes are loaded at once (the GBC limit stays).
- The spark (index 1) glows: emissive in the G-buffer, like the bomb fuses.

## Asset checklist (names `MOUSE_*`; S/N/E = facing)

- [x] Idle, upright: `S/N/E_IDLE` and `_IDLE_B` (spark flicker; blink on S) - 6
- [x] Gallop: `S/N/E_RUN_1..4` (stretch, gather, stretch, gather) - 12
- [x] Roll: `ROLL_1..2`, curled ball with ears and spark, shared by all facings - 2
- [x] Push: no frames of its own; a slow gallop into the block (`RUN_1..2`)
- [x] Lift / throw: `S/N/E_LIFT`, `S/N/E_THROW`, upright, paws up - 6
- [x] Item get: `GET`, upright facing you, paws raised - 1
- [x] Fall into a pit: `FALL_1..3`, curling and shrinking - 3

## Code checklist

- [x] `mouse` palette in `gbcPalette.ts`; palette test counts palettes on screen at once
- [x] Sprites in `gbcSprites.ts` (new "Fuse mouse" section)
- [x] `tinyActors.ts` maps every `PIP_*` pose to its `MOUSE_*` frame
- [x] `drawPip`: in tiny mode, movement plays the 4-frame gallop (`RUN_1..4` by step)
- [x] `gbcAux.ts`: `MOUSE_*` are heroes with a mouse height table; spark is emissive
- [x] Contact shadow widens for the side gallop
- [x] Item-get: held item sits above the mouse's raised paws
- [x] Tests updated (mapping, aux); `npm run check` passes
- [x] Phone screenshots: idle, gallop east/west/south/north, crypt (roll not captured)
- [x] `ASSETS.md` note; `PIP_TINY_*` set removed (the mouse covers every pose)

## Follow-ups (not started)

- [ ] Grey fur is low-contrast on the purple crypt floor; try a warmer or lighter fur shade there
- [ ] Posture change from upright idle to gallop pops; a 1-2 frame drop-to-all-fours transition
- [ ] Check roll, lift/throw, item get and fall in play (drawn, not yet seen in game)
