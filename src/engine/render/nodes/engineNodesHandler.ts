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
import { ConvertNode, MeshBasicNodeMaterial, NodeFrame, NodeMaterial, PMREMNode, TextureNode, type Node, type NodeBuilder } from 'three/webgpu';
import { Fn, and, cameraPosition, context, mix, modelWorldMatrix, nodeObject, normalLocal, positionWorld, reference, step, uniform, vec2, vec3, vec4, workingToColorSpace } from 'three/tsl';
import { fogPatches, materialNodeFogOf } from '../fogPatches';
import { planeBiasShadowFilterOn, tentShadowFilterOn } from '../../world/shadowFilter';
import { colourRampFog, engineFog } from './engineFog';
import { tentShadowFilter } from './tentShadowFilter';
import { planeBiasShadowFilter } from './planeBiasShadowFilter';
import { EngineDirectionalLightNode } from './cascadeLightNode';
import { isCascadeGhost } from '../../world/cascadeLights';
import { Scope } from '../../app/scope';
import { rebindGeometry } from '../../app/cachedAssets';
import { diagnosticNow } from '../../core/clock';
import { worldTime } from '../../core/time';
import { setting } from '../../ui/Settings';
import type { Renderer } from '../renderer';
import type { ProgramLike } from '../../boot/perflog';
import { NodeUniformBuffers, type BlockGroup } from './nodeUniformBuffers';
import { NodePlainUniforms } from './nodePlainUniforms';
import { installNodeCoarseMask, type NodeCoarseMask } from '../nodeCoarseMask';
import { installNodeLayerFrame, layerFrameOf, type NodeLayerFrameInstaller } from '../nodeLayerFrame';
import { bindGraphAttributeDefaults, copyGraphAttributeDefaults, prepareGraphAttributeDefaults } from './graphAttributes';
import { buildWithInstanceAttributes, instanceAttributeShader, nodeInstanceKey } from './nodeInstancing';
import { TextureUpdates } from './textureUpdates';
import { NodeProgramVariants } from './nodeProgramVariants';
import { classicModelUniform } from './nodeObjectUniforms';
import { registerShadowDepthResolver } from '../shadowDepthVariants';

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
  updateNodes: (nodes: unknown) => void;
  getOutputCallback: (outputNode: Node<'vec4'>, builder: NodeBuilder) => Node<'vec4'>;
  customProgramCacheKeyCallback: (this: THREE.Material) => string;
  renderStack: { camera: THREE.Camera; sceneContext: { fogNode: Node | null; environmentNode: Node | null; scene: THREE.Object3D; getCacheKey: () => unknown } }[];
  programCache: Map<THREE.Material, Map<unknown, ProgramEntry>>;
  collectUniformsGroups: (builder: unknown) => unknown[];
  onBeforeRenderCallback: THREE.Material['onBeforeRender'];
  onDisposeMaterialCallback: (this: THREE.Material) => void;
  updateGeometryAttributes: (builder: unknown, geometry: THREE.BufferGeometry) => void;
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
interface PendingBuild { readonly uniformsGroups: unknown[]; readonly updateNodes: unknown; readonly uniforms: Record<string, unknown>; readonly programs: unknown; readonly slot: number }

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

/** a node material's whole program key: the stock key, the engine's output transform, the object shape, its fog and layer */
function wholeKey(stock: string, toneMapped: boolean, rawOutput: boolean, objectKey: string, fog: { readonly id: string } | null, layer: { readonly whole: boolean } | null): string {
  return `${stock}|${PROGRAM_KEY}|${toneMapped ? 'tm' : 'raw'}${rawOutput ? '|out:raw' : ''}|${objectKey}${fog === null ? '' : `|fog:${fog.id}`}${layer === null ? '' : `|layer:${layer.whole ? 'whole' : 'alpha'}`}`;
}

/** one bound target's key context (`EngineNodesHandler.keyContextNow`) */
interface KeyContext {
  top: object; lights: number; readonly scene: object; readonly sceneKey: unknown;
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
  /** each object shape's whole key: [plain, receive] */
  readonly keys: Map<string, [string | undefined, string | undefined]>;
}

