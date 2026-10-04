// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Read the generated build binary inside the clean export.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost } from '../../src/engine/sim';
import { loadRapier } from '../../src/engine/physics/rapier';
import { mountDeclaredHud } from '../../src/engine/ui/declared';
import { installDeclaredEncounters } from '../../src/game/shard/declaredEncounters';
import { EncountersSchema } from '../../src/game/shardfile/encounters';
import { UiSchema } from '../../src/game/shardfile/ui';
import { ENCOUNTERS, ENCOUNTER_UI } from '../../src/shards/_template/data/encounters';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer); });
it('drives the one mounted SF7f panel through intro, phase, checkpoint retry and victory', () => {
  const row = v.parse(EncountersSchema, ENCOUNTERS)[1], actor = SIM_LEVEL.entities[0];
  if (!row || !actor) throw new Error('Missing encounter fixture');
  const spec = { ...row, arena: { at: [0, 0, 0] as const, radius: 8 } };
  const sim = createSimHost({ ...SIM_LEVEL, quests: [], entities: [{ ...actor, id: spec.entity }] }, { rapier });
  const root = document.createElement('div'); document.body.append(root);
  const panels = v.parse(UiSchema, ENCOUNTER_UI).filter((d) => d.kind === 'bossPanel');
  const hud = mountDeclaredHud(panels, { scope: sim.scope, system: () => undefined, read: () => 0, bossRoot: root,
    hud: { pin: () => undefined, widget: () => undefined, relabel: () => () => undefined } });
  const encounter = installDeclaredEncounters(sim, [spec], () => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined }), hud).get(spec.id);
  if (!encounter) throw new Error('Missing installed encounter');
  const ticks = (n: number): void => { for (let i = 0; i < n; i++) sim.step(); };
  const hit = (): void => {
    const target = sim.entities.get(spec.entity); if (!target) throw new Error('Missing actor');
    sim.combat.hit({ source: sim.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: target.combatActor(), amount: 1000, point: target.position, dir: new Vector3(), from: sim.player.position });
  };
  try {
    expect(root.childElementCount).toBe(1); sim.step(); expect(root.textContent).toContain(spec.name);
    ticks(61); expect(root.querySelector('.ws-boss-bar.show')).not.toBeNull();
    hit(); ticks(2); expect(root.querySelector('.ws-boss-bar.shield')).not.toBeNull();
    expect(root.querySelector('.ws-boss-bar-caption')?.textContent).toBe(spec.phases[1]?.caption);
    expect(encounter.retry()).toBe(true); expect(root.querySelector('.ws-boss-retry.show')?.textContent).toContain(spec.retry);
    ticks(16); hit(); sim.step(); expect(encounter.boss.state).toBe('victory'); ticks(90);
    expect(root.querySelector('.ws-boss-bar.show')).toBeNull(); expect(root.childElementCount).toBe(1);
  } finally { sim.dispose(); expect(root.childElementCount).toBe(0); root.remove(); }
});
