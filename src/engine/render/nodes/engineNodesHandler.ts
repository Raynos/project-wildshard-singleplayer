/**
 * The engine's TSL back-end (SHARD-PLATFORM SF59 step 2, fix 1; `docs/design/mmo/research/sf59-tsl-spike.md` §2, §5).
 *
 * The SF59 spike's verdict is that a graph material compiles to a three TSL node material, run through three's
 * `WebGLNodesHandler` inside today's `WebGLRenderer` (this supersedes decision 22's "no TSL" for this path; still no
 * WebGPURenderer). The stock handler does not fit the engine's frame as it comes; `EngineNodesHandler` is the engine's
 * subclass:
 *
 * 1. **The output transform follows the bound render target** the way classic materials do (WebGLPrograms.js): tone
 *    mapping only on screen (and only for a `toneMapped` material), the renderer's `outputColorSpace` on screen, the
 *    working (linear) space inside a target. The stock handler always applies the renderer's tone mapping and sRGB
 *    output, so a node material drawn into the engine's half-float target was sRGB-encoded twice (the spike's `tsl-raw`:
 *    24.8 dB against the family). The program cache key follows the same rule, so one material drawn both into a
 *    target and to the screen keeps one program for each.
 * 2. **Render-target samples are upright.** three's GLSL node builder flips every render-target sample for
 *    WebGPURenderer's WebGL backend, which stores targets upside down; the classic renderer stores them upright. A graph
 *    reads a target only through `targetTexture()`, which cancels the flip (§2.10). three's own shadow lookups keep theirs:
 *    the shadow node pre-flips its coordinate to match.
 * 3. **The engine epilogue** (§2.2) runs after the output transform, where classic three applies fog (`fog_fragment`
 *    follows `colorspace_fragment`): `epilogue` is an ordered list of stages a graph cannot skip. The handler's own
 *    first stage is the engine's height fog (`engineFog.ts`) wherever the engine fog is installed; three's stock fog node
 *    is then switched off, so a node material is fogged once. A level's own fog chunk (fogPatches' slots 200 / 300)
 *    does not reach node materials yet: the handler warns once.
 * 4. **The engine's shadow filter** (`shadowFilter.ts`, E138): where the tent is installed, every shadow-casting light
 *    without a filter of its own gets the tent as its node filter (`tentShadowFilter.ts`), so node and family
 *    materials share one penumbra.
 *
 * 5. **The sun's cascades and the shadow fade** (`cascadeLightNode.ts`): a DirectionalLight the sky rig registered as
 *    a cascade is gated to its depth slice as the CSM chunk gates it, with the fade's ghost shadow mixed in.
 *
 * Load it lazily (`render/graphBackend.ts`): it pulls in `three/webgpu` + `three/tsl` (≈ +117 KB gzip), which a shard
 * without a graph material never pays for. Nothing on the default render path imports this module.
 */
import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/examples/jsm/tsl/WebGLNodesHandler.js';
import { TextureNode, type Node, type NodeBuilder } from 'three/webgpu';
import { nodeObject, workingToColorSpace } from 'three/tsl';
import { fogPatches } from '../fogPatches';
import { tentShadowFilterOn } from '../../world/shadowFilter';
import { engineFog } from './engineFog';
import { tentShadowFilter } from './tentShadowFilter';
import { EngineDirectionalLightNode } from './cascadeLightNode';
import { isCascadeGhost } from '../../world/cascadeLights';
import { diagnosticNow } from '../../core/clock';
import type { Renderer } from '../renderer';

/** what an epilogue stage is handed: the builder, its material, the scene's fog and the renderer */
export interface EpilogueContext {
  readonly builder: NodeBuilder;
  readonly material: THREE.Material;
  /** the scene's fog (null: the scene is unfogged, classic three's USE_FOG off) */
  readonly fog: THREE.Fog | THREE.FogExp2 | null;
  readonly renderer: Renderer;
}
/** one stage of the engine epilogue: the output colour after the output transform → the colour it leaves */
export type EpilogueStage = (out: Node<'vec4'>, ctx: EpilogueContext) => Node<'vec4'>;

