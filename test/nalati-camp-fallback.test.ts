import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { Scope } from '../src/engine/app/scope';
import { FigureSkins } from '../src/game/systems/npc/figureSkins';
import { enterFigureGroup } from '../src/game/systems/npc/figureRows';
import * as rigLoader from '../src/engine/anim/rig';
import channels from '../src/shards/nalati-grasslands/data/peopleChannels.generated.json' with { type: 'json' };
import population from '../src/shards/nalati-grasslands/boot/peopleFrames.generated.json' with { type: 'json' };

afterEach(() => { vi.restoreAllMocks(); });

it('refuses a missing prepared skin instead of publishing a substitute camp', async () => {
  const scope = new Scope('camp-failure-test'), failure = new Error('missing skin');
  vi.spyOn(FigureSkins, 'prepared').mockRejectedValue(failure);
  vi.spyOn(rigLoader, 'loadRigFile').mockRejectedValue(failure);
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  const registry = new WorldRegistry(); registry.scope = scope;
  const camp = enterFigureGroup({ scope, sky, registry, channels: channels.clientChannels }, population);
  await expect(camp.ready).rejects.toBe(failure);
  expect(camp.group.children.every(child => !(child instanceof THREE.Mesh))).toBe(true);
  scope.dispose();
});
