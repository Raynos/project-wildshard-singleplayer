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
 *    target and to the screen keeps one program for each. An **unlit graph** (`userData.graphRawOutput`, set by the
 *    compiler) has no output transform at all, the way a `ShaderMaterial` without `colorspace_fragment` has none: every
 *    unlit graph stands for such a GLSL program, so on screen (a plain capture, the map bake) it wrote sRGB-encoded,
 *    paler colour than the program it replaced (G477 OE: Nine's lanterns, Nalati's river on the baked map). Inside a
 *    target both are linear, so the game's composed frame is unchanged; lit graphs keep the classic built-in transform.
 *    An opaque graph with `surface.targetAlpha` writes that alpha where three forces 1 (G478 OE2: a GLSL program wrote
 *    near / viewZ there for a post that blends by it, so the graph that replaced it took a grade the program never had).
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
import { ConvertNode, MaterialReferenceNode, MeshBasicNodeMaterial, NodeFrame, NodeMaterial, PMREMNode, TextureNode, type Node, type NodeBuilder } from 'three/webgpu';
import { Fn, and, cameraPosition, context, mix, modelWorldMatrix, nodeObject, normalLocal, positionWorld, reference, step, uniform, vec2, vec3, vec4, workingToColorSpace } from 'three/tsl';
import { shaderPatchProgramKey, shaderPatchSet, shaderPatchSceneShape } from '../shaderPatches';
import { fogPatches, materialNodeFogOf } from '../fogPatches';
import { planeBiasShadowFilterOn, tentShadowFilterOn } from '../../world/shadowFilter';
import { colourRampFog, engineFog } from './engineFog';
import { tentShadowFilter } from './tentShadowFilter';
import { planeBiasShadowFilter } from './planeBiasShadowFilter';
import { EngineDirectionalLightNode } from './cascadeLightNode';
import { EnginePointLightNode } from './pointLightNode';
import { isCascadeGhost } from '../../world/cascadeLights';
import { compileLightSource, compileSceneSource } from '../compileLights';
import { Scope } from '../../app/scope';
import { rebindGeometry } from '../../app/cachedAssets';
import { diagnosticNow } from '../../core/clock';
import { worldTime } from '../../core/time';
import type { Renderer } from '../renderer';
import type { ProgramLike } from '../../boot/perflog';
import { NodePlainUniforms, type BlockGroup } from './nodePlainUniforms';
import { installNodeCoarseMask, type NodeCoarseMask } from '../nodeCoarseMask';
import { installNodeLayerFrame, layerFrameOf, type NodeLayerFrameInstaller } from '../nodeLayerFrame';
import { bindGraphAttributeDefaults, copyGraphAttributeDefaults, prepareGraphAttributeDefaults } from './graphAttributes';
import { buildWithInstanceAttributes, instanceAttributeShader, nodeInstanceKey } from './nodeInstancing';
import { TextureUpdates } from './textureUpdates';
import { withNodeChildSnapshots } from './nodeChildren';
import { SceneShaderKeys } from './sceneShaderKey';
import { GraphCodeKeys } from './graphCodeKeys';
import { NodeProgramVariants } from './nodeProgramVariants';
import { classicModelUniform } from './nodeObjectUniforms';
import { registerShadowDepthResolver } from '../shadowDepthVariants';
import { bindLazy, buildCensus, buildReads, captureBuild, holdsAny, newestNodeId, type KeptRoles, graphShape, keepBuild, lazyReads, pairShapes, rebindBuild, recordBuild, restoreBuild, reuseKey, unboundReads, type BuildCensus, type BuildOutput, type GraphShape, type KeptBuild, type LazyUniform } from './nodeBuildReuse';
import { graphNodeOwner } from './graphOwners';
import { harnessPins } from '../../app/identity';

/** Depth displacement reads the same authored local normal as its surface. */
class GraphShadowDepthMaterial extends MeshBasicNodeMaterial {
  vertexNormal: Node | null = null;
  override setupPosition(builder: NodeBuilder): Node {
    const normal = this.vertexNormal;
    if (normal !== null) Fn(() => { normalLocal.assign(new ConvertNode<'vec3'>(normal, 'vec3'));  }, 'void')();
    return super.setupPosition(builder);
  }
}

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

/** a code string's length and 32-bit FNV-1a hash (programShare's shared-code check) */
function codeHash(code: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) { h ^= code.codePointAt(i) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return `${String(code.length)}:${h.toString(16)}`;
}
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
/** Retargetable slots must not alias because they initially borrow one placeholder.
 * TextureNode normally hashes the texture UUID, merging those distinct uniforms;
 * a later retarget would then change the shader layout under a warm program key. */
class RetargetableTextureNode extends TargetTextureNode {
  override getUniformHash(): string { return this.getBase().uuid; }
}

/**
 * `targetTexture` whose texture can be swapped after the build (a post pass reads the composer's input buffer, which
 * ping-pongs between two targets): `retarget` moves the sampled texture, never the program.
 */
export function retargetableTexture(map: THREE.Texture, uvNode?: Node<'vec2'>): { readonly node: Node<'vec4'>; readonly retarget: (next: THREE.Texture) => void } {
  const texture = new RetargetableTextureNode(map, uvNode ?? null);
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
function isDrawObject(value: unknown): value is THREE.Object3D { return value instanceof THREE.Object3D; }
function isNode(value: object): value is Node<'vec4'> { return Reflect.get(value, 'isNode') === true; }
/** the PMREM node fields a build reads: the atlas sampler, its texel width and height, its top mip */
const PMREM_FIELDS = ['_texture', '_width', '_height', '_maxMip'] as const;
/** a cube-UV atlas' height (its program layout), or null */
function atlasHeight(texture: THREE.Texture): number | null {
  const image: unknown = texture.image, height: unknown = typeof image === 'object' && image !== null ? Reflect.get(image, 'height') : undefined;
  return typeof height === 'number' ? height : null;
}
/** a sample of the PMREM atlas `sampler` reading `texture`, as `TextureNode.sample` makes one: only its value reaches the
 *  program (its code is the build's), so none of a lookup graph comes along */
function freshSample(sampler: TextureNode, texture: THREE.Texture): TextureNode {
  const copy = sampler.getBase().clone();
  copy.uvNode = null; copy.levelNode = null; copy.biasNode = null; copy.compareNode = null; copy.depthNode = null;
  copy.gradNode = null; Reflect.set(copy, 'offsetNode', null);
  copy.value = texture; // its own texture before it follows the atlas, so it holds nothing else
  copy.referenceNode = sampler.getBase();
  return copy;
}
/** `value`, a sample the build took of a PMREM node's atlas `sampler` (its class), as a fresh sample of `next` (the new
 *  PMREM node's atlas, reading `after`); null for any other value */
function atlasSample(value: unknown, sampler: unknown, next: unknown, after: THREE.Texture): object | null {
  if (!(value instanceof TextureNode) || !(sampler instanceof TextureNode) || !(next instanceof TextureNode)
    || value.constructor !== sampler.constructor || value.getBase() !== sampler.getBase()) return null;
  const copy = freshSample(next, after);
  return copy.value === after ? copy : null;
}
/** A kept build's roles for its environment's PMREM node `pmrem` (of `texture`): its fields by name, and any sample of its
 *  atlas; the texture and the node are what no other kept node may hold for the build to bind another environment. */
function environmentRoles(pmrem: object, texture: THREE.Texture): KeptRoles {
  const fields = new Map<unknown, string>();
  for (const field of PMREM_FIELDS) { const node: unknown = Reflect.get(pmrem, field); if (isNodeLike(node)) fields.set(Reflect.get(node, 'id'), field); }
  const sampler: unknown = Reflect.get(pmrem, '_texture');
  return { inputs: [texture, pmrem], role: node => {
    const field = fields.get(node.id);
    if (field !== undefined) return `environment:${field}`;
    return sampler instanceof TextureNode && node instanceof TextureNode && node.getBase() === sampler.getBase() ? 'environment:sample' : null;
  } };
}
/** any value that is a node */
function isNodeLike(value: unknown): value is object { return typeof value === 'object' && value !== null && Reflect.get(value, 'isNode') === true; }

/** Three's module-cached material readers must not keep their last retired target. */
function releaseMaterialReferences(nodes: unknown, material: THREE.Material): void {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) if (node instanceof MaterialReferenceNode && Reflect.get(node, 'material') === null
    && Reflect.get(node, 'reference') === material) Reflect.set(node, 'reference', null);
}

/** what the stock handler keeps for one (material, program) pair: the uniforms, groups and update nodes of the program's build */
interface ProgramEntry {
  readonly uniformsGroups: unknown[];
  readonly uniforms: Record<string, unknown>;
  readonly uniformsList: unknown[];
  readonly updateNodes: unknown;
}
/** the parts of three's (untyped) stock handler the engine handler reaches */
interface StockInternals {
  renderer: { getCacheKey: () => string };
  updateNodes: (nodes: unknown) => void;
  getOutputCallback: (outputNode: Node<'vec4'>, builder: NodeBuilder) => Node<'vec4'>;
  customProgramCacheKeyCallback: (this: THREE.Material) => string;
  renderStack: { camera: THREE.Camera; sceneContext: { lightsNode: { getBuiltinLights: () => unknown[] }; fogNode: Node | null; environmentNode: Node | null; scene: THREE.Object3D; getCacheKey: () => unknown } }[];
  programCache: Map<THREE.Material, Map<unknown, ProgramEntry>>;
  collectUniformsGroups: (builder: unknown) => unknown[];
  onBeforeRenderCallback: THREE.Material['onBeforeRender'];
  onDisposeMaterialCallback: (this: THREE.Material) => void;
  updateGeometryAttributes: (builder: unknown, geometry: THREE.BufferGeometry) => void;
  updateShaderParameters: (builder: unknown, parameters: THREE.WebGLProgramParametersWithUniforms) => void;
}
const internals = (h: WebGLNodesHandler): StockInternals => h as WebGLNodesHandler & StockInternals;

/** what the classic renderer sees of a node material's uniform groups: none (the engine binds them per draw) */
const NO_GROUPS: readonly unknown[] = Object.freeze([]);
/** a uniform group as three's UniformsGroup carries it */
function isBlockGroup(v: unknown): v is BlockGroup {
  return typeof v === 'object' && v !== null && typeof Reflect.get(v, 'name') === 'string' && Array.isArray(Reflect.get(v, 'uniforms'));
}

