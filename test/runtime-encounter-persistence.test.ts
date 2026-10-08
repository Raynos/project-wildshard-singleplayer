// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import type { BossScript } from '../src/engine/ai/BossBrain';
import type { BossBar } from '../src/engine/ui/BossBar';
import { EliteBar } from '../src/engine/ui/EliteBar';
import { Boss, type BossDef, type BossHost, type BossPersistence } from '../src/game/Boss';
import { Elites, type EliteDef, type ElitePersistence, type EliteScript } from '../src/game/Elite';
import { bossesSave, elitesSave } from '../src/game/saves';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';

class SavedBoss extends Boss { persist(): void { this.save(); } }

it.each(['default', 'adapter'] as const)('boss %s persistence preserves the record and selects exactly one owner', (mode) => {
  localStorage.clear();
  const scope = new Scope('boss.persistence');
  try { withOwner(scope, () => {
    const f = fakeWorld(), initial = { defeated: true, rewardTaken: true, kills: 3 };
    bossesSave.write({ fixture: initial, other: { ...initial, kills: 7 } }, 'nalati-grasslands');
    let data: ReturnType<typeof bossesSave.read> = { fixture: { ...initial }, other: { ...initial, kills: 7 } };
    const adapter: BossPersistence = { read: () => structuredClone(data), write: (value, slug) => {
      expect(slug).toBe('nalati-grasslands');
      const fixture = value['fixture'], other = value['other'];
      if (fixture === undefined || other === undefined) throw new Error('Both encounter records must survive');
      data = { fixture, other };
    } };
    const script: BossScript = { hpFrac: 1, shielded: false, dead: false, inArena: () => false, reset: () => undefined,
      seal: () => undefined, intro: () => new Vector3(), begin: () => undefined, enterPhase: () => undefined,
      update: () => undefined, clampHp: () => undefined, setInvulnerable: () => undefined, victory: () => undefined,
      rewardPoint: () => new Vector3(), respawnPoint: () => ({ pos: new Vector3(), yaw: 0 }) };
    const host: BossHost = { scene: f.game.scene, player: f.player, camera: f.game.camera, lockInput: () => undefined,
      respawn: () => undefined, addInteractable: () => undefined, removeInteractable: () => undefined, skipHeld: () => false };
    const ui = legacyDouble<BossBar>({});
    const def: BossDef = { id: 'fixture', name: 'Fixture', title: 'Fixture', phases: [{ at: 1, caption: '', name: '' }],
      retryTitle: '', intro: 1, introShort: 1, reward: { tier: '', name: '', flavour: '', prompt: '', model: () => new Group(), grant: () => undefined } };
    const boss = new SavedBoss(def, script, host, ui, 'nalati-grasslands', mode === 'adapter' ? adapter : undefined);
    expect([boss.defeated, boss.rewardTaken, boss.snapshot().saved.kills]).toEqual([true, true, 3]);
    boss.restore({ ...boss.snapshot(), saved: { ...initial, kills: 4 } }); boss.persist();
    expect((mode === 'adapter' ? data : bossesSave.read('nalati-grasslands'))['fixture']?.kills).toBe(4);
    expect((mode === 'adapter' ? bossesSave.read('nalati-grasslands') : data)['fixture']?.kills).toBe(3);
    expect(bossesSave.read('nalati-grasslands')['other']?.kills).toBe(7);
  }); } finally { scope.dispose(); }
});

it.each(['default', 'adapter'] as const)('elite %s persistence preserves retirement and uses exactly one owner', (mode) => {
  localStorage.clear();
  const scope = new Scope('elite.persistence');
  try { withOwner(scope, () => {
    const initial = { timer: 12, discovered: true, skinTaken: false, kills: 2, retired: false };
    elitesSave.write({ fixture: initial }, 'nalati-grasslands');
    let data: ReturnType<typeof elitesSave.read> = { fixture: { ...initial } };
    const adapter: ElitePersistence = { read: () => structuredClone(data), write: (value, slug) => { expect(slug).toBe('nalati-grasslands'); data = structuredClone(value); } };
    const def: EliteDef = { id: 'fixture', name: 'Fixture', epithet: '', lair: { x: 0, z: 0, r: 5 }, awareR: 10, engageR: 5, leashR: 20,
      rule: 'always', respawnMin: 20, signature: '', phase2: '', once: true, drop: { skin: null, skinName: '', weapon: 'sword', blurb: '' } };
    const script: EliteScript = { def, animal: null, spawn: () => undefined, despawn: () => undefined, tick: () => undefined,
      enterPhase2: () => undefined, reset: () => undefined, dropModel: () => new Group(), trophy: () => undefined };
    const elites = new Elites({ scene: new Scene(), camera: new PerspectiveCamera(), player: { position: new Vector3() }, condition: () => true,
      addInteractable: () => undefined, removeInteractable: () => undefined, toast: () => undefined }, new EliteBar(), 'nalati-grasslands', mode === 'adapter' ? adapter : undefined);
    elites.add(script); expect(elites.entry('fixture')?.timer).toBe(12); elites.won('fixture');
    expect((mode === 'adapter' ? data : elitesSave.read('nalati-grasslands'))['fixture']).toEqual({ ...initial, kills: 3, skinTaken: true, retired: true });
    expect((mode === 'adapter' ? elitesSave.read('nalati-grasslands') : data)['fixture']).toEqual(initial);
  }); } finally { scope.dispose(); }
});
