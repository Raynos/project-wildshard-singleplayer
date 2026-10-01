/**
 * The one shader-patch registry (E357 X6, 01-architecture §13.2, decision 22: WebGPU containment).
 *
 * Every `onBeforeCompile` edit and every program-cache key goes through `patchShader`, so a future renderer port
 * has one place to read them (the inventory script lists each patch id) and the order of the edits is explicit.
 *
 * Parity rules (program sources are an exact parity field, `render.programKeys`):
 * - A material's patches run sorted by `order`, ties in the order they were added. The bands in `PATCH_ORDER`
 *   follow today's call order: the material's own look first, decorations after, the shadow cascades last.
 * - `mode: 'replace'` is the old `mat.onBeforeCompile = fn`: it drops whatever the material ran before (the
 *   fog hook every material inherits, or earlier patches). `mode: 'chain'` (the default) is the old
 *   `const prev = mat.onBeforeCompile; mat.onBeforeCompile = (s, r) => { prev(s, r); … }`: what the material ran
 *   before keeps running first.
 * - The program-cache key is three's dedupe key: two materials with the same key share one program. A patch
 *   with no `key` keeps three's default (the source text of the last patch function, as the old outermost
 *   `onBeforeCompile.toString()`), so materials share programs exactly as they did.
 */
import * as THREE from 'three';
import type { Scope } from '../app/scope';

export type ShaderSource = THREE.WebGLProgramParametersWithUniforms;
export type ShaderPatchFn = (shader: ShaderSource, renderer: THREE.WebGLRenderer) => void;
/** a fixed key, or one built on the key the material had before this patch (`(k) => \`${k}|csm\``) */
export type ShaderPatchKey = string | ((before: string) => string);

/** the order bands (lower runs first; ties run in the order they were added) */
export const PATCH_ORDER = {
  /** the hook the material ran before its first chained patch (the inherited fog hook, a foreign addon's hook) */
  inherited: 0,
  /** a material's own look: its vertex / fragment edits (the old `mat.onBeforeCompile = …` sites) */
  material: 100,
  /** a decoration chained onto a finished material (cover tint, an area clip, a flutter, a gallop) */
  decorate: 200,
  /** the shadow cascades' uniforms (Sky.setupMaterial wraps CSM) */
  shadows: 900,
  /** a temporary view-only cut (Explore's diorama) */
  view: 950,
} as const;

export interface ShaderPatchOptions {
  /** 'chain' (default) keeps what the material ran before; 'replace' drops it */
  mode?: 'chain' | 'replace';
  /** the program-cache key after this patch; omitted: the key the material had (three's default if none) */
  key?: ShaderPatchKey;
  /** removes the patch when the scope is disposed */
  scope?: Scope;
}

interface Entry { readonly id: string; readonly order: number; readonly seq: number; readonly fn: ShaderPatchFn }
interface State {
  entries: Entry[];
  /** the key function, or null for three's default (the last patch function's source text) */
  key: (() => string) | null;
  /** whether a site gave this material a key of its own (Sky.fillSlots leaves those alone) */
  explicitKey: boolean;
  readonly runner: ShaderPatchFn;
  readonly keyFn: () => string;
  /** the material's own hook and key before its first patch: an undo that empties the chain puts them back */
  readonly before: { hook: PropertyDescriptor | undefined; key: PropertyDescriptor | undefined };
}

const states = new WeakMap<THREE.Material, State>();
const used = new Map<string, number>();
let seq = 0;

const ownKey = (mat: THREE.Material): (() => string) | null =>
  Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey.bind(mat) : null;

const lastText = (entries: readonly Entry[]): string => entries.at(-1)?.fn.toString() ?? '';

function stateOf(mat: THREE.Material, mode: 'chain' | 'replace'): State {
  const known = states.get(mat);
  // a known material whose runner is still in place; else (first patch, or a foreign hook replaced the runner)
  // start over from what the material runs now
  if (known !== undefined && mat.onBeforeCompile === known.runner) {
    if (mode === 'replace') known.entries = [];
    return known;
  }
  const entries: Entry[] = [];
  if (mode === 'chain') entries.push({ id: 'inherited', order: PATCH_ORDER.inherited, seq: seq++, fn: mat.onBeforeCompile.bind(mat) });
  // the old sites assigned the hook and the key separately: a hook assignment never touched an own key
  const prevKey = known !== undefined && mat.customProgramCacheKey === known.keyFn ? known.key : ownKey(mat);
  const before = { hook: Object.getOwnPropertyDescriptor(mat, 'onBeforeCompile'), key: Object.getOwnPropertyDescriptor(mat, 'customProgramCacheKey') };
  const state: State = {
    entries, key: prevKey, explicitKey: prevKey !== null, before,
    runner: (shader, renderer) => { for (const e of state.entries) e.fn(shader, renderer); },
    keyFn: () => (state.key === null ? lastText(state.entries) : state.key()),
  };
  states.set(mat, state);
  mat.onBeforeCompile = state.runner;
  mat.customProgramCacheKey = state.keyFn;
  return state;
}

