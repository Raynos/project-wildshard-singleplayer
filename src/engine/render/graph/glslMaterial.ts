/**
 * The classic graph material (nine-fix NF14): a graph lowered by `glsl.ts` and wrapped by `glslProgram.ts`, drawn as a
 * plain `ShaderMaterial` with no node runtime and no per-draw hook. `compileClassicGraph` is the GLSL twin of
 * `compile.ts`'s `compileGraph` for look materials: the same params, lent textures, uniform lists, outline and declared fog,
 * behind the same contract (`LookGraph`, `graphBackend.ts`).
 *
 * - **Clones share the graph's uniforms** (`GraphShaderMaterial.copy`), as a node material's clone shares its uniform
 *   nodes: a param, a lent texture or an engine clock moves every variant (a coarse tile's mask, a borrowed mesh map, a
 *   viewmodel's transparent copy). A variant's own colour, emissive and mesh maps stay its own.
 * - **The engine's classic patches apply as they do to a family material**: the program is built on three's stock chunks,
 *   so the coarse tile mask (anchored on `project_vertex` / `clipping_planes_fragment`), a layered backdrop's frame (its
 *   view and camera defines), the engine and level fog chunks and the sky rig's shadow cascades reach it unchanged.
 * - **A displaced caster** (`vertex.offset` / `vertex.position` with `shadow: true`) gets a depth material from the same
 *   vertex stage (`ClassicGraph.depth`), attached per mesh as three's `customDepthMaterial`.
 */
import * as THREE from 'three';
import { graphUsesMeshMap, type GraphBinding, type GraphCost, type GraphLiteral } from '@wildshard/format/materialGraph';
import type { ToonLook } from '../families/toon';
import { emitClassicGraph, graphShaders, graphUniformValues, syncGraphEnvironment, type ClassicFog, type GraphShaderOptions } from './glslProgram';
import type { EmitGraphGlslOptions, GraphGlsl } from './glsl';
import { drawNeutral } from '../drawNeutral';
import { ClassicCodec } from './glslCodec';

/** the uniforms a variant keeps its own (a creature's tint, a borrowed map); every other one is shared with its source */
const OWN_UNIFORMS: ReadonlySet<string> = new Set(['wsMaterialColour', 'wsMaterialEmissive', 'wsMaterialEmissiveIntensity', 'wsMeshMap', 'wsBumpMap',
  'wsMaterialRoughness', 'wsAlphaCutoff', 'wsCodecStep', 'wsCodecOrigin', 'normalMap', 'normalMapTransform', 'normalScale', 'roughnessMap',
  'roughnessMapTransform', 'aoMap', 'aoMapTransform', 'aoMapIntensity']);

/** the compiled materials that own their graph's shadow depth (their clones share it) */
const depthOwners = new WeakSet<THREE.Material>();

