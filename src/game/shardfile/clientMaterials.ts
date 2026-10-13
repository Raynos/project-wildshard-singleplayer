/**
 * The shardfile loader's materials (SHARD-PLATFORM SF15a): the look's material catalogue (`look.materials`, SF10a's
 * family entries) and its family looks compiled on the game's renderer, with every texture an admitted KTX2 file
 * transcoded once (its mips dropped from JS after upload). A family named by the look, the terrain or the props without
 * its own entry gets the family's plain default, vertex-coloured (PBR's dielectric). No URL, no shader source and no callback comes from the shard.
 */
import { ClampToEdgeWrapping, CompressedTexture, LinearFilter, LinearMipmapLinearFilter, MirroredRepeatWrapping, NearestFilter, NearestMipmapNearestFilter, RepeatWrapping, SRGBColorSpace, NoColorSpace, type Texture, type Material } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { BASIS_PATH, releaseAfterUpload } from '@wildshard/engine/core/ktx2';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { PainterlyLook } from '@wildshard/engine/render/families/painterly';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { familyMaterial, moveFamilyMaterial } from '@wildshard/engine/render/families/registry';
import { parseFamilyMaterial } from '@wildshard/format/materialFamilies';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { setting } from '@wildshard/engine/ui/Settings';
import { loadGraphCompiler } from '@wildshard/engine/render/graphBackend';
import { curvedParams, graphFileTextureRefs, materialTextureRefs } from '@wildshard/format/materials';
import { clientGraphs, graphOutlineHook, isGraphEntry, type GraphOutlineHook, type GraphReadout, type GraphSources } from './clientGraphs';
import { parseSkinFile, skinLookParameters } from '@wildshard/format/skinAssets';
import { SKIN_LOOK_RECIPE } from '@wildshard/format/skins';
import type { PropSurfaceBinding } from '@wildshard/engine/world/declaredProps';
import { propMaterialTextureRefs, propMaterialsOf } from '@wildshard/format/propMaterials';
import { propSurfaces } from './clientPropMaterials';
import { splatSurface, withSplatSurface } from './clientSplatTerrain';
import { splatTerrainOf, splatTextureRefs } from '@wildshard/format/splatTerrain';

const WRAPS = { repeat: RepeatWrapping, clamp: ClampToEdgeWrapping, mirror: MirroredRepeatWrapping } as const;
/**
 * A look sampler row on a just-transcoded texture, before its first upload: wrap, anisotropy (three caps it at the device's),
 * filter and mips. `mips: 'gpu'` keeps level 0 of a raw KTX2 (a data texture) and lets the GPU build the chain at upload;
 * a transcoded (compressed) texture cannot be mipmapped by the GPU, so the row refuses it.
 */
export function applyTextureSampler(texture: Texture, row: NonNullable<Shardfile['look']['samplers']>[string]): void {
  if (row.wrap !== undefined) { texture.wrapS = WRAPS[row.wrap]; texture.wrapT = WRAPS[row.wrap]; }
  if (row.anisotropy !== undefined) texture.anisotropy = row.anisotropy;
  const gpu = row.mips === 'gpu';
  if (gpu) {
    if (texture instanceof CompressedTexture) throw new Error(`Sampler ${texture.name}: GPU mips need a raw (uncompressed) KTX2`);
    texture.mipmaps = []; texture.generateMipmaps = true;
  }
  const filter = row.filter ?? (gpu ? 'linear' : undefined);
  if (filter === undefined) return;
  const mipped = gpu || texture.mipmaps.length > 1;
  texture.magFilter = filter === 'linear' ? LinearFilter : NearestFilter;
  texture.minFilter = filter === 'linear' ? (mipped ? LinearMipmapLinearFilter : LinearFilter) : (mipped ? NearestMipmapNearestFilter : NearestFilter);
}

