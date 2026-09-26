/**
 * The resident shards (SHARD-CACHE M4, E155 / E159): the user, 2026-09-25 — "I want the shards to stay in memory … I
 * definitely want to be able to go to the main menu and switch between the three shards", then "keep only TWO shards in
 * memory, not four, and make an evicted shard rebuild fast".
 *
 * One page, one shell (the loader, the AudioContext + the score, the service worker, the error modal), and up to `cap`
 * built shards, each a whole world of its own: its canvas + WebGL renderer (so its programs compile under its own shader
 * patches), its physics, HUD, sounds and systems (src/main.ts `buildShard`). One runs; the others are parked:
 *
 *   park       its loop stopped (Game.stop), its sound cut, its module state captured (src/core/shardState.ts), its
 *              listeners quiet and its elements out of the page (src/core/shardScope.ts)
 *   activate   the reverse, in place: no loading screen, the player where they stood, weapons / quest / map as left
 *   evict      the least recently used when a new one must be built past the cap: its renderer disposed and its WebGL
 *              context dropped, its physics world freed, its listeners removed, its elements gone
 *
 *   const host = new ShardHost({ build, cap: 2 });   // host.setCap(n): a test's knob
 *   await host.start('driftwood-isle');             // the first shard: exactly the boot a single-shard page had
 *   host.switchTo('pine-hollow', { enter: true });  // the deck's ENTER WORLD on another card (src/shard/switch.ts)
 *
 * The URL follows the running shard (`history.replaceState`, `?chunk=`), so every reload that stays a reload — Settings'
 * APPLY, a new build, GPU recovery, the error modal — lands on it.
 */
import * as THREE from 'three';
import { findChunk, setActiveChunk } from '../chunks/registry';
import { applyShardTier } from '../core/tier';
import { captureShardState, registerShaderChunks, resetShardState, restoreShardState, type ShardSnapshot } from '../core/shardState';
import { ShardScope, activateScope, claim, disposeScope, enterScope, installScopes, parkScope } from '../core/shardScope';
import type { ShardRequest } from './switch';
import { releaseDisposeListeners, trackDisposeListeners } from './disposeListeners';

/** a built shard, as the host drives it (src/main.ts buildShard makes one) */
export interface ShardWorld {
  readonly slug: string;
  /** out of play: exit to its title if in the world, loop stopped, sound cut */
  park: () => void;
  /** back in play: loop running, sound on, the request carried out (straight into the world / Explore) */
  activate: (req: ShardRequest) => void;
  /** evicted: everything given back (the GPU context, the physics world, its sound graph) */
  dispose: () => void;
  /** `window.__world` while it runs (the debug scripts read the running shard's) */
  readonly handle: unknown;
  /** its renderer, for the memory numbers */
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  /** its boot's steps, wall ms each (the timings of a build / rebuild) */
  readonly bootSteps: Readonly<Record<string, number>>;
}

export type ShardBuilder = (slug: string, first: boolean) => Promise<ShardWorld>;

interface Resident { world: ShardWorld; scope: ShardScope; saved: ShardSnapshot | null; globals: Map<string, unknown> }

/** `window.__*` names that are the page's, not a shard's (the service worker's handle, the host, a test's marker, the Heightfield module) */
const SHELL_GLOBALS = new Set(['__ws_sw', '__ws_prefetch', '__shardHost', '__e155', '__hf']);

/** one switch, timed (the test and the report read these) */
export interface SwitchTiming { from: string | null; to: string; kind: 'first' | 'resident' | 'build' | 'rebuild'; ms: number; evicted: string[]; at: number; steps?: Readonly<Record<string, number>> | undefined }

/** params that belong to the page's first shard only: a later build must not spawn at its `?at=` or skip its title */
const ONE_SHOT = ['at', 'glreload', 'x', 'z', 'yaw', 'pitch', 'explore', 'cam', 'model', 'skipintro', 'tour', 'quest', 'drop'];

export class ShardHost {
  /** how many built shards stay resident (the running one included) */
  private capacity: number;
  /** least → most recently used */
  private readonly resident = new Map<string, Resident>();
  private running: Resident | null = null;
  private busy = false;
  /** the shard being built now (it counts as running: its GPU recovery is live) */
  private building: string | null = null;
  private readonly built = new Set<string>();
  readonly timings: SwitchTiming[] = [];
  /** every eviction, with the state of the evicted renderer's context right after (the E159 test: it must be lost) */
  readonly evictions: { slug: string; contextLost: boolean; at: number }[] = [];
  /** `window.__*` names that existed before any shard (the browser's, a test harness's): never a shard's */
  private readonly pageGlobals: Set<string>;
  private readonly build: ShardBuilder;

