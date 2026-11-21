import { describe, expect, it } from 'vitest';
import { ROOM_W, campaignWorld, newState, tileAt } from '../src/game/world';
import {
  BG,
  CRYPT_FLOOR_BLOB,
  OBJ,
  PATH_BLOB,
  PIT_BLOB,
  STAMP_DEFS,
  THICKET_BLOB,
  WATER_BLOB,
  resolveBlobTile,
} from '../src/render/gbcArt';
import { buildRoomLayout } from '../src/render/gbcAutotile';
import {
  BG_PALETTES,
  BG_PALETTE_IDS,
  OBJ_PALETTES,
  OBJ_PALETTE_IDS,
  isRgb555,
} from '../src/render/gbcPalette';

describe('GBC colour and multi-tile rules', () => {
  it('has at most 8 sprite palettes of 6 colours, and 8 background palettes of 4 per zone', () => {
    expect(OBJ_PALETTE_IDS.length).toBeLessThanOrEqual(8);
    for (const id of OBJ_PALETTE_IDS) expect(OBJ_PALETTES[id]).toHaveLength(6);
    expect(BG_PALETTE_IDS.length).toBeLessThanOrEqual(8);
    for (const zone of Object.values(BG_PALETTES)) {
      expect(Object.keys(zone)).toHaveLength(BG_PALETTE_IDS.length);
      for (const id of BG_PALETTE_IDS) expect(zone[id]).toHaveLength(4);
    }
  });

  it('uses only colours the GBC can show (RGB555)', () => {
    const all = [
      ...Object.values(OBJ_PALETTES).flat(),
      ...Object.values(BG_PALETTES).flatMap((z) => Object.values(z).flat()),
    ];
    for (const c of all) expect(isRgb555(c), `${c.join(',')}`).toBe(true);
  });

  it.each(Object.entries(OBJ))('sprite %s is rectangular, ≤6 colours plus transparent', (_, s) => {
    const w = s.rows[0]?.length ?? 0;
    expect(w).toBeGreaterThan(0);
    for (const row of s.rows) {
      expect(row).toHaveLength(w);
      expect(row).toMatch(/^[.1-6]*$/);
    }
    expect(OBJ_PALETTE_IDS).toContain(s.pal);
  });

  it.each(Object.entries(BG))('tile %s is 16x16 with one 4-colour palette per quarter', (_, t) => {
    expect(t.rows).toHaveLength(16);
    for (const row of t.rows) expect(row).toMatch(/^[0-3]{16}$/);
    expect(t.quads).toHaveLength(4);
    for (const q of t.quads) expect(BG_PALETTE_IDS).toContain(q);
  });

  it('generates valid 16x16 tiles across all 256 8-neighbour blob masks and scalloped water seams', () => {
    for (const kit of [WATER_BLOB, PIT_BLOB, PATH_BLOB, THICKET_BLOB, CRYPT_FLOOR_BLOB]) {
      for (let mask = 0; mask < 256; mask++) {
        const t = resolveBlobTile(kit, {
          n: Boolean(mask & 1),
          ne: Boolean(mask & 2),
          e: Boolean(mask & 4),
          se: Boolean(mask & 8),
          s: Boolean(mask & 16),
          sw: Boolean(mask & 32),
          w: Boolean(mask & 64),
          nw: Boolean(mask & 128),
        });
        expect(t.rows).toHaveLength(16);
        for (const r of t.rows) expect(r).toMatch(/^[0-3]{16}$/);
      }
    }

    // Water shorelines are organically scalloped (never ruler-straight '11111111' capsule lines)
    expect(WATER_BLOB.edgeH).not.toContain('11111111');
    expect(WATER_BLOB.edgeS).not.toContain('11111111');
    expect(new Set(WATER_BLOB.edgeV).size).toBeGreaterThan(3);

    // Quadrant seams join cleanly between corners and straight banks
    for (let y = 0; y < 8; y++) {
      expect(WATER_BLOB.outerNW[y]?.[7]).toBe(WATER_BLOB.edgeH[y]?.[7]);
      expect(WATER_BLOB.outerSW?.[y]?.[7]).toBe(WATER_BLOB.edgeS?.[y]?.[7]);
    }
    expect(WATER_BLOB.outerNW[7]).toBe(WATER_BLOB.edgeV[7]);
    expect(WATER_BLOB.outerSW?.[0]).toBe(WATER_BLOB.edgeV[7]);
  });

  it('links every landmark stamp cell to a defined BG tile', () => {
    for (const [id, cells] of Object.entries(STAMP_DEFS)) {
      expect(cells.length, id).toBeGreaterThan(0);
      for (const c of cells) {
        expect(BG[c.tile], `${id} -> ${c.tile}`).toBeDefined();
      }
    }
  });

  it('Y-sorts 3/4 overhead tiles behind southern braziers while keeping north doorway lintels on ceiling', () => {
    const world = campaignWorld();

    // Ember Crypt Arch: crypt-mausoleum at y=4 sorts behind lit braziers at y=5
    const archState = newState(world, 'overworld', 3, 5, 5.5, 8.0);
    const archPlan = buildRoomLayout(world, archState);
    expect(archPlan.ceiling).toHaveLength(0);
    const mausoleum = archPlan.overhead.filter((o) => o.y === 4 && o.x >= 4 && o.x <= 6);
    expect(mausoleum).toHaveLength(3);
    for (const m of mausoleum) {
      expect(m.transparentZero).toBe(false);
      for (const t of archState.torches) {
        expect(m.y + 0.99).toBeLessThan(t.y + 0.55);
      }
    }

    // Crystal Crossroads: open north tunnel (5,0) puts archLintelN on the walk-under ceiling layer
    const cryptState = newState(world, 'ember-crypt', 1, 2, 5.5, 6.5);
    const cryptPlan = buildRoomLayout(world, cryptState);
    expect(cryptPlan.ceiling).toEqual([
      { x: 5, y: 0, tile: BG.archLintelN, transparentZero: true },
    ]);
  });

  it('authors carved stone trough chutes (slopeN/S/E/W) and routes flat overlays to plan.decals', () => {
    const patterns = new Set([
      BG.slopeN.rows.join(''),
      BG.slopeS.rows.join(''),
      BG.slopeE.rows.join(''),
      BG.slopeW.rows.join(''),
    ]);
    expect(patterns.size).toBe(4);
    for (const stTile of [BG.slopeN, BG.slopeS]) {
      // Raised 3-0-1-3 / 3-1-0-3 stone side curbs on non-joint rows
      expect(stTile.rows[0]?.slice(0, 4)).toBe('3013');
      expect(stTile.rows[0]?.slice(12, 16)).toBe('3103');
    }

    const world = campaignWorld();
    world.rooms.set('ember-crypt:9,9', {
      zone: 'ember-crypt',
      rx: 9,
      ry: 9,
      name: 'Decal vs Prop Test Chamber',
      condition: 'hold-buttons',
      rows: [
        '###########',
        '###########',
        '##O..!..>##',
        '##...n...##',
        '##..w.e..##',
        '##...s...##',
        '##.W=..C.##',
        '##.R.U.T.##',
        '##...B...##',
        '##.......##',
        '##.......##',
        '###########',
        '###########',
      ],
    });
    const st = newState(world, 'ember-crypt', 9, 9, 5.5, 9.5);
    // Default crystalColor is 'red', so 'R' is raised (props) and 'U' is lowered (decals)
    const plan = buildRoomLayout(world, st);

    expect(plan.decals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 5, y: 3, tile: BG.slopeN }),
        expect.objectContaining({ x: 5, y: 5, tile: BG.slopeS }),
        expect.objectContaining({ x: 6, y: 4, tile: BG.slopeE }),
        expect.objectContaining({ x: 4, y: 4, tile: BG.slopeW }),
        expect.objectContaining({ x: 2, y: 2, tile: BG.buttonUp }),
        expect.objectContaining({ x: 5, y: 2, tile: BG.spikes }),
        expect.objectContaining({ x: 8, y: 2, tile: BG.stairs }),
        expect.objectContaining({ x: 5, y: 7 }), // lowered 'U' barrierDown
        expect.objectContaining({ x: 5, y: 6, tile: BG.sealRingCenter }),
      ]),
    );

    // Raised 3D obstacles remain in plan.props, never plan.decals
    expect(plan.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 3, y: 6, tile: BG.crate }),
        expect.objectContaining({ x: 4, y: 6, tile: BG.balusterSingle }),
        expect.objectContaining({ x: 7, y: 6 }), // crystal switchOrb
        expect.objectContaining({ x: 3, y: 7 }), // raised 'R' barrierUp
        expect.objectContaining({ x: 7, y: 7, tile: BG.brazier0 }),
        expect.objectContaining({ x: 5, y: 8, tile: BG.brambleSingle }),
      ]),
    );
    expect(plan.props.some((p) => p.tile === BG.slopeN || p.tile === BG.sealRingCenter)).toBe(
      false,
    );
  });

  it('frames side borders as a seamless thicket and varies the round trees along the top', () => {
    const world = campaignWorld();
    // Bramble Woods: a north tree border (y = 0..1) and two-column side borders
    const woodsState = newState(world, 'overworld', 3, 3, 5.5, 6.5);
    const plan = buildRoomLayout(world, woodsState);
    const allTreeTiles = [...plan.props, ...plan.overhead];

    // Round trees along the top, between the side bands, never repeat the adjacent crown
    const crowns = [2, 4, 6].map((x) => allTreeTiles.find((p) => p.x === x && p.y === 0)?.tile);
    for (const c of crowns) expect(c).toBeDefined();
    expect(crowns[0]).not.toBe(crowns[1]);
    expect(crowns[1]).not.toBe(crowns[2]);
    expect(allTreeTiles.some((p) => p.tile === BG.treeSW || p.tile === BG.treeSW_B)).toBe(true);

    // Side-band trees are thicket ground tiles, not round trees
    for (const x of [0, 1, ROOM_W - 2, ROOM_W - 1]) {
      expect(allTreeTiles.some((p) => p.x === x && p.y === 6)).toBe(false);
      expect(plan.ground.some((p) => p.x === x && p.y === 6)).toBe(true);
    }

    // Meadow trims only along round trees; the thicket's own rim covers the sides
    expect(plan.decals.some((d) => d.tile === BG.forestEdgeN)).toBe(true);
    expect(plan.decals.some((d) => d.tile === BG.forestEdgeW)).toBe(false);
    expect(plan.decals.some((d) => d.tile === BG.forestEdgeE)).toBe(false);
  });

  it('places subtle crypt flagstone variants and the crack, moss and rug decals without overlapping mechanics', () => {
    const world = campaignWorld();
    const seenGroundVars = new Set<typeof BG.cryptFloorVarA>();
    const seenDecals = new Set<typeof BG.cryptDecalCrack>();
    const cryptDecalSet = new Set([
      BG.cryptDecalCrack,
      BG.cryptDecalMoss,
      BG.cryptDecalScorch,
      BG.cryptDecalRug,
    ]);

    for (const room of world.rooms.values()) {
      if (room.zone !== 'ember-crypt') continue;
      const st = newState(world, 'ember-crypt', room.rx, room.ry, 5.5, 6.5);
      const plan = buildRoomLayout(world, st);

      for (const g of plan.ground) {
        if (g.tile === BG.cryptFloorVarA || g.tile === BG.cryptFloorVarB) {
          seenGroundVars.add(g.tile);
        }
      }
      for (const d of plan.decals) {
        if (!cryptDecalSet.has(d.tile)) continue;
        seenDecals.add(d.tile);
        // Never overlaps portals, buttons, chutes, walls, or (5,6) center seal
        expect(tileAt(world, st, st.zone, st.rx, st.ry, d.x, d.y)).toBe('.');
        expect(d.x === 5 && d.y === 6).toBe(false);
        expect(room.portals?.some((p) => p.x === d.x && p.y === d.y) ?? false).toBe(false);
      }
    }

    expect(seenGroundVars.has(BG.cryptFloorVarA)).toBe(true);
    expect(seenGroundVars.has(BG.cryptFloorVarB)).toBe(true);
    expect(seenDecals.has(BG.cryptDecalCrack)).toBe(true);
    expect(seenDecals.has(BG.cryptDecalMoss)).toBe(true);
    // Scorch marks read as dirt or spiders at this size, so they are never placed
    expect(seenDecals.has(BG.cryptDecalScorch)).toBe(false);
    expect(seenDecals.has(BG.cryptDecalRug)).toBe(true);
  });

  it('grounds Bram Workshop and Rusted Smithy with stone plinths and cobble doorstep aprons', () => {
    // Bottom row (row 15) of both buildings has a solid dark mortar foundation plinth
    for (const bTile of [
      BG.workshop_0_1,
      BG.workshop_1_1,
      BG.workshop_2_1,
      BG.smithy_0_1,
      BG.smithy_1_1,
      BG.smithy_2_1,
    ]) {
      expect(bTile.rows[14]).not.toBe('0000000000000000');
      expect(bTile.rows[15]).toContain('33333333');
    }

    const world = campaignWorld();
    const sqState = newState(world, 'overworld', 3, 2, 5.5, 6.5);
    const sqPlan = buildRoomLayout(world, sqState);

    // Foundation cobble plinth pads under workshop (x=1..3, y=2) and smithy (x=7..9, y=3)
    expect(sqPlan.decals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 1, y: 2, tile: BG.buildingPlinthW }),
        expect.objectContaining({ x: 2, y: 2, tile: BG.buildingPlinthM }),
        expect.objectContaining({ x: 3, y: 2, tile: BG.buildingPlinthE }),
        expect.objectContaining({ x: 7, y: 3, tile: BG.buildingPlinthW }),
        expect.objectContaining({ x: 8, y: 3, tile: BG.buildingPlinthM }),
        expect.objectContaining({ x: 9, y: 3, tile: BG.buildingPlinthE }),
      ]),
    );

    // Walkable doorstep aprons south of workshop (2,3; 3,3) and smithy (7,4; 8,4), skipping 'Y' trees (1,3; 9,4)
    expect(sqPlan.decals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 2, y: 3, tile: BG.buildingApronDoor }),
        expect.objectContaining({ x: 3, y: 3, tile: BG.buildingApronE }),
        expect.objectContaining({ x: 7, y: 4, tile: BG.buildingApronW }),
        expect.objectContaining({ x: 8, y: 4, tile: BG.buildingApronDoor }),
      ]),
    );
    expect(sqPlan.decals.some((d) => d.x === 1 && d.y === 3 && d.tile === BG.buildingApronW)).toBe(
      false,
    );
    expect(sqPlan.decals.some((d) => d.x === 9 && d.y === 4 && d.tile === BG.buildingApronE)).toBe(
      false,
    );
  });
});
