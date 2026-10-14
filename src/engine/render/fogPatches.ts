import type { Fog, FogExp2, Material, Vector3 } from 'three';
import type { Node } from 'three/webgpu';
import type { Scope } from '../app/scope';

/**
 * The fog-patch registry (01 §13.2, 10 §X5). The fog chunks (`fog_pars_*`, `fog_*`) are whole-chunk writes on three's
 * ShaderChunk, so the order they land in is the look. Every writer installs through `installFogPatch` with its slot:
 * the engine's fog 100 (Atmosphere), a level's stylize 200, a level's own fog 300 (`LookStrategy.fog.order`). A patch
 * installs once per page (by id). A new id at or below the last installed slot in its stage throws before changing the registry
 * or shader chunks: otherwise the result would be the call order, not the slot's (E357 L11 / B72).
 */
export const FOG_SLOT = { engine: 100, stylize: 200, level: 300 } as const;

/** Trusted fog replacement receives colours after output transform and positions in its own level frame. */
export interface NodeFogContext {
  readonly engine: Node<'vec4'>;
  readonly fog: Fog | FogExp2;
  readonly position: Node<'vec3'>;
  readonly camera: Node<'vec3'>;
  readonly scale?: Node<'float'>;
}
/** A node equivalent of a classic fog chunk replacement; no shader text is parsed. */
export type NodeFogPatch = (out: Node<'vec4'>, context: NodeFogContext) => Node<'vec4'>;
export interface FogPatchEntry { id: string; order: number; readonly node?: NodeFogPatch }
/** A region's replacement (absent node: retain engine fog) and its borrowed origin. */
export interface MaterialNodeFog { readonly id: string; readonly node?: NodeFogPatch; readonly origin: { readonly value: Vector3 } }
const materialFog = new WeakMap<Material, MaterialNodeFog>();
/** Scope a region's fog to its own materials; imports no TSL runtime and does not alter classic shaders. */
export function bindMaterialNodeFog(material: Material, fog: MaterialNodeFog, scope: Scope): void {
  if (scope.disposed) throw new Error('Node fog needs a live scope');
  const previous = materialFog.get(material);
  materialFog.set(material, fog);
  const changed = (): void => { if (Reflect.get(material, 'isNodeMaterial') === true) material.needsUpdate = true; };
  changed();
  scope.onDispose(() => {
    if (materialFog.get(material) !== fog) return;
    if (previous === undefined) materialFog.delete(material); else materialFog.set(material, previous);
    changed();
  });
}
/** A material's region fog, else undefined for the page fog. */
export function materialNodeFogOf(material: Material): MaterialNodeFog | undefined { return materialFog.get(material); }

/** one page's fog patches: the page has one (installFogPatch); a test builds its own (E422) */
export class FogPatchRegistry {
  private readonly installed: FogPatchEntry[] = [];
  private readonly lastByStage = new Map<string | undefined, FogPatchEntry>();
  /** Run once per id; enforce slot order in the engine stage (omitted) or the supplied level stage. */
  install(id: string, order: number, install: () => void, stage?: string, node?: NodeFogPatch): boolean {
    if (this.installed.some((p) => p.id === id)) return false;
    const last = this.lastByStage.get(stage);
    if (last !== undefined && order <= last.order) throw new Error(`[fog] patch ${id} (slot ${order}) installs after ${last.id} (slot ${last.order})`);
    install();
    const entry: FogPatchEntry = { id, order, ...(node === undefined ? {} : { node }) };
    this.installed.push(entry);
    this.lastByStage.set(stage, entry);
    return true;
  }
  /** the installed fog patches, in install order (the WebGPU port inventory, tests) */
  patches(): readonly FogPatchEntry[] { return this.installed; }
}
const page = new FogPatchRegistry();

/** Run once per id; enforce slot order in the engine stage (omitted) or the supplied level stage. */
export function installFogPatch(id: string, order: number, install: () => void, stage?: string, node?: NodeFogPatch): boolean { return page.install(id, order, install, stage, node); }

/** the page's installed fog patches, in install order (the WebGPU port inventory, tests) */
export function fogPatches(): readonly FogPatchEntry[] { return page.patches(); }
