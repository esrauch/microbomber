import { describe, expect, it } from 'vitest';
import {
  type DepthSortable,
  actorFootY,
  computeShadowMetrics,
  sortDepthItems,
} from '../src/render/gbc';

interface NamedItem extends DepthSortable {
  id: string;
}

describe('Phase 6.4 foot-position depth sort and height-aware shadows', () => {
  it('draws a bomb placed north of Pip (grounded or mid-hop) strictly behind Pip, and south in front', () => {
    const pipY = 6.5;
    // Bomb placed 0.65 tiles north of Pip (even if hopping at z = 0.35, footY uses ground b.y!)
    const itemsNorth: NamedItem[] = [
      { id: 'pip', footY: actorFootY('pip', pipY), orderTie: 1 },
      { id: 'bomb-north-hop', footY: actorFootY('bomb', pipY - 0.65), orderTie: 2 },
    ];
    expect(sortDepthItems(itemsNorth).map((i) => i.id)).toEqual(['bomb-north-hop', 'pip']);

    const itemsSouth: NamedItem[] = [
      { id: 'bomb-south', footY: actorFootY('bomb', pipY + 0.65), orderTie: 1 },
      { id: 'pip', footY: actorFootY('pip', pipY), orderTie: 2 },
    ];
    expect(sortDepthItems(itemsSouth).map((i) => i.id)).toEqual(['pip', 'bomb-south']);
  });

  it('sorts stacked slimes, props, braziers, flames, and 3/4 overhead tiles by true ground contact', () => {
    // Ember Crypt Arch / general stack:
    // - Pip north of mausoleum at y=3.72 -> behind mausoleum overhead (y=4)
    // - Mausoleum overhead at y=4 -> behind brazier prop & flame at y=5
    // - Slime at y=5.8 -> behind Pip at y=6.5 -> behind crate prop at y=7
    const stack: NamedItem[] = [
      { id: 'crate-y7', footY: actorFootY('prop', 7), orderTie: 0 },
      { id: 'pip-y6.5', footY: actorFootY('pip', 6.5), orderTie: 1 },
      { id: 'slime-y5.8', footY: actorFootY('slime', 5.8), orderTie: 2 },
      { id: 'brazier-flame-y5', footY: actorFootY('torchFlame', 5), orderTie: 3 },
      { id: 'brazier-bowl-y5', footY: actorFootY('prop', 5), orderTie: 4 },
      { id: 'mausoleum-overhead-y4', footY: actorFootY('overhead', 4), orderTie: 5 },
      { id: 'pip-north-y3.72', footY: actorFootY('pip', 3.72), orderTie: 6 },
    ];
    expect(sortDepthItems(stack).map((i) => i.id)).toEqual([
      'pip-north-y3.72',
      'mausoleum-overhead-y4',
      'brazier-bowl-y5',
      'brazier-flame-y5',
      'slime-y5.8',
      'pip-y6.5',
      'crate-y7',
    ]);
  });

  it('shrinks and softens contact shadows monotonically as height above ground increases', () => {
    const ground = computeShadowMetrics(6, 0);
    const midHop = computeShadowMetrics(6, 0.28);
    const highHop = computeShadowMetrics(6, 0.65);

    expect(ground.rx).toBe(6);
    expect(ground.ry).toBeGreaterThanOrEqual(2);
    expect(midHop.rx).toBeLessThanOrEqual(ground.rx);
    expect(highHop.rx).toBeLessThan(ground.rx);
    expect(midHop.alpha).toBeLessThan(ground.alpha);
    expect(highHop.alpha).toBeLessThan(midHop.alpha);
    expect(highHop.alpha).toBeGreaterThanOrEqual(0.14);
  });
});
