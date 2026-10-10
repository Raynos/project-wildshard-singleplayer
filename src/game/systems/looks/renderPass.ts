import {
  HalfFloatType, LinearFilter, Matrix4, NearestFilter, type PerspectiveCamera, type ShaderMaterial, type Texture,
  type TextureDataType, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderTarget,
} from 'three';
import { Pass } from 'postprocessing';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { type ShaderFamily, type UniformMap, type UniformRows, uniformsFrom } from './shaderFamily';

/**
 * A full-screen render pass as declared rows (SHARD-PLATFORM M3, render-pass rows): a shard's own post work — a bloom
 * pyramid, a screen-space reflection, a light march — is its programs (a `ShaderFamily`), its render targets (a share of
 * the frame, or of another target: a mip chain), its draws in order (a program into a target, which textures it reads,
 * which uniform takes a source's texel size) and its per-frame uniforms (camera terms, and vectors packed from the pass's
 * live settings and the caller's parameters). This system owns the targets, the draw order and the uniforms; the GLSL and
 * every number are the shard's data. It runs in the engine's composer (`beforeChain`) and writes only its own targets
 * unless a draw names the frame (`to: 'input'`), e.g. an additive composite.
 */

/** A camera quantity a uniform takes each frame. */
export type CameraTerm = 'projection' | 'projectionInverse' | 'view' | 'world' | 'nearFar' | 'near' | 'far';

/** One component of a packed uniform: a constant, a live setting by name, `null` (keep the current component), a caller
 *  parameter (`{ param }`), or a setting divided by a number and / or by a target's size (`{ setting, div?, per? }`). */
export type PackTerm =
  | number
  | string
  | null
  | { readonly param: string }
  | { readonly setting: string; readonly div?: number; readonly per?: { readonly target: string; readonly axis: 'width' | 'height' } };

/** How one program is used by the pass. */
export interface PassProgramRow {
  /** its uniforms as rows (one live object each, kept across a rebuild) */
  readonly uniforms?: UniformRows;
  /** uniforms linked by name from the caller's map (one object shared with it) */
  readonly links?: readonly string[];
  /** the uniform that takes the scene's depth texture */
  readonly depth?: string;
  /** uniforms set from the camera each frame (a matrix term makes its own `Matrix4`) */
  readonly camera?: Readonly<Record<string, CameraTerm>>;
  /** uniforms packed each frame: one term for a float, two to four for a vector */
  readonly pack?: Readonly<Record<string, readonly PackTerm[]>>;
  /** splices made from a setting (a loop's step count: an integer, or `fixed` decimals); a change rebuilds the program */
  readonly splices?: Readonly<Record<string, { readonly setting: string; readonly fixed?: number }>>;
}

/** A render target: a share of a source's size (the frame's `input`, or another target), at least 1 px. */
export interface PassTargetRow {
  /** the texture's name (a capture's label) */
  readonly name: string;
  readonly of: string;
  readonly scale: number;
  readonly filter: 'linear' | 'nearest';
}

/** One draw: a program into a target (or the frame, `input`). */
export interface PassDrawRow {
  readonly program: string;
  readonly to: string;
  /** texture uniforms and their sources: `input` (the frame) or a target */
  readonly textures?: Readonly<Record<string, string>>;
  /** a `vec2` uniform set to one over a source's size */
  readonly texel?: { readonly uniform: string; readonly of: string };
}

/** A render pass as data. */
export interface RenderPassRow {
  /** the pass's name in the composer */
  readonly name: string;
  readonly programs: Readonly<Record<string, PassProgramRow>>;
  /** its targets, made in this order */
  readonly targets: Readonly<Record<string, PassTargetRow>>;
  /** its draws, in order */
  readonly draws: readonly PassDrawRow[];
  /** its live settings (`set` changes them) */
  readonly settings: Readonly<Record<string, number>>;
  /** the setting that must be above 0 for the pass to draw */
  readonly when?: string;
  /** the textures it hands on by name (a consumer reads `output(name)`) */
  readonly outputs: Readonly<Record<string, string>>;
  /** outputs read null unless the pass drew this frame (a consumer then skips it) */
  readonly drawnOnly?: boolean;
}

/** What the caller supplies: the family the programs come from, the camera, linked uniforms and parameters. */
export interface RenderPassContext {
  readonly family: ShaderFamily;
  readonly camera: PerspectiveCamera;
  readonly links?: UniformMap;
  readonly params?: Readonly<Record<string, () => number>>;
}

const MATRIX_TERMS: ReadonlySet<CameraTerm> = new Set(['projection', 'projectionInverse', 'view', 'world']);

interface Program { readonly name: string; readonly row: PassProgramRow; readonly uniforms: UniformMap; material: ShaderMaterial; key: string }

