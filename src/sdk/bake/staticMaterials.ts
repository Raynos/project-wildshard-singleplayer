import { type Material, MeshLambertMaterial, MeshStandardMaterial, NormalBlending, SRGBColorSpace, TangentSpaceNormalMap, RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping, NearestFilter, LinearFilter, NearestMipmapNearestFilter, NearestMipmapLinearFilter, LinearMipmapNearestFilter, LinearMipmapLinearFilter, type Texture, type BufferGeometry } from 'three';
import type { Shardfile } from '../shardfile';
import { parseKtx2 } from '../assets';
import { hashImmutableBytes } from '../immutable';
import type { WorldMaterial, WorldTexture } from './world';
import type { GlbPrimitive } from './glb';

/** Actual static surface factors copied while the authored material is alive. The owner selects the named look recipe. */
export interface CapturedStaticMaterial extends WorldMaterial { vertexColours: boolean; faceted: boolean }
/** Original full bitmap/atlas identity and extent, captured by its real producer. */
export interface StaticImageSource { id: string; width: number; height: number }
/** Name a real source bitmap/atlas before its producer retires. This port never reads dummy bake-canvas pixels. */
export type StaticTextureIdentity = (texture: Texture, slot: keyof WorldMaterial['maps']) => StaticImageSource;
const slots = ['colour', 'normal', 'metallicRoughness', 'occlusion', 'emissive'] as const;
type Slot = typeof slots[number];
type Bindings = NonNullable<Shardfile['props']>['materials'];
type BoundMaterial = NonNullable<Bindings>[string];
const nameOk = (name: string): boolean => name.length > 0 && name.length <= 128 && name.trim() === name && !/\p{Cc}/u.test(name) && !['__proto__', 'prototype', 'constructor'].includes(name);
const colourSlot = (slot: Slot): boolean => slot === 'colour' || slot === 'emissive';
function wrap(value: number): NonNullable<BoundMaterial['colour']>['wrapS'] {
  if (value === 33071 || value === 33648 || value === 10497) return value;
  throw new Error('Unsupported static texture wrap');
}
function minFilter(value: number | null): NonNullable<BoundMaterial['colour']>['minFilter'] {
  if (value === null || value === 9728 || value === 9729 || value === 9984 || value === 9985 || value === 9986 || value === 9987) return value;
  throw new Error('Unsupported static texture minification');
}
function magFilter(value: number | null): NonNullable<BoundMaterial['colour']>['magFilter'] {
  if (value === null || value === 9728 || value === 9729) return value;
  throw new Error('Unsupported static texture magnification');
}
function gltfSampler(value: number): number {
  const enums = new Map<number, number>([[RepeatWrapping, 10497], [ClampToEdgeWrapping, 33071], [MirroredRepeatWrapping, 33648],
    [NearestFilter, 9728], [LinearFilter, 9729], [NearestMipmapNearestFilter, 9984], [LinearMipmapNearestFilter, 9985], [NearestMipmapLinearFilter, 9986], [LinearMipmapLinearFilter, 9987]]);
  const converted = enums.get(value); if (converted === undefined) throw new Error('Unsupported authored Three sampler'); return converted;
}
function checkSource(row: WorldMaterial): void {
  if (!nameOk(row.name) || !/^[a-z][a-z0-9.-]{0,127}$/u.test(row.id) || row.colour.length !== 4 || row.emissive.length !== 3
    || ![...row.colour, ...row.emissive, row.roughness, row.metalness, row.alphaCutoff, row.occlusion].every(value => Number.isFinite(value) && value >= 0 && value <= 1)
    || !Number.isFinite(row.normalScale) || row.normalScale < 0 || row.normalScale > 4 || !['OPAQUE', 'MASK', 'BLEND'].includes(row.alpha)) throw new Error('Static material factors require an explicit bounded adapter');
}

/** Snapshot Lambert/PBR source factors and all supported slots without inferring a family from a Three class.
 * Stable name and look ID are explicit, including for unnamed generated meshes. Shader recipes remain shard-owned data.
 * UV transforms, independent alpha maps and unsupported lighting maps refuse; nothing is silently flattened. */
