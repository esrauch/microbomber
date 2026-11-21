/**
 * Tiny-actor mode (half-size Pip and bombs): maps a full-size Pip or bomb sprite to what is
 * drawn instead. Pip becomes the fuse mouse (see MOUSE_PLAN.md); bombs use their hand-drawn
 * tiny sprites. Mouse poses with no frame of their own fall back to the nearest one.
 */
import { OBJ, type ObjSpriteName } from './gbcArt';

export function tinyActorSprite(name: ObjSpriteName): ObjSpriteName {
  let tiny: string = name;
  const pip = /^PIP_(SOUTH|NORTH|EAST)_(.+)$/.exec(name);
  if (pip) {
    const [, dir, pose] = pip;
    if (pose === 'ROLL_1' || pose === 'ROLL_2') tiny = `MOUSE_${pose}`;
    // Walking is drawn as the gallop; pushing is a slow gallop into the block
    else if (pose === 'WALK_L' || pose === 'PUSH_1') tiny = `MOUSE_${dir}_RUN_1`;
    else if (pose === 'WALK_R' || pose === 'PUSH_2') tiny = `MOUSE_${dir}_RUN_2`;
    else if (pose === 'IDLE_B' || pose === 'LIFT' || pose === 'THROW') {
      tiny = `MOUSE_${dir}_${pose}`;
    } else tiny = `MOUSE_${dir}_IDLE`;
  } else if (/^PIP_(GET|FALL_\d)$/.test(name)) {
    tiny = name.replace('PIP_', 'MOUSE_');
  } else if (/^(POWDER|EMBER)_\d$/.test(name)) {
    tiny = name.replace('_', '_TINY_');
  }
  return tiny in OBJ ? (tiny as ObjSpriteName) : name;
}
