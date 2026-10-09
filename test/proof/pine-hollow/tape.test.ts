// oxlint-disable-next-line import/no-nodejs-modules -- The real native tape needs Pine's committed physics and terrain assets.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import { createSimHost } from '../../../src/engine/sim';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CROSSBOW_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessCrossbow';
import { LEVER_FLAG, PINE_WEAPON, WEAPON_COMMAND } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLoadout';
import { PineTape, pinePlan } from './witness';

it('uses an owned rifle after the crossbow is empty without granting ammunition or bypassing the loadout', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')), plan = await pinePlan(rapier);
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  try {
    plan.install(host, { restoring: false, commands: () => [], emit: () => undefined });
    const bear = [...host.entities.values()].find(body => body.kind === 'bear' && !body.scripted);
    const bow = host.adapters.get(CROSSBOW_STEP);
    if (bear === undefined || bow === undefined) throw new Error('Missing real native bear/crossbow');
    host.player.position.copy(bear.position); host.player.position.x += 10; bear.state = 'stalk';
    const saved = v.parse(v.looseObject({ loaded: v.boolean(), quiver: v.number() }), bow.snapshot());
    bow.restore({ ...saved, loaded: false, quiver: 0 });
    const tape = new PineTape([{ kind: 'wait', until: () => false }]);
    // An unowned rifle is never selected; the dry crossbow's existing trigger remains the only option.
    expect(tape.next(host).some(command => command.kind === 'script' && command.actorId === WEAPON_COMMAND)).toBe(false);
    host.flags.set(LEVER_FLAG);
    const before = bow.snapshot();
    expect(tape.next(host)).toContainEqual({ kind: 'script', actorId: WEAPON_COMMAND, value: PINE_WEAPON.lever });
    expect(bow.snapshot()).toEqual(before);
    // One loaded bolt still takes priority over the rifle, even with an empty reserve.
    bow.restore({ ...saved, loaded: true, quiver: 0 });
    expect(tape.next(host).some(command => command.kind === 'script' && command.actorId === WEAPON_COMMAND)).toBe(false);
  } finally { host.dispose(); }
});
