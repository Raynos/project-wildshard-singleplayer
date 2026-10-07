/**
 * Named prop materials on the client (SHARD-PLATFORM SF55, G211): the render half of the GLB material adapter. Each
 * `props.materials` name resolves once, at material compile, to a `PropSurfaceBinding` the engine's declared-props
 * installer draws with (`installDeclaredProps({ surfaces })`):
 *
 * - **the base material** is the admitted catalogue entry its ID names (toon, painterly, PBR, emissive or graph), or the
 *   family's plain default for a bare family ID. A graph that takes a slot compiles once more with the slot's file in its
 *   own texture param of that name (same program, its own uniforms), so its outline stage and bound params come with it;
 * - **the slots** are the admitted, transcoded KTX2 textures in their colour / data role, each carrying its glTF sampler
 *   (one sampler per file, admitted by `validatePropMaterials`). A family base draws them as a shared variant; a graph's
 *   node material reads them through its params; a graph that fell back to its preset (Debug row off, or over budget)
 *   draws them on the preset, so a fallback still shows its textures;
 * - **an unmapped name throws** from the resolver: the install refuses, naming it, and never draws a guessed surface.
 */
import {
  ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, MirroredRepeatWrapping, NearestFilter,
  NearestMipmapLinearFilter, NearestMipmapNearestFilter, RepeatWrapping, type MagnificationTextureFilter, type Material,
  type MinificationTextureFilter, type Texture, type Wrapping,
} from 'three';
import type { PropSurfaceBinding } from '@wildshard/engine/world/declaredProps';
import { FAMILY_IDS } from '@wildshard/engine/render/families/params';
import { propMaterialSlots, propSlotUse, type PropMaterials, type PropTextureSlot } from './propMaterials';
import type { Shardfile } from './schema';

const WRAPS: Readonly<Record<number, Wrapping>> = { 33071: ClampToEdgeWrapping, 33648: MirroredRepeatWrapping, 10497: RepeatWrapping };
const MAG: Readonly<Record<number, MagnificationTextureFilter>> = { 9728: NearestFilter, 9729: LinearFilter };
const MIN: Readonly<Record<number, MinificationTextureFilter>> = {
  9728: NearestFilter, 9729: LinearFilter, 9984: NearestMipmapNearestFilter, 9985: LinearMipmapNearestFilter, 9986: NearestMipmapLinearFilter, 9987: LinearMipmapLinearFilter,
};

/** Put a slot's glTF sampler on its (one per file) texture; an absent filter keeps three's trilinear default, as GLTFLoader does. */
export function applyPropSampler(texture: Texture, slot: PropTextureSlot): Texture {
  texture.wrapS = WRAPS[slot.wrapS] ?? RepeatWrapping; texture.wrapT = WRAPS[slot.wrapT] ?? RepeatWrapping;
  texture.magFilter = slot.magFilter === null ? LinearFilter : MAG[slot.magFilter] ?? LinearFilter;
  texture.minFilter = slot.minFilter === null ? LinearMipmapLinearFilter : MIN[slot.minFilter] ?? LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A material entry for a bare family ID, as clientMaterials' implicit family surfaces: plain, vertex-coloured, PBR dielectric. */
export function familyDefaultEntry(family: string): Readonly<Record<string, unknown>> {
  return { family, vertexColours: true, ...(family === 'pbr' ? { metalness: 0 } : {}) };
}

/**
 * Resolve every named prop material once. `catalogue` is the compiled `look.materials` (and family defaults), `compile`
 * compiles one more entry on the same looks / graph compiler / admitted textures (scope-owned), and `texture` resolves an
 * admitted transcoded texture in a role. Returns the resolver the installer calls per GLB material name.
 */
export function propSurfaces(materials: PropMaterials, ports: {
  look: Shardfile['look']['materials']; catalogue: ReadonlyMap<string, Material>;
  compile: (entry: unknown) => Material; texture: (ref: string, use: 'colour' | 'data') => Texture;
}): (name: string) => PropSurfaceBinding {
  const defaults = new Map<string, Material>(), resolved = new Map<string, PropSurfaceBinding>();
  const base = (id: string): Material => {
    const known = ports.catalogue.get(id) ?? defaults.get(id); if (known !== undefined) return known;
    if (!FAMILY_IDS.some((family) => family === id)) throw new Error(`props material ID ${id} is not compiled`);
    const material = ports.compile(familyDefaultEntry(id)); defaults.set(id, material); return material;
  };
  for (const [name, row] of Object.entries(materials)) {
    const slots = propMaterialSlots(row);
    const maps: { -readonly [K in keyof PropSurfaceBinding['maps']]: PropSurfaceBinding['maps'][K] } = { colour: null, normal: null, normalScale: 1, metallicRoughness: null, occlusion: null, occlusionStrength: 1, emissive: null };
    const entry = Object.hasOwn(ports.look, row.id) ? ports.look[row.id] : undefined;
    for (const [slot, value] of slots) {
      // a graph samples every texture param in the colour role (clientGraphs), so its slots resolve as the graph reads them
      const texture = applyPropSampler(ports.texture(value.file, entry?.family === 'graph' ? 'colour' : propSlotUse(slot)), value);
      maps[slot] = texture;
      if (slot === 'normal') maps.normalScale = value.scale ?? 1;
      if (slot === 'occlusion') maps.occlusionStrength = value.strength ?? 1;
    }
    let material: Material;
    if (entry?.family === 'graph' && slots.length > 0) {
      // the slot files fill the graph's own texture params of the same names (admitted: validatePropMaterials)
      const params = { ...entry.graph.params };
      for (const [slot, value] of slots) { const param = params[slot]; if (param?.type !== 'texture') throw new Error(`props material "${name}": graph ${row.id} has no texture param ${slot}`); params[slot] = { ...param, value: value.file }; }
      material = ports.compile({ family: 'graph', graph: { ...entry.graph, params } });
    } else material = base(row.id);
    resolved.set(name, { material, maps });
  }
  return (name) => {
    const binding = resolved.get(name);
    if (binding === undefined) throw new Error(`props GLB material "${name || '(unnamed)'}" is not in props.materials`);
    return binding;
  };
}
