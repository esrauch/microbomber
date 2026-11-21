import { describe, expect, it } from 'vitest';
import { OBJ, type ObjSpriteName } from '../src/render/gbcArt';
import { auxKind, bakeAuxData } from '../src/render/gbcAux';
import { tinyActorSprite } from '../src/render/tinyActors';

describe('tiny-actor mode (fuse mouse and tiny bombs)', () => {
  it('draws every Pip pose as the mouse and every bomb as its tiny sprite', () => {
    for (const name of Object.keys(OBJ) as ObjSpriteName[]) {
      if (/^PIP_/.test(name)) expect(tinyActorSprite(name), name).toMatch(/^MOUSE_/);
      if (/^(POWDER|EMBER)_\d$/.test(name)) expect(tinyActorSprite(name), name).toMatch(/_TINY_/);
    }
    expect(tinyActorSprite('PIP_EAST_PUSH_2')).toBe('MOUSE_EAST_RUN_2');
    expect(tinyActorSprite('PIP_NORTH_CARRY_1')).toBe('MOUSE_NORTH_IDLE');
    expect(tinyActorSprite('PIP_SOUTH_THROW')).toBe('MOUSE_SOUTH_THROW');
    expect(tinyActorSprite('SLIME_1')).toBe('SLIME_1');
  });

  it('has a four-frame gallop and a crouch into it in every facing', () => {
    for (const dir of ['SOUTH', 'NORTH', 'EAST']) {
      for (let f = 1; f <= 4; f++) expect(`MOUSE_${dir}_RUN_${f}` in OBJ).toBe(true);
      expect(`MOUSE_${dir}_DROP` in OBJ).toBe(true);
    }
  });

  it('lights the mouse as a hero whose tail spark glows', () => {
    expect(auxKind('MOUSE_SOUTH_IDLE')).toBe('hero');
    const aux = bakeAuxData('MOUSE_SOUTH_IDLE');
    let glow = 0;
    for (let i = 1; i < aux.data.length; i += 4) glow = Math.max(glow, aux.data[i] ?? 0);
    expect(glow).toBe(220);
  });
});
