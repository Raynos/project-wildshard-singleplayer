import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { SkyRig } from '../src/engine/client/world/skyRig';
import { WorldRegistry } from '../src/engine/client/world/registry';
import { Scope } from '../src/engine/shared/app/scope';
import { setTerrainHeight } from '../src/engine/shared/world/terrainHeight';
import { FigureSkins } from '../src/game/client/systems/npc/figureSkins';
import * as v from 'valibot';
import { installQuestFigures } from '../src/game/client/quest/figures';
import type { ShardContext } from '../src/game/server/plugin/context';
import type { ShardRuntime } from '../src/game/server/shard/runtime';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { ClientChannelsSchema } from '@wildshard/format/clientChannels';
import * as rigLoader from '../src/engine/client/anim/rig';
import { peoplePrograms } from '../src/shards/nalati-grasslands/generators/peopleMotion';
import { peopleRows as population } from '../src/shards/nalati-grasslands/generators/peopleRows.mjs';

afterEach(() => { vi.restoreAllMocks(); });
/** A chapter's entered owners as the quest-figures host reads them: scope, world sky and registry, client channels. */
function ownerOf(scope: Scope, sky: SkyRig, registry: WorldRegistry): ShardContext {
  const world = legacyDouble<NonNullable<ShardRuntime['world']>>({ sky, registry });
  return legacyDouble<ShardContext>({ scope, game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<ShardRuntime>({ world }) }),
    product: legacyDouble<ShardContext['product']>({ hasFile: () => false, url: (name: string) => name,
      shardfile: legacyDouble<ShardContext['product']['shardfile']>({ clientChannels: v.parse(ClientChannelsSchema, Object.values(peoplePrograms).flat()) }) }) });
}


it('refuses a missing prepared skin instead of publishing a substitute camp', async () => {
  setTerrainHeight(() => 12);
  const scope = new Scope('camp-failure-test'), failure = new Error('missing skin');
  vi.spyOn(FigureSkins, 'prepared').mockRejectedValue(failure);
  vi.spyOn(rigLoader, 'loadRigFile').mockRejectedValue(failure);
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  const registry = new WorldRegistry(); registry.scope = scope;
  const camp = installQuestFigures(ownerOf(scope, sky, registry), { figures: [], group: population });
  await expect(camp.ready).rejects.toBe(failure);
  expect(camp.group.children.every(child => !(child instanceof THREE.Mesh))).toBe(true);
  scope.dispose();
});
