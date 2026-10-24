import type { Material } from 'three';

// These are the renderer's per-program material facts, not its shared program
// ownership map. Restoring them still leaves WebGLRenderer's ordinary checks
// against current lights, target, geometry, clipping and material version live.
const FIELDS = ['currentProgram', '__version', 'uniforms', 'uniformsList', 'needsLights', 'lightsStateVersion',
  'outputColorSpace', 'batching', 'batchingColor', 'instancing', 'instancingColor', 'instancingMorph', 'skinning',
  'morphTargets', 'morphNormals', 'morphColors', 'morphTargetsCount', 'numClippingPlanes', 'numIntersection',
  'vertexAlphas', 'vertexTangents', 'toneMapping', 'environment', 'fog', 'envMap', 'envMapRotation', 'lightProbeGrid'] as const;
interface Variants { version: number; active: string; entries: Map<string, unknown[]> }

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
    // refilled in place: a warm variant is recorded again at every program selection
    let entry = variants.entries.get(key);
    if (entry === undefined) { entry = Array.from<unknown>({ length: FIELDS.length }); variants.entries.set(key, entry); }
    for (let i = 0; i < FIELDS.length; i++) entry[i] = Reflect.get(properties, FIELDS[i] ?? '');
    variants.active = key;
  }
  /** Restore a warm selection; false forces just one ordinary renderer lookup.
   * A material edit invalidates every entry without changing material.version. */
  select(material: Material, key: string, properties: object): boolean {
    const variants = this.materials.get(material), entry = variants?.version === material.version ? variants.entries.get(key) : undefined;
    if (entry === undefined) return false;
    if (variants?.active !== key || Reflect.get(properties, 'currentProgram') !== entry[0]) {
      // indexed: an entries() iterator made a pair per field on every switching draw (570 MiB in one 23 s Pine drive)
      for (let i = 0; i < FIELDS.length; i++) Reflect.set(properties, FIELDS[i] ?? '', entry[i]);
      if (variants !== undefined) variants.active = key;
    }
    return true;
  }
  forget(material: Material): void { this.materials.delete(material); }
}