/** the output transform for the bound target, as classic three decides it (WebGLPrograms.js getParameters) */
export function outputTransform(renderer: Renderer): { toneMapping: THREE.ToneMapping; colorSpace: string } {
  const target = renderer.getRenderTarget();
  const xr = target !== null && Reflect.get(target, 'isXRRenderTarget') === true;
  return {
    toneMapping: target === null || xr ? renderer.toneMapping : THREE.NoToneMapping,
    colorSpace: target === null ? renderer.outputColorSpace : xr ? target.texture.colorSpace : THREE.ColorManagement.workingColorSpace,
  };
}

/** a texture node that samples a classic render target upright (no WebGPU-backend flip, §2.10) */
class TargetTextureNode extends TextureNode {
  /** TextureNode.setupUV flips render-target samples under the GLSL builder; the classic renderer stores targets upright */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node { return uvNode; }
}

/**
 * Sample a render target's texture (its colour or depth) in a graph, upright: the classic renderer's targets are stored
 * the right way up, where three's GLSL node builder assumes WebGPURenderer's flipped storage. A graph never names a
 * target texture through three's `texture()`.
 */
export function targetTexture(map: THREE.Texture, uvNode?: Node<'vec2'>): Node<'vec4'> {
  return nodeObject(new TargetTextureNode(map, uvNode ?? null));
}

/** a colour-space node is a vec4 node (its d.ts types it without the vec4 extensions) */
function asVec4(node: object): Node<'vec4'> {
  if (!isNode(node)) throw new Error('EngineNodesHandler: the output transform is not a node');
  return node;
}
/** the fog of the scene a node builder builds for (the stock handler sets the scene on every builder) */
function fogOf(builder: NodeBuilder): THREE.Fog | THREE.FogExp2 | null {
  const scene: unknown = Reflect.get(builder, 'scene');
  if (typeof scene !== 'object' || scene === null) return null;
  const fog: unknown = Reflect.get(scene, 'fog');
  return fog instanceof THREE.Fog || fog instanceof THREE.FogExp2 ? fog : null;
}
function isNode(value: object): value is Node<'vec4'> { return Reflect.get(value, 'isNode') === true; }

/** the parts of three's (untyped) stock handler the engine handler reaches */
interface StockInternals {
  getOutputCallback: (outputNode: Node<'vec4'>, builder: NodeBuilder) => Node<'vec4'>;
  customProgramCacheKeyCallback: (this: THREE.Material) => string;
  renderStack: { sceneContext: { fogNode: Node | null; scene: THREE.Object3D } }[];
}
const internals = (h: WebGLNodesHandler): StockInternals => h as WebGLNodesHandler & StockInternals;

const PROGRAM_KEY = 'engine-nodes';

/** three's node handler fitted to the engine's frame (the module comment lists what it changes); install it with `loadGraphBackend` */
export class EngineNodesHandler extends WebGLNodesHandler {
  /** the engine epilogue, in order, after the output transform (fog first; then whatever the engine appends) */
  readonly epilogue: EpilogueStage[] = [];
  /** node-material programs this handler built (the validator's and the bench's count) */
  builds = 0;
  /** ms spent in the node builder (JS), summed */
  buildMs = 0;
  private real: Renderer | null = null;
  private warnedLevelFog = false;

  constructor() {
    super();
    const self = internals(this);
    self.getOutputCallback = (outputNode, builder) => {
      const renderer = this.classicRenderer();
      const { toneMapping, colorSpace } = outputTransform(renderer);
      const material = builder.material;
      let mapped: Node = outputNode;
      if (material.toneMapped && toneMapping !== THREE.NoToneMapping) mapped = outputNode.toneMapping(toneMapping);
      let out = asVec4(workingToColorSpace(mapped, colorSpace));
      const ctx: EpilogueContext = { builder, material, fog: fogOf(builder), renderer };
      for (const stage of this.epilogue) out = stage(out, ctx);
      return out;
    };
    // the program follows the bound target and the material's tone-mapping flag, as classic programs do
    const stockKey = self.customProgramCacheKeyCallback;
    self.customProgramCacheKeyCallback = function customProgramCacheKeyCallback(this: THREE.Material): string {
      return `${stockKey.call(this)}|${PROGRAM_KEY}|${this.toneMapped ? 'tm' : 'raw'}`;
    };
    this.epilogue.push((out, ctx) => (this.engineFogOn() && Reflect.get(ctx.material, 'fog') === true ? engineFog(out, ctx.fog) : out));
  }

