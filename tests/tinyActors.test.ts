import { describe, expect, it } from 'vitest';
import { OBJ, type ObjSpriteName } from '../src/render/gbcArt';
import { tinyActorSprite } from '../src/render/tinyActors';

describe('tiny actor sprites (half-size experiment)', () => {
  it('gives every Pip and bomb sprite a tiny counterpart', () => {
    for (const name of Object.keys(OBJ) as ObjSpriteName[]) {
      if (!/^(PIP|POWDER|EMBER)_/.test(name) || name.includes('_TINY_')) continue;
      expect(tinyActorSprite(name), name).toMatch(/_TINY_/);
    }
    expect(tinyActorSprite('PIP_EAST_PUSH_2')).toBe('PIP_TINY_EAST_WALK_R');
    expect(tinyActorSprite('PIP_NORTH_CARRY_1')).toBe('PIP_TINY_NORTH_IDLE');
    expect(tinyActorSprite('SLIME_1')).toBe('SLIME_1');
  });
});
