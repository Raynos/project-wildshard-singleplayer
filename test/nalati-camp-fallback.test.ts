import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { Scope } from '../src/engine/app/scope';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { FigureSkins } from '../src/game/systems/npc/figureSkins';
import * as v from 'valibot';
import { installQuestFigures } from '../src/game/quest/figures';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { legacyDouble } from './fake/FakeGame';
import { ClientChannelsSchema } from '../src/format/clientChannels';
import * as rigLoader from '../src/engine/anim/rig';
import channels from '../src/shards/nalati-grasslands/data/peopleChannels.generated.json' with { type: 'json' };
import population from '../src/shards/nalati-grasslands/data/peopleFrames.generated.json' with { type: 'json' };

afterEach(() => { vi.restoreAllMocks(); });
/** A chapter's entered owners as the quest-figures host reads them: scope, world sky and registry, client channels. */
function ownerOf(scope: Scope, sky: SkyRig, registry: WorldRegistry): ShardContext {
  const world = legacyDouble<NonNullable<ShardRuntime['world']>>({ sky, registry });
  return legacyDouble<ShardContext>({ scope, game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<ShardRuntime>({ world }) }),
    product: legacyDouble<ShardContext['product']>({ shardfile: legacyDouble<ShardContext['product']['shardfile']>({ clientChannels: v.parse(ClientChannelsSchema, channels.clientChannels) }) }) });
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