/** A lowered graph's `ShaderMaterial`: its clones share the graph's uniforms; its colour, emissive and mesh maps are ports. */
export class GraphShaderMaterial extends THREE.ShaderMaterial {
  readonly isGraphShaderMaterial = true;
  /** the tile grid codec this program decodes positions with (null: it reads no model-space position): its own step and
   *  origin follow the drawn object, re-uploaded only when they change (RM8.1e) */
  codec: ClassicCodec | null = null;
  /** a vertex-moving caster's shadow depth from the graph's own vertex stage (null: the stock depth), shared by its clones;
   *  each variant casts with its own copy (`classicShadowDepth`) */
  shadowDepth: GraphShaderMaterial | null = null;
  /** this variant's own copy of `shadowDepth` (its map and cutoff), made at its first cast and freed with it */
  castDepth: GraphShaderMaterial | null = null;
  /** a lit graph's image-based light: the drawn scene's prefiltered environment (`syncGraphEnvironment`), as a node
   *  material reads `scene.environment` */
  envMap: THREE.Texture | null = null;
  /** the material's own colour (`materialColour`), as a node material's `color` */
  get color(): THREE.Color { return this.colourUniform('wsMaterialColour', 1).value; }
  /** the material's own emissive colour (`materialEmissive` is this times `emissiveIntensity`) */
  get emissive(): THREE.Color { return this.colourUniform('wsMaterialEmissive', 0).value; }
  get emissiveIntensity(): number { const u = this.uniforms['wsMaterialEmissiveIntensity']; return typeof u?.value === 'number' ? u.value : 1; }
  set emissiveIntensity(value: number) { this.own('wsMaterialEmissiveIntensity', value); }
  /** the material's own roughness (`roughness`), read where the graph writes none, as a node material's */
  get roughness(): number { const u = this.uniforms['wsMaterialRoughness']; return typeof u?.value === 'number' ? u.value : 1; }
  set roughness(value: number) { this.own('wsMaterialRoughness', value); }
  /** a graph with a cutoff discards below the material's own `alphaTest` (three refreshes no alphaTest for a shader
   *  material): a row's value replaces the graph's, as on a node material */
  override get alphaTest(): number { return super.alphaTest; }
  override set alphaTest(value: number) {
    super.alphaTest = value;
    // three's copy sets it before the uniforms arrive (they come with the source's value)
    const cutoff = this.uniforms['wsAlphaCutoff'];
    if (cutoff !== undefined) cutoff.value = value;
  }
  /** a borrowed colour map (`meshMap`): sampled where the graph reads it, else its fallback */
  get map(): THREE.Texture | null { return this.texture('wsMeshMap'); }
  set map(texture: THREE.Texture | null) { this.lend('wsMeshMap', 'WS_MESH_MAP', texture); }
  /** a borrowed bump map (`meshMap` named `bump`) */
  get bumpMap(): THREE.Texture | null { return this.texture('wsBumpMap'); }
  set bumpMap(texture: THREE.Texture | null) { this.lend('wsBumpMap', 'WS_BUMP_MAP', texture); }
  /** a lit graph's borrowed PBR maps (`bindGraphMeshMap`'s `graphPbrMaps` loan), as a node material's slots: three switches
   *  their defines from these properties, the lit program samples them with its stock chunks */
  readonly normalMapType: THREE.NormalMapTypes = THREE.TangentSpaceNormalMap;
  get normalMap(): THREE.Texture | null { return this.texture('normalMap'); }
  set normalMap(texture: THREE.Texture | null) { this.slot('normalMap', 'normalMapTransform', texture); }
  get roughnessMap(): THREE.Texture | null { return this.texture('roughnessMap'); }
  set roughnessMap(texture: THREE.Texture | null) { this.slot('roughnessMap', 'roughnessMapTransform', texture); }
  get aoMap(): THREE.Texture | null { return this.texture('aoMap'); }
  set aoMap(texture: THREE.Texture | null) { this.slot('aoMap', 'aoMapTransform', texture); }
  get aoMapIntensity(): number { const u = this.uniforms['aoMapIntensity']; return typeof u?.value === 'number' ? u.value : 1; }
  set aoMapIntensity(value: number) { this.own('aoMapIntensity', value); }
  /** the normal map's scale, the uniform's own vector (a loan copies into it) */
  get normalScale(): THREE.Vector2 {
    const known: unknown = this.uniforms['normalScale']?.value;
    if (known instanceof THREE.Vector2) return known;
    const value = new THREE.Vector2(1, 1); this.uniforms['normalScale'] = { value };
    return value;
  }

  override onBeforeRender(_renderer: THREE.WebGLRenderer, scene: THREE.Scene, _camera: THREE.Camera, _geometry: THREE.BufferGeometry, object: THREE.Object3D): void {
    this.codec?.draw(this, object);
    // the environment uniforms are shared with clones: every lit draw writes its own scene's before it uploads
    if (this.lights) syncGraphEnvironment(this, scene);
  }


  override dispose(): void {
    this.castDepth?.dispose(); this.castDepth = null;
    if (depthOwners.has(this)) this.shadowDepth?.dispose();
    super.dispose();
  }

  override copy(source: THREE.ShaderMaterial): this {
    super.copy(source);
    this.codec = source instanceof GraphShaderMaterial && source.codec !== null ? new ClassicCodec() : null;
    this.shadowDepth = source instanceof GraphShaderMaterial ? source.shadowDepth : null;
    // three's copy clones every uniform value (a texture too): the graph's are shared again, a variant's own map stays the
    // same texture, its colours its own copies
    for (const [name, uniform] of Object.entries(source.uniforms)) {
      if (!OWN_UNIFORMS.has(name)) this.uniforms[name] = uniform;
      else if (uniform.value instanceof THREE.Texture) this.uniforms[name] = { value: uniform.value };
    }
    return this;
  }