  /** the classic renderer this handler serves (after `renderer.setNodesHandler(handler)`) */
  classicRenderer(): Renderer {
    if (this.real === null) throw new Error('EngineNodesHandler: renderer.setNodesHandler(handler) first');
    return this.real;
  }

  /** bind to the renderer (`renderer.setNodesHandler` calls it); the program key follows the bound target from here */
  override setRenderer(renderer: Renderer): void {
    super.setRenderer(renderer);
    this.real = renderer;
    // the stock key reads the renderer's tone mapping and output space whatever is bound; the engine's follows the target
    const proxy: unknown = Reflect.get(this, 'renderer');
    if (typeof proxy === 'object' && proxy !== null) {
      // every DirectionalLight lights node materials through the engine's node: a registered cascade gets the CSM gate
      // (cascadeLightNode.ts). The handler owns its node library, so nothing else sees the swap.
      const library: unknown = Reflect.get(proxy, 'library');
      const lightNodes: unknown = typeof library === 'object' && library !== null ? Reflect.get(library, 'lightNodes') : null;
      if (lightNodes instanceof WeakMap) lightNodes.set(THREE.DirectionalLight, EngineDirectionalLightNode);
      Reflect.set(proxy, 'getCacheKey', () => {
        const { toneMapping, colorSpace } = outputTransform(renderer);
        return `${String(toneMapping)}:${colorSpace}`;
      });
    }
  }

  /** the engine fog is the page's fog (Atmosphere installed slot 100); a level's own fog chunk is not ported yet */
  private engineFogOn(): boolean {
    const patches = fogPatches();
    const engine = patches.some((p) => p.id === 'engine.fog');
    if (engine && patches.length > 1 && !this.warnedLevelFog) {
      this.warnedLevelFog = true;
      console.warn(`[nodes] a level fog patch (${patches.filter((p) => p.id !== 'engine.fog').map((p) => p.id).join(', ')}) does not reach graph materials: they get the engine fog only`);
    }
    return engine;
  }

  /** a render begins: three's stock fog node is dropped wherever the engine epilogue fogs */
  override renderStart(scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Object3D): void {
    super.renderStart(scene, camera, targetScene);
    // the engine epilogue fogs node materials; three's stock fog node would fog them a second time
    if (this.engineFogOn()) {
      const top = internals(this).renderStack.at(-1);
      if (top !== undefined) top.sceneContext.fogNode = null;
    }
  }

  /** the frame's lights: every shadow caster without a node filter of its own gets the engine tent; the fade's ghosts are left out */
  override updateLights(lights: THREE.Light[]): void {
    if (tentShadowFilterOn()) {
      for (const light of lights) {
        const shadow: unknown = Reflect.get(light, 'shadow');
        if (!(shadow instanceof THREE.LightShadow) || !light.castShadow) continue;
        if (Reflect.get(shadow, 'filterNode') === undefined) Reflect.set(shadow, 'filterNode', tentShadowFilter);
      }
    }
    // the fade's ghosts light nothing (intensity 0) and lend their maps to their cascades: no light node of their own
    super.updateLights(lights.some(isCascadeGhost) ? lights.filter((l) => !isCascadeGhost(l)) : lights);
  }

  /** build one node material's program (timed: `builds`, `buildMs`) */
  override build(material: THREE.Material, object: THREE.Object3D, parameters: THREE.WebGLProgramParametersWithUniforms): void {
    const t0 = diagnosticNow();
    super.build(material, object, parameters);
    this.buildMs += diagnosticNow() - t0;
    this.builds++;
  }
}
