import { vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../src/engine/client/app/app';
import { Scope } from '../../src/engine/shared/app/scope';
import { EquipmentService } from '../../src/engine/client/combat/EquipmentService';
import { createLevelInstallation } from '../../src/engine/client/level/installation';
import { INPUT_CONTEXTS } from '../../src/game/client/inputContexts';
import { shardContext } from '../../src/game/server/plugin/context';
import { createShardProduct } from '../../src/game/shared/shardfile/shardProduct';
import { prepareHeldClaimsEntry, installHeldClaimsEntry } from '../../src/game/client/shardfile/heldClaimsEntry';
import { entryOwner } from '../../src/game/client/shardfile/entryOwners';
import { heldSwordWorld } from './heldNativeSword';
import type { HeldMeleeOwner } from '../../src/game/client/loadout/claims';
import type { ShardRuntime } from '../../src/game/server/shard/runtime';
import source from './nine-product-inputs';
import manifest from '../../src/shards/nine-dragon-stack/discovery.generated';
import { nineHeldPresentationBytes } from './nine-held-presentation';
import { fixtureProductFile, fixtureJsonCheck } from './productFile';
import { headlessConstants } from '../../src/shards/nine-dragon-stack/generators/headless';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

export const slottedEnteredRows = { grapple: { item: 'tool.fei-zhua', source: 'fixture/grapple-source.json', presentation: 'weapons/jian-row.json' } };
export const enteredRows = { grapple: { item: 'tool.fei-zhua', profile: headlessConstants.grappleProfile, hooks: headlessConstants.hooks, presentation: 'weapons/jian-row.json' } };
export async function heldEntry(prepare = true) {
  const app = new App(), parent = new Scope('held-parent'), scope = parent.child('held-entry');
  app.levelScope = scope;
  for (const input of INPUT_CONTEXTS.filter(row => row.id === 'weapon.melee')) app.input.register(input, scope);
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const bytes = new TextEncoder().encode(JSON.stringify(headlessConstants));
  let pending: Promise<Uint8Array> | null = null;
  const presentation = nineHeldPresentationBytes();
  const product = createShardProduct({ slug: manifest.slug, revision: source.identity.revision, shardfile: source, jsonCheck: fixtureJsonCheck,
    sections: new Map<string, unknown>([['held/arms', { kind: 'declared-primary', primary: { item: 'weapon.jian', blade: 'wood', file: enteredRows.grapple.presentation }, tools: ['tool.fei-zhua'] }],
      ['client/plan', { version: 1, features: [{ kind: 'held.claims.prepare', id: 'held.primary' }, { kind: 'held.claims.install', claims: 'held.primary' }, { kind: 'held.claims.enter', claims: 'held.primary', ...enteredRows }] }]]),
    files: new Map([[enteredRows.grapple.presentation, fixtureProductFile(enteredRows.grapple.presentation, { hash: '0'.repeat(64), url: '/jian-row.json' })], [slottedEnteredRows.grapple.source, { hash: '1'.repeat(64), url: '/constants.json' }]]),
    read: hash => pending ?? Promise.resolve(hash === '1'.repeat(64) ? bytes : presentation) });
  // Only this synthetic grapple projection lacks a shipping file owner.
  // Preserve its original immutable bytes and the entered native parser.
  const named = product.json.bind(product);
  vi.spyOn(product, 'json').mockImplementation(async name => {
    if (name !== slottedEnteredRows.grapple.source) return named(name);
    const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(await product.file(name)));
    return value;
  });
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
  return { app, parent, scope, ctx, build, bytes: presentation, level, get primary(){return entryOwner(scope,'claims','held.primary').melee().primary();},
    get installed(){if(installed===null)throw new Error('Primary not installed');return installed;},get equipment(){if(equipment===null)throw new Error('Equipment not built');return equipment;},get held() { return entryOwner(scope, 'claims', 'held.primary'); },
    pause: (read: Promise<Uint8Array>) => { pending = read; }, dispose: () => { parent.dispose(); app.engineScope.dispose(); } };
}