  constructor(o: { build: ShardBuilder; cap: number }) {
    this.build = o.build;
    this.capacity = Math.max(1, Math.floor(o.cap));
    installScopes();
    trackDisposeListeners();
    this.pageGlobals = new Set(Object.keys(window).filter((k) => k.startsWith('__')));
    registerShaderChunks(THREE.ShaderChunk); // three's own chunks, before the first shard patches them
  }

  get cap(): number { return this.capacity; }
  /**
   * How many stay resident: pause ▸ Settings ▸ Debug ▸ Shards in memory (main.ts), and the E155 script's knob. Lowering it
   * evicts parked shards, least recently used first, at once; raising it keeps what is resident.
   */
  setCap(n: number): void {
    this.capacity = Math.max(1, Math.floor(n));
    if (this.busy) return; // a build in flight: the next switch evicts down
    for (const s of this.slugs) { if (this.resident.size <= this.capacity) break; this.evict(s); }
  }

  /** the texture estimate per shard: a parked one's cannot change, the running one's at most every 5 s (the Debug card) */
  private readonly texMB = new Map<ShardWorld, { mb: number; at: number }>();
  /**
   * The Debug card's memory readout: resident shards (least → most recently used) and their estimated texture MB. The
   * running shard's estimate (a walk of its scene) is redone when older than `maxAgeMs` (the page's alive beat, E179, asks
   * with a long one: it must not walk the scene every few seconds of play).
   */
  memory(maxAgeMs = 5000): { cap: number; shards: { slug: string; running: boolean; textureMB: number }[] } {
    const now = performance.now();
    const shards = [...this.resident.values()].map((r) => {
      const running = r === this.running, hit = this.texMB.get(r.world);
      const fresh = hit !== undefined && (!running || now - hit.at < maxAgeMs);
      const mb = fresh ? hit.mb : Math.round(textureBytes(r.world.scene) / 1e5) / 10;
      if (!fresh) this.texMB.set(r.world, { mb, at: now });
      return { slug: r.world.slug, running, textureMB: mb };
    });
    return { cap: this.capacity, shards };
  }

  /** the shard running now */
  get active(): string | null { return this.running?.world.slug ?? this.building; }
  /** the resident shards, least → most recently used */
  get slugs(): string[] { return [...this.resident.keys()]; }
  has(slug: string): boolean { return this.resident.has(slug); }
  /** is `slug` built but not running? (its GPU recovery stands down while parked) */
  isParked(slug: string): boolean { return this.active !== slug; }
  /** a switch or a build is under way */
  get switching(): boolean { return this.busy; }

  /** the page's first shard: the same boot as a single-shard page */
  async start(slug: string): Promise<void> {
    const t0 = performance.now();
    this.busy = true;
    try { await this.buildNew(slug, true); } finally { this.busy = false; }
    this.timings.push({ from: null, to: slug, kind: 'first', ms: performance.now() - t0, evicted: [], at: t0, steps: this.resident.get(slug)?.world.bootSteps });
  }

  /**
   * Play `slug`. Resident: synchronous (the deck's click is still the user gesture the pointer lock and the audio want).
   * Else the running shard is parked, the least recently used evicted past the cap, and `slug` built behind the loader;
   * it lands on its own title, as a reload did.
   */
  switchTo(slug: string, req: ShardRequest = {}): Promise<void> {
    if (findChunk(slug) === undefined) return Promise.resolve();
    const from = this.running;
    if (from?.world.slug === slug) { from.world.activate(req); return Promise.resolve(); }
    if (this.busy) return Promise.resolve();
    const t0 = performance.now();
    if (from) this.park(from);
    this.followUrl(slug, req);
    // E179: a parked shard whose context the browser took without a word (no `webglcontextlost` reached its host while it
    // was out of the page) would wake on a dead context, and its GPU recovery would RELOAD THE PAGE on the first draw.
    // Rebuilt instead, behind the loader: a switch never navigates.
    const stale = this.resident.get(slug);
    if (stale?.world.renderer.getContext().isContextLost() === true) { console.warn(`[shard] ${slug} lost its WebGL context while parked: rebuilt, not resumed`); this.evict(slug); }
    const hit = this.resident.get(slug);
    if (hit) {
      this.resume(hit, req);
      this.timings.push({ from: from?.world.slug ?? null, to: slug, kind: 'resident', ms: performance.now() - t0, evicted: [], at: t0 });
      return Promise.resolve();
    }
    this.busy = true;
    const evicted = [...this.resident.keys()].slice(0, Math.max(0, this.resident.size - this.capacity + 1)); // least recently used first
    for (const s of evicted) this.evict(s);
    const kind = this.built.has(slug) ? 'rebuild' : 'build';
    return this.buildNew(slug, false)
      .then(() => { this.timings.push({ from: from?.world.slug ?? null, to: slug, kind, ms: performance.now() - t0, evicted, at: t0, steps: this.resident.get(slug)?.world.bootSteps }); return undefined; })
      .finally(() => { this.busy = false; });
  }

