import { describe, expect, it } from 'vitest';
import {
  BigRoomCanvas,
  LAB_BIG_H,
  LAB_BIG_W,
  type LabRoomSpec,
  causalTraceSignature,
  composeEntangledRooms,
  generateEscalationTriadSuite,
  replayWitness,
  solveLabRoom,
  synthesizeNextEscalationAct,
} from '../tools/puzzle-lab';

describe('Phase 3: Entangled 22x26 Composer & CEGAR 1->2->3 Escalation Generator', () => {
  it('composes Critic-certified 22x26 multi-step entangled rooms across all 5 families', () => {
    const generated = composeEntangledRooms(20261122, 5, {
      maxAttempts: 10,
      minMacroSteps: 3,
      minCreativityScore: 30,
    });

    expect(generated.length).toBe(5);
    const familiesSeen = new Set(generated.map((g) => g.family));
    expect(familiesSeen.size).toBe(5);

    for (const item of generated) {
      expect(item.room.width).toBe(LAB_BIG_W);
      expect(item.room.height).toBe(LAB_BIG_H);
      expect(item.room.rows.length).toBe(LAB_BIG_H);
      // Canonical 4-tile outer wall border for 22x26 Shrine framing
      expect(item.room.rows[0]).toBe('#'.repeat(LAB_BIG_W));
      expect(item.room.rows[3]).toBe('#'.repeat(LAB_BIG_W));
      expect(item.room.rows[22]).toBe('#'.repeat(LAB_BIG_W));
      expect(item.room.rows[25]).toBe('#'.repeat(LAB_BIG_W));

      expect(item.report.passedAllGates).toBe(true);
      expect(item.report.replayVerified).toBe(true);
      expect(item.report.backportErrors).toEqual([]);
      expect(item.report.shortcuts).toEqual([]);
      expect(item.report.ablation.unusedKitBombs).toEqual([]);
      expect(item.report.ablation.redundantProps).toEqual([]);
      expect(item.report.solve.steps.length).toBeGreaterThanOrEqual(3);
      expect(item.report.creativity.totalScore).toBeGreaterThanOrEqual(30);
    }
  }, 15_000);

  it('synthesizes all 4 three-room 1->2->3 Escalation Triads (12 verified 22x26 rooms)', () => {
    const triads = generateEscalationTriadSuite();
    expect(triads.map((t) => t.triadId)).toEqual([
      'triad-stolen-flame',
      'triad-dont-burn-box',
      'triad-cold-feet',
      'triad-high-tide',
    ]);

    for (const triad of triads) {
      const [act1, act2, act3] = triad.stages;

      expect(act1.room.width).toBe(LAB_BIG_W);
      expect(act1.room.height).toBe(LAB_BIG_H);
      expect(act1.solve.solved).toBe(true);
      expect(act1.report.replayVerified).toBe(true);
      expect(act1.report.backportErrors).toEqual([]);

      // Act II strictly falsifies Act I's witness & passes all 5 Critic gates
      expect(replayWitness(act2.room, act1.solve.flatActions)).toBe(false);
      expect(act2.blockedPreviousWitness).toBe(true);
      expect(act2.report.passedAllGates).toBe(true);
      expect(act2.report.ablation.unusedKitBombs).toEqual([]);

      // Act III strictly falsifies Act II's witness & passes all 5 Critic gates
      expect(replayWitness(act3.room, act2.solve.flatActions)).toBe(false);
      expect(act3.blockedPreviousWitness).toBe(true);
      expect(act3.report.passedAllGates).toBe(true);
      expect(act3.report.ablation.unusedKitBombs).toEqual([]);
      expect(act3.report.creativity.totalScore).toBeGreaterThanOrEqual(30);
    }

    // Confirm Stolen Flame Act II was discovered purely via automatic `strip-kit:fire`!
    const stolenFlame = triads.find((t) => t.triadId === 'triad-stolen-flame')!;
    expect(stolenFlame.stages[1].mutationApplied).toBe('strip-kit:fire');
    expect(stolenFlame.stages[1].solve.summary.stoleFireWithoutFireBomb).toBe(true);
  }, 15_000);

  it('automatically discovers a kit-strip or footprint-blocker escalation with zero custom rules', () => {
    const c = new BigRoomCanvas();
    c.carveRect(7, 9, 13, 14, '.');
    c.carveRect(7, 13, 13, 13, '=');
    c.set(10, 10, '%');
    // Seed room: Pip has both `bomb` and `fire`; brazier is across `=` fence and Mirror can bend Laser
    const r1: LabRoomSpec = {
      id: 'auto-cegar-seed',
      name: 'Auto CEGAR Seed',
      width: LAB_BIG_W,
      height: LAB_BIG_H,
      kit: ['bomb', 'fire'],
      entry: [8, 12],
      condition: 'all-torches',
      rows: c.rows(),
      props: [{ id: 'm1', kind: 'mirror', x: 10, y: 11, facing: 'SW' }],
      braziers: [{ id: 'b1', x: 10, y: 14 }],
      lasers: [{ id: 'L1', x: 7, y: 9, dir: 'E', level: 0 }],
    };

    const s1 = solveLabRoom(r1);
    expect(s1.solved).toBe(true);
    expect(s1.summary.usedBombKinds.has('fire')).toBe(true);

    const escalated = synthesizeNextEscalationAct(r1, s1, 2, []);
    expect(escalated).not.toBeNull();
    expect(replayWitness(escalated!.room, s1.flatActions)).toBe(false);
    expect(escalated!.report.passedAllGates).toBe(true);
    expect(causalTraceSignature(escalated!.solve)).not.toBe(causalTraceSignature(s1));
  });
});