  private colourUniform(name: string, initial: number): THREE.IUniform<THREE.Color> {
    const known = this.uniforms[name];
    if (known !== undefined && known.value instanceof THREE.Color) return { value: known.value };
    const value = new THREE.Color(initial, initial, initial);
    this.uniforms[name] = { value };
    return { value };
  }
  private texture(name: string): THREE.Texture | null { const value: unknown = this.uniforms[name]?.value; return value instanceof THREE.Texture ? value : null; }
  /** set an own uniform's value in place (its program already reads that object) */
  private own(name: string, value: unknown): void { const known = this.uniforms[name]; if (known === undefined) this.uniforms[name] = { value }; else known.value = value; }
  private lend(name: string, define: string, texture: THREE.Texture | null): void {
    const had = this.texture(name) !== null;
    this.own(name, texture);
    if (had === (texture !== null)) return;
    const defines: Record<string, unknown> = { ...this.defines };
    if (texture === null) Reflect.deleteProperty(defines, define); else defines[define] = '';
    this.defines = defines; this.needsUpdate = true;
  }
  /** a PBR map slot and its uv transform (three refreshes neither for a shader material); its presence is a program variant */
  private slot(name: string, transform: string, texture: THREE.Texture | null): void {
    const had = this.texture(name) !== null;
    this.own(name, texture);
    if (texture !== null) {
      if (texture.matrixAutoUpdate) texture.updateMatrix();
      const known: unknown = this.uniforms[transform]?.value;
      if (known instanceof THREE.Matrix3) known.copy(texture.matrix); else this.uniforms[transform] = { value: texture.matrix.clone() };
    }
    if (had !== (texture !== null)) this.needsUpdate = true;
  }
}

/** a compiled classic graph: the look-material contract (`LookGraph`) and what draws it */
export interface ClassicGraph {
  readonly material: GraphShaderMaterial;
  readonly glsl: GraphGlsl;
  readonly cost: GraphCost;
  readonly bindings: readonly { readonly param: string; readonly bind: GraphBinding }[];
  readonly selects: { readonly light: number; readonly branch: number };
  /** the outline stage's hull (null without one): attach it with `attachClassicOutline` */
  readonly outline: GraphShaderMaterial | null;
  /** a displaced caster's shadow depth (null unless a vertex stage says `shadow: true`): attach it with `attachClassicDepth` */
  readonly depth: GraphShaderMaterial | null;
  /** a fog graph's lowering and its uniform objects, for the materials that select it (null for any other kind) */
  readonly fog: ClassicFog | null;
  readonly setParam: (name: string, value: GraphLiteral) => void;
  readonly setTexture: (name: string, texture: THREE.Texture) => void;
  readonly setArrayParam: (name: string, value: readonly GraphLiteral[]) => void;
}
/** what compiling a classic graph needs beyond the graph */
export interface ClassicGraphOptions extends Omit<EmitGraphGlslOptions, 'toon'> {
  readonly toon?: ToonLook;
  readonly textures?: GraphShaderOptions['textures'];
  /** resolves a material's `effectState.fog` catalogue id to that compiled fog graph */
  readonly fog?: (id: string) => ClassicFog;
}

/** a program that reads a model-space position or offsets one decodes a tile primitive's grid (RM8.1e) */
const readsCodec = (vertexShader: string): boolean => /\bwsCodec(Step|Origin)\b/.test(vertexShader.slice(vertexShader.indexOf('void main()')));
/** a mesh without a declared attribute reads its default, else TSL's attribute() constant (three's generateConst: zeros,
 *  a vec4 as a new Vector4, 0, 0, 0, 1), never the generic value the last draw left at that location */