/**
 * Run `install` (a foreign addon that assigns `onBeforeCompile` itself: three's CSM) and hand back the hook it
 * installed, leaving the material's own hook in place; chain the hook back in with `patchShader`.
 */
export function takeForeignHook(mat: THREE.Material, install: () => void): ShaderPatchFn {
  const before = Object.getOwnPropertyDescriptor(mat, 'onBeforeCompile');
  install();
  const hook = mat.onBeforeCompile.bind(mat);
  if (before) Object.defineProperty(mat, 'onBeforeCompile', before); else Reflect.deleteProperty(mat, 'onBeforeCompile');
  return hook;
}

/**
 * Patch a material's shader source before it compiles. Returns the undo (Explore's diorama cut is temporary);
 * the material needs `needsUpdate = true` after either, as before.
 */
export function patchShader(mat: THREE.Material, id: string, order: number, fn: ShaderPatchFn, opts: ShaderPatchOptions = {}): () => void {
  const mode = opts.mode ?? 'chain';
  const state = stateOf(mat, mode);
  const entry: Entry = { id, order, seq: seq++, fn };
  state.entries = [...state.entries, entry].sort((a, b) => a.order - b.order || a.seq - b.seq);
  const keyBefore = state.key, explicitBefore = state.explicitKey;
  const { key } = opts;
  if (typeof key === 'string') { state.key = () => key; state.explicitKey = true; } else if (key !== undefined) {
    // the old `const k = mat.customProgramCacheKey.bind(mat)` read three's default lazily: the outermost hook's text
    const prior = keyBefore ?? ((): string => lastText(state.entries));
    state.key = () => key(prior());
    state.explicitKey = true;
  }
  used.set(id, (used.get(id) ?? 0) + 1);
  const undo = (): void => {
    if (!state.entries.includes(entry)) return;
    state.entries = state.entries.filter((e) => e !== entry);
    state.key = keyBefore; state.explicitKey = explicitBefore;
    if (mat.onBeforeCompile !== state.runner || !state.entries.every((e) => e.id === 'inherited')) return;
    // nothing of the registry's is left: put the material's own hook and key back exactly as they were
    const restore = (name: 'onBeforeCompile' | 'customProgramCacheKey', d: PropertyDescriptor | undefined): void => {
      if (d) Object.defineProperty(mat, name, d); else Reflect.deleteProperty(mat, name);
    };
    restore('onBeforeCompile', state.before.hook); restore('customProgramCacheKey', state.before.key);
    states.delete(mat);
  };
  opts.scope?.onDispose(undo);
  return undo;
}

/**
 * The hook every material inherits until a `replace` patch drops it (Atmosphere's fog uniforms). It stays on the
 * prototype, as before, so three's default key (its source text) is the one every unpatched material shares.
 */
export function setInheritedPatch(fn: (shader: ShaderSource) => void): void {
  THREE.Material.prototype.onBeforeCompile = fn;
}

/** Set a material's program-cache key with no source patch (a ShaderMaterial whose source is its own). */
export function setProgramKey(mat: THREE.Material, key: string): void {
  const fixed = (): string => key;
  mat.customProgramCacheKey = fixed;
}

/** Whether a site gave the material a program key of its own (Sky.fillSlots skips those). */
export function hasProgramKey(mat: THREE.Material): boolean {
  const state = states.get(mat);
  if (state !== undefined && mat.customProgramCacheKey === state.keyFn) return state.explicitKey;
  return Object.hasOwn(mat, 'customProgramCacheKey');
}

/** The patch ids in this material's chain, in run order (tests, the inventory). */
export function patchIds(mat: THREE.Material): string[] {
  const state = states.get(mat);
  return state === undefined || mat.onBeforeCompile !== state.runner ? [] : state.entries.map((e) => e.id);
}

/** Every patch id used so far, with how many materials took it (Debug, the inventory). */
export function usedPatchIds(): ReadonlyMap<string, number> { return used; }