  /** drop a parked shard (the cap, or its context was lost while parked); the running one is never evicted */
  evict(slug: string): void {
    const r = this.resident.get(slug);
    if (!r || r === this.running) return;
    this.resident.delete(slug);
    r.saved = null;
    this.texMB.delete(r.world);
    try { r.world.dispose(); } catch (e) { console.warn(`[shard] ${slug} did not dispose cleanly`, e); }
    this.evictions.push({ slug, contextLost: r.world.renderer.getContext().isContextLost(), at: performance.now() });
    r.globals.clear();
    const released = releaseDisposeListeners(r.scope); // off the objects other shards still use (src/shard/disposeListeners.ts)
    disposeScope(r.scope);
    console.info(`[shard] evicted ${slug} (${released} dispose listeners released)`);
  }

  /**
   * The shard's debug globals (`window.__world`, `__stealth`, `__elites` … — 27 scripts read `__world`): they name the
   * running shard's objects, so they leave with it and come back with it (and an evicted shard's are simply dropped)
   */
  private takeGlobals(): Map<string, unknown> {
    const out = new Map<string, unknown>();
    for (const k of Object.keys(window)) {
      if (!k.startsWith('__') || SHELL_GLOBALS.has(k) || this.pageGlobals.has(k)) continue;
      out.set(k, Reflect.get(window, k));
      Reflect.deleteProperty(window, k);
    }
    return out;
  }

  private park(r: Resident): void {
    r.world.park();
    r.globals = this.takeGlobals();
    r.saved = captureShardState();
    parkScope(r.scope);
    enterScope(null);
    this.running = null;
  }

  private resume(r: Resident, req: ShardRequest): void {
    setActiveChunk(r.world.slug); // config + the def's samplers
    applyShardTier(r.world.slug);
    if (r.saved) restoreShardState(r.saved); // …then its own module state (its bake, its physics, its shader chunks …)
    r.saved = null;
    for (const [k, v] of r.globals) Reflect.set(window, k, v);
    r.globals.clear();
    activateScope(r.scope);
    enterScope(r.scope);
    this.resident.delete(r.world.slug); this.resident.set(r.world.slug, r); // most recently used
    this.running = r;
    r.world.activate(req);
  }

  private async buildNew(slug: string, first: boolean): Promise<void> {
    const scope = new ShardScope(slug);
    if (!first) resetShardState(); // the new shard's modules start as a fresh page's would
    setActiveChunk(slug);
    applyShardTier(slug);
    enterScope(scope);
    if (first) {
      // index.html's canvas and HUD root are the first shard's
      claim(scope, document.getElementById('game'));
      claim(scope, document.getElementById('hud'));
    } else {
      // a later shard gets its own, where index.html's stood (the parked ones' are out of the page)
      const anchor = document.querySelector('.ws-resume');
      const canvas = document.createElement('canvas'); canvas.id = 'game';
      const hud = document.createElement('div'); hud.id = 'hud';
      if (anchor) { anchor.before(canvas); anchor.before(hud); } else document.body.append(canvas, hud);
    }
    this.building = slug;
    try {
      const world = await this.build(slug, first);
      const r: Resident = { world, scope, saved: null, globals: new Map() };
      this.resident.set(slug, r);
      this.running = r;
      this.built.add(slug);
    } finally { this.building = null; }
  }

  /** the address names the running shard; a later build reads its params from it (first-shard-only ones dropped) */
  private followUrl(slug: string, req: ShardRequest): void {
    const u = new URL(location.href);
    for (const p of ONE_SHOT) u.searchParams.delete(p);
    u.searchParams.set('chunk', slug);
    if (req.explore === true && !this.resident.has(slug)) u.searchParams.set('explore', 'hub'); // a new build opens its hub, as the reload did
    history.replaceState(history.state, '', u);
  }

