import { describe, expect, it } from 'vitest';
import { OBJ } from '../src/render/gbcArt';
import { auxKind, bakeAuxData } from '../src/render/gbcAux';

describe('fuse mouse hero and compact bombs', () => {
  it('defines all fuse mouse poses and compact 10x10 bomb frames', () => {
    for (const dir of ['SOUTH', 'NORTH', 'EAST']) {
      for (const pose of ['IDLE', 'IDLE_B', 'DROP', 'LIFT', 'THROW']) {
        expect(`MOUSE_${dir}_${pose}` in OBJ).toBe(true);
      }
      for (let f = 1; f <= 4; f++) expect(`MOUSE_${dir}_RUN_${f}` in OBJ).toBe(true);
    }
    for (const name of [
      'MOUSE_ROLL_1',
      'MOUSE_ROLL_2',
      'MOUSE_GET',
      'MOUSE_FALL_1',
      'MOUSE_FALL_2',
      'MOUSE_FALL_3',
    ]) {
      expect(name in OBJ).toBe(true);
    }
    for (let f = 1; f <= 4; f++) {
      expect(`POWDER_${f}` in OBJ).toBe(true);
      expect(`EMBER_${f}` in OBJ).toBe(true);
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
