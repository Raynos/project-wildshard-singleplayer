/**
 * A layered backdrop's level frame for node materials (SHARD-PLATFORM G321, the graph path of `BackdropLayer.dress`).
 *
 * A classic dressing program is read in its level's frame by GLSL defines (`levelFrameSource`: the view and the camera
 * shifted by the region's origin, the output faded by the owner weight). A node material (an SF59 graph) declares its
 * camera in a uniform block and writes no `gl_FragColor`, so the defines cannot reach it. Here the same frame arrives as
 * material inputs instead: `frameNodeMaterial(material, frame)` files the layer's three uniforms against the material,
 * and the loaded node back-end (installed by `nodes/engineNodesHandler.ts`, never imported here) reads them while it
 * builds that material's program:
 *
 * - its model-view becomes `view × model` (the level frame's view: the page's view times the origin's translation);
 * - the graph compiler's camera reads (`cameraPosition`, the camera-relative billboards, `viewDepth`, `screenDirection`)
 *   take the camera less the origin and the frame's view (`layerFrameOf`);
 * - the output after the engine epilogue is faded by the weight: its alpha, or (`whole`, a piece that blends `One` of its
 *   source) its whole colour, exactly where a classic piece's `gl_FragColor` is faded.
 *
 * The uniforms are read by reference each draw, so moving the layer's matrix, origin or weight never rebuilds a program.
 * Importing this module loads no TSL and installs nothing.
 */
import type { Material, Matrix4, Vector3 } from 'three';

/** The level frame a layer draws its node dressing in: live uniforms it moves each frame, and how its output fades. */
export interface NodeLayerFrame {
  /** the view in the level's frame (the page camera's view times the origin's translation) */
  readonly view: { readonly value: Matrix4 };
  /** the level frame's origin on the page */
  readonly origin: { readonly value: Vector3 };
  /** the owner weight (0..1) the output is faded by */
  readonly fade: { readonly value: number };
  /** fade the whole colour (a piece that blends `One` of its source), not only its alpha */
  readonly whole: boolean;
}

/** What the loaded node back-end does with a framed material (sets its model-view context); false: not a node material. */
export type NodeLayerFrameInstaller = (material: Material, frame: NodeLayerFrame) => boolean;

let installer: NodeLayerFrameInstaller | null = null;
const frames = new WeakMap<Material, NodeLayerFrame>();

/** The node back-end supplies its frame installer when it loads (`EngineNodesHandler`). */
export function installNodeLayerFrame(install: NodeLayerFrameInstaller): void { installer = install; }

/**
 * Draw `material` (a node material) in a layer's level frame: true when it is one and is now framed (rebuilt at its next
 * draw), false for a classic material (or with no node back-end loaded, when no node material can exist), which keeps the
 * GLSL path. The material keeps the frame for its life.
 */
export function frameNodeMaterial(material: Material, frame: NodeLayerFrame): boolean {
  if (installer === null || Reflect.get(material, 'isNodeMaterial') !== true) return false;
  frames.set(material, frame);
  if (!installer(material, frame)) { frames.delete(material); return false; }
  material.needsUpdate = true;
  return true;
}

/** The level frame a node material draws in (null: the page's own frame). */
export function layerFrameOf(material: Material | null | undefined): NodeLayerFrame | null {
  return material === null || material === undefined ? null : frames.get(material) ?? null;
}
