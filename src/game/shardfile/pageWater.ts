/** Client-only material binding to an existing native pond and shared ripples. */
import * as THREE from 'three';
import * as v from 'valibot';
import { PageWaterBindingSchema } from '@wildshard/format/pagePreparation';
import { POND, waterLevel } from '@wildshard/engine/world/Heightfield';
import { waterTexture } from '@wildshard/engine/world/water/ripples';
import { lentLook, setLentParam, setLentTexture } from './lentLooks';
import type { ShardContext } from '../plugin/context';

function isTexture(value: unknown): value is THREE.Texture { return value instanceof THREE.Texture; }

export function bindPageWater(ctx: ShardContext, input: unknown): void {
  const row = v.parse(PageWaterBindingSchema, input), game = ctx.game.runtime?.world?.game;
  if (game === undefined) throw new Error('Water binding requires its world');
  const object = game.scene.getObjectByName(row.object);
  if (object === undefined && game.scene !== game.rootScene) { for (const id of row.looks) setLentTexture(id, row.ripples, waterTexture()); return; }
  const old: unknown = object instanceof THREE.Mesh ? object.material : null, probe: unknown = object?.userData[row.probe];
  const ripples: unknown = old instanceof THREE.MeshPhysicalMaterial ? old.normalMap : null;
  if (!(object instanceof THREE.Mesh) || !isTexture(probe) || !isTexture(ripples)) throw new Error('Missing native water surface/probe/ripples');
  for (const id of row.looks) setLentTexture(id, row.ripples, ripples);
  setLentTexture(row.look, row.skyline, probe); setLentParam(row.look, row.centre, [POND.x, POND.z, waterLevel(), 1]);
  object.material = lentLook(row.look); if (old instanceof THREE.Material) old.dispose();
}