/** Validated runtime view of one paired program. */
interface DrawEntry {
  readonly program: unknown;
  readonly entry: ProgramEntry;
  readonly groups: readonly BlockGroup[];
  readonly linked: WebGLProgram | null;
}
interface MaterialProperties {
  currentProgram?: unknown;
  uniforms?: unknown;
  uniformsList?: unknown;
  __version?: unknown;
}
function isMaterialProperties(value: unknown): value is MaterialProperties { return typeof value === 'object' && value !== null; }
/**
 * one node build not yet paired with the program the renderer acquired for it: the renderer files that program in the
 * material's program map (`programs`, key → program) at `slot`, the map's size when the build ran
 */
interface SceneInputs { readonly fog: object | null; readonly environment: object | null }
function sameSceneInput(held: WeakRef<object> | null, live: object | null): boolean {
  return held === null ? live === null : held.deref() === live;
}
/** kept disposed builds (G782): at most this many, and at most this many estimated bytes, oldest dropped first */
const KEPT_BUILDS = 96, KEPT_BYTES = 12 * 1024 * 1024;
interface SceneBinding {
  readonly scene: WeakRef<object>; readonly rawKey: unknown; readonly lights: string;
  /** the scene's fog and environment when built, and whether the build reads each (`buildReads`): one it does not read
   *  may be swapped without a rebuild */
  readonly inputs: { readonly fog: WeakRef<object> | null; readonly environment: WeakRef<object> | null; readonly reads: { readonly fog: boolean; readonly environment: boolean } } | null;
  readonly parameters: THREE.WebGLProgramParametersWithUniforms;
}
interface PendingBuild { readonly binding: SceneBinding | null; readonly uniformsGroups: unknown[]; readonly updateNodes: unknown; readonly uniforms: Record<string, unknown>; readonly programs: unknown; readonly slot: number }

/** Node buffer names contain process-global node IDs. Equal cloned graphs share a
 * program, so both its GLSL blocks and each build's runtime groups need names
 * based on build order instead. Values, layouts and node ownership stay local. */
function stableBufferNames(builder: unknown, parameters: THREE.WebGLProgramParametersWithUniforms, groups: readonly unknown[]): void {
  const uniforms: unknown = typeof builder === 'object' && builder !== null ? Reflect.get(builder, 'uniforms') : undefined;
  if (typeof uniforms !== 'object' || uniforms === null) return;
  const names = new Map<string, string>();
  let count = 0;
  for (const stage of ['vertex', 'fragment']) {
    const list: unknown = Reflect.get(uniforms, stage);
    if (!Array.isArray(list)) continue;
    const entries: readonly unknown[] = list;
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null || Reflect.get(entry, 'type') !== 'buffer') continue;
      const node: unknown = Reflect.get(entry, 'node'), member: unknown = Reflect.get(entry, 'name');
      const block: unknown = typeof node === 'object' && node !== null ? Reflect.get(node, 'name') : undefined;
      if (typeof block !== 'string' || !/^NodeBuffer_\d+$/u.test(block) || typeof member !== 'string' || !/^buffer\d+$/u.test(member)) continue;
      if (names.has(block)) continue;
      names.set(block, `engineNodeBuffer${count}`); names.set(member, `engineNodeBufferData${count}`); count++;
    }
  }
  if (names.size === 0) return;
  const replace = (source: string): string => source.replaceAll(/\b(?:NodeBuffer_\d+|buffer\d+)\b/gu, name => names.get(name) ?? name);
  parameters.vertexShader = replace(parameters.vertexShader); parameters.fragmentShader = replace(parameters.fragmentShader);
  for (const [old, name] of names) {
    const bufferUniform = parameters.uniforms[old];
    if (bufferUniform !== undefined) { parameters.uniforms[name] = bufferUniform; delete parameters.uniforms[old]; }
  }
  for (const group of groups) if (isBlockGroup(group)) {
    const name = names.get(group.name); if (name !== undefined) Reflect.set(group, 'name', name);
  }
}

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

// A bone buffer's declared array length is part of the linked program's layout. The key is one string per shape (never
// built per draw), so a warm key memo compares and hashes it once.
const boneKeys = new Map<number, string>();
function nodeObjectKey(object: unknown): string {
  if (!(object instanceof THREE.SkinnedMesh)) return nodeInstanceKey(object);
  const bones = object.skeleton.bones.length;
  let key = boneKeys.get(bones);
  if (key === undefined) { key = `${nodeInstanceKey(object)}|bones:${bones}`; boneKeys.set(bones, key); }
  return key;
}

const PROGRAM_KEY = 'engine-nodes';

/**
 * A graph depth variant's stock key (`shadowDepthOf`): its node hash and receive flag, without the scene context's lights,
 * environment and fog, which it never reads. Three draws a cast with no scene while the context is the frame's, so a
 * warm-up compiling it under its scene would otherwise build a program the shadow pass never asks for, and the cast
 * builds its own in the frame (Pine's forest LODs at activation).
 */
function depthStockKey(material: THREE.Material, receive: boolean): string {
  if (!(material instanceof NodeMaterial)) throw new Error('A graph depth variant is a node material');
  return `${NodeMaterial.prototype.customProgramCacheKey.call(material)}|depth|${String(receive)}`;
}

/** a node material's whole program key: the stock key, the engine's output transform, the object shape, its fog and layer */
function wholeKey(stock: string, toneMapped: boolean, rawOutput: boolean, objectKey: string, fog: { readonly id: string } | null, layer: { readonly whole: boolean } | null): string {
  return `${stock}|${PROGRAM_KEY}|${toneMapped ? 'tm' : 'raw'}${rawOutput ? '|out:raw' : ''}|${objectKey}${fog === null ? '' : `|fog:${fog.id}`}${layer === null ? '' : `|layer:${layer.whole ? 'whole' : 'alpha'}`}`;
}

/** one bound target's key context (`EngineNodesHandler.keyContextNow`) */
interface KeyContext {
  top: object; lights: number; readonly scene: object; readonly sceneKey: unknown; readonly shaderShape: string | null;
  readonly toneMapping: THREE.ToneMapping; readonly colorSpace: string; readonly stamp: number;
}
/** the key contexts a material keeps memos for at once (the screen and the targets one frame draws it into) */
const MEMO_CONTEXTS = 4;

/** one material's program keys within one key context and material version (`customProgramCacheKeyCallback`) */
interface StockKeyMemo {
  readonly stamp: number;
  readonly version: number;
  /** the stock key with and without the receive-shadow flag */
  receive: string | undefined;
  plain: string | undefined;
  /** the parts of the whole key the memo was made under; a change empties `keys` */
  fog: { readonly id: string } | null;
  layer: { readonly whole: boolean } | null;
  toneMapped: boolean;
  rawOutput: boolean;
  sceneIndependent: boolean;
  sceneShape: boolean;
  /** each object shape's whole key: [plain, receive] */
  readonly keys: Map<string, [string | undefined, string | undefined]>;
  /** each object shape's final key (patches folded in) and its token: [plain, receive] (`keyToken`) */
  readonly tokens: Map<string, [KeyToken | undefined, KeyToken | undefined]>;
}
/** a final program key and the token that stands for it in `NodeProgramVariants` */
interface KeyToken { readonly final: string; readonly token: object; readonly kept: string; readonly patches: object | null }
/** distinct final program keys holding a token at once (more: the table starts over, and each key's next draw takes a
 *  new token: one cold variant lookup, never a wrong one) */
const KEY_TOKEN_CAP = 1024;

/** WebGLUniforms.setValue(gl, name, value, textures), as `hookPlainUniforms` wraps it */
type UniformSetter = (this: unknown, gl: unknown, name: unknown, value: unknown, textures: unknown) => void;
const isUniformSetter = (value: unknown): value is UniformSetter => typeof value === 'function';

/** builds kept in `EngineNodesHandler.buildLog` */
const BUILD_LOG_CAP = 1024;