/** three's node handler fitted to the engine's frame (the module comment lists what it changes); install it with `loadGraphBackend` */
export class EngineNodesHandler extends WebGLNodesHandler {
  /** the engine epilogue, in order, after the output transform (fog first; then whatever the engine appends) */
  readonly epilogue: EpilogueStage[] = [];
  /** node-material programs this handler built (the validator's and the bench's count) */
  builds = 0;
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
  private real: Renderer | null = null;
  private warnedLevelFog = false;
  /** the node programs' uniforms, sent per draw: plain program uniforms (`nodePlainUniforms.ts`), or the std140 blocks
   *  (`nodeUniformBuffers.ts`) under the `graphUniforms` Developer tool; null without a WebGL 2 context */
  private blocks: NodePlainUniforms | NodeUniformBuffers | null = null;
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
    self.onDisposeMaterialCallback = function onDisposeMaterialCallback(this: THREE.Material): void { disposed(this); };
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
    self.customProgramCacheKeyCallback = function customProgramCacheKeyCallback(this: THREE.Material): string {
      const current = frame();
      const object: unknown = typeof current === 'object' && current !== null ? Reflect.get(current, 'object') : undefined;
      const layer = layerFrameOf(this);
      const bound = materialNodeFogOf(this) ?? fogPatches().at(-1);
      const fog = bound?.node === undefined ? null : bound;
      const receive = object instanceof THREE.Object3D && object.receiveShadow;
      const stamp = keyContext();
      const rawOutput = this.userData['graphRawOutput'] === true, objectKey = nodeObjectKey(object);
      if (stamp < 0) return wholeKey(stockKey.call(this), this.toneMapped, rawOutput, objectKey, fog, layer);
      let memos = stockKeys.get(this);
      if (memos === undefined || memos[0]?.version !== this.version) { memos = []; stockKeys.set(this, memos); }
      let memo = memos.find(m => m.stamp === stamp);
      if (memo === undefined) {
        memo = { stamp, version: this.version, receive: undefined, plain: undefined, fog, layer, toneMapped: this.toneMapped, rawOutput, keys: new Map() };
        // a few key contexts a frame (the screen and its targets); a context that moved on drops out first
        if (memos.length >= MEMO_CONTEXTS) memos.shift();
        memos.push(memo);
      } else if (memo.fog !== fog || memo.layer !== layer || memo.toneMapped !== this.toneMapped || memo.rawOutput !== rawOutput) {
        memo.fog = fog; memo.layer = layer; memo.toneMapped = this.toneMapped; memo.rawOutput = rawOutput; memo.keys.clear();
      }
      // the whole key, kept per object shape and receive flag while its other parts hold (warm draws ask on every draw)
      let shape = memo.keys.get(objectKey);
      if (shape === undefined) { shape = [undefined, undefined]; memo.keys.set(objectKey, shape); }
      const slot = receive ? 1 : 0, kept = shape[slot];
      if (kept !== undefined) return kept;
      let stock = receive ? memo.receive : memo.plain;
      if (stock === undefined) { stock = stockKey.call(this); if (receive) memo.receive = stock; else memo.plain = stock; }
      const key = wholeKey(stock, this.toneMapped, rawOutput, objectKey, fog, layer); shape[slot] = key;
      return key;
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
    if (same && c.scene === scene && c.sceneKey === sceneKey) { c.top = top; c.lights = this.lightsStamp; return c.stamp; }
    const next: KeyContext = { top, lights: this.lightsStamp, scene, sceneKey, toneMapping: renderer.toneMapping, colorSpace: renderer.outputColorSpace, stamp: ++this.keyContextStamp };
    if (target === null) this.screenKeyContext = next; else this.keyContexts.set(target, next);
    return next.stamp;
  }