export function captureStaticMaterial(source: Material, assignment: { name: string; id: string }, image: StaticTextureIdentity): CapturedStaticMaterial {
  if (Reflect.get(source, 'isMeshPhysicalMaterial') === true) throw new Error('Physical extension layers require an explicit static adapter');
  if (!(source instanceof MeshLambertMaterial || source instanceof MeshStandardMaterial)) throw new Error('Static capture requires an explicit Lambert/PBR surface adapter');
  if (!nameOk(assignment.name) || !/^[a-z][a-z0-9.-]{0,127}$/u.test(assignment.id)) throw new Error('Static material requires a stable name and explicit look ID');
  if (source.side === 1 || source.blending !== NormalBlending || !source.depthWrite || !source.depthTest || source.polygonOffset || !source.colorWrite || source.wireframe || source.stencilWrite || source.premultipliedAlpha || source.alphaHash || !source.fog) throw new Error('Unsupported static material render state');
  for (const key of ['alphaMap', 'bumpMap', 'lightMap', 'displacementMap', 'specularMap', 'envMap']) {
    const value: unknown = Reflect.get(source, key); if (value !== null && value !== undefined) throw new Error(`Static material ${assignment.name}: unsupported ${key}`);
  }
  if (source.transparent && source.alphaTest > 0) throw new Error('Combined blend/mask requires an explicit static adapter');
  const standard = source instanceof MeshStandardMaterial ? source : null;
  if (source.normalMap !== null && source.normalMapType !== TangentSpaceNormalMap) throw new Error('Static normal maps require tangent-space vectors');
  if (standard !== null && (standard.roughnessMap !== standard.metalnessMap)) throw new Error('Static material requires one combined metallic-roughness map and scalar normal scale');
  if (source.normalScale.x !== source.normalScale.y) throw new Error('Static material requires scalar normal scale');
  const use = (texture: Texture | null, slot: Slot): WorldTexture | null => {
    if (texture === null) return null;
    if (texture.channel !== 0 || texture.offset.x !== 0 || texture.offset.y !== 0 || texture.repeat.x !== 1 || texture.repeat.y !== 1 || texture.rotation !== 0 || texture.center.x !== 0 || texture.center.y !== 0) throw new Error('Static material texture requires original UV0 with identity transform');
    if (texture.premultiplyAlpha || !texture.matrixAutoUpdate) throw new Error('Static texture requires an explicit premultiply/matrix adapter');
    if (!colourSlot(slot) && texture.colorSpace === SRGBColorSpace) throw new Error('Static data texture must use linear transfer');
    if (colourSlot(slot) && texture.colorSpace !== SRGBColorSpace) throw new Error('Static colour atlas needs an explicit sRGB source adapter');
    const original = image(texture, slot);
    if (original.id.length === 0 || original.id.length > 2048 || ![original.width, original.height].every(value => Number.isInteger(value) && value >= 1 && value <= 4096)) throw new Error('Missing bounded original static texture/atlas identity');
    return { image: original.id, width: original.width, height: original.height, wrapS: wrap(gltfSampler(texture.wrapS)), wrapT: wrap(gltfSampler(texture.wrapT)), minFilter: minFilter(gltfSampler(texture.minFilter)), magFilter: magFilter(gltfSampler(texture.magFilter)), flipY: texture.flipY, anisotropy: texture.anisotropy };
  };
  const row: CapturedStaticMaterial = {
    ...assignment, colour: [...source.color, source.opacity], metalness: standard?.metalness ?? 0, roughness: standard?.roughness ?? 1,
    emissive: source.emissive.toArray().map(value => value * source.emissiveIntensity), alpha: source.transparent ? 'BLEND' : source.alphaTest > 0 ? 'MASK' : 'OPAQUE',
    alphaCutoff: source.alphaTest, doubleSided: source.side === 2, normalScale: source.normalScale.x, occlusion: source.aoMapIntensity,
    vertexColours: source.vertexColors, faceted: source.flatShading,
    maps: { colour: use(source.map, 'colour'), normal: use(source.normalMap, 'normal'), metallicRoughness: use(standard?.roughnessMap ?? null, 'metallicRoughness'), occlusion: use(source.aoMap, 'occlusion'), emissive: use(source.emissiveMap, 'emissive') },
  };
  checkSource(row);
  return row;
}

/** Return complete mipmapped KTX2 pixels for this exact original image, orientation and colour/data role.
 * Canvas atlases must be captured with the real producer/font/rasteriser. Atlas UV rectangles are never repacked. */
export type StaticTextureResolver = (source: Readonly<WorldTexture>, role: 'srgb' | 'linear') => Uint8Array;

/** Named multi-material transport for both native-world and normalized-GLB bakes.
 * Every source slot is explicit. Geometry is borrowed; generated wire materials and faceted copies are owned until dispose(). */
export class StaticMaterialCatalogue {
  private readonly rows = new Map<string, { source: WorldMaterial & { vertexColours?: boolean; faceted?: boolean }; binding: BoundMaterial; material: MeshStandardMaterial; dependencies: string[] }>();
  private readonly textures = new Map<string, Uint8Array>();
  private readonly samplers = new Map<string, string>();
  private readonly geometry = new Set<BufferGeometry>();
  private disposed = false;