  /**
   * The E159 test's stand-in for a browser taking a parked shard's context (the per-page context limit, iOS under memory
   * pressure): its GPU recovery sees it parked and hands it to `evict` (main.ts `onLostParked`). Parked shards only.
   */
  debugLoseContext(slug: string): void {
    const r = this.resident.get(slug);
    if (r && r !== this.running) r.world.renderer.forceContextLoss();
  }

  /** GPU / heap numbers per resident shard (the E155 test; `window.__shardHost.stats()`) */
  stats(): { slug: string; running: boolean; geometries: number; textures: number; programs: number; textureMB: number; contextLost: boolean }[] {
    return [...this.resident.values()].map((r) => {
      const w = r.world, info = w.renderer.info;
      return {
        slug: w.slug, running: r === this.running, geometries: info.memory.geometries, textures: info.memory.textures,
        programs: info.programs?.length ?? 0, textureMB: Math.round(textureBytes(w.scene) / 1e5) / 10, contextLost: w.renderer.getContext().isContextLost(),
      };
    });
  }
}

/**
 * An estimate of the texture memory a scene holds: every texture its materials and uniforms reference, once, at its
 * pixel size × bytes per texel (× 4/3 with mipmaps; × 6 for a cube, × depth for an array). Render targets (the composer's,
 * the shadow maps) are not in the scene and not counted; a compressed (KTX2) texture counts at its format's block size
 * (ASTC 4×4 / BC7 / ETC2 EAC: 1 byte a texel; ETC1 / ETC2 RGB / BC1 / PVRTC 4bpp: ½).
 */
export function textureBytes(scene: THREE.Object3D): number {
  const seen = new Set<object>();
  const add = (v: unknown): void => { if (v instanceof THREE.Texture) seen.add(v as object); };
  const fromMaterial = (m: THREE.Material): void => {
    for (const v of Object.values(m)) add(v);
    const u = (m as Partial<THREE.ShaderMaterial>).uniforms;
    if (u) for (const x of Object.values(u)) { const val: unknown = x.value; if (Array.isArray(val)) val.forEach(add); else add(val); }
  };
  scene.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material;
    if (Array.isArray(m)) m.forEach(fromMaterial); else if (m) fromMaterial(m);
  });
  if (scene instanceof THREE.Scene) { add(scene.background); add(scene.environment); }
  let bytes = 0;
  const num = (o: unknown, k: string): number => { const n: unknown = typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined; return typeof n === 'number' ? n : 0; };
  for (const t of seen) {
    const img: unknown = Reflect.get(t, 'image');
    const w = num(img, 'width'), h = num(img, 'height');
    if (w <= 0 || h <= 0) continue;
    const layers = t instanceof THREE.CubeTexture ? 6 : Math.max(1, num(img, 'depth'));
    const type = num(t, 'type'), format = num(t, 'format'), minFilter = num(t, 'minFilter');
    const compressed = t instanceof THREE.CompressedTexture, filtered = minFilter !== THREE.LinearFilter && minFilter !== THREE.NearestFilter;
    const bpp = compressed ? blockBytesPerTexel(format) : type === THREE.FloatType ? 16 : type === THREE.HalfFloatType ? 8 : format === THREE.RedFormat ? 1 : 4;
    // a KTX2 texture carries its own mip chain (its JS copy is dropped once uploaded: count the chain, not the array)
    const mips = compressed ? filtered : Reflect.get(t, 'generateMipmaps') === true && filtered;
    bytes += w * h * layers * bpp * (mips ? 4 / 3 : 1);
  }
  return bytes;
}

/** bytes a texel of a GPU-compressed format takes (its block's bytes ÷ its texels) */
function blockBytesPerTexel(format: number): number {
  switch (format) {
    case THREE.RGB_ETC1_Format: case THREE.RGB_ETC2_Format: case THREE.RGB_S3TC_DXT1_Format: case THREE.RGBA_S3TC_DXT1_Format:
    case THREE.RGB_PVRTC_4BPPV1_Format: case THREE.RGBA_PVRTC_4BPPV1_Format: case THREE.RED_RGTC1_Format: case THREE.SIGNED_RED_RGTC1_Format:
      return 0.5;
    case THREE.RGB_PVRTC_2BPPV1_Format: case THREE.RGBA_PVRTC_2BPPV1_Format:
      return 0.25;
    default:
      return 1; // ASTC 4×4, BC7 (BPTC), BC3 / DXT5, ETC2 EAC, RGTC2
  }
}