  override renderEnd(): void { try { super.renderEnd(); } finally { this.textureUpdates.endRender(); this.blocks?.invalidateBindings(); } }

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
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) this.blocks = setting('graphUniforms') === 'blocks' ? new NodeUniformBuffers(gl) : new NodePlainUniforms(gl);
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

  /** One owned depth variant per material, including independent clones; never per frame. */
  private readonly shadowDepths = new WeakMap<NodeMaterial, GraphShadowDepthMaterial>();

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
    super.updateLights(lights.some(isCascadeGhost) ? lights.filter((l) => !isCascadeGhost(l)) : lights);
  }

  /** build one node material's program (timed: `builds`, `buildMs`); the build waits to be paired with its program */
  override build(material: THREE.Material, object: THREE.Object3D, parameters: THREE.WebGLProgramParametersWithUniforms): void {
    const t0 = diagnosticNow();
    if (material instanceof NodeMaterial) buildWithInstanceAttributes(material, () => { super.build(material, object, parameters); });
    else super.build(material, object, parameters);
    parameters.vertexShader = instanceAttributeShader(parameters.vertexShader, object, parameters.extensionMultiDraw);
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
    const updateNodes: unknown = typeof builder === 'object' && builder !== null ? Reflect.get(builder, 'updateNodes') : undefined;
    const uniformsGroups = classicModelUniform(parameters, internals(this).collectUniformsGroups(builder).filter(isBlockGroup));
    stableBufferNames(builder, parameters, uniformsGroups);
    if (this.blocks instanceof NodePlainUniforms) this.blocks.declare(parameters, uniformsGroups.filter(isBlockGroup));
    pending.push({ uniformsGroups, updateNodes,
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
   * The renderer switched `material` to `program` (WebGLRenderer.setProgram). The stock handler pairs a program it has not
   * seen with the material's LATEST build, which is wrong when the material was built more than once before it drew: the
   * boot's precompile (`renderer.compileAsync`) builds a material for each program it will need (into the scene target and
   * to the screen, say, whose output transforms differ) without switching to any, so the first program met at the first
   * draw got the last build's uniforms. Its uniform names then point at another build's nodes (a shadow sampler at a
   * float: 'Invalid value used as weak map key' in setTexture2D; G169 pastel plain with Graph materials on). Each build
   * since the last switch is paired with the program the renderer filed right after it (at the slot of the material's
   * program map that the build recorded) before the stock switch runs, so every program keeps its own build's uniforms.
   */
  private pairPrograms(material: THREE.Material, materialProperties: object, selected?: unknown): void {
    const pending = this.pendingBuilds.get(material);
    if (pending !== undefined) {
      this.pendingBuilds.delete(material);
      const programs: unknown = Reflect.get(materialProperties, 'programs');
      if (programs instanceof Map) {
        const acquired: unknown[] = [...programs.values()];
        const cache = internals(this).programCache;
        const known = cache.get(material) ?? new Map<unknown, ProgramEntry>();
        cache.set(material, known);
        const deferred: PendingBuild[] = [];
        for (const build of pending) {
          // a build from before the material was disposed filed into a map that is gone: nothing to pair
          const built: unknown = build.programs === programs ? acquired[build.slot] : undefined;
          if (built === undefined || known.has(built)) continue;
          // A live draw must not resolve every queued future layout. Their
          // uniform discovery belongs to each program's preparation slice.
          if (selected !== undefined && built !== selected) { deferred.push(build); continue; }
          known.set(built, { uniformsGroups: build.uniformsGroups, uniforms: build.uniforms, uniformsList: uniformsListOf(built, build.uniforms), updateNodes: build.updateNodes });
        }
        if (deferred.length > 0) this.pendingBuilds.set(material, deferred);
      }
    }
  }

  onUpdateProgram(material: THREE.Material, program: unknown, materialProperties: object): void {
    this.pairPrograms(material, materialProperties, setting('buildPacing') === 'links' ? program : undefined);
    const stock: unknown = Reflect.get(WebGLNodesHandler.prototype, 'onUpdateProgram');
    if (typeof stock === 'function') Reflect.apply(stock, this, [material, program, materialProperties]);
    if (internals(this).programCache.get(material)?.has(program) === true) Reflect.deleteProperty(material, '_latestBuilder');
    // Precompile pairing has no renderer version yet and must not claim the
    // last build's program for the current object's variant.
    if (Reflect.get(materialProperties, '__version') === material.version) this.objectVariants.record(material, material.customProgramCacheKey(), materialProperties);
    this.bindBlocks(material, program);
    const frame: unknown = Reflect.get(this, 'nodeFrame');
    this.bindAttributeDefaults(material, typeof frame === 'object' && frame !== null ? Reflect.get(frame, 'object') : undefined, program);
  }

  /** Borrow current sampler values from compiled layouts, including unpaired future
   * variants. Reading them neither resolves a program nor uploads a texture. */
  materialTextures(material: THREE.Material): readonly THREE.Texture[] {
    const textures = new Set<THREE.Texture>();
    const read = (uniforms: Record<string, unknown>): void => {
      for (const sampler of Object.values(uniforms)) {
        const value: unknown = typeof sampler === 'object' && sampler !== null ? Reflect.get(sampler, 'value') : undefined;
        if (isTexture(value)) textures.add(value);
      }
    };
    for (const entry of internals(this).programCache.get(material)?.values() ?? []) read(entry.uniforms);
    for (const build of this.pendingBuilds.get(material) ?? []) read(build.uniforms);
    return [...textures];
  }

  /** Resolve this linked program's block indices before its first visible draw.
   * Isolated links also pair only this prepared identity; other pending variants
   * keep their own groups. No material selection, uniform upload or draw occurs. */
  prepareProgram(material: THREE.Material, program: Pick<ProgramLike, 'program'>): void {
    if (setting('buildPacing') === 'links') {
      const properties: unknown = this.classicRenderer().properties.get(material);
      if (!isMaterialProperties(properties)) throw new Error('Missing prepared node material properties');
      this.pairPrograms(material, properties, program);
    }
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
   * Bind the uniform blocks of `material`'s program (`program`, else the program it last drew with) through the engine's
   * per-draw binding (`nodeUniformBuffers.ts`) and leave the classic renderer none of them: its global binding point
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
    if (blocks instanceof NodePlainUniforms) {
      // Plain uniforms go to the current program: send them once setProgram has put this draw's program in use.
      this.hookPlainUniforms(draw.program);
      this.pendingPlain = { program: draw.program, linked, groups: draw.groups, pass: this.frame.renderId };
    } else blocks.bind(linked, draw.groups, this.frame.renderId);
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
    if (typeof uniforms !== 'object' || uniforms === null || typeof stock !== 'function') throw new Error('Node program keeps no uniform setter');
    this.plainHooked.add(program);
    const flush = (): void => { this.flushPlainUniforms(program); };
    Reflect.set(uniforms, 'setValue', function setValue(this: unknown, ...args: unknown[]): void {
      Reflect.apply(stock, this, args);
      if (args[1] === 'modelMatrix') flush();
    });
  }

  /** `program` is in use: send the pending draw's plain uniforms if they belong to it */
  private flushPlainUniforms(program: object): void {
    const pending = this.pendingPlain, blocks = this.blocks;
    if (pending === null || pending.program !== program || !(blocks instanceof NodePlainUniforms)) return;
    this.pendingPlain = null;
    blocks.bind(pending.linked, pending.groups, pending.pass);
  }

  /** Warm draws borrow the paired program view without rebuilding block lists.
   * Renderer version/layout checks and custom node dispatch remain live. */
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
      if (!this.objectVariants.select(material, material.customProgramCacheKey(), properties)) {
        // A cold variant needs one normal lookup, without invalidating every
        // other warm variant by incrementing the material's version.
        properties.__version = -1;
      }
      const current = properties.currentProgram, draw = this.drawEntry(material, current), entry = draw?.entry;
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
  private disposeMaterial(material: THREE.Material): void {
    this.pendingBuilds.delete(material); this.objectVariants.forget(material); this.drawEntries.delete(material);
    Reflect.deleteProperty(material, '_latestBuilder');
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
