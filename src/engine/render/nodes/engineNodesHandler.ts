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
 *    may supply its trusted node replacement through the same registry and region sweep.
 * 4. **The engine's shadow filter** (`shadowFilter.ts`, E138): where the tent is installed, every shadow-casting light
 *    without a filter of its own gets the tent as its node filter (`tentShadowFilter.ts`), so node and family
 *    materials share one penumbra; where the chunk carries the receiver-plane bias instead (E435), the same biased PCF
 *    (`planeBiasShadowFilter.ts`).
 *
 * 5. **The sun's cascades and the shadow fade** (`cascadeLightNode.ts`): a DirectionalLight the sky rig registered as
 *    a cascade is gated to its depth slice as the CSM chunk gates it, with the fade's ghost shadow mixed in.
 * 6. **A layered backdrop's level frame** (`nodeLayerFrame.ts`, G321): a node material a `BackdropLayer` dresses with
 *    is built with the level frame's view as its model-view (`material.contextNode`), the graph compiler's camera reads
 *    shifted by the frame's origin, and its output faded by the owner weight as the last epilogue stage; its programs
 *    keep a key of their own.
 * 7. **The scene's environment is upright** (`ClassicPMREMNode`). three's PMREM node assumes WebGPURenderer's PMREM: a
 *    render-target PMREM stored upside down with its directions' y negated, so it flips both. The classic
 *    PMREMGenerator writes the standard convention upright (`cube_uv_reflection_fragment` reads it unflipped), so a lit
 *    node material's image-based light came from below the horizon: a standard graph under a sky environment drew
 *    about a quarter as bright as its classic twin (Pine Hollow's cabin door, near black in shade). A classic PMREM
 *    (`CubeUVReflectionMapping`) environment reaches node materials through this node instead.
 *
 * Load it lazily (`render/graphBackend.ts`): it pulls in `three/webgpu` + `three/tsl` (≈ +117 KB gzip), which a shard
 * without a graph material never pays for. Nothing on the default render path imports this module.
 */
import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/examples/jsm/tsl/WebGLNodesHandler.js';
import { ConvertNode, NodeMaterial, PMREMNode, TextureNode, type Node, type NodeBuilder } from 'three/webgpu';
import { and, cameraPosition, context, mix, modelWorldMatrix, nodeObject, positionWorld, reference, step, uniform, vec2, vec3, vec4, workingToColorSpace } from 'three/tsl';
import { fogPatches, materialNodeFogOf } from '../fogPatches';
import { planeBiasShadowFilterOn, tentShadowFilterOn } from '../../world/shadowFilter';
import { engineFog } from './engineFog';
import { tentShadowFilter } from './tentShadowFilter';
import { planeBiasShadowFilter } from './planeBiasShadowFilter';
import { EngineDirectionalLightNode } from './cascadeLightNode';
import { isCascadeGhost } from '../../world/cascadeLights';
import { diagnosticNow } from '../../core/clock';
import { worldTime } from '../../core/time';
import type { Renderer } from '../renderer';
import { NodeUniformBuffers, type BlockGroup } from './nodeUniformBuffers';
import { installNodeCoarseMask, type NodeCoarseMask } from '../nodeCoarseMask';
import { installNodeLayerFrame, layerFrameOf, type NodeLayerFrameInstaller } from '../nodeLayerFrame';
import { buildWithInstanceAttributes, instanceAttributeShader, nodeInstanceKey } from './nodeInstancing';

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
/**
 * `targetTexture` whose texture can be swapped after the build (a post pass reads the composer's input buffer, which
 * ping-pongs between two targets): `retarget` moves the sampled texture, never the program.
 */
export function retargetableTexture(map: THREE.Texture, uvNode?: Node<'vec2'>): { readonly node: Node<'vec4'>; readonly retarget: (next: THREE.Texture) => void } {
  const texture = new TargetTextureNode(map, uvNode ?? null);
  return { node: nodeObject(texture), retarget: (next) => { texture.value = next; } };
}

/** a texture, typed as three's default texture (`instanceof` alone narrows to `Texture<any>`) */
function isTexture(value: unknown): value is THREE.Texture { return value instanceof THREE.Texture; }

/** a direction node's y negated (a vec3 node: three's d.ts types context reads as unknown) */
function negateY(direction: unknown): Node<'vec3'> {
  if (typeof direction !== 'object' || direction === null || !isNode(direction)) throw new Error('EngineNodesHandler: an environment direction that is not a node');
  const d = new ConvertNode<'vec3'>(direction, 'vec3');
  return vec3(d.x, d.y.negate(), d.z);
}

/**
 * The classic renderer's PMREM environment sampled as `cube_uv_reflection_fragment` samples it (module comment, 7):
 * the atlas upright (its texture node never flips) and the lookup direction as it is. PMREMNode negates a render-target
 * PMREM's direction y in `setup`; the direction it is handed is pre-negated so the two cancel.
 */
class ClassicPMREMNode extends PMREMNode {
  constructor(value: THREE.Texture) {
    super(value);
    const stock: unknown = Reflect.get(this, '_texture');
    if (!(stock instanceof TextureNode)) throw new Error('EngineNodesHandler: PMREMNode keeps no texture node');
    Reflect.set(this, '_texture', new TargetTextureNode(stock.value));
  }

  override setup(builder: NodeBuilder): Node {
    const outer: unknown = builder.context;
    const getUV: unknown = typeof outer === 'object' && outer !== null ? Reflect.get(outer, 'getUV') : undefined;
    if (typeof outer !== 'object' || outer === null || this.uvNode !== null || typeof getUV !== 'function') throw new Error('EngineNodesHandler: an environment read without a lighting context');
    builder.context = { ...outer, getUV: (node: unknown, b: unknown): Node<'vec3'> => negateY(Reflect.apply(getUV, undefined, [node, b])) };
    try {
      const built: unknown = super.setup(builder);
      if (typeof built !== 'object' || built === null || !isNode(built)) throw new Error('EngineNodesHandler: PMREMNode built no node');
      return built;
    } finally { builder.context = outer; }
  }
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

/** what the stock handler keeps for one (material, program) pair: the uniforms, groups and update nodes of the program's build */
interface ProgramEntry {
  readonly uniformsGroups: unknown[];
  readonly uniforms: Record<string, unknown>;
  readonly uniformsList: unknown[];
  readonly updateNodes: unknown;
}
/** the parts of three's (untyped) stock handler the engine handler reaches */
interface StockInternals {
  getOutputCallback: (outputNode: Node<'vec4'>, builder: NodeBuilder) => Node<'vec4'>;
  customProgramCacheKeyCallback: (this: THREE.Material) => string;
  renderStack: { sceneContext: { fogNode: Node | null; environmentNode: Node | null; scene: THREE.Object3D } }[];
  programCache: Map<THREE.Material, Map<unknown, ProgramEntry>>;
  collectUniformsGroups: (builder: unknown) => unknown[];
  onBeforeRenderCallback: (this: THREE.Material, ...args: unknown[]) => void;
  onDisposeMaterialCallback: (this: THREE.Material) => void;
}
const internals = (h: WebGLNodesHandler): StockInternals => h as WebGLNodesHandler & StockInternals;

/** what the classic renderer sees of a node material's uniform groups: none (the engine binds them per draw) */
const NO_GROUPS: readonly unknown[] = Object.freeze([]);
/** a uniform group as three's UniformsGroup carries it */
function isBlockGroup(v: unknown): v is BlockGroup {
  return typeof v === 'object' && v !== null && typeof Reflect.get(v, 'name') === 'string' && Array.isArray(Reflect.get(v, 'uniforms'));
}

/**
 * one node build not yet paired with the program the renderer acquired for it: the renderer files that program in the
 * material's program map (`programs`, key → program) at `slot`, the map's size when the build ran
 */
interface PendingBuild { readonly builder: unknown; readonly uniforms: Record<string, unknown>; readonly programs: unknown; readonly slot: number }

/** the program's active uniforms that the build declares (three's `generateUniformsList`, WebGLUniforms.seqWithValue) */
function uniformsListOf(program: unknown, uniforms: Record<string, unknown>): unknown[] {
  const getUniforms: unknown = typeof program === 'object' && program !== null ? Reflect.get(program, 'getUniforms') : null;
  if (typeof getUniforms !== 'function') return [];
  const active: unknown = Reflect.apply(getUniforms, program, []);
  const seq: unknown = typeof active === 'object' && active !== null ? Reflect.get(active, 'seq') : null;
  if (!Array.isArray(seq)) return [];
  const list: unknown[] = [];
  for (const u of seq) {
    const id: unknown = typeof u === 'object' && u !== null ? Reflect.get(u, 'id') : undefined;
    if (typeof id === 'string' && id in uniforms) list.push(u);
  }
  return list;
}

/** Native coarse masks follow node-transformed world positions, including instances. */
const nodeCoarseMask: NodeCoarseMask = (material, origin, mask, half) => {
  if (!(material instanceof NodeMaterial)) return false;
  const quadrant = step(vec2(half), positionWorld.xz.sub(uniform(origin.value)));
  const flags = uniform(mask.value);
  const hidden = mix(mix(flags.x, flags.y, quadrant.x), mix(flags.z, flags.w, quadrant.x), quadrant.y);
  // The updater and step both produce exact binary flags.
  const keep = hidden.equal(0);
  material.maskNode = material.maskNode === null ? keep : and(new ConvertNode<'bool'>(material.maskNode, 'bool'), keep);
  return true;
};

/** A layer's level frame: the model-view in the frame's view (the graph compiler reads the camera through `layerFrameOf`). */
const nodeLayerFrame: NodeLayerFrameInstaller = (material, frame) => {
  if (!(material instanceof NodeMaterial)) return false;
  material.contextNode = context({ modelViewMatrix: reference('value', 'mat4', frame.view).mul(modelWorldMatrix) });
  return true;
};

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
  /** the node programs' uniform blocks, bound per draw (`nodeUniformBuffers.ts`; null without a WebGL 2 context) */
  private blocks: NodeUniformBuffers | null = null;
  /** builds of each material not yet paired with their programs (see `onUpdateProgram`) */
  private readonly pendingBuilds = new WeakMap<object, PendingBuild[]>();
  /** each classic PMREM environment's upright node (`ClassicPMREMNode`) */
  private readonly environments = new WeakMap<THREE.Texture, Node>();

  constructor() {
    super();
    installNodeCoarseMask(nodeCoarseMask);
    installNodeLayerFrame(nodeLayerFrame);
    const self = internals(this);
    // the stock per-draw and dispose callbacks, as three writes them, plus the engine's uniform blocks: every draw binds
    // its program's blocks once their nodes are updated, and a disposed material's blocks free their buffers
    const before = (material: THREE.Material, renderer: unknown, object: unknown): void => { this.beforeDraw(material, renderer, object); };
    const disposed = (material: THREE.Material): void => { this.disposeMaterial(material); };
    self.onBeforeRenderCallback = function onBeforeRenderCallback(this: THREE.Material, ...args: unknown[]): void { before(this, args[0], args[4]); };
    self.onDisposeMaterialCallback = function onDisposeMaterialCallback(this: THREE.Material): void { disposed(this); };
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
    const frame = (): unknown => Reflect.get(this, 'nodeFrame');
    self.customProgramCacheKeyCallback = function customProgramCacheKeyCallback(this: THREE.Material): string {
      const current = frame();
      const object: unknown = typeof current === 'object' && current !== null ? Reflect.get(current, 'object') : undefined;
      const layer = layerFrameOf(this);
      const fog = materialNodeFogOf(this) ?? fogPatches().at(-1);
      const fogKey = fog?.node === undefined ? '' : `|fog:${fog.id}`;
      return `${stockKey.call(this)}|${PROGRAM_KEY}|${this.toneMapped ? 'tm' : 'raw'}|${nodeInstanceKey(object)}${fogKey}${layer === null ? '' : `|layer:${layer.whole ? 'whole' : 'alpha'}`}`;
    };
    this.epilogue.push((out, ctx) => {
      const bound = materialNodeFogOf(ctx.material);
      const patch = bound === undefined ? fogPatches().at(-1)?.node : bound.node;
      if ((!this.engineFogOn() && patch === undefined) || Reflect.get(ctx.material, 'fog') !== true || ctx.fog === null) return out;
      const scale: unknown = Reflect.get(ctx.material, 'graphFogScale');
      const node = typeof scale === 'object' && scale !== null && isNode(scale) ? new ConvertNode<'float'>(scale, 'float') : undefined;
      const engine = engineFog(out, ctx.fog, node);
      if (patch === undefined) return engine;
      const origin = bound?.origin ?? layerFrameOf(ctx.material)?.origin;
      const shift = origin === undefined ? null : reference('value', 'vec3', origin);
      return patch(out, { engine, fog: ctx.fog, position: shift === null ? positionWorld : positionWorld.sub(shift),
        camera: shift === null ? cameraPosition : cameraPosition.sub(shift), ...(node === undefined ? {} : { scale: node }) });
    });
    // a layered backdrop's node dressing fades by its owner weight last, where a classic piece's gl_FragColor is faded
    this.epilogue.push((out, ctx) => {
      const layer = layerFrameOf(ctx.material);
      if (layer === null) return out;
      const fade = reference('value', 'float', layer.fade);
      return layer.whole ? out.mul(fade) : vec4(out.xyz, out.w.mul(fade));
    });
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
    const gl: unknown = renderer.getContext();
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) this.blocks = new NodeUniformBuffers(gl);
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

  /** Engine fog or the page's explicit node replacement suppresses stock fog to avoid applying it twice. */
  private engineFogOn(): boolean {
    const patches = fogPatches();
    const engine = patches.some((p) => p.id === 'engine.fog');
    if (engine && patches.length > 1 && patches.at(-1)?.node === undefined && !this.warnedLevelFog) {
      this.warnedLevelFog = true;
      console.warn(`[nodes] a level fog patch (${patches.filter((p) => p.id !== 'engine.fog').map((p) => p.id).join(', ')}) does not reach graph materials: they get the engine fog only`);
    }
    return engine || patches.at(-1)?.node !== undefined;
  }

  /**
   * a render begins: the node frame's clock is the game's frame time where the game's loop runs (`worldTime.t`;
   * three's stock frame reads `performance.now()`, so a graph's `time` drew wherever the wall clock had it and two map
   * bakes of one build differed); three's stock fog node is dropped wherever the engine epilogue fogs
   */
  override renderStart(scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Object3D): void {
    super.renderStart(scene, camera, targetScene);
    const frame: unknown = Reflect.get(this, 'nodeFrame');
    if (worldTime.t !== null && typeof frame === 'object' && frame !== null) {
      Reflect.set(frame, 'time', worldTime.t);
      Reflect.set(frame, 'deltaTime', worldTime.realDt);
    }
    // the engine epilogue fogs node materials; three's stock fog node would fog them a second time
    if (this.engineFogOn()) {
      const top = internals(this).renderStack.at(-1);
      if (top !== undefined) top.sceneContext.fogNode = null;
    }
    // a classic PMREM environment reaches node materials upright (module comment, 7); one node per texture keeps one key
    const sceneContext = internals(this).renderStack.at(-1)?.sceneContext;
    const environment: unknown = sceneContext === undefined ? null : Reflect.get(sceneContext.scene, 'environment');
    if (sceneContext !== undefined && isTexture(environment) && environment.mapping === THREE.CubeUVReflectionMapping) {
      let node = this.environments.get(environment);
      if (node === undefined) { node = nodeObject(new ClassicPMREMNode(environment)); this.environments.set(environment, node); }
      sceneContext.environmentNode = node;
    }
  }

  /** the frame's lights: every shadow caster without a node filter of its own gets the engine's filter (the tent, else the
   *  receiver-plane biased PCF, E435); the fade's ghosts are left out */
  override updateLights(lights: THREE.Light[]): void {
    const filter = tentShadowFilterOn() ? tentShadowFilter : planeBiasShadowFilterOn() ? planeBiasShadowFilter : null;
    if (filter !== null) {
      for (const light of lights) {
        const shadow: unknown = Reflect.get(light, 'shadow');
        if (!(shadow instanceof THREE.LightShadow) || !light.castShadow) continue;
        if (Reflect.get(shadow, 'filterNode') === undefined) Reflect.set(shadow, 'filterNode', filter);
      }
    }
    // the fade's ghosts light nothing (intensity 0) and lend their maps to their cascades: no light node of their own
    super.updateLights(lights.some(isCascadeGhost) ? lights.filter((l) => !isCascadeGhost(l)) : lights);
  }

  /** build one node material's program (timed: `builds`, `buildMs`); the build waits to be paired with its program */
  override build(material: THREE.Material, object: THREE.Object3D, parameters: THREE.WebGLProgramParametersWithUniforms): void {
    const t0 = diagnosticNow();
    if (material instanceof NodeMaterial) buildWithInstanceAttributes(material, () => { super.build(material, object, parameters); });
    else super.build(material, object, parameters);
    parameters.vertexShader = instanceAttributeShader(parameters.vertexShader, object);
    // Three's classic node builder hardcodes GL_POINTS to one pixel. A compiler-owned
    // size property replaces only that epilogue; content still supplies no shader code.
    if (material.userData['graphPointSize'] === true) {
      if (!(object instanceof THREE.Points)) throw new Error('Points graph requires a Points object');
      const shader = parameters.vertexShader;
      if (!shader.includes('float wildshardGraphPointSize;') || !shader.includes('gl_PointSize = 1.0;')) throw new Error('Missing graph point-size output');
      parameters.vertexShader = shader.replace('gl_PointSize = 1.0;', 'gl_PointSize = wildshardGraphPointSize;');
    }
    this.buildMs += diagnosticNow() - t0;
    this.builds++;
    // WebGLRenderer.getProgram calls build only for a key its material has no program for, then files the acquired
    // program under that key: the program lands at the map's current size
    const builder: unknown = Reflect.get(material, '_latestBuilder');
    const properties: unknown = this.classicRenderer().properties.get(material);
    const programs: unknown = typeof properties === 'object' && properties !== null ? Reflect.get(properties, 'programs') : undefined;
    const pending = this.pendingBuilds.get(material) ?? [];
    pending.push({ builder, uniforms: parameters.uniforms, programs, slot: programs instanceof Map ? programs.size : -1 });
    this.pendingBuilds.set(material, pending);
  }

  /**
   * The renderer switched `material` to `program` (WebGLRenderer.setProgram). The stock handler pairs a program it has not
   * seen with the material's LATEST build, which is wrong when the material was built more than once before it drew: the
   * boot's precompile (`renderer.compileAsync`) builds a material for each program it will need (into the scene target and
   * to the screen, say, whose output transforms differ) without switching to any, so the first program met at the first
   * draw got the last build's uniforms. Its uniform names then point at another build's nodes (a shadow sampler at a
   * float: 'Invalid value used as weak map key' in setTexture2D; G169 pastel plain with Graph materials on). Each build
   * since the last switch is paired with the program the renderer filed right after it (at the slot of the material's
   * program map that the build recorded) before the stock switch runs, so every program keeps its own build's uniforms.
   */
  onUpdateProgram(material: THREE.Material, program: unknown, materialProperties: object): void {
    const pending = this.pendingBuilds.get(material);
    if (pending !== undefined) {
      this.pendingBuilds.delete(material);
      const programs: unknown = Reflect.get(materialProperties, 'programs');
      if (programs instanceof Map) {
        const acquired: unknown[] = [...programs.values()];
        const cache = internals(this).programCache;
        const known = cache.get(material) ?? new Map<unknown, ProgramEntry>();
        cache.set(material, known);
        for (const build of pending) {
          // a build from before the material was disposed filed into a map that is gone: nothing to pair
          const built: unknown = build.programs === programs ? acquired[build.slot] : undefined;
          if (built === undefined || known.has(built)) continue;
          const updateNodes: unknown = typeof build.builder === 'object' && build.builder !== null ? Reflect.get(build.builder, 'updateNodes') : undefined;
          known.set(built, { uniformsGroups: internals(this).collectUniformsGroups(build.builder), uniforms: build.uniforms, uniformsList: uniformsListOf(built, build.uniforms), updateNodes });
        }
      }
    }
    const stock: unknown = Reflect.get(WebGLNodesHandler.prototype, 'onUpdateProgram');
    if (typeof stock === 'function') Reflect.apply(stock, this, [material, program, materialProperties]);
    this.bindBlocks(material, program);
  }

  /**
   * Bind the uniform blocks of `material`'s program (`program`, else the program it last drew with) through the engine's
   * per-draw binding (`nodeUniformBuffers.ts`) and leave the classic renderer none of them: its global binding point
   * per group runs out after a dozen node programs.
   */
  private bindBlocks(material: THREE.Material, program: unknown): void {
    const blocks = this.blocks;
    if (blocks === null) return;
    const properties: unknown = this.classicRenderer().properties.get(material);
    const current: unknown = program ?? (typeof properties === 'object' && properties !== null ? Reflect.get(properties, 'currentProgram') : undefined);
    const entry = current === undefined ? undefined : internals(this).programCache.get(material)?.get(current);
    if (Reflect.get(material, 'uniformsGroups') !== NO_GROUPS) Reflect.set(material, 'uniformsGroups', NO_GROUPS);
    const linked: unknown = typeof current === 'object' && current !== null ? Reflect.get(current, 'program') : undefined;
    if (entry === undefined || !(typeof WebGLProgram !== 'undefined' && linked instanceof WebGLProgram)) return;
    blocks.bind(linked, entry.uniformsGroups.filter(isBlockGroup));
  }

  /**
   * a node material is about to draw (three's onBeforeRenderCallback): point the node frame at it, force the per-draw
   * update, update its current program's nodes, recompile when the object's shadow receipt changed; then bind its blocks
   */
  private beforeDraw(material: THREE.Material, renderer: unknown, object: unknown): void {
    const self = internals(this), frame: unknown = Reflect.get(this, 'nodeFrame');
    if (typeof frame === 'object' && frame !== null) { Reflect.set(frame, 'material', material); Reflect.set(frame, 'object', object); }
    const info: unknown = typeof renderer === 'object' && renderer !== null ? Reflect.get(renderer, 'info') : undefined;
    const render: unknown = typeof info === 'object' && info !== null ? Reflect.get(info, 'render') : undefined;
    if (typeof render === 'object' && render !== null) Reflect.set(render, 'frame', Number(Reflect.get(render, 'frame')) + 1);
    const real = this.classicRenderer();
    if (real.properties.has(material)) {
      const properties: unknown = real.properties.get(material);
      const current: unknown = typeof properties === 'object' && properties !== null ? Reflect.get(properties, 'currentProgram') : undefined;
      const entry = self.programCache.get(material)?.get(current);
      // compile() can select a new program without onUpdateProgram. After an offscreen
      // draw, setProgram may see matching material flags and skip its switch callback.
      // Pair queued builds and select their uniforms before that first real draw.
      if (typeof properties === 'object' && properties !== null && current !== undefined &&
        (this.pendingBuilds.has(material) || entry === undefined || Reflect.get(properties, 'uniforms') !== entry.uniforms ||
          Reflect.get(properties, 'uniformsList') !== entry.uniformsList)) this.onUpdateProgram(material, current, properties);
      else if (entry !== undefined) this.updateNodeList(entry.updateNodes);
    }
    const hash = `${String(typeof object === 'object' && object !== null ? Reflect.get(object, 'receiveShadow') : undefined)}|${nodeInstanceKey(object)}`;
    if (Reflect.get(material, 'prevObjectHash') !== hash) { Reflect.set(material, 'prevObjectHash', hash); material.needsUpdate = true; }
    this.bindBlocks(material, null);
  }

  /** run the stock node update over a program's update nodes */
  private updateNodeList(nodes: unknown): void {
    const update: unknown = Reflect.get(this, 'updateNodes');
    if (typeof update === 'function') Reflect.apply(update, this, [nodes]);
  }

  /** a node material was disposed (three's onDisposeMaterialCallback): its uniform groups and block buffers go */
  private disposeMaterial(material: THREE.Material): void {
    const self = internals(this), programs = self.programCache.get(material), blocks = this.blocks;
    if (programs !== undefined) {
      for (const entry of programs.values()) {
        for (const group of entry.uniformsGroups) {
          if (typeof group !== 'object' || group === null) continue;
          blocks?.release(group);
          const dispose: unknown = Reflect.get(group, 'dispose');
          if (typeof dispose === 'function') Reflect.apply(dispose, group, []);
        }
      }
      self.programCache.delete(material);
    }
    material.removeEventListener('dispose', self.onDisposeMaterialCallback);
  }
}