/** Does the shard carry a graph material, in its catalogue or in an admitted skin binding? */
function carriesGraph(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>): boolean {
  if (Object.values(shard.look.materials).some((entry) => entry.family === 'graph')) return true;
  return shard.rows.looks.some((row) => {
    if (row.recipe !== SKIN_LOOK_RECIPE) return false;
    const bytes = assets.get(skinLookParameters(row).skin);
    return bytes !== undefined && isGraphEntry(parseSkinFile(bytes).binding.material);
  });
}

/**
 * Compile a shardfile's admitted material data on the game's renderer; `compile` adds one more entry (family or graph);
 * `tick` advances the family looks' clocks and moves the graph materials' bound params; `graphs.bind` hands the graph
 * params their live sources (the frame owner's hour, the shard state). A `family: "graph"` entry compiles through the
 * lazy graph back-end only while Settings ▸ Debug ▸ Look ▸ "Graph materials" is on (`options.graphs` overrides the row);
 * otherwise it falls back to its family preset (`clientGraphs.ts`). `outline` is the mesh-level hook the views call wherever
 * they bind a catalogue material: a compiled graph that declares `stages.outline` adds its hull as each mesh's second draw
 * (scope-owned with the material); every other material attaches nothing. `surfaces` (SF55) resolves a props GLB material
 * name to its base material and texture slots when the props declare named materials (`clientPropMaterials.ts`); null
 * keeps the one-family path. A family entry with `look.curves` (state-bound curves) compiles at its fields' values and
 * moves in `tick`, uniforms only, whenever a field it reads moved: the live state source `graphs.bind` hands over, else
 * the field's declared default.
 */