function attributeDefaults(glsl: GraphGlsl, m: THREE.ShaderMaterial): THREE.ShaderMaterial['defaultAttributeValues'] {
  const missing = (type: string): number[] => (type === 'float' ? [0] : type === 'vec2' ? [0, 0] : type === 'vec3' ? [0, 0, 0] : [0, 0, 0, 1]);
  return { ...m.defaultAttributeValues, ...Object.fromEntries(glsl.attributes.map(a => [a.name, a.default === null ? missing(a.type) : [...a.default]])) };
}
/** a displaced caster's shadow depth: the graph's vertex stage and surface mask, writing depth (three's BasicDepthPacking) */
function depthMaterial(glsl: GraphGlsl, opts: GraphShaderOptions): GraphShaderMaterial {
  const shaders = graphShaders(glsl, { ...opts, depth: true });
  const m = new GraphShaderMaterial({ vertexShader: shaders.vertexShader, fragmentShader: shaders.fragmentShader, uniforms: shaders.uniforms });
  m.name = 'graph:depth'; m.userData['graphDepthVariant'] = true;
  if (readsCodec(shaders.vertexShader)) m.codec = new ClassicCodec();
  m.defaultAttributeValues = attributeDefaults(glsl, m);
  return m;
}

/**
 * The depth a shadow cast of `object` with the classic graph material `source` draws with in place of three's stock depth
 * material `stock` (its configured copy of the caster's depth facts), or null where the stock draws: a vertex-moving
 * graph (`shadow: true`) casts from its own vertex stage, as the node path's depth variant does. Installed by the classic
 * back-end's loader (`installClassicShadowDepth`).
 */
export function classicShadowDepth(source: unknown, stock: THREE.MeshDepthMaterial, object: THREE.Object3D): THREE.Material | null {
  if (!(source instanceof GraphShaderMaterial) || source.shadowDepth === null) return null;
  const depth = source.castDepth ??= source.shadowDepth.clone();
  depth.side = stock.side; depth.map = stock.map; depth.alphaTest = stock.alphaTest;
  // three's shadow pass calls no material hook: the caster's grid decode is fed here
  depth.codec?.draw(depth, object);
  return depth;
}

/** A lowered graph as its classic material, with the graph's render state (sides, blend, depth, flat shading, points). */
function shaderMaterial(glsl: GraphGlsl, opts: GraphShaderOptions): GraphShaderMaterial {
  const shaders = graphShaders(glsl, opts), ir = glsl.ir, effect = ir.effectState, outline = opts.outline === true;
  const m = new GraphShaderMaterial({ vertexShader: shaders.vertexShader, fragmentShader: shaders.fragmentShader, uniforms: shaders.uniforms, lights: shaders.lights, fog: shaders.fog });
  m.name = outline ? 'graph:outline' : `graph:${ir.kind}`;
  if (readsCodec(shaders.vertexShader)) m.codec = new ClassicCodec();
  m.defaultAttributeValues = attributeDefaults(glsl, m);
  if (ir.kind === 'post') { m.depthTest = false; m.depthWrite = false; return m; }
  if (outline) { m.side = THREE.BackSide; return m; }
  m.side = ir.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide;
  // three reads FLAT_SHADED from the material's own flag, which ShaderMaterial does not declare: the define carries it
  if (ir.model !== 'unlit' && (ir.flatShading ?? ir.model === 'toon')) m.defines = { ...m.defines, FLAT_SHADED: '' };
  if (ir.stages.surface?.alpha !== undefined) m.transparent = ir.stages.surface.alphaCutoff === undefined;
  if (ir.stages.surface?.alphaCutoff !== undefined) m.alphaTest = ir.stages.surface.alphaCutoff;
  if (effect?.blend !== undefined) {
    m.transparent = true;
    m.blending = effect.blend === 'additive' ? THREE.AdditiveBlending : effect.blend === 'premultiplied' ? THREE.CustomBlending : THREE.NormalBlending;
    if (effect.blend === 'premultiplied') { m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }
  }
  if (effect?.depthWrite !== undefined) m.depthWrite = effect.depthWrite;
  // O14: an additive double-sided blend that writes no depth reads the same in one pass (the sum is order-free)
  if (effect?.singlePass === true || (m.transparent && m.side === THREE.DoubleSide && m.blending === THREE.AdditiveBlending && !m.depthWrite)) m.forceSinglePass = true;
  if (effect?.depthBias !== undefined) { m.polygonOffset = true; m.polygonOffsetFactor = effect.depthBias.factor; m.polygonOffsetUnits = effect.depthBias.units; }
  // an unlit graph writes raw colour (no output transform), as the GLSL program it stands for did; a graded one is display linear
  if (ir.stages.lighting?.grade !== undefined || (ir.model === 'unlit' && effect?.output !== 'colour')) m.toneMapped = false;
  // the flags the client reads off a compiled graph, as compile.ts sets them: a borrowed mesh map, raw unlit output, points
  if (graphUsesMeshMap(ir)) m.userData['graphMeshMap'] = true;
  if (ir.kind === 'material' && ir.model !== 'unlit') m.userData['graphPbrMaps'] = true;
  if (ir.kind === 'material' && ir.model === 'unlit' && effect?.output !== 'colour') m.userData['graphRawOutput'] = true;
  if (ir.primitive === 'points') m.userData['graphPrimitive'] = 'points';
  return m;
}

