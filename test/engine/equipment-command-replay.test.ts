import { expect, it } from 'vitest';
import { Group } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { Weapon, type WeaponState } from '../../src/engine/combat/Weapon';
import { InputService, type ActionCommand } from '../../src/engine/input/InputService';
import { EquipmentActionInput } from '../../src/engine/input/equipmentInput';
import { WOODEN_SWORD, IRON_SWORD } from '../../src/game/weapons/starterEquipment';

class FixtureWeapon extends Weapon {
  readonly model = new Group(); enabled = true; adsHeld = false; holster = 0; aimInfo = null;
  readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  tryFire(): void { /* Selection only. */ }
  update(): void { /* Selection only. */ }
}
function fixture() {
  let time = 0;
  const input = new InputService(() => time * 1000), scope = new Scope('equipment-replay');
  const equipment: EquipmentService = new EquipmentService(new FixtureWeapon(WOODEN_SWORD), {
    scope, input: new EquipmentActionInput(input, () => equipment.current.enabled),
  });
  equipment.add(new FixtureWeapon(IRON_SWORD), { locked: false });
  return { input, equipment, dispose: () => { scope.dispose(); }, advance: (dt: number) => { time += dt; equipment.update(dt, time); },
    state: () => ({ id: equipment.current.id, swapping: equipment.swappingNow, holsters: equipment.list.map((weapon) => weapon.holster), input: input.snapshot() }) };
}
it('records UI weapon choices by stable id, preserving selection during a swap and replaying real equipment timing', () => {
  const first = fixture(), replay = fixture(), commands: ActionCommand[] = [];
  const tape = [{ dt: 0, action: 'swap.weapon.sword-iron' }, { dt: 0.3, action: 'swap.weapon.sword' },
    { dt: 0.5, action: 'swap.ui' }, { dt: 0.5, action: 'swap.weapon.sword' }] as const;
  try {
    first.input.recordCommand = (command) => { commands.push(command); };
    for (const entry of tape) { first.advance(entry.dt); first.input.press(entry.action); }
    expect(commands).toHaveLength(tape.length); expect(first.equipment.swappingNow).toBe(true);
    for (const [index, entry] of tape.entries()) {
      replay.advance(entry.dt); const command = commands[index]; if (command === undefined) throw new Error('Missing recorded choice');
      replay.input.executeCommand(command);
    }
    first.advance(0.5); replay.advance(0.5);
    expect(first.equipment.current.id).toBe('sword'); expect(replay.state()).toEqual(first.state());
  } finally { first.dispose(); replay.dispose(); }
});
