// oxlint-disable-next-line import/no-nodejs-modules -- Native durability witness has no browser or renderer.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only admitted immutable template bytes and the shipped native engine.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import source from '../../../src/shards/_template/shard.config.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { SaveStore } from '../../../src/engine/saves/store.ts';
import { createShardfileSim, bindShardfileSim } from '../../../src/game/shardfile/simulation.ts';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot.ts';
import { GridRegionDurability } from '../../../src/game/grid/durability.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
class Storage {
  data = new Map(); fail = false; failProfile = false;
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail || (this.failProfile && key.endsWith('profile'))) throw new Error('Quota'); this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}
const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(new URL(`../../../src/shards/_template/assets/${file.hash}`, import.meta.url))]));
const local = new Storage(), store = new SaveStore({ local, session: null });
const identity = { id: 'template-3', shard: '_template' }, other = { id: 'template-2', shard: '_template' };
const durability = new GridRegionDurability(store, identity, source, []);
let sim = createShardfileSim(source, assets, { rapier, quest: durability.quest });
durability.bind(sim.host);
try {
  sim.host.step();
  local.fail = true;
  sim.host.player.position.set(0, 0, -9); sim.host.step();
  const blob = sim.host.entities.get('grey-blob:1'); assert.ok(blob);
  sim.host.combat.hit({ source: sim.host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: blob.combatActor(),
    amount: 1000, point: new Vector3(), dir: new Vector3(0, 0, 1) }); sim.host.step();
  assert.equal(sim.host.flags.has('template.complete'), true);
  assert.equal(durability.wallet.coins(), 5);
  assert.equal(Object.values(durability.ledger.state().facts).length, 1);
  const snapshot = snapshotSimHost(sim.host);
  for (let retry = 0; retry < 10; retry++) assert.equal(durability.checkpoint(snapshot), false);
  assert.equal(durability.wallet.coins(), 5);
  const lostWrite = new GridRegionDurability(new SaveStore({ local, session: null }), identity, source, []);
  assert.equal(lostWrite.read(), undefined); assert.equal(lostWrite.wallet.coins(), 0);
  local.fail = false; assert.equal(durability.checkpoint(snapshot), true);
  const authored = sim.host.level; sim.dispose();
  const reopened = new GridRegionDurability(new SaveStore({ local, session: null }), identity, source, []), saved = reopened.read(); assert.ok(saved);
  const host = restoreSimHost(authored, { rapier }, saved, (restored) => {
    sim = bindShardfileSim(restored, source, assets, { rapier, restoring: true, quest: reopened.quest });
    reopened.bind(restored);
  });
  assert.equal(host.flags.has('template.complete'), true); assert.equal(reopened.wallet.coins(), 5);
  for (let tick = 0; tick < 120; tick++) host.step();
  assert.equal(reopened.wallet.coins(), 5); assert.equal(Object.values(reopened.ledger.state().facts).length, 1);
  assert.equal(Object.values(reopened.ledger.state().achievements)[0].count, 1);
  const sibling = new GridRegionDurability(new SaveStore({ local, session: null }), other, source, []);
  assert.equal(sibling.read(), undefined); assert.equal(sibling.wallet.coins(), 0);
  const revised = new GridRegionDurability(new SaveStore({ local, session: null }), identity, { ...source, identity: { ...source.identity, revision: source.identity.revision + 1 } }, []);
  assert.throws(() => revised.read(), /revision changed/);
  const key = [...local.data.keys()].find((name) => name.endsWith(identity.id)); assert.ok(key);
  const document = JSON.parse(local.getItem(key));
  document.keys['platform.region'].data.snapshot = JSON.stringify({ version: 900 }); local.setItem(key, JSON.stringify(document));
  assert.throws(() => new GridRegionDurability(new SaveStore({ local, session: null }), identity, source, []).read());

  const profileLocal = new Storage(), profileStore = new SaveStore({ local: profileLocal, session: null });
  const profileSave = new GridRegionDurability(profileStore, identity, source, []);
  const profileSim = createShardfileSim(source, assets, { rapier, quest: profileSave.quest }); profileSave.bind(profileSim.host);
  try {
    profileSim.host.step(); profileLocal.failProfile = true;
    profileSim.host.player.position.set(0, 0, -9); profileSim.host.step();
    const target = profileSim.host.entities.get('grey-blob:1'); assert.ok(target);
    profileSim.host.combat.hit({ source: profileSim.host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: target.combatActor(),
      amount: 1000, point: target.position, from: profileSim.host.player.position, dir: new Vector3(0, 0, 1) }); profileSim.host.step();
    const pending = snapshotSimHost(profileSim.host);
    assert.equal(profileSave.checkpoint(pending), false);
    const cold = new GridRegionDurability(new SaveStore({ local: profileLocal, session: null }), identity, source, []);
    assert.equal(cold.wallet.coins(), 5); assert.equal(Object.values(cold.ledger.state().facts).length, 0); assert.equal(cold.read(), undefined);
    profileLocal.failProfile = false; assert.equal(profileSave.checkpoint(pending), true);
    const durable = new GridRegionDurability(new SaveStore({ local: profileLocal, session: null }), identity, source, []);
    assert.equal(durable.wallet.coins(), 5); assert.equal(Object.values(durable.ledger.state().facts).length, 1); assert.ok(durable.read());
  } finally { profileSim.dispose(); }
  console.info(JSON.stringify({ nativeDurability: true, failedRetries: 10, coins: 5, questFacts: 1, achievementGrants: 1,
    restoredTicks: 120, independentCopies: true, refusesChangedRevision: true, refusesCorruptSnapshot: true, profileQuotaDeferred: true }));
} finally { sim.dispose(); }