/** three's node handler fitted to the engine's frame (the module comment lists what it changes); install it with `loadGraphBackend` */
export class EngineNodesHandler extends WebGLNodesHandler {
  /** the engine epilogue, in order, after the output transform (fog first; then whatever the engine appends) */
  readonly epilogue: EpilogueStage[] = [];
  /** node-material programs this handler built (the validator's and the bench's count) */
  builds = 0;
  /** The last BUILD_LOG_CAP builds, oldest first: when (diagnostic clock) and for which material and object (names
   *  only), elapsed build time and how the build went (`how`: 'reused', or why it was built in full: 'first of its key', 'no graph shape',
   *  'no reuse key', a pairing refusal; '+ kept' when a full build was kept for reuse). The frame floor attributes them
   *  to runtime hooks: a build after an entry's warm-up is a missed warm program.
   *  prepareMs covers shape/key/reuse lookup; frontendMs is only the stock
   *  builder call (null on reuse), both within the existing total ms. */
  readonly buildLog: { at: number; ms: number; prepareMs: number; frontendMs: number | null; material: string; object: string; how: string; census?: BuildCensus }[] = [];
  /** each `buildLog` row's program parameters (`reuseKey`: the object class, the custom key's tail, the parameters and
   *  defines), at the same index; '' where none could be read. Two builds of one material diff here (what moved its key). */
  readonly buildKeys: string[] = [];
  /** program key asks (customProgramCacheKey) and those that built a new whole key string (outside a render call, or a
   *  memo miss): a diagnostic, as the build log; a warm frame should build next to none */
  keyAsks = 0;
  keyBuilds = 0;
  /** the token of the program key the last customProgramCacheKey ask returned (null: a key no memo kept) */
  private lastKeyToken: object | null = null;
  /** one token per distinct final program key (`KeyToken`) */
  private readonly keyTokens = new Map<string, object>();
  private readonly textureUpdates: TextureUpdates;
  private readonly frame: NodeFrame;
  /** The material's active program view, including its validated block list. */
  private readonly drawEntries = new WeakMap<THREE.Material, DrawEntry>();
  /**
   * The draw whose plain uniforms wait for its program to be in use (`flushPlainUniforms`): plain uniforms are program
   * state, written to the CURRENT program, and onBeforeRender / onUpdateProgram run before setProgram's useProgram.
   */
  private pendingPlain: { readonly program: unknown; readonly linked: WebGLProgram; readonly groups: readonly BlockGroup[]; readonly pass: number } | null = null;
  /** three programs whose uniform setter flushes the pending plain uniforms */
  private readonly plainHooked = new WeakSet();
  /** ms spent in the node builder (JS), summed */
  buildMs = 0;
  /** builds that reused an equal program's earlier build (`nodeBuildReuse.ts`) */
  reuses = 0;
  /** per reuse key, the last full build and its material */
  private readonly reusable = new Map<string, WeakRef<THREE.Material>>();
  /** each such material's full build, held by the material itself: a key never keeps a retired region's material or its
   *  nodes alive (live P0: Driftwood -> Sky Reach -> Driftwood), and a disposed material's build goes with it */
  private readonly reusableBuilds = new WeakMap<THREE.Material, { readonly binding: SceneBinding | null; readonly output: BuildOutput; readonly shape: GraphShape; readonly lazy: readonly LazyUniform[]; readonly builtSince: number }>();
  /** each such material's reuse key */
  private readonly reusableKeys = new WeakMap<THREE.Material, string>();
  /** per reuse key, a disposed source's build kept as code and positions (`keepBuild`: no nodes, textures or values of
   *  its region), oldest first; bounded by KEPT_BUILDS entries and KEPT_BYTES */
  private readonly keptBuilds = new Map<string, { readonly build: KeptBuild; readonly binding: Omit<SceneBinding, 'parameters'> | null; readonly height: number | null }>();
  private keptBytes = 0;
  /** reuses served from a kept build (a re-entered region's programs) */
  keptReuses = 0;
  /** kept builds a compile of their key could not use, by reason (`+scene`, `+lights`, `+fog`, `+environment`, `+key`, or
   *  `released:<kind>` for a collected scene node, named by its kind); a diagnostic the frame floor reads (grid-crossing T2) */
  readonly keptMisses: Record<string, number> = {};
  /** scene-binding refreshes served by moving a program's environment uniforms to the new environment, with no build
   *  (`rebindEnvironment`); a diagnostic */
  environmentRebinds = 0;
  /** each graph material's shape, read before its first build touched its nodes */
  private readonly shapes = new WeakMap<THREE.Material, GraphShape>();
  /** programShare: graph shapes whose builds wrote other code under one shared key (they key by their own nodes) */
  private readonly unshared = new Set<string>();
  /** programShare: each shared build key's code, as a length and hash */
  private readonly sharedCode = new Map<string, string>();
  private real: Renderer | null = null;
  private bindingFacts: { readonly stamp: number; readonly context: object; readonly scene: object; readonly rawKey: unknown; readonly lights: string; readonly inputs: SceneInputs | null } | null = null;
  private readonly sceneShaderKeys = new SceneShaderKeys();
  private readonly graphCodeKeys = new GraphCodeKeys();
  private readonly sceneBindings = new WeakMap<THREE.Material, Map<unknown, SceneBinding>>();
  private warnedLevelFog = false;
  /** the node programs' uniforms, sent per draw as plain program uniforms (`nodePlainUniforms.ts`); null without a WebGL 2
   *  context */
  private blocks: NodePlainUniforms | null = null;
  /** builds of each material not yet paired with their programs (see `onUpdateProgram`) */
  private readonly pendingBuilds = new WeakMap<object, PendingBuild[]>();
  private readonly objectVariants = new NodeProgramVariants();
  /** each classic PMREM environment's upright node (`ClassicPMREMNode`) */
  private readonly environments = new WeakMap<THREE.Texture, Node>();
  /** the stock program keys per material, one memo per key context it drew under (`customProgramCacheKeyCallback`) */
  private readonly stockKeys = new WeakMap<THREE.Material, StockKeyMemo[]>();
  /**
   * What a program key's scene and output parts are computed under, per bound target (null: the screen): the render call
   * (its stack entry), the lights, the scene context's hash and the renderer's output transform. A target keeps its own
   * stamp, so a frame that alternates targets keeps every material's key for each; a stamp advances whenever its scene
   * hash or output transform moves, so a target bound inside one render call (or a light update) never reuses a key
   * computed for another target (sp-o286, sp-o290).
   */
  private readonly keyContexts = new WeakMap<THREE.RenderTarget, KeyContext>();
  private screenKeyContext: KeyContext | null = null;
  /** the last key context's stamp (`keyContextNow`) */
  private keyContextStamp = 0;
  /** advances at every `updateLights`: the key context's validity */
  private lightsStamp = 0;

