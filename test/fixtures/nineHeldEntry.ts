import { Vector3 } from 'three';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { createLevelInstallation } from '../../src/engine/level/installation';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { shardContext } from '../../src/game/plugin/context';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { prepareHeldClaimsEntry, installHeldClaimsEntry } from '../../src/game/shardfile/heldClaimsEntry';
import { entryOwner } from '../../src/game/shardfile/entryOwners';
import { heldSwordWorld } from './heldNativeSword';
import type { HeldMeleeOwner } from '../../src/game/loadout/claims';
import type { ShardRuntime } from '../../src/game/shard/runtime';
import source from '../../src/shards/nine-dragon-stack/shard.config';
import manifest from '../../src/shards/nine-dragon-stack/discovery.generated';
import aim from '../../src/shards/nine-dragon-stack/data/grapple.json' with { type: 'json' };
import bursts from '../../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };
import { headlessConstants } from '../../src/shards/nine-dragon-stack/generators/headless';
import { legacyDouble } from '../fake/FakeGame';

export const enteredRows = { grapple: { item: 'tool.fei-zhua', source: 'sim/headless-constants.json', presentation: 'weapons/jian-row.json' } };
export async function heldEntry(prepare = true) {
  const app = new App(), parent = new Scope('held-parent'), scope = parent.child('held-entry');
  app.levelScope = scope;
  for (const input of INPUT_CONTEXTS.filter(row => row.id === 'weapon.melee')) app.input.register(input, scope);
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const bytes = new TextEncoder().encode(JSON.stringify(headlessConstants));
  let pending: Promise<Uint8Array> | null = null;
  const presentation = new TextEncoder().encode(JSON.stringify({ portraitFov: 78, aim, bursts }));
  const product = createShardProduct({ slug: manifest.slug, revision: source.identity.revision, shardfile: source,
    sections: new Map<string, unknown>([['held/arms', { kind: 'declared-primary', primary: { item: 'weapon.jian', blade: 'wood', file: enteredRows.grapple.presentation }, tools: ['tool.fei-zhua'] }],
      ['client/plan', { version: 1, features: [{ kind: 'held.claims.prepare', id: 'held.primary' }, { kind: 'held.claims.install', claims: 'held.primary' }, { kind: 'held.claims.enter', claims: 'held.primary', ...enteredRows }] }]]),
    files: new Map([[enteredRows.grapple.presentation, { hash: '0'.repeat(64), url: '/jian-row.json' }], [enteredRows.grapple.source, { hash: '1'.repeat(64), url: '/constants.json' }]]),
    read: hash => hash === '1'.repeat(64) ? pending ?? Promise.resolve(bytes) : Promise.resolve(presentation) });
  const native=heldSwordWorld();scope.onDispose(native.dispose);
  const runtime: ShardRuntime = { world: legacyDouble<NonNullable<ShardRuntime['world']>>(native.world), step: null, play: null,
    interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const ctx = shardContext(level.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  let equipment: EquipmentService | null = null, installed: HeldMeleeOwner | null = null;
  const build = async ():Promise<void> => {
    const factory=runtime.buildEquipment;if(factory===undefined)throw new Error('Missing native builder');
    installed=entryOwner(scope,'claims','held.primary').melee();
    const result=await factory({raycast:()=>null},false,{arms:native.arms});
    equipment=new EquipmentService(result.primary,{scope});app.registerEquipment(equipment,scope);
  };
  if(prepare){level.openKit();await prepareHeldClaimsEntry(ctx,'held.primary');installHeldClaimsEntry(ctx,'held.primary');level.closeKit();await build();}
  return { app, parent, scope, ctx, build, bytes, level, get primary(){return entryOwner(scope,'claims','held.primary').melee().primary();},
    get installed(){if(installed===null)throw new Error('Primary not installed');return installed;},get equipment(){if(equipment===null)throw new Error('Equipment not built');return equipment;},get held() { return entryOwner(scope, 'claims', 'held.primary'); },
    pause: (read: Promise<Uint8Array>) => { pending = read; }, dispose: () => { parent.dispose(); app.engineScope.dispose(); } };
}
