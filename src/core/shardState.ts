/**
 * Module state per resident shard (SHARD-CACHE M3, E155). The engine was written for one shard per page: a module keeps
 * the running shard's things in its own variables (the physics world, the registry, the clock, the fog's uniforms, the
 * shader chunks three compiles from). With several shards in memory only one runs at a time, so those variables only
 * ever need to hold the RUNNING shard's values:
 *
 *   shardSlot('physics.active', () => current, (v) => { current = v; });   // a module registers each variable, once
 *   stateSlot('atmosphere.fog', fogUniforms);                              // a uniform bag / plain object: its fields
 *
 * and the shard host (src/shard/ShardHost.ts) swaps them:
 *
 *   const saved = captureShardState();   // parking a shard: what its modules hold now
 *   resetShardState();                    // before building another: every slot back to its first value
 *   restoreShardState(saved);             // activating it again: its own values back (a slot it never knew: reset)
 *
 * A module that is never registered keeps one value for the page — right for caches keyed by what they hold (a texture
 * per URL, a material per Sky) and for anything only the shell uses. A single-shard session never captures, resets or
 * restores anything: it runs exactly as before.
 *
 * `stateSlot` copies an object's own fields: a `{ value }` uniform and a three.js maths value (Color, Vector*, Matrix*,
 * Quaternion) are copied INTO the live objects on restore, so every material that holds the uniform sees the change;
 * anything else (a function, a texture, an array, null) is put back by reference.
 */

type Restore = () => void;
interface Slot { capture: () => Restore; reset: () => void }

const slots = new Map<string, Slot>();

/** a module variable, per shard: `get` reads it, `set` writes it; `fresh` makes the value a new shard starts from (default: its first value) */
export function shardSlot<T>(name: string, get: () => T, set: (v: T) => void, fresh?: () => T): void {
  // with `fresh` the first value is not kept: it is the first shard's live container (a Map it fills), and holding it
  // would hold that shard for the page's life
  const first = fresh ?? ((v: T) => () => v)(get());
  slots.set(name, {
    capture: () => { const v = get(); return () => { set(v); }; },
    reset: () => { set(first()); },
  });
}

/** a copyable maths value (three's Color / Vector2-4 / Matrix3-4 / Quaternion all have `clone` and `copy`) */
interface Copyable { clone: () => Copyable; copy: (v: Copyable) => unknown }
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isCopyable = (v: unknown): v is Copyable => {
  if (!isRecord(v)) return false;
  // a Texture has clone / copy too, but is shared by reference (copying one would re-upload it)
  if (v['isTexture'] === true) return false;
  return v['isColor'] === true || v['isVector2'] === true || v['isVector3'] === true || v['isVector4'] === true || v['isMatrix3'] === true || v['isMatrix4'] === true || v['isQuaternion'] === true;
};
const isUniform = (v: unknown): v is { value: unknown } => isRecord(v) && Object.keys(v).length === 1 && 'value' in v;

type FieldSnap = { kind: 'uniform-copy'; target: Copyable; v: Copyable } | { kind: 'uniform'; target: { value: unknown }; v: unknown } | { kind: 'copy'; v: Copyable } | { kind: 'ref'; v: unknown };

function snapField(v: unknown): FieldSnap {
  if (isUniform(v)) return isCopyable(v.value) ? { kind: 'uniform-copy', target: v.value, v: v.value.clone() } : { kind: 'uniform', target: v, v: v.value };
  if (isCopyable(v)) return { kind: 'copy', v: v.clone() };
  return { kind: 'ref', v };
}

function snapObject(obj: Record<string, unknown>): Map<string, FieldSnap> {
  const out = new Map<string, FieldSnap>();
  for (const k of Object.keys(obj)) out.set(k, snapField(obj[k]));
  return out;
}

function applyObject(obj: Record<string, unknown>, snap: ReadonlyMap<string, FieldSnap>): void {
  for (const k of Object.keys(obj)) if (!snap.has(k)) Reflect.deleteProperty(obj, k); // a hook set since (swordEvents.onSwing …)
  for (const [k, s] of snap) {
    const live = obj[k];
    if (s.kind === 'uniform-copy') { if (isUniform(live) && isCopyable(live.value)) live.value.copy(s.v); else obj[k] = { value: s.v.clone() }; }
    else if (s.kind === 'uniform') { if (isUniform(live)) live.value = s.v; else obj[k] = { value: s.v }; }
    else if (s.kind === 'copy') { if (isCopyable(live)) live.copy(s.v); else obj[k] = s.v.clone(); }
    else obj[k] = s.v;
  }
}

/** an object's own fields, per shard (a uniform bag, a hook object, a table of knobs); reset = the fields it had when registered */
export function stateSlot(name: string, obj: object): void {
  const target = obj as Record<string, unknown>;
  const initial = snapObject(target);
  slots.set(name, {
    capture: () => { const s = snapObject(target); return () => { applyObject(target, s); }; },
    reset: () => { applyObject(target, initial); },
  });
}

/** an array's items, per shard (a module list that a shard fills: the flock's wolves …); reset = empty */
export function listSlot(name: string, list: unknown[]): void {
  slots.set(name, {
    capture: () => { const items = [...list]; return () => { list.length = 0; list.push(...items); }; },
    reset: () => { list.length = 0; },
  });
}

/** a set's members, per shard (a module's registry of live instances); reset = empty */
export function setSlot(name: string, set: Set<unknown>): void {
  slots.set(name, {
    capture: () => { const items = [...set]; return () => { set.clear(); for (const x of items) set.add(x); }; },
    reset: () => { set.clear(); },
  });
}

/** a map's entries, per shard (a module cache of loaded assets that must not cross renderers); reset = empty */
export function mapSlot(name: string, map: Map<unknown, unknown>): void {
  slots.set(name, {
    capture: () => { const entries = [...map]; return () => { map.clear(); for (const [k, v] of entries) map.set(k, v); }; },
    reset: () => { map.clear(); },
  });
}

export type ShardSnapshot = ReadonlyMap<string, Restore>;

/** every slot's value now (parking the running shard) */
export function captureShardState(): ShardSnapshot {
  const out = new Map<string, Restore>();
  for (const [name, s] of slots) out.set(name, s.capture());
  return out;
}

/** a shard's values back (activating it); a slot registered after it was captured (a module first imported since) resets */
export function restoreShardState(snap: ShardSnapshot): void {
  for (const [name, s] of slots) { const r = snap.get(name); if (r) r(); else s.reset(); }
}

/** every slot to its first value (before a shard is built next to others) */
export function resetShardState(): void { for (const s of slots.values()) s.reset(); }

/** diagnostics: the registered slot names */
export function shardSlotNames(): string[] { return [...slots.keys()]; }

// three's shader chunks: each shard patches them for its own look (Atmosphere, stylize, the Nalati fog, the CSM light
// loop, the shadow filter / fade) and compiles its programs from them. Registered here, before anything patches them,
// so the reset is three's own source. (three is imported by src/boot/entry.ts before the game's modules run.)
let chunkSlotDone = false;
/** register THREE.ShaderChunk as a slot — called by the shard host before the first shard builds (three's pristine chunks) */
export function registerShaderChunks(chunks: Record<string, string>): void {
  if (chunkSlotDone) return;
  chunkSlotDone = true;
  stateSlot('three.ShaderChunk', chunks);
}
