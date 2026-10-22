import { Group, Vector3 } from 'three';
import { vi } from 'vitest';
import * as v from 'valibot';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { Weapon } from '../../src/engine/combat/Weapon';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { createLevelInstallation } from '../../src/engine/level/installation';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { shardContext } from '../../src/game/plugin/context';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { ItemCatalogue } from '../../src/game/plugin/nativeItems';
import { prepareHeldClaimsEntry, installHeldClaimsEntry } from '../../src/game/shardfile/heldClaimsEntry';
import { entryOwner } from '../../src/game/shardfile/entryOwners';
import * as melee from '../../src/game/loadout/declaredMelee';
import type { Sword } from '../../src/game/weapons/Sword';
import type { ShardRuntime } from '../../src/game/shard/runtime';
import { MeleeWeaponProfileSchema } from '../../src/format/weaponProfiles';
import source from '../../src/shards/nine-dragon-stack/shard.config';
import manifest from '../../src/shards/nine-dragon-stack/discovery.generated';
import items from '../../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import aim from '../../src/shards/nine-dragon-stack/data/grapple.json' with { type: 'json' };
import bursts from '../../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };
import { headlessConstants } from '../../src/shards/nine-dragon-stack/generators/headless';
import { legacyDouble } from '../fake/FakeGame';

export class NativeWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: 0, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  override get charge(): number { return 0; }
  tryFire(): void { /* Native melee clock stays owned. */ }
  update(): void { /* The real controller is adopted. */ }
}

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
  const runtime: ShardRuntime = { world: legacyDouble<NonNullable<ShardRuntime['world']>>({}), step: null, play: null,
    interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const ctx = shardContext(level.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const primary = legacyDouble<Sword>(new NativeWeapon(new ItemCatalogue(items).equipment('weapon.jian'))), equipment = new EquipmentService(primary, { scope });
  app.registerEquipment(equipment, scope);
  const profile = v.parse(MeleeWeaponProfileSchema, source.items.rows.find(row => row.kind === 'weapon')?.profile);
  const installed = { primary: () => primary, profile };
  const install = vi.spyOn(melee, 'installDeclaredMelee').mockReturnValue(installed);
  try {
    if (prepare) { level.openKit(); await prepareHeldClaimsEntry(ctx, 'held.primary'); installHeldClaimsEntry(ctx, 'held.primary'); level.closeKit(); }
  } finally { install.mockRestore(); }
  return { app, parent, scope, ctx, primary, equipment, installed, bytes, level, get held() { return entryOwner(scope, 'claims', 'held.primary'); },
    pause: (read: Promise<Uint8Array>) => { pending = read; }, dispose: () => { parent.dispose(); app.engineScope.dispose(); } };
}