  constructor() {
    super();
    const textureFrame: unknown = Reflect.get(this, 'nodeFrame');
    if (!(textureFrame instanceof NodeFrame)) throw new Error('Missing node frame');
    this.frame = textureFrame;
    const textures = new TextureUpdates(textureFrame); this.textureUpdates = textures;
    Reflect.set(this, 'updateNodes', (nodes: unknown): void => { textures.update(nodes); });
    installNodeCoarseMask(nodeCoarseMask);
    installNodeLayerFrame(nodeLayerFrame);
    const self = internals(this);
    // the stock per-draw and dispose callbacks, as three writes them, plus the engine's uniform blocks: every draw binds
    // its program's blocks once their nodes are updated, and a disposed material's blocks free their buffers
    const before = (material: THREE.Material, object: THREE.Object3D): void => { this.beforeDraw(material, object); };
    const disposed = (material: THREE.Material): void => { this.disposeMaterial(material); };
    self.onBeforeRenderCallback = function onBeforeRenderCallback(this: THREE.Material, _renderer, _scene, _camera, _geometry, object): void { before(this, object); };
    const onDisposeMaterialCallback = function onDisposeMaterialCallback(this: THREE.Material): void { disposed(this); };
    self.onDisposeMaterialCallback = onDisposeMaterialCallback; this.disposeListener = onDisposeMaterialCallback;
    // Only new bindings need the stock handler's geometry refresh. A rebind
    // keeps uploaded-only buffers and live memos; it is not a retirement.
    self.updateGeometryAttributes = function updateGeometryAttributes(builder: unknown, geometry: THREE.BufferGeometry): void {
      const attributes: unknown = typeof builder === 'object' && builder !== null ? Reflect.get(builder, 'bufferAttributes') : undefined;
      if (!Array.isArray(attributes)) throw new Error('Node build carries no buffer attribute list');
      let changed = false;
      for (const entry of attributes) {
        const name: unknown = Reflect.get(entry, 'name'), node: unknown = Reflect.get(entry, 'node');
        const attribute: unknown = typeof node === 'object' && node !== null ? Reflect.get(node, 'attribute') : undefined;
        if (typeof name !== 'string' || !(attribute instanceof THREE.BufferAttribute || attribute instanceof THREE.InterleavedBufferAttribute)) throw new Error('Node buffer attribute is malformed');
        if (geometry.getAttribute(name) !== attribute) { geometry.setAttribute(name, attribute); changed = true; }
      }
      if (changed) queueMicrotask(() => { rebindGeometry(geometry); });
    };
    self.getOutputCallback = (outputNode, builder) => {
      const renderer = this.classicRenderer();
      const { toneMapping, colorSpace } = outputTransform(renderer);
      const material = builder.material;
      // Shadow targets store native depth, never display colour/fog/layer fades.
      if (material.userData['graphDepthVariant'] === true) return outputNode;
      // an unlit graph writes its colour as the GLSL program it stands for did (module comment, 1): no output transform
      let out: Node<'vec4'> = outputNode;
      if (material.userData['graphRawOutput'] !== true) {
        let mapped: Node = outputNode;
        if (material.toneMapped && toneMapping !== THREE.NoToneMapping) mapped = outputNode.toneMapping(toneMapping);
        out = asVec4(workingToColorSpace(mapped, colorSpace));
      }
      // an opaque graph's written alpha (`surface.targetAlpha`, module comment, 1): three forces an opaque draw's alpha
      // to 1, where the GLSL program it stands for wrote its own (a renderer's inverse view depth, read by its post)
      const targetAlpha: unknown = Reflect.get(material, 'graphTargetAlpha');
      if (typeof targetAlpha === 'object' && targetAlpha !== null && isNode(targetAlpha) && !material.transparent) out = vec4(out.xyz, new ConvertNode<'float'>(targetAlpha, 'float'));
      const ctx: EpilogueContext = { builder, material, fog: fogOf(builder), renderer };
      for (const stage of this.epilogue) out = stage(out, ctx);
      return out;
    };
    // the program follows the bound target and the material's tone-mapping flag, as classic programs do
    const stockKey = self.customProgramCacheKeyCallback;
    const frame = (): unknown => Reflect.get(this, 'nodeFrame');
    // The stock key walks every own property of the material and hashes its node children, and the warm draw path asks
    // for it on every draw (shadow casts too): on Safari that walk was a large share of a Driftwood frame (sp-o276).
    // It is computed once per material, receive-shadow flag and key context (scene hash, bound target, output transform:
    // `keyContextNow`), and again whenever the material's version moves.
    const stockKeys = this.stockKeys, keyContext = (): number => this.keyContextNow();
    const asked = (): void => { this.keyAsks++; this.lastKeyToken = null; }, built = (): void => { this.keyBuilds++; };
    // the final key's token: the slot's own while its key holds (`===`: a pointer test for the kept string), else the
    // table's for that key text (one whole-key lookup a new slot), so equal keys share a token across memos
    const tokens = this.keyTokens, reuse = (token: object): void => { this.lastKeyToken = token; };
    const tokened = (memo: StockKeyMemo, objectKey: string, slot: 0 | 1, final: string, kept: string, patches: object | null): string => {
      let row = memo.tokens.get(objectKey);
      if (row === undefined) { row = [undefined, undefined]; memo.tokens.set(objectKey, row); }
      const held = row[slot];
      if (held !== undefined && held.final === final) { this.lastKeyToken = held.token; return final; }
      let token = tokens.get(final);
      if (token === undefined) { if (tokens.size >= KEY_TOKEN_CAP) tokens.clear(); token = {}; tokens.set(final, token); }
      row[slot] = { final, token, kept, patches }; this.lastKeyToken = token;
      return final;
    };
    // The stock key with its leading material hash (the hash of its node ids) replaced by its graph's shape (G669 DR8).
    // three's key is materialHash + sceneHash + rendererHash + objectHash, and its material hash is the class's own
    // customProgramCacheKey: the tail is read through a stand-in whose class hash is empty, so a shared graph's key walks no
    // node ids at all (computing the hash to cut it off walked them twice a memo miss)
    const blankHash = { prototype: { customProgramCacheKey: (): string => '' } };
    const sharedStock = (material: THREE.Material, receive: boolean, sceneIndependent: boolean, sceneShape: boolean): string => {
      const lead = this.shareKeyOf(material);
      if (lead === null) return stockKey.call(material);
      // A certified unlit graph reads neither scene lights/environment nor fog. Stock SceneContext still hashes
      // their fresh node/light IDs on every region entry, retaining equivalent programs on a shared material.
      // Explicit material inputs and layer bindings keep the original boundary; target/receive/object/patch facts
      // remain in this key and wholeKey. The compiler excludes explicit scene inputs, including nested loops.
      if (sceneIndependent)
        return `${lead}|scene:none|${internals(this).renderer.getCacheKey()}${String(receive)}`;
      const scene = internals(this).renderStack.at(-1)?.sceneContext;
      const stable = sceneShape && scene !== undefined ? this.sceneShaderKeys.key(scene.scene, scene.lightsNode.getBuiltinLights()) : null;
      if (stable !== null) return `${lead}|scene:shape:${stable}|${internals(this).renderer.getCacheKey()}${String(receive)}`;
      const bare: unknown = Object.create(material, { constructor: { value: blankHash } });
      const tail: unknown = Reflect.apply(stockKey, bare, []);
      return typeof tail === 'string' ? lead + tail : stockKey.call(material);
    };
    self.customProgramCacheKeyCallback = function customProgramCacheKeyCallback(this: THREE.Material): string {
      const current = frame();
      const object: unknown = typeof current === 'object' && current !== null ? Reflect.get(current, 'object') : undefined;
      const layer = layerFrameOf(this);
      const bound = materialNodeFogOf(this) ?? fogPatches().at(-1);
      const fog = bound?.node === undefined ? null : bound;
      const receive = object instanceof THREE.Object3D && object.receiveShadow;
      const stamp = keyContext();
      asked();
      const rawOutput = this.userData['graphRawOutput'] === true, objectKey = nodeObjectKey(object);
      const depth = this.userData['graphDepthVariant'] === true, patches = shaderPatchSet(this);
      const sceneIndependent = this instanceof MeshBasicNodeMaterial && this.userData['graphSceneIndependent'] === true
        && !this.fog && this.envMap === null && this.envNode === null && this.lightsNode === null
        && layer === null && patches === null;
      const sceneShape = this instanceof NodeMaterial && Reflect.get(this, 'envMap') === null
        && this.envNode === null && this.lightsNode === null && shaderPatchSceneShape(this);
      if (stamp < 0) { built(); return shaderPatchProgramKey(this, wholeKey(depth ? depthStockKey(this, receive) : sharedStock(this, receive, sceneIndependent, sceneShape), this.toneMapped, rawOutput, objectKey, fog, layer)); }
      let memos = stockKeys.get(this);
      if (memos === undefined || memos[0]?.version !== this.version) { memos = []; stockKeys.set(this, memos); }
      let memo: (typeof memos)[number] | undefined; // a loop, not find(): no closure made on every draw
      for (let i = 0; i < memos.length; i++) if (memos[i]?.stamp === stamp) { memo = memos[i]; break; }
      if (memo === undefined) {
        memo = { stamp, version: this.version, receive: undefined, plain: undefined, fog, layer, toneMapped: this.toneMapped, rawOutput, sceneIndependent, sceneShape, keys: new Map(), tokens: new Map() };
        // a few key contexts a frame (the screen and its targets); a context that moved on drops out first
        if (memos.length >= MEMO_CONTEXTS) memos.shift();
        memos.push(memo);
      } else if (memo.fog !== fog || memo.layer !== layer || memo.toneMapped !== this.toneMapped || memo.rawOutput !== rawOutput || memo.sceneIndependent !== sceneIndependent || memo.sceneShape !== sceneShape) {
        if (memo.sceneIndependent !== sceneIndependent || memo.sceneShape !== sceneShape) { memo.receive = undefined; memo.plain = undefined; }
        memo.sceneShape = sceneShape; memo.sceneIndependent = sceneIndependent; memo.fog = fog; memo.layer = layer; memo.toneMapped = this.toneMapped; memo.rawOutput = rawOutput; memo.keys.clear(); memo.tokens.clear();
      }
      // the whole key, kept per object shape and receive flag while its other parts hold (warm draws ask on every draw)
      let shape = memo.keys.get(objectKey);
      if (shape === undefined) { shape = [undefined, undefined]; memo.keys.set(objectKey, shape); }
      const slot = receive ? 1 : 0, kept = shape[slot];
      if (kept !== undefined) {
        // the slot's final key while its kept key and the material's patch set are the same objects: no key text compared
        // (a node key runs to hundreds of KB: 43 of 4270 samples of a steady Nalati Simulator profile compared it)
        const held = memo.tokens.get(objectKey)?.[slot];
        if (held !== undefined && held.kept === kept && held.patches === patches) { reuse(held.token); return held.final; }
        return tokened(memo, objectKey, slot, shaderPatchProgramKey(this, kept), kept, patches);
      }
      let stock = receive ? memo.receive : memo.plain;
      if (stock === undefined) { stock = depth ? depthStockKey(this, receive) : sharedStock(this, receive, sceneIndependent, sceneShape); if (receive) memo.receive = stock; else memo.plain = stock; }
      const key = wholeKey(stock, this.toneMapped, rawOutput, objectKey, fog, layer); shape[slot] = key; built();
      return tokened(memo, objectKey, slot, shaderPatchProgramKey(this, key), key, patches);
    };
    this.epilogue.push((out, ctx) => {
      const bound = materialNodeFogOf(ctx.material);
      const patch = bound === undefined ? fogPatches().at(-1)?.node : bound.node;
      if ((!this.engineFogOn() && patch === undefined) || Reflect.get(ctx.material, 'fog') !== true || ctx.fog === null) return out;
      const scale: unknown = Reflect.get(ctx.material, 'graphFogScale');
      const node = typeof scale === 'object' && scale !== null && isNode(scale) ? new ConvertNode<'float'>(scale, 'float') : undefined;
      if (patch === undefined) return engineFog(out, ctx.fog, node);
      // only a trusted function patch reads the engine fog (the colour ramp computes its own): build it only for one
      const engine = typeof patch === 'function' ? engineFog(out, ctx.fog, node) : out;
      const origin = bound?.origin ?? layerFrameOf(ctx.material)?.origin;
      const shift = origin === undefined ? null : reference('value', 'vec3', origin);
      const fogContext = { engine, fog: ctx.fog, position: shift === null ? positionWorld : positionWorld.sub(shift),
        camera: shift === null ? cameraPosition : cameraPosition.sub(shift), ...(node === undefined ? {} : { scale: node }) };
      return typeof patch === 'function' ? patch(out, fogContext) : colourRampFog(out, fogContext, patch.colourRamp);
    });
    // a layered backdrop's node dressing fades by its owner weight last, where a classic piece's gl_FragColor is faded
    this.epilogue.push((out, ctx) => {
      const layer = layerFrameOf(ctx.material);
      if (layer === null) return out;
      const fade = reference('value', 'float', layer.fade);
      return layer.whole ? out.mul(fade) : vec4(out.xyz, out.w.mul(fade));
    });
  }

  /**
   * The stamp of the current key context (`keyContext`): the same number while the scene context and its hash (lights,
   * environment, fog), the bound target and the output transform stay put, across render calls; a new one when any moves;
   * -1 where no key may be kept (outside a render call, or an XR target, whose output space is its texture's and may move
   * without the target changing).
   */
  private keyContextNow(): number {
    const top = internals(this).renderStack.at(-1), renderer = this.real;
    if (top === undefined || renderer === null) return -1;
    const target = renderer.getRenderTarget();
    if (target !== null && Reflect.get(target, 'isXRRenderTarget') === true) return -1;
    const c = target === null ? this.screenKeyContext : this.keyContexts.get(target);
    const same = c !== undefined && c !== null && c.toneMapping === renderer.toneMapping && c.colorSpace === renderer.outputColorSpace;
    if (same && c.top === top && c.lights === this.lightsStamp) return c.stamp;
    // A new render call or light update: the stock key's scene part is the scene context's hash (its lights, environment
    // and fog), read once here; an unchanged hash keeps the stamp, so a material's key outlives the render call.
    const scene = top.sceneContext, sceneKey = scene.getCacheKey();
    const shaderShape = this.sceneShaderKeys.key(scene.scene, scene.lightsNode.getBuiltinLights());
    if (same && c.scene === scene && c.sceneKey === sceneKey && c.shaderShape === shaderShape) { c.top = top; c.lights = this.lightsStamp; return c.stamp; }
    const next: KeyContext = { top, lights: this.lightsStamp, scene, sceneKey, shaderShape, toneMapping: renderer.toneMapping, colorSpace: renderer.outputColorSpace, stamp: ++this.keyContextStamp };
    if (target === null) this.screenKeyContext = next; else this.keyContexts.set(target, next);
    return next.stamp;
  }

  override renderEnd(): void { try { super.renderEnd(); } finally { this.bindingFacts = null; this.textureUpdates.endRender(); this.blocks?.invalidateBindings(); } }

  /** Clone-safe optional attributes use the renderer's existing constant-value binding. */
  override setObject(object: THREE.Object3D, material: THREE.Material): void {
    prepareGraphAttributeDefaults(material);
    super.setObject(object, material);
  }

  /** the classic renderer this handler serves (after `renderer.setNodesHandler(handler)`) */
  classicRenderer(): Renderer {
    if (this.real === null) throw new Error('EngineNodesHandler: renderer.setNodesHandler(handler) first');
    return this.real;
  }

