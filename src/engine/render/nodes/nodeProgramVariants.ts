import type { Material } from 'three';

// These are the renderer's per-program material facts, not its shared program
// ownership map. Restoring them still leaves WebGLRenderer's ordinary checks
// against current lights, target, geometry, clipping and material version live.
const FIELDS = ['currentProgram', '__version', 'uniforms', 'uniformsList', 'needsLights', 'lightsStateVersion',
  'outputColorSpace', 'batching', 'batchingColor', 'instancing', 'instancingColor', 'instancingMorph', 'skinning',
  'morphTargets', 'morphNormals', 'morphColors', 'morphTargetsCount', 'numClippingPlanes', 'numIntersection',
  'vertexAlphas', 'vertexTangents', 'toneMapping', 'environment', 'fog', 'envMap', 'envMapRotation', 'lightProbeGrid'] as const;
type Snapshot = Record<(typeof FIELDS)[number], unknown>;
interface Variants { version: number; active: string; entries: Map<string, Snapshot> }
/** One fixed-shape copy of the fields (a literal, so every snapshot shares one hidden class and Object.assign copies it
 *  on V8's fast path: restoring them by name, one keyed store a field, was the top self frame of the Sim's Pine interior) */
const snapshot = (p: object): Snapshot => ({
  currentProgram: Reflect.get(p, 'currentProgram'),
  __version: Reflect.get(p, '__version'),
  uniforms: Reflect.get(p, 'uniforms'),
  uniformsList: Reflect.get(p, 'uniformsList'),
  needsLights: Reflect.get(p, 'needsLights'),
  lightsStateVersion: Reflect.get(p, 'lightsStateVersion'),
  outputColorSpace: Reflect.get(p, 'outputColorSpace'),
  batching: Reflect.get(p, 'batching'),
  batchingColor: Reflect.get(p, 'batchingColor'),
  instancing: Reflect.get(p, 'instancing'),
  instancingColor: Reflect.get(p, 'instancingColor'),
  instancingMorph: Reflect.get(p, 'instancingMorph'),
  skinning: Reflect.get(p, 'skinning'),
  morphTargets: Reflect.get(p, 'morphTargets'),
  morphNormals: Reflect.get(p, 'morphNormals'),
  morphColors: Reflect.get(p, 'morphColors'),
  morphTargetsCount: Reflect.get(p, 'morphTargetsCount'),
  numClippingPlanes: Reflect.get(p, 'numClippingPlanes'),
  numIntersection: Reflect.get(p, 'numIntersection'),
  vertexAlphas: Reflect.get(p, 'vertexAlphas'),
  vertexTangents: Reflect.get(p, 'vertexTangents'),
  toneMapping: Reflect.get(p, 'toneMapping'),
  environment: Reflect.get(p, 'environment'),
  fog: Reflect.get(p, 'fog'),
  envMap: Reflect.get(p, 'envMap'),
  envMapRotation: Reflect.get(p, 'envMapRotation'),
  lightProbeGrid: Reflect.get(p, 'lightProbeGrid'),
});

/** Warm object-layout variants of one node material, with the renderer retaining
 * program ownership and invalidation. No material clones or object IDs are keys. */
export class NodeProgramVariants {
  private readonly materials = new WeakMap<Material, Variants>();
  /** Called only after WebGLRenderer selected a program for this exact key. */
  record(material: Material, key: string, properties: object): void {
    if (Reflect.get(properties, '__version') !== material.version) return;
    let variants = this.materials.get(material);
    if (variants === undefined || variants.version !== material.version) {
      variants = { version: material.version, active: key, entries: new Map() }; this.materials.set(material, variants);
    }
    variants.entries.set(key, snapshot(properties)); variants.active = key;
  }
  /** Restore a warm selection; false forces just one ordinary renderer lookup.
   * A material edit invalidates every entry without changing material.version. */
  select(material: Material, key: string, properties: object): boolean {
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