  constructor(sources: readonly (WorldMaterial & { vertexColours?: boolean; faceted?: boolean })[], look: Shardfile['look']['materials'], resolve: StaticTextureResolver) {
    if (sources.length === 0 || sources.length > 256) throw new Error('Static material catalogue requires 1–256 source slots');
    try { for (const source of sources) {
      checkSource(source);
      const entry = Object.hasOwn(look, source.id) ? look[source.id] : undefined;
      if (!nameOk(source.name) || this.rows.has(source.name) || entry === undefined) throw new Error(`Static material ${source.name || '(unnamed)'} is duplicated or has no explicit look entry`);
      if (entry.family === 'graph') throw new Error('Static graph transport needs an explicit factor-binding adapter');
      const cutoff = source.alpha === 'MASK' ? source.alphaCutoff : 0;
      if (('alphaCutoff' in entry ? entry.alphaCutoff : 0) !== cutoff) throw new Error(`Static material ${source.name}: catalogue alpha cutoff differs from source`);
      const binding: BoundMaterial = { id: source.id, colour: null, normal: null, metallicRoughness: null, occlusion: null, emissive: null }, dependencies: string[] = [];
      for (const slot of slots) {
        const map = source.maps[slot]; if (map === null) continue;
        if ((entry.family === 'painterly' && slot === 'metallicRoughness') || (entry.family === 'emissive' && slot !== 'colour')) throw new Error(`Static material ${source.name}: family cannot draw ${slot}`);
        if (![33071, 33648, 10497].includes(map.wrapS) || ![33071, 33648, 10497].includes(map.wrapT)
          || (map.minFilter !== null && ![9728, 9729, 9984, 9985, 9986, 9987].includes(map.minFilter)) || (map.magFilter !== null && ![9728, 9729].includes(map.magFilter))
          || !Number.isInteger(map.anisotropy ?? 1) || (map.anisotropy ?? 1) < 1 || (map.anisotropy ?? 1) > 16) throw new Error('Unsupported static texture sampler');
        const bytes = resolve(structuredClone(map), colourSlot(slot) ? 'srgb' : 'linear'); parseKtx2(bytes);
        const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dfd = header.getUint32(48, true);
        if (bytes[dfd + 14] !== (colourSlot(slot) ? 2 : 1)) throw new Error('Static texture transfer differs from its source slot role');
        if ((map.width !== undefined && header.getUint32(20, true) !== map.width) || (map.height !== undefined && header.getUint32(24, true) !== map.height)) throw new Error('Static atlas extent changed; cropping/repacking requires an explicit UV adapter');
        const file = hashImmutableBytes(bytes), sampler = { file, wrapS: wrap(map.wrapS), wrapT: wrap(map.wrapT), minFilter: minFilter(map.minFilter), magFilter: magFilter(map.magFilter), anisotropy: map.anisotropy ?? 1 };
        const identity = JSON.stringify({ ...sampler, role: colourSlot(slot) ? 'srgb' : 'linear' }), previous = this.samplers.get(file);
        if (previous !== undefined && previous !== identity) throw new Error('Static texture bytes cannot mix samplers or colour/data roles');
        this.samplers.set(file, identity); this.textures.set(file, Uint8Array.from(bytes)); dependencies.push(file);
        if (slot === 'normal') binding.normal = { ...sampler, scale: source.normalScale };
        else if (slot === 'occlusion') binding.occlusion = { ...sampler, strength: source.occlusion };
        else binding[slot] = sampler;
      }
      const material = new MeshStandardMaterial(); material.name = source.name;
      material.color.fromArray(source.colour); material.opacity = source.colour[3] ?? 1;
      material.roughness = source.roughness; material.metalness = source.metalness; material.emissive.fromArray(source.emissive);
      material.side = source.doubleSided ? 2 : 0; material.transparent = source.alpha === 'BLEND'; material.alphaTest = cutoff;
      this.rows.set(source.name, { source: structuredClone(source), binding, material, dependencies: [...new Set(dependencies)].sort() });
    } } catch (error) { this.dispose(); throw error; }
  }

  /** Assign one source material slot to one primitive; multi-material meshes split by their actual geometry groups first. */
  primitive(name: string, geometry: BufferGeometry, options: Omit<GlbPrimitive, 'geometry' | 'material'> = {}): GlbPrimitive {
    if (this.disposed) throw new Error('Static material catalogue disposed');
    const row = this.rows.get(name); if (row === undefined) throw new Error(`Unmapped static primitive material ${name}`);
    if (!geometry.hasAttribute('position') || geometry.drawRange.start !== 0 || geometry.drawRange.count < (geometry.index?.count ?? geometry.getAttribute('position').count)) throw new Error('Static primitive requires its complete authored triangle range');
    if (Object.values(row.source.maps).some(value => value !== null) && !geometry.hasAttribute('uv')) throw new Error(`Static atlas primitive ${name} needs its original UV0`);
    if (row.source.vertexColours === false && geometry.hasAttribute('color')) throw new Error('Disabled source vertex colour needs an explicit geometry adapter');
    let actual = geometry;
    if (row.source.faceted === true) { actual = geometry.index === null ? geometry.clone() : geometry.toNonIndexed(); actual.computeVertexNormals(); this.geometry.add(actual); }
    return { ...options, geometry: actual, material: row.material };
  }

