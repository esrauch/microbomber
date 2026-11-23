import { describe, expect, it } from 'vitest';
import {
  LAB_BIG_H,
  LAB_BIG_W,
  certifySuiteEntry,
  getCuratedPuzzleSuite,
  replayWitness,
  solveLabRoom,
  validateBackportInvariants,
} from '../tools/puzzle-lab';

describe('Phase 4: Curated 50-Room 22x26 Abstracted Puzzle Suite (P01-P50)', () => {
  const suite = getCuratedPuzzleSuite();

  it('contains all 50 distinct 22x26 rooms (P01-P50) obeying 60 Hz backport invariants', () => {
    expect(suite.length).toBe(50);
    const seenCodes = new Set<string>();
    const seenIds = new Set<string>();

    suite.forEach((entry, idx) => {
      const expectedCode = `P${String(idx + 1).padStart(2, '0')}`;
      expect(entry.code).toBe(expectedCode);
      expect(seenCodes.has(entry.code)).toBe(false);
      expect(seenIds.has(entry.room.id)).toBe(false);
      seenCodes.add(entry.code);
      seenIds.add(entry.room.id);

      expect(entry.room.width).toBe(LAB_BIG_W);
      expect(entry.room.height).toBe(LAB_BIG_H);
      expect(entry.room.rows.length).toBe(LAB_BIG_H);
      expect(entry.room.rows[0]).toBe('#'.repeat(LAB_BIG_W));
      expect(entry.room.rows[3]).toBe('#'.repeat(LAB_BIG_W));
      expect(entry.room.rows[22]).toBe('#'.repeat(LAB_BIG_W));
      expect(entry.room.rows[25]).toBe('#'.repeat(LAB_BIG_W));
      expect(validateBackportInvariants(entry.room)).toEqual([]);
    });
  });

  it('autonomously solves and replay-verifies all 50 rooms (P01-P50)', () => {
    for (const entry of suite) {
      // State budget is the real limit; the wall-clock cap is generous so CPU contention from
      // parallel test files can't flake the densest rooms (P04/P09/P42).
      const res = solveLabRoom(entry.room, {
        maxStates: 4000,
        maxDepth: 10,
        maxMs: 10_000,
      });
      expect(res.solved, `failed to solve ${entry.code}: ${entry.room.name}`).toBe(true);
      expect(replayWitness(entry.room, res.flatActions)).toBe(true);
      if (!entry.allowGenerousBaselineKit) {
        expect(
          res.steps.length,
          `${entry.code} solved in too few steps (${res.steps.length})`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  }, 60_000);

  it('certifies full 5-Gate Ablation & Creativity across spotlight rooms spanning every new primitive', () => {
    const spotlights = [
      'P03', // Stolen Flame III (Mirror + Unified Laser + Crate evacuation)
      'P06', // Coat of Rime (Rock backstop + Frost-armored Crate across Laser)
      'P09', // Shut the Shaft (Crystal windblock + Self-Cryo + Rock blocks mid-strip Laser)
      'P12', // Under the Beam, Over the Tide (Elevation + Sluice + Level-1 Laser)
      'P14', // Bank Off the Cascade (Frozen Waterfall Veil backstop)
      'P15', // Spring the Messenger (Bomb Grate + Spring Pad + Pillar L)
      'P17', // Dry Tunnel, Wet Fuse (Pack-Otter Mousehole smuggling + Veil)
      'P21', // Prism Backhand (Dual-face Mirror shield + Ice bridge)
      'P25', // Puddle Maker (1x1 Turntable Laser + B->; meltwater + Frost)
      'P27', // Curveball in the Gale (Wind Vortex catapult + Crosswind Fan)
      'P32', // Four-Spoke Dispatch (3x3 Turntable rotating chute)
      'P35', // Tortoise Eclipse (Cryo-kicked Tortoise through Grate into Laser)
      'P39', // Calm-Lee Flame (Rock windbreak in Fan lane)
      'P40', // Polarized Prism (Magnet Polarity Switch + 1x1 Mirror + Repel)
      'P41', // Cryo Relay (Parallel Mimic + Self-Cryo Fan slide)
      'P43', // Counter-Phase Escalator (0->1->2 counter-phase pillars + Crate transfer)
      'P44', // Periscope Prism (Pillar-lifted Mirror into level-1 Laser + timed Q pillar bridge)
      'P45', // Three-Tier Cascade (2->1->0 ledge hops + counter-phase pillar return)
      'P46', // Twin-Column Eclipse (Two pillars controlling two crossing Lasers)
      'P47', // Roundhouse Switch (Mine Cart + 3x3 Turntable track rotation)
      'P48', // Shut the Sluice, Dry the Rail (Waterfall across Cart Track + Sluice drain)
      'P49', // Cryo Freight (Mine Cart carrying Ice Bomb to clear Laser & freeze canal)
      'P50', // Magnetic Flatbed (Gate-controlled Cart Track + Mine Cart carrying Magnet Bomb)
    ];

    for (const code of spotlights) {
      const entry = suite.find((e) => e.code === code);
      expect(entry).toBeDefined();
      if (!entry) continue;
      const cert = certifySuiteEntry(entry, {
        maxStates: 4000,
        maxDepth: 10,
        maxMs: 4000,
      });
      expect(cert.certified, `${code} failed Critic certification`).toBe(true);
      expect(cert.report.ablation.unusedKitBombs).toEqual([]);
      expect(cert.report.ablation.redundantProps).toEqual([]);
      expect(cert.report.shortcuts).toEqual([]);
    }
  }, 25_000);
});
