/**
 * Experiment (half-size actors): maps a full-size Pip or bomb sprite to its hand-drawn tiny
 * counterpart, so the small actors are drawn 1:1 instead of shrinking 16x16 art. Poses the
 * tiny set lacks (carry, lift, throw, hood sway) fall back to the nearest one it has.
 */
import { OBJ, type ObjSpriteName } from './gbcArt';

export function tinyActorSprite(name: ObjSpriteName): ObjSpriteName {
  let tiny: string = name;
  const pip = /^PIP_(SOUTH|NORTH|EAST)_(.+)$/.exec(name);
  if (pip) {
    const [, dir, pose] = pip;
    if (pose === 'ROLL_1' || pose === 'ROLL_2') tiny = `PIP_TINY_${pose}`;
    else if (pose === 'WALK_L' || pose === 'PUSH_1') tiny = `PIP_TINY_${dir}_WALK_L`;
    else if (pose === 'WALK_R' || pose === 'PUSH_2') tiny = `PIP_TINY_${dir}_WALK_R`;
    else tiny = `PIP_TINY_${dir}_IDLE`;
  } else if (/^PIP_(GET|FALL_\d)$/.test(name)) {
    tiny = name.replace('PIP_', 'PIP_TINY_');
  } else if (/^(POWDER|EMBER)_\d$/.test(name)) {
    tiny = name.replace('_', '_TINY_');
  }
  return tiny in OBJ ? (tiny as ObjSpriteName) : name;
}