  /** Assign an actual mesh material array through its indexed triangle groups. Single-material meshes use all faces.
   * Split groups preserve every original attribute and instance matrix; gaps, overlaps and unknown slots refuse. */
  primitives(geometry: BufferGeometry, names: readonly string[], options: Omit<GlbPrimitive, 'geometry' | 'material'> = {}): GlbPrimitive[] {
    if (names.length === 1) { const name = names[0]; if (name === undefined) throw new Error('Missing static slot'); return [this.primitive(name, geometry, options)]; }
    const position = geometry.getAttribute('position'), index = geometry.index;
    const count = index?.count ?? position.count;
    if (names.length === 0 || names.length > 256 || count % 3 !== 0 || geometry.groups.length === 0 || geometry.drawRange.start !== 0 || geometry.drawRange.count < count) throw new Error('Static multi-material mesh needs complete triangle groups');
    const groups = [...geometry.groups].sort((a, b) => a.start - b.start), assigned = new Map<string, number[]>(); let end = 0;
    for (const group of groups) {
      const slot = group.materialIndex ?? 0, name = names[slot];
      if (!Number.isInteger(slot) || slot < 0 || name === undefined || !Number.isInteger(group.start) || !Number.isInteger(group.count) || group.start !== end || group.count < 1 || group.count % 3 !== 0 || group.start + group.count > count) throw new Error('Static material groups have missing, overlapping or unknown triangles');
      const triangles = assigned.get(name) ?? [];
      for (let i = group.start; i < group.start + group.count; i++) triangles.push(index?.getX(i) ?? i);
      assigned.set(name, triangles); end += group.count;
    }
    if (end !== count) throw new Error('Static material groups omit triangles');
    return [...assigned].map(([name, indices]) => {
      const part = geometry.clone(); part.clearGroups(); part.setIndex(indices); this.geometry.add(part);
      return this.primitive(name, part, options);
    });
  }

  /** Distinct exact slot dependencies for this GLB only. Include ground and props material names before final row packing. */
  dependencies(names: readonly string[]): string[] {
    if (this.disposed) throw new Error('Static material catalogue disposed');
    return [...new Set(names.flatMap(name => { const row = this.rows.get(name); if (row === undefined) throw new Error(`Unmapped static primitive material ${name}`); return row.dependencies; }))].sort();
  }
  /** Independent named format bindings and immutable texture bytes; pack textures before their GLB users. */
  snapshot(): { materials: NonNullable<Bindings>; textures: Map<string, Uint8Array> } {
    if (this.disposed) throw new Error('Static material catalogue disposed');
    return { materials: Object.fromEntries([...this.rows].map(([name, row]) => [name, structuredClone(row.binding)])), textures: new Map([...this.textures].map(([hash, bytes]) => [hash, Uint8Array.from(bytes)])) };
  }
  /** Dispose transport-only resources, never borrowed source geometry or source materials. */
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const row of this.rows.values()) row.material.dispose(); for (const geometry of this.geometry) geometry.dispose(); }
}

/** Read exact emitted names from a byte-admitted GLB, including an empty name so named packing refuses it. */
export function staticMaterialNames(bytes: Uint8Array): string[] {
  if (bytes.length < 28) throw new Error('Truncated static GLB');
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), size = header.getUint32(12, true);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(16, true) !== 0x4e4f534a || size > 2_000_000 || 28 + size > bytes.length) throw new Error('Invalid static GLB JSON');
  const document: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + size)));
  if (typeof document !== 'object' || document === null || !('materials' in document) || !Array.isArray(document.materials)) throw new Error('Static GLB needs material slots');
  return document.materials.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('name' in row) || typeof row.name !== 'string') return '';
    return row.name;
  });
}

/** Each named GLB directly depends on every texture its own material slots use, rather than another tile's union. */
export function checkStaticMaterialDependencies(bytes: Uint8Array, materials: NonNullable<Bindings>, dependencies: readonly string[]): void {
  for (const name of staticMaterialNames(bytes)) {
    const row = Object.hasOwn(materials, name) ? materials[name] : undefined;
    if (row === undefined) throw new Error(`Unmapped static GLB material ${name || '(unnamed)'}`);
    for (const slot of slots) {
      const texture = row[slot]; if (texture !== null && !dependencies.includes(texture.file)) throw new Error(`Static GLB material ${name}: missing its own ${slot} dependency`);
    }
  }
}
