import { Color, HalfFloatType, LinearFilter, NearestFilter, type PerspectiveCamera, type Scene, Texture, Uniform, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderTarget, type Material, type TextureDataType } from 'three';
import { Pass, Effect, BlendFunction, EffectAttribute, BloomEffect, EffectPass, RenderPass } from 'postprocessing';
import { loadGraphCompiler, type GraphCompiler } from '@wildshard/engine/render/graphBackend';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { validateGraph } from '@wildshard/format/materialGraph';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { PostChainRow, PostEffectRow, PostPackTerm, ScaledPostRow } from '@wildshard/format/scaledPost';
import { BLEND_ADD_KEEP_ALPHA, type UniformMap } from '../plugin/shaderFamily';

const compilers = new WeakMap<Renderer, GraphCompiler>();
/** Client-only terminal program. Linked observations retain their live identity;
 * only the postprocessing Uniform wrappers are owned by this effect. */
export class PostRowEffect<U extends UniformMap> extends Effect {
  private readonly bindings: readonly { readonly row: UniformMap[string]; readonly uniform: Uniform<unknown> }[];
  constructor(row: PostEffectRow, readonly u: U) {
    const bindings = Object.entries(u).map(([name, linked]) => ({ name, row: linked, uniform: new Uniform<unknown>(linked.value) }));
    super(row.name, row.source, { blendFunction: row.blend === 'normal' ? BlendFunction.NORMAL : BlendFunction.SRC,
      attributes: row.depth === true ? EffectAttribute.DEPTH : EffectAttribute.NONE,
      uniforms: new Map(bindings.map(({ name, uniform }) => [name, uniform])) });
    this.bindings = bindings;
  }
  override update(_renderer: Renderer, _input: WebGLRenderTarget, _deltaTime?: number): void {
    for (const binding of this.bindings) binding.uniform.value = binding.row.value;
  }
}
/** Colour effects in their declared tier order, with live uniform observations. */
export function postChainEffects(row: PostChainRow, tier: string, uniforms: UniformMap): Effect[] {
  const effects: Effect[] = [];
  const b = row.bloom;
  if (b?.tiers.includes(tier) === true) effects.push(new BloomEffect({ intensity: b.intensity,
    luminanceThreshold: b.threshold, luminanceSmoothing: b.smoothing, mipmapBlur: true, radius: b.radius, levels: b.levels ?? TIER_CONFIG.bloomLevels }));
  effects.push(new PostRowEffect(row.effect, uniforms));
  return effects;
}
/** Construct a declared scene/bloom/colour chain; no shard factories or callbacks. */
export function postChainPasses(row: PostChainRow, context: { readonly scene: Scene; readonly camera: PerspectiveCamera; readonly tier: string }, uniforms: UniformMap): Pass[] {
  return [...(row.scene ? [new RenderPass(context.scene, context.camera)] : []), new EffectPass(context.camera, ...postChainEffects(row, context.tier, uniforms))];
}
/** Prepare the client backend during async world loading, before synchronous composer construction. */
export async function prepareScaledPost(renderer: Renderer): Promise<void> { compilers.set(renderer, await loadGraphCompiler(renderer)); }
/** Generic client-only post executor: all differences between shards are graphs and rows. */
export class ScaledPostPass extends Pass {
  private readonly graphs = new Map<string, ReturnType<GraphCompiler['compileGraph']>>();
  private readonly rts = new Map<string, WebGLRenderTarget>();
  private readonly overrides = new Map<string, string>();
  private readonly outs = new Map<string, Texture | null>();
  private type: TextureDataType = HalfFloatType;
  private w = 0;
  private h = 0;
  settings: Record<string, number>;
  debugGain = 1;
  constructor(private readonly row: ScaledPostRow, private readonly ctx: { readonly renderer: Renderer; readonly camera: PerspectiveCamera; readonly links?: UniformMap; readonly params?: UniformMap }) {
    super(row.name);
    const compiler = compilers.get(ctx.renderer);
    if (compiler === undefined) throw new Error('Scaled post backend was not prepared during world loading');
    this.settings = { ...row.settings }; this.needsSwap = false;
    this.needsDepthTexture = Object.values(row.programs).some(p => p.depth !== undefined);
    const known = new Set(['input']);
    for (const [key, target] of Object.entries(row.targets)) {
      if (key === 'input' || !known.has(target.of) || !Number.isFinite(target.scale) || target.scale <= 0 || target.scale > 1) throw new Error(`Invalid scaled post target ${key}`);
      known.add(key);
    }
    for (const draw of row.draws) {
      if (!(draw.program in row.programs) || !known.has(draw.to) || Object.values(draw.textures ?? {}).some(source => !known.has(source) || source === draw.to)) throw new Error('Invalid scaled post draw');
    }
    for (const target of Object.values(row.outputs)) if (!known.has(target) || target === 'input') throw new Error('Invalid scaled post output');
    for (const [name, p] of Object.entries(row.programs)) {
      const checked = validateGraph(p.graph, { trustedBudget: true });
      if (!checked.ok || p.graph.kind !== 'post') throw new Error(`Invalid scaled post graph ${name}`);
      const graph = compiler.compileGraph(p.graph, { trustedBudget: true });
      graph.material.name = `${row.name}.${name}`;
      if (p.blend === 'addKeepAlpha') Object.assign(graph.material, { transparent: true, ...BLEND_ADD_KEEP_ALPHA });
      this.graphs.set(name, graph);
      Object.defineProperty(this, `material:${name}`, { value: graph.material, enumerable: true });
    }
    const first = row.draws[0];
    const initial = first === undefined ? undefined : this.graphs.get(first.program);
    if (initial !== undefined) this.fullscreenMaterial = initial.material;
  }
  material(name: string): Material | undefined { return this.graphs.get(name)?.material; }
  set(settings: Readonly<Record<string, number>>): void {
    for (const value of Object.values(settings)) if (!Number.isFinite(value)) throw new Error('Post settings must be finite');
    Object.assign(this.settings, settings);
  }
  output(name: string): Texture | null { return this.outs.get(name) ?? null; }
  debugView(output: string, target: string | null): void { if (target === null) this.overrides.delete(output); else this.overrides.set(output, target); }
  private publish(): void { for (const [out, key] of Object.entries(this.row.outputs)) this.outs.set(out, this.rts.get(this.overrides.get(out) ?? key)?.texture ?? null); }
  override initialize(renderer: Renderer, _alpha: boolean, frameBufferType: number): void {
    this.type = frameBufferType === UnsignedByteType || !(renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }
  override setDepthTexture(texture: Texture): void {
    for (const [name, p] of Object.entries(this.row.programs)) if (p.depth !== undefined) this.graphs.get(name)?.setTexture(p.depth, texture);
  }
  override setSize(width: number, height: number): void {
    if (width === this.w && height === this.h) return;
    this.w = width; this.h = height;
    for (const rt of this.rts.values()) rt.dispose(); this.rts.clear();
    const sizes = new Map<string, readonly [number, number]>([['input', [width, height]]]);
    for (const [key, row] of Object.entries(this.row.targets)) {
      const source = sizes.get(row.of); if (source === undefined) throw new Error('Missing post target size');
      const w = Math.max(1, Math.round(source[0] * row.scale)), h = Math.max(1, Math.round(source[1] * row.scale));
      sizes.set(key, [w, h]);
      const rt = new WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = rt.texture.magFilter = row.filter === 'nearest' ? NearestFilter : LinearFilter;
      rt.texture.name = row.name; this.rts.set(key, rt);
    }
    this.publish();
  }
  private term(term: PostPackTerm): number | null {
    if (term === null || typeof term === 'number') return term;
    if (typeof term === 'string') return this.settings[term] ?? 0;
    if ('param' in term) { const value: unknown = this.ctx.params?.[term.param]?.value; if (typeof value !== 'number') throw new Error('Missing numeric post parameter'); return value; }
    return (this.settings[term.setting] ?? 0) / (term.div ?? 1) / (term.per === undefined ? 1 : this.rts.get(term.per.target)?.[term.per.axis] ?? 1);
  }
  private frame(): void {
    const camera = this.ctx.camera;
    for (const [name, p] of Object.entries(this.row.programs)) {
      const graph = this.graphs.get(name); if (graph === undefined) continue;
      for (const key of p.links ?? []) {
        const value: unknown = this.ctx.links?.[key]?.value;
        if (!(key in (p.graph.params ?? {}))) continue;
        if (isTexture(value)) graph.setTexture(key, value);
        else if (typeof value === 'number') graph.setParam(key, value);
        else if (value instanceof Vector2 || value instanceof Vector3 || value instanceof Vector4 || value instanceof Color) graph.setParam(key, value.toArray());
        else throw new Error(`Missing post uniform ${key}`);
      }
      for (const [key, term] of Object.entries(p.camera ?? {})) {
        if (term === 'near' || term === 'far') graph.setParam(key, camera[term]);
        else if (term === 'nearFar') graph.setParam(key, [camera.near, camera.far]);
        else {
          const matrix = term === 'projection' ? camera.projectionMatrix : term === 'projectionInverse' ? camera.projectionMatrixInverse : term === 'view' ? camera.matrixWorldInverse : camera.matrixWorld;
          graph.setArrayParam(key, [0, 1, 2, 3].map(i => matrix.elements.slice(i * 4, i * 4 + 4)));
        }
      }
      for (const [key, terms] of Object.entries(p.pack ?? {})) {
        const initial = p.graph.params?.[key]?.value;
        const value = terms.map((term, i) => this.term(term) ?? (Array.isArray(initial) ? Number(initial[i]) : typeof initial === 'number' ? initial : 0));
        graph.setParam(key, value.length === 1 ? value[0] ?? 0 : value);
      }
    }
  }
  override render(renderer: Renderer, input: WebGLRenderTarget | null): void {
    if (this.row.drawnOnly === true) for (const key of Object.keys(this.row.outputs)) this.outs.set(key, null);
    if (input === null || this.rts.size === 0 || this.row.when !== undefined && (this.settings[this.row.when] ?? 0) <= 0) return;
    this.frame();
    const source = (key: string): WebGLRenderTarget => { const target = key === 'input' ? input : this.rts.get(key); if (target === undefined) throw new Error('Missing post target'); return target; };
    for (const draw of this.row.draws) {
      const graph = this.graphs.get(draw.program); if (graph === undefined) throw new Error('Missing post program');
      for (const [key, target] of Object.entries(draw.textures ?? {})) graph.setTexture(key, source(target).texture);
      if (draw.texel !== undefined) { const target = source(draw.texel.of); graph.setParam(draw.texel.uniform, [1 / target.width, 1 / target.height]); }
      this.fullscreenMaterial = graph.material; renderer.setRenderTarget(source(draw.to)); renderer.render(this.scene, this.camera);
    }
    if (this.row.drawnOnly === true) this.publish();
  }
  override dispose(): void { for (const rt of this.rts.values()) rt.dispose(); for (const graph of this.graphs.values()) graph.material.dispose(); super.dispose(); }
}
function isTexture(value: unknown): value is Texture { return value instanceof Texture; }