/** A render pass built from a `RenderPassRow`. */
export class RowRenderPass extends Pass {
  private readonly row: RenderPassRow;
  private readonly ctx: RenderPassContext;
  private readonly programs = new Map<string, Program>();
  private readonly rts = new Map<string, WebGLRenderTarget>();
  private readonly overrides = new Map<string, string>();
  private readonly outs = new Map<string, Texture | null>();
  private type: TextureDataType = HalfFloatType;
  private w = 0;
  private h = 0;
  /** the live settings */
  settings: Record<string, number>;
  /** a consumer's gain on this pass's output (a capture's debug view raises it) */
  debugGain = 1;

  constructor(row: RenderPassRow, ctx: RenderPassContext) {
    super(row.name);
    this.row = row;
    this.ctx = ctx;
    this.settings = { ...row.settings };
    this.needsSwap = false;
    this.needsDepthTexture = Object.values(row.programs).some((p) => p.depth !== undefined);
    for (const [name, p] of Object.entries(row.programs)) {
      const uniforms: UniformMap = {};
      for (const draw of row.draws) if (draw.program === name) for (const key of Object.keys(draw.textures ?? {})) uniforms[key] = { value: null };
      if (p.depth !== undefined) uniforms[p.depth] = { value: null };
      for (const [key, term] of Object.entries(p.camera ?? {})) if (MATRIX_TERMS.has(term)) uniforms[key] = { value: new Matrix4() };
      if (p.uniforms !== undefined) Object.assign(uniforms, uniformsFrom(p.uniforms));
      for (const key of p.links ?? []) {
        const slot = ctx.links?.[key];
        if (slot === undefined) throw new Error(`RowRenderPass ${row.name}: no linked uniform ${key}`);
        uniforms[key] = slot;
      }
      const key = this.spliceKey(p);
      const material = this.make(name, p, uniforms);
      this.programs.set(name, { name, row: p, uniforms, key, material });
      this.expose(name, material);
    }
    const first = row.draws[0];
    const firstProgram = first === undefined ? undefined : this.programs.get(first.program);
    if (firstProgram !== undefined) this.fullscreenMaterial = firstProgram.material;
  }

  /** each program's material as its own enumerable field (`material:<program>`), one step from the pass like a
   *  hand-written pass's `mFoo`: the engine's shader warm-up (precompile.ts postJobs) finds a pass's materials by walking
   *  its fields to a fixed depth, so a program first drawn later (or gated off) is still compiled up front */
  private expose(name: string, material: ShaderMaterial): void {
    Object.defineProperty(this, `material:${name}`, { value: material, enumerable: true, writable: true, configurable: true });
  }

  private splices(p: PassProgramRow): Record<string, string> | undefined {
    if (p.splices === undefined) return undefined;
    const out: Record<string, string> = {};
    for (const [key, s] of Object.entries(p.splices)) {
      const v = this.settings[s.setting] ?? 0;
      out[key] = s.fixed === undefined ? String(v) : v.toFixed(s.fixed);
    }
    return out;
  }

  private spliceKey(p: PassProgramRow): string { return JSON.stringify(this.splices(p) ?? null); }

  private make(name: string, p: PassProgramRow, uniforms: UniformMap): ShaderMaterial {
    const fragments = this.splices(p);
    return this.ctx.family.material(name, uniforms, fragments === undefined ? {} : { fragments });
  }

  /** a program's material (captures, tests) */
  material(name: string): ShaderMaterial | undefined { return this.programs.get(name)?.material; }

  /** live tuning; a setting a program splices rebuilds that program */
  set(s: Readonly<Record<string, number>>): void {
    this.settings = { ...this.settings, ...s };
    for (const prog of this.programs.values()) {
      const key = this.spliceKey(prog.row);
      if (key === prog.key) continue;
      prog.key = key;
      prog.material.dispose();
      prog.material = this.make(prog.name, prog.row, prog.uniforms);
      this.expose(prog.name, prog.material);
    }
  }

  /** an output's texture (null before the first resize, or when `drawnOnly` and the pass did not draw) */
  output(name: string): Texture | null { return this.outs.get(name) ?? null; }

  /** captures only: hand another target's texture on as an output (null = the row's) */
  debugView(output: string, target: string | null): void {
    if (target === null) this.overrides.delete(output); else this.overrides.set(output, target);
  }

  private publish(): void {
    for (const [out, target] of Object.entries(this.row.outputs)) this.outs.set(out, this.rts.get(this.overrides.get(out) ?? target)?.texture ?? null);
  }

  override initialize(renderer: Renderer, _alpha: boolean, frameBufferType: number): void {
    const ext = renderer.extensions;
    this.type = frameBufferType === UnsignedByteType || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }

  override setDepthTexture(depthTexture: Texture): void {
    for (const prog of this.programs.values()) {
      const slot = prog.row.depth === undefined ? undefined : prog.uniforms[prog.row.depth];
      if (slot !== undefined) slot.value = depthTexture;
    }
  }

  override setSize(width: number, height: number): void {
    if (width === this.w && height === this.h) return;
    this.w = width;
    this.h = height;
    for (const rt of this.rts.values()) rt.dispose();
    this.rts.clear();
    const sizes = new Map<string, readonly [number, number]>([['input', [width, height]]]);
    for (const [key, t] of Object.entries(this.row.targets)) {
      const base = sizes.get(t.of);
      if (base === undefined) throw new Error(`RowRenderPass ${this.row.name}: target ${key} is sized from an unknown ${t.of}`);
      const w = Math.max(1, Math.round(base[0] * t.scale)), h = Math.max(1, Math.round(base[1] * t.scale));
      sizes.set(key, [w, h]);
      const rt = new WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false });
      const filter = t.filter === 'nearest' ? NearestFilter : LinearFilter;
      rt.texture.minFilter = filter;
      rt.texture.magFilter = filter;
      rt.texture.name = t.name;
      this.rts.set(key, rt);
    }
    this.publish();
  }

  private term(t: PackTerm): number | null {
    if (t === null || typeof t === 'number') return t;
    if (typeof t === 'string') return this.settings[t] ?? 0;
    if ('param' in t) {
      const f = this.ctx.params?.[t.param];
      if (f === undefined) throw new Error(`RowRenderPass ${this.row.name}: no parameter ${t.param}`);
      return f();
    }
    let v = this.settings[t.setting] ?? 0;
    if (t.div !== undefined) v /= t.div;
    if (t.per !== undefined) {
      const rt = this.rts.get(t.per.target);
      if (rt !== undefined) v /= rt[t.per.axis];
    }
    return v;
  }

  private frameUniforms(prog: Program): void {
    const cam = this.ctx.camera;
    for (const [key, term] of Object.entries(prog.row.camera ?? {})) {
      const slot = prog.uniforms[key];
      if (slot === undefined) continue;
      const v: unknown = slot.value;
      if (term === 'near') slot.value = cam.near;
      else if (term === 'far') slot.value = cam.far;
      else if (term === 'nearFar' && v instanceof Vector2) v.set(cam.near, cam.far);
      else if (v instanceof Matrix4) {
        v.copy(term === 'projection' ? cam.projectionMatrix : term === 'projectionInverse' ? cam.projectionMatrixInverse : term === 'view' ? cam.matrixWorldInverse : cam.matrixWorld);
      }
    }
    for (const [key, terms] of Object.entries(prog.row.pack ?? {})) {
      const slot = prog.uniforms[key];
      if (slot === undefined) continue;
      const v: unknown = slot.value;
      if (typeof v === 'number') { const x = this.term(terms[0] ?? null); if (x !== null) slot.value = x; continue; }
      if (!(v instanceof Vector2 || v instanceof Vector3 || v instanceof Vector4)) continue;
      terms.forEach((t, i) => { const x = this.term(t); if (x !== null) v.setComponent(i, x); });
    }
  }

  private source(name: string, input: WebGLRenderTarget): WebGLRenderTarget | undefined {
    return name === 'input' ? input : this.rts.get(name);
  }

  override render(renderer: Renderer, inputBuffer: WebGLRenderTarget | null): void {
    if (this.row.drawnOnly === true) for (const out of Object.keys(this.row.outputs)) this.outs.set(out, null);
    if (inputBuffer === null || this.rts.size === 0) return;
    if (this.row.when !== undefined && !((this.settings[this.row.when] ?? 0) > 0)) return;
    for (const prog of this.programs.values()) this.frameUniforms(prog);
    for (const draw of this.row.draws) {
      const prog = this.programs.get(draw.program);
      const target = this.source(draw.to, inputBuffer);
      if (prog === undefined || target === undefined) continue;
      for (const [key, from] of Object.entries(draw.textures ?? {})) {
        const slot = prog.uniforms[key], src = this.source(from, inputBuffer);
        if (slot !== undefined && src !== undefined) slot.value = src.texture;
      }
      if (draw.texel !== undefined) {
        const v: unknown = prog.uniforms[draw.texel.uniform]?.value, src = this.source(draw.texel.of, inputBuffer);
        if (v instanceof Vector2 && src !== undefined) v.set(1 / src.width, 1 / src.height);
      }
      this.fullscreenMaterial = prog.material;
      renderer.setRenderTarget(target);
      renderer.render(this.scene, this.camera);
    }
    if (this.row.drawnOnly === true) this.publish();
  }

  override dispose(): void {
    for (const rt of this.rts.values()) rt.dispose();
    for (const prog of this.programs.values()) prog.material.dispose();
    super.dispose();
  }
}