/**
 * Compile a graph to its classic material. Throws (with every reason) when validation refuses it. A `model: 'toon'`
 * graph needs the family look (`toon`); a material selecting a declared fog needs `fog`.
 */
export function compileClassicGraph(input: unknown, opts: ClassicGraphOptions = {}): ClassicGraph {
  const { toon, textures, fog: fogFor, ...emit } = opts;
  const glsl = emitClassicGraph(input, { ...emit, ...(toon === undefined ? {} : { toonLook: toon }) }), ir = glsl.ir;
  const selected = ir.effectState?.fog;
  const fog = typeof selected === 'string' ? fogFor?.(selected) : undefined;
  if (typeof selected === 'string' && fog === undefined) throw new Error(`material graph: fog ${selected} needs a fog resolver`);
  const shared = new Map<string, THREE.IUniform>();
  const shaderOpts: GraphShaderOptions = { shared, ...(toon === undefined ? {} : { toonLook: toon }), ...(textures === undefined ? {} : { textures }), ...(fog === undefined ? {} : { fog }) };
  // a fog graph draws nothing itself: its uniforms are made once here and lent to every program selecting it
  const fogOwn = ir.kind === 'fog' ? graphUniformValues(glsl, shaderOpts) : null;
  const material = ir.kind === 'fog' ? carrier() : shaderMaterial(glsl, shaderOpts);
  const outline = glsl.outline === null ? null : shaderMaterial(glsl, { ...shaderOpts, outline: true });
  const casts = ir.stages['vertex.offset']?.shadow === true || ir.stages['vertex.position']?.shadow === true;
  const depth = casts ? depthMaterial(glsl, shaderOpts) : null;
  if (depth !== null) {
    material.shadowDepth = depth; material.userData['graphShadowDepth'] = true; depthOwners.add(material);
  }
  const uniformsOf = (name: string): THREE.IUniform | undefined => fogOwn?.get(name) ?? shared.get(name);
  // the runtime feeds write params every frame (NF15 P4: a scan per write cost 0.18 ms a frame): by name, once
  const paramNames = new Map(glsl.uniforms.flatMap(u => (u.from === 'param' || u.from === 'texture' || u.from === 'array' ? [[u.param, u.name] as const] : [])));
  const param = (name: string): string | undefined => paramNames.get(name);
  const inRange = (name: string, n: number, min: number | undefined, max: number | undefined): void => {
    if (!Number.isFinite(n)) throw new Error(`material graph: param ${name} must be finite`);
    if ((min !== undefined && n < min) || (max !== undefined && n > max)) throw new Error(`material graph: param ${name} outside declared range`);
  };
  return {
    material, glsl, cost: glsl.cost, bindings: glsl.bindings, selects: glsl.program?.selects ?? { light: 0, branch: 0 }, outline, depth,
    fog: fogOwn === null ? null : { glsl, uniforms: fogOwn },
    setParam(name, value) {
      const p = ir.params?.[name];
      if (p === undefined || p.type === 'texture') throw new Error(`material graph: no param ${name}`);
      const length = p.type === 'vec2' ? 2 : p.type === 'vec4' ? 4 : 3;
      if (p.type === 'float' ? typeof value !== 'number' : typeof value === 'number' || value.length !== length) throw new Error(`material graph: param ${name} type mismatch`);
      if (typeof value === 'number') inRange(name, value, p.min, p.max); else for (const n of value) inRange(name, n, p.min, p.max);
      const uniform = uniformsOf(param(name) ?? '');
      // a param no stage reads has no uniform: nothing draws it
      if (uniform === undefined) return;
      const target: unknown = uniform.value;
      if (typeof value === 'number') uniform.value = value;
      else if (target instanceof THREE.Color) target.setRGB(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, THREE.SRGBColorSpace);
      else if (target instanceof THREE.Vector2 || target instanceof THREE.Vector3 || target instanceof THREE.Vector4) target.fromArray(value);
    },
    setTexture(name, texture) {
      if (ir.params?.[name]?.role !== 'lent') throw new Error(`material graph: no sampled lent texture ${name}`);
      const sampler = glsl.uniforms.find(u => u.from === 'texture' && u.param === name);
      if (sampler?.type === 'sampler2DArray' && !(texture instanceof THREE.DataArrayTexture) && !(texture instanceof THREE.CompressedArrayTexture)) throw new Error(`material graph: ${name} requires a 2D texture array`);
      if (sampler?.type === 'sampler3D' && !(texture instanceof THREE.Data3DTexture)) throw new Error(`material graph: ${name} requires a 3D texture`);
      const uniform = sampler === undefined ? undefined : uniformsOf(sampler.name);
      if (uniform !== undefined) uniform.value = texture;
    },
    setArrayParam(name, value) {
      const row = ir.arrays?.[name], uniform = uniformsOf(param(name) ?? '');
      if (row === undefined || value.length !== row.value.length) throw new Error(`material graph: uniform list ${name} has fixed capacity`);
      const width = row.type === 'float' ? 1 : row.type === 'vec2' ? 2 : row.type === 'vec3' ? 3 : 4;
      for (const v of value) if ((typeof v === 'number' ? width !== 1 : v.length !== width) || !(typeof v === 'number' ? [v] : v).every(Number.isFinite)) throw new Error(`material graph: array element must be a finite ${row.type}`);
      if (uniform === undefined) return;
      const flat: unknown = uniform.value;
      if (!(flat instanceof Float32Array)) return;
      value.forEach((v, i) => { if (typeof v === 'number') flat[i] = v; else flat.set(v, i * width); });
    },
  };
}
/** a fog graph's carrier: never drawn, it keeps `setParam` by catalogue id */
function carrier(): GraphShaderMaterial {
  const m = new GraphShaderMaterial(); m.visible = false; m.userData['graphFog'] = true; m.name = 'graph:fog';
  return m;
}

