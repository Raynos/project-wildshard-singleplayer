// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { SkyRig } from '@wildshard/engine/world/skyRig';
import { live } from '@wildshard/engine/models/live';
import { modelContext, seedOf, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import * as lowPolyKit from '@wildshard/engine/world/lowpolyKit';
import { driftwoodFixedProduct } from './fixtures/driftwoodFixedProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { loadFixedGeometry, fixedGeometryReady } from '../src/shards/driftwood-isle/runtime/boot/fixedGeometry';
import { barrel, crate, ropeCoil } from '../src/shards/driftwood-isle/runtime/models/cargo';
import { driftLog } from '../src/shards/driftwood-isle/runtime/models/driftLog';
import { captainHat, sailclothCape } from '../src/shards/driftwood-isle/runtime/models/captainHat';
import { reefFish } from '../src/shards/driftwood-isle/runtime/models/reefFish';
import { seaGlassChime } from '../src/shards/driftwood-isle/runtime/models/seaGlassChime';
import { trophyPlaques } from '../src/shards/driftwood-isle/runtime/models/trophyPlaques';

const entries = [live(barrel), live(crate), live(ropeCoil), live(driftLog), live(captainHat), live(sailclothCape), live(reefFish), live(seaGlassChime), live(trophyPlaques)];

it('forwards cold fixed preparation to the existing live roster', () => {
  expect(fixedGeometryReady()).toBe(false);
  for (const entry of entries) expect(entry.prepare).toBe(loadFixedGeometry);
  expect(() => barrel.build(modelContext(SkyRig.prototype), barrel.defaults, new Rng(1))).toThrow('not loaded');
});

async function geometryHash(geometry: BufferGeometry): Promise<string> {
  const values: string[] = [];
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    values.push(name, JSON.stringify([attribute.itemSize, attribute.normalized, Array.from(attribute.array)]));
  }
  values.push(JSON.stringify({index: geometry.index === null ? null : Array.from(geometry.index.array), drawRange: geometry.drawRange, groups: geometry.groups}));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(values.join(''))));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const isMaterial = (value: unknown): value is Material => value instanceof Material;

function partsOf(built: readonly ModelPart[] | Object3D): readonly ModelPart[] {
  if (!(built instanceof Object3D)) return built;
  const parts: ModelPart[] = [];
  built.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry: unknown = object.geometry, material: unknown = object.material;
    if (!isGeometry(geometry) || !isMaterial(material)) throw new Error('Unexpected card draw');
    parts.push({geometry, material, castShadow: object.castShadow, receiveShadow: object.receiveShadow});
  });
  return parts;
}

it('matches the original warm cards for every authored geometry and variant', async () => {
  const product = await driftwoodFixedProduct(), material = new MeshStandardMaterial();
  const borrowed = vi.spyOn(lowPolyKit, 'lowPolyLookMaterial').mockReturnValue(material);
  const mocked = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(product);
  const signatures: Record<string, unknown> = {}, ctx = modelContext(SkyRig.prototype);
  async function check<P extends object>(def: ModelDef<P>): Promise<void> {
    // The parent oracle explicitly preloads the same warm-world templates; the new cards use their roster preparation.
    await (def.prepare ?? loadFixedGeometry)();
    for (const [id, params] of [['default', def.defaults] as const, ...(def.variants ?? []).map(row => [row.id, {...def.defaults, ...row.params}] as const)]) {
      const parts = partsOf(def.build(ctx, params, new Rng(seedOf(def))));
      signatures[`${def.id}/${id}`] = await Promise.all(parts.map(async part => ({geometry: await geometryHash(part.geometry), castShadow: part.castShadow ?? false, receiveShadow: part.receiveShadow ?? false})));
      for (const part of parts) expect(part.material).toBe(material);
    }
  }
  try {
    await check(barrel); await check(crate); await check(ropeCoil); await check(driftLog);
    await check(captainHat); await check(sailclothCape); await check(reefFish); await check(seaGlassChime); await check(trophyPlaques);
    expect(signatures).toMatchSnapshot();
    expect(mocked).toHaveBeenCalled();
  } finally { mocked.mockRestore(); borrowed.mockRestore(); material.dispose(); }
});