  /** bind to the renderer (`renderer.setNodesHandler` calls it); the program key follows the bound target from here */
  override setRenderer(renderer: Renderer): void {
    const previous = this.real;
    super.setRenderer(renderer);
    this.real = renderer;
    // Shader-only hosts have no buffer draw to wrap. Real renderers install it in their constructor.
    const stock: unknown = Reflect.get(renderer, 'renderBufferDirect');
    if (previous !== renderer && typeof stock === 'function') {
      const draw = renderer.renderBufferDirect.bind(renderer);
      renderer.renderBufferDirect = (camera, scene, geometry, material, object, group): void => {
        // Ordinary draws need no shadow continuation closure.
        if (!(material instanceof THREE.MeshDepthMaterial || material instanceof THREE.MeshDistanceMaterial)) {
          if (!(material instanceof NodeMaterial)) this.blocks?.invalidateBindings();
          draw(camera, scene, geometry, material, object, group); return;
        }
        // A shadow cast: the stock depth material, or a vertex-moving graph's own depth variant (no closure per cast)
        const depth = this.shadowCasterDepth(material, object, group);
        if (depth === null) { this.blocks?.invalidateBindings(); draw(camera, scene, geometry, material, object, group); return; }
        this.drawShadow(camera, depth, object, () => { draw(camera, scene, geometry, depth, object, group); });
      };
    }
    // precompile's shadow jobs compile the variant this handler's shadow draws use (sp-o289)
    registerShadowDepthResolver(renderer, (source, depthStock) => this.shadowDepthOf(source, depthStock));
    const gl: unknown = renderer.getContext();
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) this.blocks = new NodePlainUniforms(gl);
    // the stock key reads the renderer's tone mapping and output space whatever is bound; the engine's follows the target
    const proxy: unknown = Reflect.get(this, 'renderer');
    if (typeof proxy === 'object' && proxy !== null) {
      // every DirectionalLight lights node materials through the engine's node: a registered cascade gets the CSM gate
      // (cascadeLightNode.ts). The handler owns its node library, so nothing else sees the swap.
      const library: unknown = Reflect.get(proxy, 'library');
      const lightNodes: unknown = typeof library === 'object' && library !== null ? Reflect.get(library, 'lightNodes') : null;
      if (lightNodes instanceof WeakMap) {
        lightNodes.set(THREE.DirectionalLight, EngineDirectionalLightNode);
        // and every PointLight through the engine's, its direct term one shared layout function (pointLightNode.ts)
        lightNodes.set(THREE.PointLight, EnginePointLightNode);
      }
      Reflect.set(proxy, 'getCacheKey', () => {
        const { toneMapping, colorSpace } = outputTransform(renderer);
        return `${String(toneMapping)}:${colorSpace}`;
      });
    }
  }

  /** One owned depth variant per material, including independent clones; never per frame. */
  private readonly shadowDepths = new WeakMap<NodeMaterial, GraphShadowDepthMaterial>();
  /** materials whose dispose a reused build registered (`applyReused`: no stock build added the stock callback) */
  private readonly reuseDisposals = new WeakSet<THREE.Material>();

  /**
   * The depth variant the shadow pass draws a caster of `source` with, configured from its stock depth material `stock`
   * exactly as that draw configures it, or null where the stock material draws (not a vertex-moving graph). Precompile's
   * shadow jobs compile this same configured variant (`shadowDepthVariants.ts`, sp-o289), so the first shadow draw finds
   * its program issued and linked instead of building and querying it inside a travel frame.
   */
  shadowDepthOf(source: unknown, stock: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial): GraphShadowDepthMaterial | null {
    if (!(source instanceof NodeMaterial) || source.userData['graphShadowDepth'] !== true) return null;
    let depth = this.shadowDepths.get(source);
    if (depth === undefined) {
      depth = new GraphShadowDepthMaterial();
      depth.name = 'graph:shadow-depth'; depth.userData['graphDepthVariant'] = true;
      // MeshBasicNodeMaterial enables lighting internally; a depth caster must
      // never receive the very shadow map currently bound as its framebuffer.
      depth.lights = false;
      depth.colorNode = vec3(1); depth.fog = false; depth.toneMapped = false;
      this.shadowDepths.set(source, depth);
      const lifetime = new Scope('graph:shadow-depth');
      lifetime.own(depth);
      lifetime.listenOnceEmitter(source, 'dispose', () => { this.shadowDepths.delete(source); lifetime.dispose(); });
    }
    // Nodes and their live uniforms are borrowed; stock selection retains side/clipping/map policy.
    const normal: unknown = Reflect.get(source, 'vertexNormal');
    depth.vertexNormal = typeof normal === 'object' && normal !== null && isNode(normal) ? normal : null;
    copyGraphAttributeDefaults(source, depth);
    depth.contextNode = source.contextNode;
    depth.positionNode = source.positionNode; depth.opacityNode = source.opacityNode;
    depth.maskNode = source.maskNode; depth.alphaTestNode = source.alphaTestNode;
    depth.opacity = source.opacity; depth.side = stock.side; depth.alphaTest = stock.alphaTest;
    for (const key of ['map', 'alphaMap', 'wireframe', 'wireframeLinewidth', 'clippingPlanes', 'clipIntersection', 'clipShadows',
      'displacementMap', 'displacementScale', 'displacementBias'] as const) Reflect.set(depth, key, Reflect.get(stock, key));
    return depth;
  }

  /** the depth variant a shadow cast of `object` draws with in place of the stock depth material `stock`, or null (stock) */
  private shadowCasterDepth(stock: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial, object: THREE.Object3D, group: THREE.GeometryGroup | null): GraphShadowDepthMaterial | null {
    if (!(object instanceof THREE.Mesh)) return null;
    // Explicit custom depth/distance materials belong to their caller.
    if (stock === object.customDepthMaterial || stock === object.customDistanceMaterial) return null;
    const source: unknown = Array.isArray(object.material) ? object.material[group?.materialIndex ?? 0] : object.material;
    return this.shadowDepthOf(source, stock);
  }

  /** The classic shadow map calls renderBufferDirect without the main node callbacks: run them for the depth variant. */
  private drawShadow(camera: THREE.Camera, depth: GraphShadowDepthMaterial, object: THREE.Object3D, draw: () => void): void {
    const top = internals(this).renderStack.at(-1), frame = this.frame;
    if (top === undefined) throw new Error('Graph shadow depth requires an active render');
    const oldCamera = top.camera, savedCamera = frame.camera, savedMaterial = frame.material, savedObject = frame.object;
    top.camera = camera; frame.camera = camera;
    try {
      this.setObject(object, depth);
      this.beforeDraw(depth, object);
      draw();
    } finally {
      top.camera = oldCamera; frame.camera = savedCamera; frame.material = savedMaterial; frame.object = savedObject;
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
    super.renderStart(scene, camera, targetScene); this.textureUpdates.beginRender(); this.blocks?.invalidateBindings();
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
    this.lightsStamp++;
    const lit = lights.some(isCascadeGhost) ? lights.filter((l) => !isCascadeGhost(l)) : lights;
    // a warm-up's copied lights stand for the page's own (compileLights.ts): the program keys and binds those, so the warm
    // builds the program the real draw uses (a phone-4x Nine road drive built one ring tile's material 10-18 times)
    super.updateLights(lit.some(light => compileLightSource(light) !== undefined) ? lit.map(light => compileLightSource(light) ?? light) : lit);
  }

  /** build one node material's program (timed: `builds`, `buildMs`); the build waits to be paired with its program */
  override build(material: THREE.Material, object: THREE.Object3D, parameters: THREE.WebGLProgramParametersWithUniforms): void {
    withNodeChildSnapshots(() => { this.buildProgram(material, object, parameters); });
  }

  private buildProgram(material: THREE.Material, object: THREE.Object3D, parameters: THREE.WebGLProgramParametersWithUniforms): void {
    const t0 = diagnosticNow();
    // graph materials only (their compile owns its nodes); the shape is read before the build touches the graph
    const owner = material instanceof NodeMaterial && !parameters.skinning && !parameters.morphTargets ? graphNodeOwner(material) : undefined;
    let shape = owner === undefined ? null : this.shapes.get(material) ?? null;
    if (owner !== undefined && shape === null) { shape = graphShape(material, owner); this.shapes.set(material, shape); }
    const program = shape === null ? null : reuseKey(parameters, object, material, this.shareKeyOf(material));
    const key = shape === null || program === null ? null : `${program}\n${shape.signature}`;
    const reused = key === null || shape === null ? null : this.reusedBuild(key, material, object, shape);
    let how = shape === null ? 'no graph shape' : key === null ? 'no reuse key' : typeof reused === 'string' ? reused : 'first of its key';
    const prepareMs = diagnosticNow() - t0;
    let frontendMs: number | null = null, made: ReturnType<typeof recordBuild> | null = null;
    if (typeof reused === 'object' && reused !== null) { this.applyReused(material, object, parameters, reused); this.reuses++; how = 'reused'; }
    else {
      // the build's own scene-side nodes are the ones made after this (`keepBuild`'s held uniforms)
      const builtSince = key === null ? 0 : newestNodeId();
      const buildFrontend = (): void => {
        const frontendAt = diagnosticNow();
        // G717.O3.1: the harness's census pin records the nodes the build makes (measurement only; off when shipped)
        if (harnessPins()?.nodeBuildCensus === true) made = recordBuild(() => { super.build(material, object, parameters); });
        else super.build(material, object, parameters);
        frontendMs = diagnosticNow() - frontendAt;
      };
      if (material instanceof NodeMaterial) buildWithInstanceAttributes(material, buildFrontend);
      else buildFrontend();
      const real = key === null ? null : captureBuild(Reflect.get(material, '_latestBuilder'));
      if (key !== null && real !== null && shape !== null && owner !== undefined) {
        const { lazy, rest: unbound } = lazyReads(unboundReads(real, material, owner), owner);
        if (unbound.length === 0) { this.reusable.set(key, new WeakRef(material)); this.reusableKeys.set(material, key); this.reusableBuilds.set(material, { output: real, shape, lazy, builtSince, binding: this.sceneBinding(parameters, Reflect.get(material, '_latestBuilder')) }); how += ' + kept'; }
      }
    }
    this.disposeFirst(material);
    parameters.vertexShader = instanceAttributeShader(parameters.vertexShader, object, parameters.extensionMultiDraw);
    // Three's classic node builder hardcodes GL_POINTS to one pixel. A compiler-owned
    // size property replaces only that epilogue; content still supplies no shader code.
    if (material.userData['graphPointSize'] === true) {
      if (!(object instanceof THREE.Points)) throw new Error('Points graph requires a Points object');
      const shader = parameters.vertexShader;
      if (!shader.includes('float wildshardGraphPointSize;') || !shader.includes('gl_PointSize = 1.0;')) throw new Error('Missing graph point-size output');
      parameters.vertexShader = shader.replace('gl_PointSize = 1.0;', 'gl_PointSize = wildshardGraphPointSize;');
    }
    const buildMs = diagnosticNow() - t0;
    this.buildMs += buildMs;
    this.builds++;
    if (this.buildLog.length >= BUILD_LOG_CAP) { this.buildLog.shift(); this.buildKeys.shift(); }
    const censusOutput = made === null ? null : captureBuild(Reflect.get(material, '_latestBuilder'));
    this.buildLog.push({ at: t0, ms: buildMs, prepareMs, frontendMs, material: material.name || material.type, object: object.name || object.type, how,
      ...(made === null || censusOutput === null ? {} : { census: buildCensus(censusOutput, shape, made) }) });
    this.buildKeys.push(program ?? reuseKey(parameters, object, material, this.shareKeyOf(material)) ?? '');
    // WebGLRenderer.getProgram calls build only for a key its material has no program for, then files the acquired
    // program under that key: the program lands at the map's current size
    const builder: unknown = Reflect.get(material, '_latestBuilder');
    const properties: unknown = this.classicRenderer().properties.get(material);
    const programs: unknown = typeof properties === 'object' && properties !== null ? Reflect.get(properties, 'programs') : undefined;
    const pending = this.pendingBuilds.get(material) ?? [];
    const updateNodes: unknown = typeof builder === 'object' && builder !== null ? Reflect.get(builder, 'updateNodes') : undefined;
    const uniformsGroups = classicModelUniform(parameters, internals(this).collectUniformsGroups(builder).filter(isBlockGroup));
    stableBufferNames(builder, parameters, uniformsGroups);
    this.blocks?.declare(parameters, uniformsGroups.filter(isBlockGroup));
    // Compare the emitted code after stable buffer naming and uniform lowering.
    // Transient NodeBuffer IDs differ between equal array-backed graphs.
    if (key !== null && shape !== null && this.shareKeyOf(material) !== null) {
      const code = codeHash(`${parameters.vertexShader}\0${parameters.fragmentShader}`), seen = this.sharedCode.get(key);
      if (seen === undefined) this.sharedCode.set(key, code);
      else if (seen !== code) {
        this.unshared.add(shape.signature);
        console.warn(`[programShare] ${material.name || material.type} wrote other code under a shared program key: it keys by its own nodes from now on`);
      }
    }
    pending.push({ binding: this.sceneBinding(parameters, builder), uniformsGroups, updateNodes,
      uniforms: parameters.uniforms, programs, slot: programs instanceof Map ? programs.size : -1 });
    // A cold precompile may never draw. Retain only the stock fallback's runtime
    // view, not the builder's graph caches, source strings, scene and geometry.
    if (typeof builder === 'object' && builder !== null) {
      const uniformGroups: Record<string, { uniforms: { nodeUniform: unknown }[] }> = {};
      for (const group of uniformsGroups) if (isBlockGroup(group)) {
        uniformGroups[group.name] = { uniforms: group.uniforms.map((nodeUniform: unknown) => ({ nodeUniform })) };
      }
      Reflect.set(material, '_latestBuilder', { uniformGroups, uniforms: { vertex: [], fragment: [] }, updateNodes });
    }
    this.pendingBuilds.set(material, pending);
  }

  /**
   * A graph material's program key leads with its type and a bounded exact name
   * for its graph's shape (`graphShape`: every node its compile made, with its class, code-bearing fields, constants
   * and texture kinds) instead of the hash of its node ids: three files programs by key (acquireProgram), so equal graphs
   * under the same scene, target, fog, layer and object then link ONE GL program, each material with its own uniforms.
   * Null (its own nodes key it) for any other material, or a shape whose builds wrote other code under one key.
   */
  private shareKeyOf(material: THREE.Material): string | null {
    if (!(material instanceof NodeMaterial)) return null;
    const owner = graphNodeOwner(material);
    if (owner === undefined) return null;
    let shape = this.shapes.get(material);
    if (shape === undefined) { shape = graphShape(material, owner); this.shapes.set(material, shape); }
    return this.unshared.has(shape.signature) ? null : `${material.type}~${this.graphCodeKeys.key(shape)}`;
  }

  /** the build an earlier material of the same program key and graph shape left, bound to `material`'s own nodes; null
   *  without one, the reason when they cannot be bound (`nodeBuildReuse.ts`) */
  private reusedBuild(key: string, material: THREE.Material, object: THREE.Object3D, shape: GraphShape): BuildOutput | string | null {
    const source = this.reusable.get(key)?.deref(), entry = source === undefined ? undefined : this.reusableBuilds.get(source);
    if (source === undefined || entry === undefined) {
      this.reusable.delete(key);
      const kept = this.keptBuilds.get(key);
      if (kept === undefined) return null;
      const mismatch = this.sceneBindingMismatch(kept.binding), roles = kept.build.roles;
      // a build that reads its environment by role binds the current one's (one atlas size), even a new one when nothing
      // else it keeps holds the old
      const bind = roles === 'none' || kept.height === null ? null : this.environmentBinder(kept.height);
      const refused = mismatch !== null && !(mismatch === 'environment' && roles === 'rebindable') ? mismatch
        : roles !== 'none' && bind === null ? 'environment' : null;
      if (refused !== null) { this.keptMisses[refused] = (this.keptMisses[refused] ?? 0) + 1; return null; }
      const restored = restoreBuild(kept.build, shape, object, material, bind ?? undefined);
      if (typeof restored === 'string' && restored.startsWith('released')) { this.keptMisses[restored] = (this.keptMisses[restored] ?? 0) + 1; this.dropKept(key); return null; }
      if (typeof restored === 'string') this.keptMisses[restored] = (this.keptMisses[restored] ?? 0) + 1;
      else this.keptReuses++;
      return restored;
    }
    if (source === material || !this.sameSceneBinding(entry.binding)) return null;
    const twins = pairShapes(entry.shape, shape);
    if (!bindLazy(entry.lazy, twins, object, material)) return 'a reference uniform cannot be made alike';
    return rebindBuild(entry.output, twins) ?? 'a paired uniform is not a uniform node';
  }

  /** the stock build's tail for a reused build: the program's code and uniforms, the material's builder view, the update
   *  nodes' first update (a reused build carries no buffer attributes) */
  private applyReused(material: THREE.Material, object: THREE.Object3D, parameters: THREE.WebGLProgramParametersWithUniforms, output: BuildOutput): void {
    const self = internals(this);
    this.frame.material = material; this.frame.object = object;
    self.updateShaderParameters(output, parameters);
    Reflect.set(material, '_latestBuilder', output);
    // the stock build's dispose callback, as the material's own lifetime (the shadow-depth variants' pattern); first in
    // line like the stock one (`disposeFirst`), so its shader-cache release runs before the renderer's
    if (!material.hasEventListener('dispose', self.onDisposeMaterialCallback) && !this.reuseDisposals.has(material)) {
      this.reuseDisposals.add(material);
      const lifetime = new Scope('graph:reused-build');
      lifetime.listenOnceEmitter(material, 'dispose', () => { this.reuseDisposals.delete(material); lifetime.dispose(); this.disposeMaterial(material); });
      const listeners: unknown = Reflect.get(material, '_listeners');
      const list: unknown = typeof listeners === 'object' && listeners !== null ? Reflect.get(listeners, 'dispose') : undefined;
      if (Array.isArray(list)) { const added: unknown = list.pop(); list.unshift(added); }
    }
    self.updateNodes(output.updateNodes);
  }

  /** Native programs share code; their JS uniforms still belong to the scene
   * which supplied them. No strong scene reference is added to the cache. */
  private currentBindingFacts(): NonNullable<EngineNodesHandler['bindingFacts']> | null {
    const scene = internals(this).renderStack.at(-1)?.sceneContext;
    if (scene === undefined) return null;
    const held = this.bindingFacts;
    if (held !== null && held.stamp === this.lightsStamp && held.context === scene) return held;
    const inputs = scene.scene instanceof THREE.Scene ? { fog: scene.scene.fog, environment: scene.scene.environment } : null;
    const next = { stamp: this.lightsStamp, context: scene, scene: compileSceneSource(scene.scene), rawKey: scene.getCacheKey(), inputs,
      lights: scene.lightsNode.getBuiltinLights().map(light => light instanceof THREE.Light ? light.id : '').join(',') };
    this.bindingFacts = next;
    return next;
  }

  /** `builder`: the finished build (its uniforms and update lists, `buildReads`). An input absent when it was built counts
   *  as read: a later one may be what its material lights with. */
  private sceneBinding(parameters: THREE.WebGLProgramParametersWithUniforms, builder: unknown): SceneBinding | null {
    if (typeof parameters.customProgramCacheKey !== 'string' || !parameters.customProgramCacheKey.includes('|scene:shape:')) return null;
    const facts = this.currentBindingFacts();
    if (facts === null) return null;
    const inputs = facts.inputs, environmentNode: unknown = typeof builder === 'object' && builder !== null ? Reflect.get(builder, 'environmentNode') : undefined;
    const reads = (input: object | null, node?: unknown): boolean => input === null
      || buildReads(builder, typeof node === 'object' && node !== null ? [input, node] : [input]);
    return { scene: new WeakRef(facts.scene), rawKey: facts.rawKey, lights: facts.lights,
      inputs: inputs === null ? null : { fog: inputs.fog === null ? null : new WeakRef(inputs.fog),
        environment: inputs.environment === null ? null : new WeakRef(inputs.environment),
        reads: { fog: reads(inputs.fog), environment: reads(inputs.environment, environmentNode) } }, parameters };
  }

  private sameSceneBinding(binding: Omit<SceneBinding, 'parameters'> | null): boolean {
    return this.sceneBindingMismatch(binding) === null;
  }

  private sceneBindingMismatch(binding: Omit<SceneBinding, 'parameters'> | null): string | null {
    if (binding === null) return null;
    const facts = this.currentBindingFacts();
    if (facts === null) return 'frame';
    let mismatch = '';
    if (binding.scene.deref() !== facts.scene) mismatch += '+scene';
    if (binding.lights !== facts.lights) mismatch += '+lights';
    // Stock SceneContext recreates its node wrappers after a borrowed fog or
    // environment is restored. The same scene, live resources and source lights
    // still supply the exact bound uniforms; only real owner replacements rebind.
    if (binding.inputs === null || facts.inputs === null) {
      if (binding.rawKey !== facts.rawKey) mismatch += '+key';
    } else {
      // a fog or environment the build never read binds nothing of it: swapping it changes none of its uniforms
      if (binding.inputs.reads.fog && !sameSceneInput(binding.inputs.fog, facts.inputs.fog)) mismatch += '+fog';
      if (binding.inputs.reads.environment && !sameSceneInput(binding.inputs.environment, facts.inputs.environment)) mismatch += '+environment';
    }
    return mismatch === '' ? null : mismatch.slice(1);
  }

  /** A scene with the same shader shape may reuse the native program, but not
   * a previous scene's lights, fog references, environment sampler or updates. */
  private refreshSceneBinding(material: THREE.Material, program: unknown): void {
    const bindings = this.sceneBindings.get(material), binding = bindings?.get(program);
    if (binding === undefined) return;
    const mismatch = this.sceneBindingMismatch(binding);
    if (mismatch === null) return;
    const object: unknown = this.frame.object;
    if (!isDrawObject(object)) return;
    if (mismatch === 'environment' && this.rebindEnvironment(material, program, binding)) return;
    const parameters = { ...binding.parameters };
    this.build(material, object, parameters);
    const logged = this.buildLog.at(-1);
    if (logged !== undefined) logged.how = `scene binding ${mismatch}: ${logged.how}`;
    const pending = this.pendingBuilds.get(material), build = pending?.pop();
    if (pending?.length === 0) this.pendingBuilds.delete(material);
    if (build === undefined || build.binding === null) throw new Error('Missing refreshed scene binding');
    material.onBeforeCompile(parameters, this.classicRenderer());
    const known = internals(this).programCache.get(material), previous = known?.get(program);
    if (known === undefined || previous === undefined) throw new Error('Missing node program binding');
    for (const group of previous.uniformsGroups) {
      if (typeof group !== 'object' || group === null) continue;
      this.blocks?.release(group);
      const dispose: unknown = Reflect.get(group, 'dispose');
      if (typeof dispose === 'function') Reflect.apply(dispose, group, []);
    }
    releaseMaterialReferences(previous.updateNodes, material);
    known.set(program, { uniformsGroups: build.uniformsGroups, uniforms: build.uniforms,
      uniformsList: uniformsListOf(program, build.uniforms), updateNodes: build.updateNodes });
    bindings?.set(program, build.binding);
    this.drawEntries.delete(material);
    Reflect.deleteProperty(material, '_latestBuilder');
  }

  /**
   * A binding refused only for its environment (G782 crossings: a region's sky makes a new PMREM each entry, so every lit
   * program bound on the road or at the last visit refreshed in full, a node build each, at the first entered draw). A
   * build reads a classic PMREM environment through its upright node (`ClassicPMREMNode`, one per texture), and of that
   * node only its atlas sampler and the atlas' texel width, height and top mip: the code is the environment's cube-UV
   * layout, not its texture. When both environments are classic PMREMs of one size, the program's uniforms move to the
   * new environment's node in place of a build. Anything else that holds the old environment (a uniform group, an update
   * node, another uniform) keeps the full refresh. False when it could not rebind.
   */
  /** The current scene's classic PMREM node for each environment role a kept build reads (`environmentRoles`), when that
   *  environment is a cube-UV atlas of `height`; null otherwise. Each sample role gets its own fresh sample. */
  private environmentBinder(height: number): ((role: string) => Node | null) | null {
    const texture = this.currentBindingFacts()?.inputs?.environment;
    if (!isTexture(texture) || texture.mapping !== THREE.CubeUVReflectionMapping || atlasHeight(texture) !== height) return null;
    let node = this.environments.get(texture);
    if (node === undefined) { node = nodeObject(new ClassicPMREMNode(texture)); this.environments.set(texture, node); }
    const update: unknown = Reflect.get(node, 'updateBefore');
    if (typeof update !== 'function') return null;
    Reflect.apply(update, node, [this.frame]);
    const pmrem = node, sampler: unknown = Reflect.get(pmrem, '_texture');
    return role => {
      if (role === 'environment:sample') return sampler instanceof TextureNode ? freshSample(sampler, texture) : null;
      const value: unknown = role.startsWith('environment:') ? Reflect.get(pmrem, role.slice('environment:'.length)) : undefined;
      return isNodeLike(value) && isNode(value) ? value : null;
    };
  }

  private rebindEnvironment(material: THREE.Material, program: unknown, binding: SceneBinding): boolean {
    const before = binding.inputs?.environment?.deref(), after = this.currentBindingFacts()?.inputs?.environment;
    if (!isTexture(before) || !isTexture(after) || before.mapping !== THREE.CubeUVReflectionMapping || after.mapping !== THREE.CubeUVReflectionMapping) return false;
    const height = (texture: THREE.Texture): unknown => { const image: unknown = texture.image; return typeof image === 'object' && image !== null ? Reflect.get(image, 'height') : undefined; };
    const size = height(before);
    if (typeof size !== 'number' || size !== height(after)) return false;
    const old = this.environments.get(before), known = internals(this).programCache.get(material), previous = known?.get(program);
    if (old === undefined || known === undefined || previous === undefined) return false;
    let next = this.environments.get(after);
    if (next === undefined) { next = nodeObject(new ClassicPMREMNode(after)); this.environments.set(after, next); }
    const update: unknown = Reflect.get(next, 'updateBefore');
    if (typeof update !== 'function') return false;
    Reflect.apply(update, next, [this.frame]);
    // the old node's uniforms by id (a proxied node and its target share it), each to the new node's own
    const twins = new Map<unknown, unknown>();
    for (const field of PMREM_FIELDS) {
      const from: unknown = Reflect.get(old, field), to: unknown = Reflect.get(next, field);
      if (!isNodeLike(from) || !isNodeLike(to) || from.constructor !== to.constructor) return false;
      twins.set(Reflect.get(from, 'id'), to);
    }
    const inputs = [before, old], uniforms: Record<string, unknown> = {}, sampler: unknown = Reflect.get(old, '_texture');
    // each moved node by id, for the update nodes that hold it too (a sample keeps its texture's matrix current)
    const replaced = new Map<unknown, unknown>(twins);
    let moved = 0;
    for (const [name, value] of Object.entries(previous.uniforms)) {
      const twin = isNodeLike(value) ? twins.get(Reflect.get(value, 'id')) : undefined;
      if (twin !== undefined) { uniforms[name] = twin; moved++; continue; }
      // a sample of the atlas the build took (TextureNode.sample clones the sampler): its own copy, of the new atlas
      const sample = value === sampler ? null : atlasSample(value, sampler, Reflect.get(next, '_texture'), after);
      if (sample !== null) {
        if (holdsAny([sample], inputs)) return false;
        uniforms[name] = sample; replaced.set(Reflect.get(value as object, 'id'), sample); moved++; continue;
      }
      if (holdsAny([value], inputs)) return false;
      uniforms[name] = value;
    }
    const grouped = previous.uniformsGroups.flatMap((group): unknown[] => {
      const members: unknown = typeof group === 'object' && group !== null ? Reflect.get(group, 'uniforms') : undefined;
      return Array.isArray(members) ? members.map((member: unknown): unknown => typeof member === 'object' && member !== null ? Reflect.get(member, 'node') : member) : [group];
    });
    if (!Array.isArray(previous.updateNodes)) return false;
    const updateNodes = previous.updateNodes.map((node: unknown): unknown => (isNodeLike(node) ? replaced.get(Reflect.get(node, 'id')) : undefined) ?? node);
    if (moved === 0 || holdsAny(grouped, inputs) || holdsAny(updateNodes, inputs)) return false;
    const inputsNow = binding.inputs;
    if (inputsNow === null) return false;
    let uniformsList: unknown[] | undefined;
    known.set(program, { uniformsGroups: previous.uniformsGroups, uniforms,
      get uniformsList(): unknown[] { uniformsList ??= uniformsListOf(program, uniforms); return uniformsList; }, updateNodes });
    this.sceneBindings.get(material)?.set(program, { ...binding, inputs: { ...inputsNow, environment: new WeakRef(after) } });
    this.drawEntries.delete(material);
    this.environmentRebinds++;
    return true;
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
  private pairPrograms(material: THREE.Material, materialProperties: object): void {
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
          if (build.binding !== null) {
            const bindings = this.sceneBindings.get(material) ?? new Map<unknown, SceneBinding>();
            bindings.set(built, build.binding); this.sceneBindings.set(material, bindings);
          }
          // Pair every identity now, but resolve uniforms only when that variant
          // is selected. Querying a different still-linking program here blocks
          // the current road draw before precompile's readiness fence can run.
          const uniforms = build.uniforms;
          let uniformsList: unknown[] | undefined;
          known.set(built, { uniformsGroups: build.uniformsGroups, uniforms,
            get uniformsList(): unknown[] {
              uniformsList ??= uniformsListOf(built, uniforms);
              return uniformsList;
            }, updateNodes: build.updateNodes });
        }
      }
    }
  }

  onUpdateProgram(material: THREE.Material, program: unknown, materialProperties: object): void {
    this.pairPrograms(material, materialProperties);
    this.refreshSceneBinding(material, program);
    const stock: unknown = Reflect.get(WebGLNodesHandler.prototype, 'onUpdateProgram');
    if (typeof stock === 'function') Reflect.apply(stock, this, [material, program, materialProperties]);
    if (internals(this).programCache.get(material)?.has(program) === true) Reflect.deleteProperty(material, '_latestBuilder');
    // Precompile pairing has no renderer version yet and must not claim the
    // last build's program for the current object's variant.
    if (Reflect.get(materialProperties, '__version') === material.version) {
      material.customProgramCacheKey(); const token = this.lastKeyToken;
      if (token !== null) this.objectVariants.record(material, token, materialProperties);
    }
    this.bindBlocks(material, program);
    const frame: unknown = Reflect.get(this, 'nodeFrame');
    this.bindAttributeDefaults(material, typeof frame === 'object' && frame !== null ? Reflect.get(frame, 'object') : undefined, program);
  }

  /** Resolve this linked program's block indices before its first visible draw.
   * Isolated links also pair only this prepared identity; other pending variants
   * keep their own groups. No material selection, uniform upload or draw occurs. */
  prepareProgram(material: THREE.Material, program: Pick<ProgramLike, 'program'>): void {
    const blocks = this.blocks;
    if (blocks === null) return;
    const paired = internals(this).programCache.get(material)?.get(program);
    if (paired !== undefined) blocks.prepare(program.program, paired.uniformsGroups.filter(isBlockGroup));
    for (const build of this.pendingBuilds.get(material) ?? []) {
      if (build.programs instanceof Map && [...build.programs.values()][build.slot] === program) {
        blocks.prepare(program.program, build.uniformsGroups.filter(isBlockGroup));
      }
    }
  }

  /**
   * Bind the uniform groups of `material`'s program (`program`, else the program it last drew with) through the engine's
   * per-draw plain uniforms (`nodePlainUniforms.ts`) and leave the classic renderer none of them: its global binding point
   * per group runs out after a dozen node programs.
   */
  private drawEntry(material: THREE.Material, program: unknown): DrawEntry | undefined {
    const cached = this.drawEntries.get(material);
    if (cached?.program === program) return cached;
    const entry = internals(this).programCache.get(material)?.get(program);
    if (entry === undefined) return undefined;
    const linked: unknown = typeof program === 'object' && program !== null ? Reflect.get(program, 'program') : undefined;
    const draw = { program, entry, groups: entry.uniformsGroups.filter(isBlockGroup),
      linked: typeof WebGLProgram !== 'undefined' && linked instanceof WebGLProgram ? linked : null };
    this.drawEntries.set(material, draw); return draw;
  }

  private bindBlocks(material: THREE.Material, program: unknown): void {
    if (this.blocks === null) return;
    const properties: unknown = this.classicRenderer().properties.get(material);
    if (!isMaterialProperties(properties)) throw new Error('Missing node material properties');
    const draw = this.drawEntry(material, program ?? properties.currentProgram);
    // Stock onUpdateProgram restores its groups. The classic renderer owns none.
    this.bindDraw(material, draw);
  }

  private bindDraw(material: THREE.Material, draw: DrawEntry | undefined): void {
    const blocks = this.blocks;
    if (blocks === null) return;
    Reflect.set(material, 'uniformsGroups', NO_GROUPS);
    const linked = draw?.linked ?? null;
    if (draw === undefined || linked === null) return;
    // the node frame's render id is the camera pass the draw's updates just ran in (`textureUpdates.ts`)
    // Plain uniforms go to the current program: send them once setProgram has put this draw's program in use.
    this.hookPlainUniforms(draw.program);
    this.pendingPlain = { program: draw.program, linked, groups: draw.groups, pass: this.frame.renderId };
  }

  /**
   * setProgram ends every draw's uniforms with `p_uniforms.setValue(gl, 'modelMatrix', …)`, unconditionally and after
   * `useProgram`: the program's uniform setter is wrapped once so that call sends the draw's pending plain uniforms.
   */
  private hookPlainUniforms(program: unknown): void {
    if (typeof program !== 'object' || program === null || this.plainHooked.has(program)) return;
    const getUniforms: unknown = Reflect.get(program, 'getUniforms');
    const uniforms: unknown = typeof getUniforms === 'function' ? Reflect.apply(getUniforms, program, []) : undefined;
    const stock: unknown = typeof uniforms === 'object' && uniforms !== null ? Reflect.get(uniforms, 'setValue') : undefined;
    if (typeof uniforms !== 'object' || uniforms === null || !isUniformSetter(stock)) throw new Error('Node program keeps no uniform setter');
    this.plainHooked.add(program);
    const flush = (): void => { this.flushPlainUniforms(program); };
    // three's own four arguments, passed on as they are: a rest array and Reflect.apply on each of a draw's uniform sets
    // were a native call per set on JavaScriptCore (60 of 5980 samples of a steady Nalati Simulator profile)
    Reflect.set(uniforms, 'setValue', function setValue(this: unknown, gl: unknown, name: unknown, value: unknown, textures: unknown): void {
      stock.call(this, gl, name, value, textures);
      if (name === 'modelMatrix') flush();
    });
  }

  /** `program` is in use: send the pending draw's plain uniforms if they belong to it */
  private flushPlainUniforms(program: object): void {
    const pending = this.pendingPlain, blocks = this.blocks;
    if (pending === null || pending.program !== program || blocks === null) return;
    this.pendingPlain = null;
    blocks.bind(pending.linked, pending.groups, pending.pass);
  }

  /** Warm draws borrow the paired program view without rebuilding block lists.
   * Renderer version/layout checks and custom node dispatch remain live. */
  /** the handler's own dispose callback (O18: it goes first among a material's dispose listeners) */
  private disposeListener: ((this: THREE.Material) => void) | null = null;

  private beforeDraw(material: THREE.Material, object: THREE.Object3D): void {
    const self = internals(this), frame = this.frame;
    frame.material = material;
    frame.object = object;
    // No per-draw `info.render.frame` bump (stock three's way to refresh its classic uniform groups): the engine binds
    // its own blocks and leaves the classic renderer none, and the bump only made every later shadow cast re-update its
    // geometry, instance buffers and skeleton (a bone texture upload per cascade) as if a new frame had begun (sp-o276).
    const real = this.classicRenderer();
    if (real.properties.has(material)) {
      const properties: unknown = real.properties.get(material);
      if (!isMaterialProperties(properties)) throw new Error('Missing node material properties');
      // the variants are keyed by the key's token (`tokened`), not the key text
      material.customProgramCacheKey(); const token = this.lastKeyToken;
      const selected = token !== null && this.objectVariants.select(material, token, properties);
      if (!selected) {
        // A cold variant needs one normal lookup, without invalidating every
        // other warm variant by incrementing the material's version.
        properties.__version = -1;
      }
      const current = properties.currentProgram;
      this.pairPrograms(material, properties);
      if (selected) this.refreshSceneBinding(material, current);
      const draw = this.drawEntry(material, current), entry = draw?.entry;
      // compile() can select a new program without onUpdateProgram. After an offscreen
      // draw, setProgram may see matching material flags and skip its switch callback.
      if (current !== undefined && (this.pendingBuilds.has(material) || entry === undefined ||
        properties.uniforms !== entry.uniforms || properties.uniformsList !== entry.uniformsList)) {
        this.onUpdateProgram(material, current, properties);
      } else {
        if (entry !== undefined) self.updateNodes(entry.updateNodes);
        this.bindDraw(material, draw);
      }
    }
    this.bindAttributeDefaults(material, object);
  }

  private bindAttributeDefaults(material: THREE.Material, object: unknown, program?: unknown): void {
    if (material.userData['graphAttributeDefaults'] === undefined) return;
    const renderer = this.classicRenderer(), gl: unknown = renderer.getContext();
    if (!(typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)) return;
    const properties: unknown = renderer.properties.get(material);
    const current: unknown = program ?? (typeof properties === 'object' && properties !== null ? Reflect.get(properties, 'currentProgram') : undefined);
    bindGraphAttributeDefaults(material, object, current, gl);
  }

  /** a node material was disposed (three's onDisposeMaterialCallback): its uniform groups and block buffers go */
  /**
   * O18: three's renderer files a node material's shader stages in its custom shader cache (WebGLShaderCache, through
   * WebGLPrograms.getParameters, as for a ShaderMaterial) but releases them on dispose only for a ShaderMaterial, so every
   * disposed node material (its node graph and what its closures hold: a retired world) stayed in that cache for the
   * page's life. The handler's dispose callback goes first among the material's dispose listeners (three files its own
   * before the build), and marks the node material a shader material for that one dispatch, so three's own dispose
   * releases its stages; the mark is gone before the next frame.
   */
  private disposeFirst(material: THREE.Material): void {
    const callback = this.disposeListener, listeners: unknown = Reflect.get(material, '_listeners');
    const list: unknown = typeof listeners === 'object' && listeners !== null ? Reflect.get(listeners, 'dispose') : undefined;
    if (!Array.isArray(list)) return;
    const at = list.indexOf(callback);
    if (at > 0) { list.splice(at, 1); list.unshift(callback); }
  }

  /** a disposed material that was its key's reuse source leaves its build behind as code and positions (`keepBuild`) */
  private keepDisposed(material: THREE.Material): void {
    const entry = this.reusableBuilds.get(material), key = this.reusableKeys.get(material);
    if (entry === undefined || key === undefined || this.reusable.get(key)?.deref() !== material) return;
    // its environment's PMREM read by role: the next visit's sky makes a new one of the same size (G782)
    const environment = entry.binding?.inputs?.environment?.deref(), pmrem = isTexture(environment) ? this.environments.get(environment) : undefined;
    const build = keepBuild(entry.output, entry.shape, entry.lazy, pmrem === undefined || !isTexture(environment) ? undefined : environmentRoles(pmrem, environment), entry.builtSince);
    if (build === null) return;
    const binding = entry.binding === null ? null : { scene: entry.binding.scene, rawKey: entry.binding.rawKey, lights: entry.binding.lights, inputs: entry.binding.inputs };
    this.dropKept(key);
    this.keptBuilds.set(key, { build, binding, height: isTexture(environment) ? atlasHeight(environment) : null }); this.keptBytes += build.bytes;
    for (const [oldest] of this.keptBuilds) {
      if (this.keptBuilds.size <= KEPT_BUILDS && this.keptBytes <= KEPT_BYTES) break;
      this.dropKept(oldest);
    }
  }

  private dropKept(key: string): void {
    const kept = this.keptBuilds.get(key);
    if (kept === undefined) return;
    this.keptBytes -= kept.build.bytes; this.keptBuilds.delete(key);
  }

  private disposeMaterial(material: THREE.Material): void {
    if (material instanceof NodeMaterial && Reflect.get(material, 'isShaderMaterial') !== true) {
      Reflect.defineProperty(material, 'isShaderMaterial', { value: true, configurable: true });
      queueMicrotask(() => { Reflect.deleteProperty(material, 'isShaderMaterial'); });
    }
    for (const pending of this.pendingBuilds.get(material) ?? []) releaseMaterialReferences(pending.updateNodes, material);
    const builder: unknown = Reflect.get(material, '_latestBuilder');
    if (typeof builder === 'object' && builder !== null) releaseMaterialReferences(Reflect.get(builder, 'updateNodes'), material);
    this.sceneBindings.delete(material);
    this.keepDisposed(material);
    this.pendingBuilds.delete(material); this.objectVariants.forget(material); this.drawEntries.delete(material); this.reusableBuilds.delete(material);
    Reflect.deleteProperty(material, '_latestBuilder');
    const self = internals(this), programs = self.programCache.get(material), blocks = this.blocks;
    if (programs !== undefined) {
      for (const entry of programs.values()) {
        releaseMaterialReferences(entry.updateNodes, material);
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
