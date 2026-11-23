import { describe, expect, it } from 'vitest';
import {
  type LabRoomSpec,
  SEED_TRICKS,
  evaluateRoomQuality,
  probePairwiseMicroArenas,
  replayWitness,
  solveLabRoom,
} from '../tools/puzzle-lab';

describe('Phase 2: Bounded Macro-Solver, 5-Gate Ablation Critic & Pairwise Prober', () => {
  it.each(SEED_TRICKS.map((t) => [t.id, t.name, t] as const))(
    'autonomously solves and replay-verifies seed trick %s (%s)',
    (_id, _name, trick) => {
      const res = solveLabRoom(trick.microArena, {
        maxStates: 2500,
        maxDepth: 9,
        maxMs: 1500,
      });
      expect(res.solved, `failed to solve ${trick.id}: ${trick.name}`).toBe(true);
      expect(res.steps.length).toBeGreaterThanOrEqual(2);
      expect(replayWitness(trick.microArena, res.flatActions)).toBe(true);
    },
  );

  it('certifies high creativity & zero unused elements on Coat of Rime (TR-01) and Thaw at the Gate (TR-03)', () => {
    const tr01 = SEED_TRICKS.find((t) => t.id === 'TR-01')!;
    const rep01 = evaluateRoomQuality(tr01.microArena, {
      minMacroSteps: 3,
      minCreativityScore: 40,
    });
    expect(rep01.passedAllGates).toBe(true);
    expect(rep01.ablation.unusedKitBombs).toEqual([]);
    expect(rep01.ablation.redundantProps).toEqual([]);
    expect(rep01.creativity.dualRoleProps.length).toBeGreaterThanOrEqual(1);
    expect(['creative', 'masterpiece']).toContain(rep01.creativity.tier);

    const tr03 = SEED_TRICKS.find((t) => t.id === 'TR-03')!;
    const rep03 = evaluateRoomQuality(tr03.microArena, {
      minMacroSteps: 2,
      minCreativityScore: 30,
    });
    expect(rep03.passedAllGates).toBe(true);
    expect(rep03.creativity.selfCryo).toBe(true);
  });

  it('catches unused kit bombs, dead-weight props, and 0-bomb shortcuts in the 5-Gate Critic', () => {
    const tr02 = SEED_TRICKS.find((t) => t.id === 'TR-02')!.microArena;

    // 1. Adding an unnecessary 'fire' bomb to TR-02 makes it trivial & flags unused kit bombs!
    const overKitted: LabRoomSpec = {
      ...tr02,
      id: 'flawed-overkitted',
      kit: ['bomb', 'fire'],
    };
    const repOver = evaluateRoomQuality(overKitted);
    expect(repOver.passedAllGates).toBe(false);
    expect(repOver.ablation.unusedKitBombs.length).toBeGreaterThan(0);

    // 2. Adding an untouched crate in the corner flags `redundantProps`!
    const deadPropRoom: LabRoomSpec = {
      ...tr02,
      id: 'flawed-dead-prop',
      props: [...(tr02.props ?? []), { id: 'decor-crate', kind: 'crate', x: 1, y: 4 }],
    };
    const repDead = evaluateRoomQuality(deadPropRoom);
    expect(repDead.passedAllGates).toBe(false);
    expect(repDead.ablation.redundantProps).toContain('decor-crate');

    // 3. Removing the '%' blocker wall in TR-02 makes it solvable by walking/pushing with 0 bombs!
    const walkBypass: LabRoomSpec = {
      ...tr02,
      id: 'flawed-walk-bypass',
      rows: tr02.rows.map((r) => r.replace('%', '.')),
    };
    const repBypass = evaluateRoomQuality(walkBypass);
    expect(repBypass.passedAllGates).toBe(false);
    expect(repBypass.shortcuts.some((s) => s.includes('solvable-without-bombs'))).toBe(true);
  });

  it('discovers valid, non-trivial causal motifs via the automated Pairwise Micro-Arena Prober', () => {
    const discovered = probePairwiseMicroArenas({
      maxCandidates: 24,
      perArenaBudget: { maxStates: 600, maxDepth: 7, maxMs: 180 },
    });

    expect(discovered.length).toBeGreaterThanOrEqual(3);
    for (const item of discovered) {
      expect(item.report.passedAllGates).toBe(true);
      expect(item.report.replayVerified).toBe(true);
      expect(item.report.shortcuts).toEqual([]);
      expect(item.report.ablation.unusedKitBombs).toEqual([]);
      expect(item.report.ablation.redundantProps).toEqual([]);
    }
  });
});