/**
 * Add a compiled classic graph's outline (`ClassicGraph.outline`) to `mesh` as its second draw: a child mesh over a
 * shallow copy of its geometry (the same buffers), sharing an instanced mesh's matrices and following its count. The hull
 * casts and receives no shadow. Returns the child.
 */
export function attachClassicOutline(mesh: THREE.Mesh, outline: THREE.Material): THREE.Mesh {
  const source = mesh.geometry, geometry = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(source.attributes)) geometry.setAttribute(k, a);
  geometry.setIndex(source.index);
  for (const g of source.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
  let hull: THREE.Mesh;
  if (mesh instanceof THREE.InstancedMesh) {
    const instanced = new THREE.InstancedMesh(geometry, outline, 0);
    instanced.instanceMatrix = mesh.instanceMatrix; instanced.instanceColor = mesh.instanceColor; instanced.count = mesh.count;
    instanced.onBeforeRender = drawNeutral(() => { instanced.count = mesh.count; });
    hull = instanced;
  } else hull = new THREE.Mesh(geometry, outline);
  hull.name = `${mesh.name}:outline`; hull.castShadow = false; hull.receiveShadow = false;
  mesh.add(hull);
  return hull;
}
/** a displaced caster's shadow depth on `mesh` (`ClassicGraph.depth`): three draws its shadow with it */
export function attachClassicDepth(mesh: THREE.Mesh, depth: THREE.Material): void { mesh.customDepthMaterial = depth; }
