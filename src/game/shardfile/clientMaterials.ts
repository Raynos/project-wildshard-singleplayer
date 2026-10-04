/**
 * The shardfile loader's materials (SHARD-PLATFORM SF15a): the look's material catalogue (`look.materials`, SF10a's
 * family entries) and its family looks compiled on the game's renderer, with every texture an admitted KTX2 file
 * transcoded once (its mips dropped from JS after upload). A family named by the look, the terrain or the props without
 * its own entry gets the family's plain default, vertex-coloured (PBR's dielectric). No URL, no shader source and no callback comes from the shard.
 */
import { CompressedTexture, SRGBColorSpace, NoColorSpace, type Texture, type Material } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { BASIS_PATH, releaseAfterUpload } from '@wildshard/engine/core/ktx2';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { PainterlyLook } from '@wildshard/engine/render/families/painterly';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { familyMaterial } from '@wildshard/engine/render/families/registry';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Shardfile } from './schema';
import { materialTextureRefs } from './materials';
import { declaresMeasure, installMeasureLookRow } from './measureLook';

/** Compile a shardfile's admitted material data on the game's renderer; `compile` adds one more family entry; `tick` advances the family looks' clocks. */
export async function clientMaterials(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, renderer: Renderer, scope: Scope): Promise<{ materials: ReadonlyMap<string, Material>; textures: ReadonlyMap<string, Texture>; compile: (entry: unknown) => Material; tick: (dt: number) => void }> {
  const textures = new Map<string, Texture>(), uses = new Map<string, 'colour' | 'data'>();
  const refs = new Set([...materialTextureRefs(shard.look.materials), ...(shard.props?.textures.map((entry) => entry.colour) ?? [])]);
  if (refs.size > 0) {
    const loader = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
    scope.onDispose(() => { loader.dispose(); });
    for (const ref of refs) {
      const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing admitted material texture');
      const texture = await new Promise<Texture>((resolve, reject) => { loader.parse(Uint8Array.from(bytes).buffer, resolve, reject); });
      if (scope.disposed) { texture.dispose(); throw new Error('Material scope unloaded during transcode'); }
      texture.flipY = false; texture.name = `shardfile:${ref}`; if (texture instanceof CompressedTexture) releaseAfterUpload(texture);
      scope.own(texture); textures.set(ref, texture);
    }
  }
  const resolveTexture = (ref: string, use: 'colour' | 'data'): Texture => {
    const texture = textures.get(ref); if (texture === undefined) throw new Error('Unresolved admitted material texture');
    const previous = uses.get(ref); if (previous !== undefined && previous !== use) throw new Error('One texture hash cannot mix colour and numeric data roles');
    uses.set(ref, use); texture.colorSpace = use === 'colour' ? SRGBColorSpace : NoColorSpace; return texture;
  };
  for (const entry of shard.props?.textures ?? []) resolveTexture(entry.colour, 'colour');
  const toon = new ToonLook(shard.look.familyLooks.toon ?? {}), painterly = new PainterlyLook(shard.look.familyLooks.painterly ?? {}), emissive = new EmissiveLook(shard.look.familyLooks.emissive ?? {});
  const context = { toon, painterly, emissive, textures: resolveTexture, scope }, materials = new Map<string, Material>();
  const defaults = new Set([...shard.look.families, ...(shard.terrain === null ? [] : [shard.terrain.family]), ...(shard.props === null ? [] : [shard.props.family])]);
  // a family's implicit surface is plain and vertex-coloured; PBR's metalness default is a map multiplier, so the plain one is dielectric
  for (const id of defaults) if (!Object.hasOwn(shard.look.materials, id)) materials.set(id, scope.own(familyMaterial({ family: id, vertexColours: true, ...(id === 'pbr' ? { metalness: 0 } : {}) }, context)));
  for (const [id, entry] of Object.entries(shard.look.materials)) materials.set(id, scope.own(familyMaterial(entry, context)));
  // SF56: a declared measure layer draws only while its Debug row is on
  if (declaresMeasure(shard)) installMeasureLookRow(scope);
  // a further family entry (an exported skin's binding, SF16) compiles on the same looks and admitted textures, scope-owned
  return { materials, textures, compile: (entry) => scope.own(familyMaterial(entry, context)), tick: (dt) => { toon.tick(dt); painterly.tick(dt); emissive.tick(dt); } };
}
