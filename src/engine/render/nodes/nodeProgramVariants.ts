import type { Material } from 'three';

// These are the renderer's per-program material facts, not its shared program
// ownership map. Restoring them still leaves WebGLRenderer's ordinary checks
// against current lights, target, geometry, clipping and material version live.
const FIELDS = ['currentProgram', '__version', 'uniforms', 'uniformsList', 'needsLights', 'lightsStateVersion',
  'outputColorSpace', 'batching', 'batchingColor', 'instancing', 'instancingColor', 'instancingMorph', 'skinning',
  'morphTargets', 'morphNormals', 'morphColors', 'morphTargetsCount', 'numClippingPlanes', 'numIntersection',
  'vertexAlphas', 'vertexTangents', 'toneMapping', 'environment', 'fog', 'envMap', 'envMapRotation', 'lightProbeGrid'] as const;
type Snapshot = Record<(typeof FIELDS)[number], unknown>;
/** a variant's key: the handler's token for one whole program key (a pointer lookup; a node program key can run to
 *  hundreds of KB, and a Map lookup by such a string hashed and compared it whole: the top render frame of a steady Nalati
 *  Simulator profile, 241 of 5229 samples on one `entries.get`), or the key itself */
export type VariantKey = object | string;
interface Variants { version: number; active: VariantKey; entries: Map<VariantKey, Snapshot> }
/** One fixed-shape copy of the fields (a literal, so every snapshot shares one hidden class and Object.assign copies it
 *  on V8's fast path: restoring them by name, one keyed store a field, was the top self frame of the Sim's Pine interior) */
const snapshot = (p: Readonly<Partial<Snapshot>>): Snapshot => ({
  currentProgram: p.currentProgram,
  __version: p.__version,
  uniforms: p.uniforms,
  uniformsList: p.uniformsList,
  needsLights: p.needsLights,
  lightsStateVersion: p.lightsStateVersion,
  outputColorSpace: p.outputColorSpace,
  batching: p.batching,
  batchingColor: p.batchingColor,
  instancing: p.instancing,
  instancingColor: p.instancingColor,
  instancingMorph: p.instancingMorph,
  skinning: p.skinning,
  morphTargets: p.morphTargets,
  morphNormals: p.morphNormals,
  morphColors: p.morphColors,
  morphTargetsCount: p.morphTargetsCount,
  numClippingPlanes: p.numClippingPlanes,
  numIntersection: p.numIntersection,
  vertexAlphas: p.vertexAlphas,
  vertexTangents: p.vertexTangents,
  toneMapping: p.toneMapping,
  environment: p.environment,
  fog: p.fog,
  envMap: p.envMap,
  envMapRotation: p.envMapRotation,
  lightProbeGrid: p.lightProbeGrid,
});

/** Warm object-layout variants of one node material, with the renderer retaining
 * program ownership and invalidation. No material clones or object IDs are keys. */
export class NodeProgramVariants {
  private readonly materials = new WeakMap<Material, Variants>();
  /** Called only after WebGLRenderer selected a program for this exact key. */
  record(material: Material, key: VariantKey, properties: object): void {
    const current: Readonly<Partial<Snapshot>> = properties;
    if (current.__version !== material.version) return;
    let variants = this.materials.get(material);
    if (variants === undefined || variants.version !== material.version) {
      variants = { version: material.version, active: key, entries: new Map() }; this.materials.set(material, variants);
    }
    variants.entries.set(key, snapshot(properties)); variants.active = key;
  }
  /** Restore a warm selection; false forces just one ordinary renderer lookup.
   * A material edit invalidates every entry without changing material.version. */
  select(material: Material, key: VariantKey, properties: object): boolean {
    const variants = this.materials.get(material), entry = variants?.version === material.version ? variants.entries.get(key) : undefined;
    if (entry === undefined) return false;
    if (variants?.active !== key || Reflect.get(properties, 'currentProgram') !== entry.currentProgram) {
      Object.assign(properties, entry);
      if (variants !== undefined) variants.active = key;
    }
    return true;
  }
  forget(material: Material): void { this.materials.delete(material); }
}
