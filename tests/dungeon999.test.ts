import { describe, expect, it } from 'vitest';
import {
  ALL_BOMBS,
  BOMB_FUSE,
  BOMB_FUSES,
  FIRE_FUSE,
  FIXED_DT,
  campaignWorld,
  currentRoom,
  enterDungeon999,
  enterRoom,
  equipBomb,
  isButtonPressed,
  newState,
  tick,
  tileAt,
  windVectorAt,
} from '../src/game/world';
import { placeDownChute, pullA, stepSeconds, stepTicks, tapA } from './input';

describe('Dungeon 999: The Developer Dungeon & 7-Bomb Rube Goldberg Rig', () => {
  const world = campaignWorld();

  it('starts in Lobby: Measuring Hall (0, 0) with all 7 bombs unlocked, maxBombs=4, blastRadius=2, and zero self-blast damage', () => {
    const s = newState(world);
    enterDungeon999(world, s);
    expect([s.zone, s.rx, s.ry]).toEqual(['dungeon-999', 0, 0]);
    expect(currentRoom(world, s)?.name).toBe('Lobby: Measuring Hall');
    expect(s.unlockedBombs).toEqual([...ALL_BOMBS]);
    expect(s.maxBombs).toBe(4);
    expect(s.blastRadius).toBe(2);

    const direct = newState(world, 'dungeon-999', 0, 0);
    expect(direct.unlockedBombs).toEqual([...ALL_BOMBS]);
    expect(direct.maxBombs).toBe(4);
    expect(direct.blastRadius).toBe(2);

    // Standing right next to own Bomb detonation deals zero HP damage in dungeon-999
    const hpBefore = direct.hp;
    tapA(world, direct);
    expect(direct.bombs).toHaveLength(1);
    stepSeconds(world, direct, BOMB_FUSE + 0.15);
    expect(direct.hp).toBe(hpBefore);
  });

  it('resets broken/burned/frozen tiles, blocks, solved state, and crystal colour when leaving and re-entering any dungeon-999 room', () => {
    const s = newState(world, 'dungeon-999', 0, -1, 5.5, 8.5);
    expect(tileAt(world, s, 'dungeon-999', 0, -1, 7, 8)).toBe('%');

    // Break '%' at (7, 8), flip crystal to blue, and freeze a tile
    s.x = 6.2;
    s.y = 8.5;
    s.fx = 1;
    s.fy = 0;
    s.aimX = 1;
    s.aimY = 0;
    tapA(world, s);
    stepSeconds(world, s, BOMB_FUSE + 0.15);
    expect(tileAt(world, s, 'dungeon-999', 0, -1, 7, 8)).toBe('.');
    s.crystalColor = 'blue';
    s.frozenTiles?.add('dungeon-999:0,-1:4,4');
    s.solvedRooms.add('dungeon-999:0,-1');
    s.blocks[0]!.x = 4;

    // Leave to Lobby (0, 0) and re-enter A1 (0, -1)
    enterRoom(world, s, 'dungeon-999', 0, 0, 5.5, 6.5);
    enterRoom(world, s, 'dungeon-999', 0, -1, 5.5, 8.5);

    expect(tileAt(world, s, 'dungeon-999', 0, -1, 7, 8)).toBe('%');
    expect(s.crystalColor).toBe('red');
    expect(s.frozenTiles?.size ?? 0).toBe(0);
    expect(s.solvedRooms.has('dungeon-999:0,-1')).toBe(false);
    expect(s.blocks[0]?.x).toBe(3);
  });

  it('A1 (0, -1): Bomb rolls down sloped e -> s chutes into crystal C to flip red -> blue', () => {
    const s = newState(world, 'dungeon-999', 0, -1, 3.5, 3.5);
    expect(s.crystalColor).toBe('red');
    equipBomb(s, 'bomb');
    placeDownChute(world, s);
    expect(s.bombs).toHaveLength(1);
    stepSeconds(world, s, BOMB_FUSE + 0.2);
    expect(s.crystalColor).toBe('blue');
  });

  it('A2 (1, -1): Fire Bomb ignites a dry-grass (,) fuse line that spreads tile-by-tile to light a distant brazier T', () => {
    const s = newState(world, 'dungeon-999', 1, -1, 2.5, 3.5);
    equipBomb(s, 'fire');
    s.fx = 1;
    s.fy = 0;
    s.aimX = 1;
    s.aimY = 0;

    const topTorch = (): boolean => s.torches.find((t) => t.x === 7 && t.y === 3)?.lit ?? false;
    expect(topTorch()).toBe(false);

    // Drop Fire Bomb at the west mouth of the 4-tile ',' dry-grass fuse line (x=3..6 -> T at 7,3)
    tapA(world, s);
    stepSeconds(world, s, FIRE_FUSE + 0.1);
    // Immediately after detonation, fire starts at x=3 and has not yet spread all 4 tiles to (7,3)
    expect(s.fires.length).toBeGreaterThan(0);
    expect(topTorch()).toBe(false);

    // Advance for tile-by-tile fire spread across (3,3)->(4,3)->(5,3)->(6,3) to ignite T at (7,3)
    stepSeconds(world, s, 2.0);
    expect(topTorch()).toBe(true);
  });

  it('A3 (1, 0): Wind Bomb (0.8s fuse) blast-jumps Pip across a 2-tile gap and leaves a 2.5s whirlwind vortex that catapults a thrown Bomb across a 3-tile chasm', () => {
    const s = newState(world, 'dungeon-999', 1, 0, 3.5, 3.5);
    expect(BOMB_FUSES.wind).toBe(0.8);
    equipBomb(s, 'wind');
    s.fx = 1;
    s.fy = 0;
    s.aimX = 1;
    s.aimY = 0;

    // 1. Place Wind Bomb at Pip's feet / ahead while facing East across the 2-tile pit (x=4..5, y=3)
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'wind',
      x: 3.3,
      y: 3.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: BOMB_FUSES.wind,
      graceOverlap: true,
      shoveCount: 0,
    });
    const events = stepSeconds(world, s, BOMB_FUSES.wind + 0.1);
    expect(events).toContain('boom-wind');
    expect(events).toContain('wind-jump');
    expect(s.x).toBeGreaterThan(6.0);
    expect(isButtonPressed(world, s, 7, 3)).toBe(false);

    // Verify a 2.5s lingering whirlwind vortex was spawned
    const vortex = s.gusts.find((g) => g.vortex);
    expect(vortex).toBeDefined();
    expect(vortex!.remaining).toBeGreaterThan(2.0);

    // 2. Spawn a whirlwind vortex at (3.5, 8.5) facing East across the 3-tile chasm (x=4..6, y=8)
    s.gusts = [];
    s.x = 2.2;
    s.y = 8.5;
    s.fx = 1;
    s.fy = 0;
    s.aimX = 1;
    s.aimY = 0;
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'wind',
      x: 3.5,
      y: 8.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    expect(s.gusts.some((g) => g.vortex)).toBe(true);

    // Throw a regular Bomb East into the whirlwind vortex -> catapults across x=4..6 to flip C (8,8) & break % (8,9)
    equipBomb(s, 'bomb');
    s.bombCooldown = 0;
    pullA(world, s);
    const catEvents = [
      ...stepTicks(world, s, 1, { dx: 0, dy: 0, holdA: true }),
      ...stepSeconds(world, s, BOMB_FUSE + 0.25),
    ];
    expect(catEvents).toContain('wind-catapult');
    expect(s.crystalColor).toBe('blue');
    expect(tileAt(world, s, 'dungeon-999', 1, 0, 8, 9)).toBe('.');
  });

  it('A4 (1, 1): Ice Bomb (3x3 nova) freezes water currents to stop a drifting Bomb on target, and freezes a Brass Beetle into a kickable 4s sliding ice-cube that holds down O', () => {
    const s = newState(world, 'dungeon-999', 1, 1, 3.5, 5.5);

    // 1. Float a regular Bomb into the east water current '3' at (3.5, 4.5), let it drift near C (7, 3), then freeze the stream with an Ice Bomb
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'bomb',
      x: 3.5,
      y: 4.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 2.2,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.85);
    const drifting = s.bombs[0]!;
    expect(drifting.x).toBeGreaterThan(5.2);
    expect(drifting.vx).toBeGreaterThan(1.0);

    // Detonate an Ice Bomb on (Math.floor(drifting.x), 4) to freeze the 3x3 water current patch
    const freezeCx = Math.floor(drifting.x);
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'ice',
      x: freezeCx + 0.5,
      y: 4.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    expect(s.frozenTiles?.has(`dungeon-999:1,1:${freezeCx},4`)).toBe(true);
    expect(tileAt(world, s, 'dungeon-999', 1, 1, freezeCx, 4)).toBe('.');
    expect(drifting.vx).toBe(0);

    // 2. Freeze the Brass Beetle ('beetle') at (4.5, 8.5) into a 4s ice cube and kick-slide it East onto button O (7, 8)
    const beetle = s.enemies.find((e) => e.kind === 'beetle')!;
    expect(beetle).toBeDefined();
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'ice',
      x: beetle.x,
      y: beetle.y,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    expect(beetle.frozenTimer).toBeGreaterThan(3.8);

    // Walk Pip East into the frozen beetle to kick it along row 8 onto O at (7, 8)
    s.x = beetle.x - 0.8;
    s.y = 8.5;
    stepSeconds(world, s, 1.0, { dx: 1, dy: 0 });
    expect(isButtonPressed(world, s, 7, 8)).toBe(true);
    expect(s.roomSolved).toBe(true);
  });

  it('A5 (0, 1): Rock Bomb spawns 1 solid Rock block (second crumbles first; Bomb shatters it) as an anchored windbreak and fills a 1-tile hazard channel', () => {
    const s = newState(world, 'dungeon-999', 0, 1, 3.5, 4.5);

    // Without a Rock windbreak, ambient wind at button O (6.5, 4.5) is strong east gale (dx = 2.2)
    expect(windVectorAt(world, s, 6.5, 4.5).dx).toBeCloseTo(2.2, 2);

    // 1. Detonate first Rock Bomb at (3.5, 4.5) -> spawns 1 rock block at (3, 4)
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'rock',
      x: 3.5,
      y: 4.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    expect(s.blocks.filter((b) => b.rock)).toHaveLength(1);
    expect([s.blocks[0]!.x, s.blocks[0]!.y]).toEqual([3, 4]);

    // 2. Detonate second Rock Bomb at (4.5, 4.5) -> first rock block crumbles, replaced by new one at (4, 4)
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'rock',
      x: 4.5,
      y: 4.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    const rocks = s.blocks.filter((b) => b.rock);
    expect(rocks).toHaveLength(1);
    expect([rocks[0]!.x, rocks[0]!.y]).toEqual([4, 4]);

    // Calm lee downwind of Rock block at (4, 4) covers button O at (6.5, 4.5)
    expect(windVectorAt(world, s, 6.5, 4.5)).toEqual({ dx: 0, dy: 0 });

    // 3. Regular Bomb blast shatters the Rock block
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'bomb',
      x: 4.5,
      y: 5.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    expect(s.blocks.filter((b) => b.rock)).toHaveLength(0);

    // 4. Detonating a Rock Bomb on/ahead of a 1-tile hazard channel (';' at 4,8 or '!' at 7,8) fills it into walkable '.' floor
    expect(tileAt(world, s, 'dungeon-999', 0, 1, 7, 8)).toBe('!');
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'rock',
      x: 7.5,
      y: 8.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.02,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.05);
    expect(tileAt(world, s, 'dungeon-999', 0, 1, 7, 8)).toBe('.');
  });

  it('A6 (-1, 1): Magnet Bomb continuously pulls a rolling Bomb off a chute into a side target and pulls an aligned metal block (M) onto floor button O', () => {
    const s = newState(world, 'dungeon-999', -1, 1, 4.5, 2.5);
    expect(s.crystalColor).toBe('red');

    // 1. Place a Magnet Bomb east of the 's' chute at (6.5, 3.5) and drop a Bomb at top of the 's' chute (4.5, 2.5)
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'magnet',
      x: 6.5,
      y: 3.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: BOMB_FUSES.magnet,
      graceOverlap: false,
      shoveCount: 0,
    });
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'bomb',
      x: 4.5,
      y: 2.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.9,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, 0.95);
    // The rolling Bomb is curved sideways off col 4 toward col 6 to flip Crystal C (6, 4)!
    expect(s.crystalColor).toBe('blue');

    // 2. Place a Magnet Bomb at (2.5, 5.5) on/north of button O (2, 5) to pull aligned metal block M from (2, 7) -> (2, 6) -> (2, 5)
    const metal = s.blocks.find((b) => b.metal)!;
    expect(metal).toBeDefined();
    expect([metal.x, metal.y]).toEqual([2, 7]);
    s.bombs = [
      {
        id: s.nextEntityId++,
        kind: 'magnet',
        x: 2.5,
        y: 5.5,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        fuse: BOMB_FUSES.magnet,
        graceOverlap: false,
        shoveCount: 0,
      },
    ];
    stepSeconds(world, s, 1.0);
    expect([metal.x, metal.y]).toEqual([2, 5]);
    expect(isButtonPressed(world, s, 2, 5)).toBe(true);
    expect(s.roomSolved).toBe(true);
  });

  it('A7 (-1, 0): Squeak Bomb (2.5s chirp) lures a Brass Beetle onto floor button O and dazes it for 2.5s on pop without breaking tiles, and Mimic Statue steps with Pip', () => {
    const s = newState(world, 'dungeon-999', -1, 0, 3.5, 6.5);
    const beetle = s.enemies.find((e) => e.kind === 'beetle')!;
    const mimic = s.enemies.find((e) => e.kind === 'mimic')!;
    expect(beetle).toBeDefined();
    expect(mimic).toBeDefined();

    // 1. Mimic Statue steps in lockstep with Pip when Pip walks East
    const mimicStartX = mimic.x;
    const pipStartX = s.x;
    for (let i = 0; i < 15; i++) {
      tick(world, s, { dx: 1, dy: 0 }, FIXED_DT);
    }
    expect(s.x).toBeGreaterThan(pipStartX + 0.5);
    expect(mimic.x - mimicStartX).toBeCloseTo(s.x - pipStartX, 2);

    // 2. Place a Squeak Bomb next to crate W (6, 9) and button O (7, 3) to verify it lures the Beetle onto O and pops with 2.5s daze without breaking W
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'squeak',
      x: 7.5,
      y: 3.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: BOMB_FUSES.squeak,
      graceOverlap: false,
      shoveCount: 0,
    });
    // Also place a Squeak Bomb adjacent to wooden crate W at (6, 9) to confirm pop breaks nothing
    s.bombs.push({
      id: s.nextEntityId++,
      kind: 'squeak',
      x: 6.5,
      y: 8.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.2,
      graceOverlap: false,
      shoveCount: 0,
    });
    stepSeconds(world, s, BOMB_FUSES.squeak + 0.1);
    expect(tileAt(world, s, 'dungeon-999', -1, 0, 6, 9)).toBe('W');
    expect(isButtonPressed(world, s, 7, 3)).toBe(true);
    expect(s.roomSolved).toBe(true);
    expect(beetle.stumbleTimer).toBeGreaterThan(2.3);
  });
});
