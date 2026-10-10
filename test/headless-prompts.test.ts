import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { tagCollider } from '../src/engine/physics/surface';
import { InteractionRules, installInteractionRows, parseInteractionRows } from '../src/game/quest/interactionRows';
import { bindHeadlessPrompts, createHeadlessPromptPicker, parsePromptRegistrations, type HeadlessPrompt } from '../src/sdk/runtime/prompts';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
const boot = (playerBody = false): SimHost => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier, ground: false, playerBody });
  host.player.position.set(0, 0, 0);
  return host;
};
const registration = (id: string | null, x: number) => ({ id, position: { x, y: 1.68, z: 0 }, radius: 4, sight: { slack: 0.1 } });

it('keeps page order, strict reach, strong priority and live hidden/moved prompts without dropping unhosted competitors', () => {
  const host = boot();
  try {
    const picker = createHeadlessPromptPicker(host);
    let hidden = false;
    const position = { x: 2, y: 1.68, z: 0 };
    const first: HeadlessPrompt = { act: 1, position, get radius() { return hidden ? 0 : 4; } };
    const equal: HeadlessPrompt = { act: 2, position: { x: -2, y: 1.68, z: 0 }, radius: 4 };
    const prompts = bindHeadlessPrompts(parsePromptRegistrations([registration('first', 2), registration('equal', -2)]), id => id === 'first' ? first : equal);
    expect(picker.pick(prompts)?.act).toBe(1);
    hidden = true; expect(picker.pick(prompts)?.act).toBe(2);
    hidden = false; position.x = 4; expect(picker.pick(prompts)?.act).toBe(2);
    position.x = 1;
    const competitor = bindHeadlessPrompts(parsePromptRegistrations([registration(null, 0.5)]), () => undefined);
    expect(picker.pick([...competitor, ...prompts])?.act).toBeNull();
    expect(picker.pick([{ ...competitor[0], act: null, position: { x: 0.5, y: 1.68, z: 0 }, radius: 4, weak: true }, ...prompts])?.act).toBe(1);
    expect(() => bindHeadlessPrompts(parsePromptRegistrations([registration('absent', 1)]), () => undefined)).toThrow('no live host binding');
  } finally { host.dispose(); }
});

it('admits only the actual reconstructed own body, retains its sight identity on restore and refuses an intervening native wall', () => {
  const host = boot(true);
  let restored: SimHost | undefined;
  try {
    const body = host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(0.8, 0.8, 0.8).setTranslation(2, 1.68, 0).setCollisionGroups(groups('WORLD')));
    tagCollider(body, 'wood', 'piece:chest');
    host.physics.step();
    const picker = createHeadlessPromptPicker(host);
    const target: HeadlessPrompt = { act: 1, position: { x: 2, y: 1.68, z: 0 }, radius: 4, sight: { slack: 0.1, body: 'piece:chest' } };
    expect(picker.pick([target])).toBe(target);
    expect(picker.pick([{ ...target, sight: { slack: 0.1, body: 'string:chest' } }])).toBeUndefined();
    restored = restoreSimHost(host.level, { rapier }, snapshotSimHost(host));
    expect(createHeadlessPromptPicker(restored).pick([target])).toBe(target);
    expect(createHeadlessPromptPicker(restored).pick([{ ...target, sight: { slack: 0.1, body: 'string:chest' } }])).toBeUndefined();
    host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(0.1, 1, 1).setTranslation(0.8, 1.68, 0).setCollisionGroups(groups('WORLD')));
    host.physics.step();
    expect(picker.pick([target])).toBeUndefined();
    expect(host.physics.colliderTag(body)?.owner).toBe('piece:chest');
  } finally { restored?.dispose(); host.dispose(); }
});

it('refuses named farther and occluded script acts while leaving lash-owned world cracks independent', () => {
  const host = boot(true);
  try {
    let commands: { actorId: string; value: number }[] = [], cracked: number | null = null;
    const rules = new InteractionRules(host.flags, parseInteractionRows({ marks: [], rows: [
      { id: 'near', act: 1, at: 'near', sets: ['used:near'] }, { id: 'far', act: 2, at: 'far', sets: ['used:far'] },
      { id: 'crank', act: 3, at: 'crank', crack: 'heavy', sets: ['raised'] },
    ] }));
    const spots = { near: { x: 1, y: 1.68, z: 0, radius: 4 }, far: { x: 2, y: 1.68, z: 0, radius: 4 }, crank: { x: 2, y: 1.68, z: 0, radius: 1 } };
    const prompts: HeadlessPrompt[] = [{ act: 1, position: spots.near, get radius() { return host.flags.has('used:near') ? 0 : 4; } }, { act: 2, position: spots.far, radius: 4 }];
    installInteractionRows(host, rules, { actorId: 'test.prompt', stepId: 'test.prompts', spots, prompts, commands: () => commands,
      crack: { reach: { light: 3, heavy: 3 }, cracked: () => cracked } });
    commands = [{ actorId: 'test.prompt', value: 2 }]; host.step(); expect(host.flags.has('used:far')).toBe(false);
    commands = [{ actorId: 'test.prompt', value: 1 }]; host.step(); expect(host.flags.has('used:near')).toBe(true);
    host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(0.1, 1, 1).setTranslation(1, 1.68, 0).setCollisionGroups(groups('WORLD')));
    commands = [{ actorId: 'test.prompt', value: 2 }]; cracked = 3; host.step();
    expect(host.flags.has('used:far')).toBe(false); expect(host.flags.has('raised')).toBe(true);
  } finally { host.dispose(); }
});