export async function clientMaterials(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, renderer: Renderer, scope: Scope, options: { graphs?: boolean; sources?: GraphSources } = {}): Promise<{
  materials: ReadonlyMap<string, Material>; textures: ReadonlyMap<string, Texture>; compile: (entry: unknown) => Material; tick: (dt: number) => void;
  outline: GraphOutlineHook; graphs: { bind: (sources: GraphSources) => void; readout: GraphReadout }; surfaces: ((name: string) => PropSurfaceBinding) | null;
}> {
  const textures = new Map<string, Texture>(), uses = new Map<string, 'colour' | 'data'>();
  const named = shard.props === null ? undefined : propMaterialsOf(shard.props);
  const splat = shard.props === null ? undefined : splatTerrainOf(shard.props);
  const refs = new Set([...materialTextureRefs(shard.look.materials), ...graphFileTextureRefs(shard.look.materials, (hash) => assets.get(hash)), ...(shard.props?.textures.map((entry) => entry.colour) ?? []), ...propMaterialTextureRefs(named), ...splatTextureRefs(splat)]);
  const splatRefs = new Set(splatTextureRefs(splat));
  if (refs.size > 0) {
    const loader = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
    scope.onDispose(() => { loader.dispose(); });
    for (const ref of refs) {
      const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing admitted material texture');
      const texture = await new Promise<Texture>((resolve, reject) => { loader.parse(Uint8Array.from(bytes).buffer, resolve, reject); });
      if (scope.disposed) { texture.dispose(); throw new Error('Material scope unloaded during transcode'); }
      // a splat layer is copied into its array, never uploaded itself (clientSplatTerrain)
      texture.flipY = false; texture.name = `shardfile:${ref}`;
      const sampler = shard.look.samplers?.[ref]; if (sampler !== undefined) applyTextureSampler(texture, sampler);
      if (texture instanceof CompressedTexture && !splatRefs.has(ref)) releaseAfterUpload(texture);
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
  const defaults = new Set([...shard.look.families, ...(shard.terrain === null || shard.terrain.form === 'query' ? [] : [shard.terrain.family]), ...(shard.props === null ? [] : [shard.props.family])]);
  // a family's implicit surface is plain and vertex-coloured; PBR's metalness default is a map multiplier, so the plain one is dielectric
  for (const id of defaults) if (!Object.hasOwn(shard.look.materials, id)) materials.set(id, scope.own(familyMaterial({ family: id, vertexColours: true, ...(id === 'pbr' ? { metalness: 0 } : {}) }, context)));
  // graph entries: the lazy compiler loads only when the row is on and the shard carries one (a shard without pays nothing)
  const graphsOn = options.graphs ?? setting('graphMaterials') === 'on';
  const compiler = graphsOn && carriesGraph(shard, assets) ? await loadGraphCompiler(renderer) : null;
  if (scope.disposed) throw new Error('Material scope unloaded during the graph compiler load');
  const graphs = clientGraphs(shard, { compiler, fallback: (entry) => familyMaterial(entry, context), textures: (ref) => resolveTexture(ref, 'colour'), file: (hash) => assets.get(hash) });
  if (options.sources !== undefined) graphs.bind(options.sources);
  const compile = (entry: unknown): Material => {
    if (!isGraphEntry(entry)) return scope.own(familyMaterial(entry, context));
    const material = graphs.compile(entry), outline = graphs.outline(material);
    if (outline !== null) scope.own(outline.material);
    return scope.own(material);
  };
  // state-bound curves (look.curves): compiled at the fields' values now, moved in `tick` when a field moves
  let stateOf = options.sources?.state;
  const fieldDefaults = new Map<string, number>();
  for (const part of ['shared', 'player'] as const) for (const field of shard.state[part]) if (typeof field.default === 'number') fieldDefaults.set(`${part}.${field.name}`, field.default);
  const fieldValue = (key: string): number => {
    const dot = key.indexOf('.'), part = key.slice(0, dot) === 'player' ? 'player' : 'shared';
    return stateOf?.(part, key.slice(dot + 1)) ?? fieldDefaults.get(key) ?? 0;
  };
  const moving: { material: Material; base: ReturnType<typeof parseFamilyMaterial>; rows: NonNullable<Shardfile['look']['curves']>[string]; seen: Map<string, number> }[] = [];
  for (const [id, entry] of Object.entries(shard.look.materials)) {
    const rows = shard.look.curves?.[id];
    if (rows === undefined || isGraphEntry(entry)) { materials.set(id, compile(entry)); continue; }
    const base = parseFamilyMaterial(entry), seen = new Map(rows.map((row) => [row.state, fieldValue(row.state)]));
    const material = compile(curvedParams(base, rows, (key) => seen.get(key) ?? 0));
    materials.set(id, material); moving.push({ material, base, rows, seen });
  }
  const moveCurves = (): void => {
    for (const row of moving) {
      let moved = false;
      for (const [key, last] of row.seen) { const now = fieldValue(key); if (now !== last) { row.seen.set(key, now); moved = true; } }
      if (moved) moveFamilyMaterial(row.material, curvedParams(row.base, row.rows, (key) => row.seen.get(key) ?? 0));
    }
  };
  const propNamed = named === undefined ? null : propSurfaces(named, { look: shard.look.materials, catalogue: materials, compile, texture: resolveTexture });
  // G227: the splat terrain's tile primitives draw with the live terrain's splat material, every other name as before
  const splatDrawn = splat === undefined ? null : splatSurface(splat, { scope, anisotropy: Math.min(16, renderer.capabilities.getMaxAnisotropy()), texture: (ref) => { const texture = textures.get(ref); if (texture === undefined) throw new Error('Unresolved admitted splat layer'); return texture; } });
  const surfaces = splat === undefined || splatDrawn === null ? propNamed : withSplatSurface({ name: splat.material, binding: splatDrawn.binding }, propNamed);
  // a further entry (an exported skin's binding, SF16) compiles on the same looks, compiler and admitted textures, scope-owned
  return { materials, textures, compile, outline: graphOutlineHook(graphs.outline), tick: (dt) => { toon.tick(dt); painterly.tick(dt); emissive.tick(dt); graphs.tick(dt); moveCurves(); },
    graphs: { bind: (sources) => { if (sources.state !== undefined) stateOf = sources.state; graphs.bind(sources); moveCurves(); }, readout: graphs.readout }, surfaces };
}
