import { elitesSave } from './saves';
import * as THREE from 'three';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { fxMaterial, annulus, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import { WeaponPickup } from '@wildshard/engine/player/WeaponPickup';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { EliteBar } from '@wildshard/engine/ui/EliteBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { EliteCore, type EliteCoreEntry, type EliteCoreRule, type EliteCoreScript } from './eliteSystem';

/**
 * Elite — the engine's NAMED ELITE system (docs/design/nalati/elites-and-bosses.md §1; plan NALATI.md row B12). "Elites
 * live in the world, bosses own the screen." This is the generic half every shard reuses — each elite's own AI is an
 * `EliteScript` (Nalati's five: src/shards/nalati-grasslands/combat/elites.ts).
 *
 *   const elites = new Elites(host, bar);            // bar = new EliteBar() (src/engine/ui/EliteBar.ts)
 *   elites.add(script);                              // one per elite: its EliteDef + its brain
 *   game.onUpdate((dt, t) => elites.update(dt, t));
 *
 * What the system does for every elite:
 *   · PLACEMENT + SPAWN RULE — placed at its lair, only while its rule holds ('always' | 'dusk' | 'night' | 'storm',
 *     `host.condition(rule)`), one alive at a time; a dusk / night / storm elite leaves when its rule ends (unengaged).
 *   · AWARE → ENGAGED → LEASH — aware inside `awareR` (the named bar shows OVER ITS HEAD), engaged inside `engageR` or
 *     on a hit (the bar PINS top-centre — the user's rule), and past `leashR` from the lair it disengages, walks home
 *     (`script.leash`) and regenerates to full.
 *   · PHASE 2 AT 50 % — a 1 s invulnerable beat, "ENRAGED" (or the def's caption) under the bar, `script.enterPhase2()`.
 *   · THE BANNER — "NAMED ELITE NEARBY · name · epithet", once per approach (first aware inside 80 m, or entering the
 *     lair); re-armed after 60 s beyond the leash.
 *   · DEATH → DROP + TIMER — the first kill drops the cosmetic skin in the purple orb (`WeaponPickup` tier 'rare') + the
 *     trophy; later kills the trophy only. The kill itself goes through the AnimalManager (kill feed, Progress →
 *     the achievement + joke title). The lair then sleeps `respawnMin` minutes of PLAY time (persisted, 'ws.elites.v1');
 *     a dusk / night elite comes back at the next dusk after that. A `once` elite (Argymaq) never comes back.
 *   · THE SKULL — a gold skull on the minimap at a discovered lair (you came within 60 m, or it saw you): pulsing while
 *     engaged, grey with a countdown ring while dead (`EliteBar.skulls`).
 *   · TELLS — `GroundTell`: a pooled, terrain-draped ring / lane decal (one FX program) for the signature move's tell.
 */

export type EliteRule = EliteCoreRule;

export interface EliteDef {
  id: string;
  /** "Aqbars the Pale" / "Irbis of the Crags" */
  name: string;
  epithet: string;
  lair: { x: number; z: number; r: number };
  awareR: number; engageR: number; leashR: number;
  rule: EliteRule;
  /** minutes of play before the lair wakes again */
  respawnMin: number;
  /** a one-time elite (Argymaq: once tamed, the lair retires) */
  once?: boolean;
  /** the signature move's name — flashes under the bar the first time you see it */
  signature: string;
  /** the phase-2 caption ("ENRAGED") */
  phase2: string;
  /** the first-kill drop (cosmetic) and the trophy every kill leaves. `skin: null` — no skin, the prize is something
   *  else (Argymaq: the horse himself, E314 C); no `trophyName` — no trophy (Nalati: no pack, E314 C) */
  drop: { skin: string | null; skinName: string; weapon: string; blurb: string; trophyName?: string };
}

/** One elite's brain on the page: the rules' script (eliteSystem.ts `EliteCoreScript`) over an Animal, plus its bar and drop. */
export interface EliteScript extends EliteCoreScript<Animal> {
  readonly def: EliteDef;
  /** the bar's fill 0..1 (default hp / maxHp) — Argymaq's reads 0 at BROKEN */
  barFrac?: () => number;
  /** the drop orb's display model */
  dropModel: () => THREE.Object3D;
}

export interface EliteHost {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer?: Renderer;
  player: { position: THREE.Vector3 };
  condition: (rule: EliteRule) => boolean;
  addInteractable: (it: Interactable) => void;
  removeInteractable: (it: Interactable) => void;
  toast: (text: string) => void;
  /** the "named elite nearby" sting / the phase roar / the kill (music + audio) */
  sting?: (event: 'banner' | 'phase2' | 'kill') => void;
  pickupHum?: (inside: boolean) => void;
  /** a first-kill skin was taken: own it (B15 wears it) */
  ownSkin?: (skin: string) => void;
  /** does the eye see the elite's head (no wall / rock / ground between)? The name over its head hides while it does not
   *  (a cabin wall between you and it); absent = always seen */
  canSee?: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
}

type Entry = EliteCoreEntry<EliteScript>;

const SIGHT_EVERY = 0.2;
const _h = new THREE.Vector3();

/** Optional typed persistence for runtime-bound lairs; the default remains the legacy shard slot. */
export interface ElitePersistence {
  read: (slug: string) => ReturnType<typeof elitesSave.read>;
  write: (value: ReturnType<typeof elitesSave.read>, slug: string) => void;
}

/** The named elite system on the page: the renderer-free rules (eliteSystem.ts `EliteCore`) plus the bar, banner, orb and skulls. */
export class Elites {
  private readonly scope = resourceScope().child('Elites');
  private readonly core: EliteCore<EliteScript>;
  /** the lairs' first-kill orbs while they float */
  private readonly drops = new Map<Entry, WeaponPickup>();
  /** the elite whose bar is up (nearest aware / engaged) */
  focus: Entry | null = null;
  /** the focus's head in line of sight (re-cast every SIGHT_EVERY s while its bar floats over its head) */
  private seen = true; private sightT = 0;

  constructor(private readonly host: EliteHost, private readonly bar: EliteBar, slug: string, persistence: ElitePersistence = elitesSave) {
    this.core = new EliteCore<EliteScript>(host, {
      spawned: (e) => { this.drops.delete(e); },
      broken: (e, entering) => {
        if (entering) { this.focus = e; this.bar.show(e.script.def.name, e.script.def.epithet); this.bar.caption('BROKEN'); }
        const a = e.script.animal; if (a === null) return;
        a.headWorld(_h); _h.y += 0.55 * a.scale;
        this.bar.set(0, 'pinned', _h, this.host.camera, false, true);
      },
      banner: (e) => { this.bar.banner(e.script.def.name, e.script.def.epithet); this.host.sting?.('banner'); },
      phase2: (e) => { if (this.focus === e) this.bar.caption(e.script.def.phase2); this.host.sting?.('phase2'); },
      signature: (e) => { if (this.focus === e) this.bar.caption(e.script.def.signature); },
      fell: (e, firstSkin) => {
        const a = e.script.animal;
        this.host.sting?.('kill');
        if (firstSkin && a && e.script.def.drop.skin !== null) this.dropSkin(e, a.position);
        if (this.focus === e) { this.bar.set(0, 'pinned', null, this.host.camera, false); this.focus = null; this.scope.timeout(1600, () => { if (this.focus === null) this.bar.hide(); }); }
      },
      // Argymaq: no skin, the horse is the prize
      won: (e, firstSkin) => { const skin = e.script.def.drop.skin; if (firstSkin && skin !== null) this.host.ownSkin?.(skin); },
      retired: (e) => { if (this.focus === e) { this.focus = null; this.bar.hide(); } },
    }, slug, persistence);
  }

  get entries(): readonly Entry[] { return this.core.entries; }
  add(script: EliteScript): void { this.core.add(script); }
  /** Materialize eligible lair actors before restoring a rebuilt world, without advancing AI, timers or rewards. */
  initialize(): void { this.core.initialize(); }
  entry(id: string): Entry | undefined { return this.core.entry(id); }
  owned(id: string): boolean { return this.core.owned(id); }
  /** dev: spawn it now next to (x, z) whatever its rule (`?elite=`) */
  devSpawn(id: string): Animal | null { return this.core.devSpawn(id); }
  /** the script says this elite moved its signature move now: flash its name the first time */
  signature(id: string): void { this.core.signature(id); }
  /** a once elite won for good (Argymaq tamed): the trophy + the "skin" (the horse is the reward), the lair retires */
  won(id: string): void { this.core.won(id); }

  update(dt: number, t: number): void {
    const p = this.host.player.position;
    const best = this.core.update(dt, t);
    // ── the bar: the nearest aware / engaged elite ──
    if (best !== this.focus) {
      this.focus = best; this.sightT = 0;
      if (best) this.bar.show(best.script.def.name, best.script.def.epithet); else this.bar.hide();
    }
    if (this.focus) {
      const e = this.focus, a = e.script.animal;
      if (a) {
        a.headWorld(_h); _h.y += 0.55 * a.scale;
        const pinned = e.state === 'engaged';
        // the floating name is world-anchored: behind a wall it hides (a pinned bar is the fight's and stays)
        if (pinned || !this.host.canSee) { this.seen = true; this.sightT = 0; }
        else if ((this.sightT -= dt) <= 0) { this.sightT = SIGHT_EVERY; this.seen = this.host.canSee(this.host.camera.position, _h); }
        this.bar.set(e.script.barFrac?.() ?? a.hp / a.maxHp, pinned ? 'pinned' : 'head', _h, this.host.camera, e.beatT > 0, false, !this.seen);
      }
    }
    this.bar.skulls(this.core.entries.map((e) => ({
      x: e.script.def.lair.x, z: e.script.def.lair.z, shown: e.discovered && e.state !== 'retired',
      dead: e.state === 'dead', engaged: e.state === 'engaged', countdown: e.state === 'dead' ? e.timer / (e.script.def.respawnMin * 60) : 0,
    })), p);
    for (const [e, drop] of this.drops) { drop.update(dt, t, this.host.renderer, this.host.camera); if (drop.group.parent === null) this.drops.delete(e); }
    this.bar.update(dt);
  }

  private dropSkin(e: Entry, at: THREE.Vector3): void {
    const def = e.script.def, skin = def.drop.skin;
    if (skin === null) return;
    const drop = new WeaponPickup({ scene: this.host.scene, item: e.script.dropModel(), position: new THREE.Vector3(at.x, heightAt(at.x, at.z), at.z), tier: 'rare', prompt: `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, scale: 1.4 });
    this.drops.set(e, drop);
    this.host.addInteractable(drop.interactable);
    drop.onNear = (inside) => this.host.pickupHum?.(inside);
    drop.onPickup = () => {
      const s = this.core.record(def.id);
      if (s) s.skinTaken = true;
      this.core.save();
      this.host.ownSkin?.(skin);
      this.host.removeInteractable(drop.interactable);
      this.host.pickupHum?.(false);
      this.host.toast(`${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`);
    };
  }
}

// ─────────────────────────────── the telegraph decals ───────────────────────────────

/**
 * GroundTell — a terrain-draped telegraph decal (a ring at your feet, a lane across the grass), drawn over the grass
 * (depth test off: a tell must never hide) with the shared FX program. `ring(x, z, r, alpha)` / `lane(x0, z0, x1, z1,
 * width, alpha)` re-drape it (≤ 130 heightAt calls — only when it moves); `hide()`.
 */
/** Wedge-specific shader parameters are authored by the caller; geometry/draping is shared. */
export interface GroundTellWedgeStyle {
  cone: number;
  material: THREE.ShaderMaterial;
  fill: THREE.IUniform<number>;
  alpha: THREE.IUniform<number>;
}

export class GroundTell {
  readonly mesh: THREE.Mesh;
  private readonly mat: FxMaterial | null;
  private readonly base: Float32Array;
  private readonly pos: THREE.BufferAttribute;
  constructor(scene: THREE.Scene, kind: 'ring' | 'lane' | 'wedge', color: THREE.ColorRepresentation, private readonly wedgeStyle?: GroundTellWedgeStyle) {
    let g: THREE.BufferGeometry;
    if (kind === 'ring') g = annulus(0.86, 1, 64);
    else if (kind === 'wedge') {
      if (wedgeStyle === undefined) throw new Error('GroundTell wedge needs a shader profile');
      const R = 7, N = 14, uv: number[] = [], idx: number[] = [];
      for (let r = 0; r <= R; r++) for (let n = 0; n <= N; n++) uv.push(n / N, r / R);
      for (let r = 0; r < R; r++) for (let n = 0; n < N; n++) { const a = r * (N + 1) + n, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(uv.length / 2 * 3), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    } else {
      // a unit lane: x across (−0.5..0.5), z along (0..1); uv.x along, uv.y across (the ring look: a bright band)
      const seg = 24, P: number[] = [], U: number[] = [], N: number[] = [], I: number[] = [];
      for (let i = 0; i <= seg; i++) { const z = i / seg; P.push(-0.5, 0, z, 0.5, 0, z); U.push(z, 0, z, 1); N.push(0, 1, 0, 0, 1, 0); if (i < seg) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
    }
    this.pos = g.getAttribute('position') as THREE.BufferAttribute;
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.base = new Float32Array(this.pos.array);
    if (kind === 'wedge' && wedgeStyle !== undefined) {
      this.mat = null;
      const R = 7, N = 14;
      for (let r = 0; r <= R; r++) for (let n = 0; n <= N; n++) {
        const a = (n / N - 0.5) * 2 * wedgeStyle.cone, rr = r / R, i = r * (N + 1) + n;
        // Retain the legacy two-component Float32 rounding before reach/yaw application.
        this.base[i * 3] = Math.sin(a) * rr; this.base[i * 3 + 2] = Math.cos(a) * rr;
      }
      this.mesh = new THREE.Mesh(g, wedgeStyle.material);
      this.mesh.renderOrder = 9;
    } else {
      this.mat = fxMaterial(FX.ring, color, 0);
      this.mat.uniforms.uP.value.x = kind === 'ring' ? 0.8 : 0.6;
      this.mat.depthTest = kind !== 'ring';
      this.mesh = new THREE.Mesh(g, this.mat);
      this.mesh.renderOrder = 30;
    }
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
  }
  setTime(t: number): void { if (this.mat !== null) this.mat.uniforms.uTime.value = t; }
  hide(): void { this.mesh.visible = false; }
  ring(x: number, z: number, r: number, alpha: number, lift = 0.35): void {
    const b = this.base, P = this.pos;
    for (let i = 0; i < P.count; i++) { const lx = (b[i * 3] ?? 0) * r, lz = (b[i * 3 + 2] ?? 0) * r; P.setXYZ(i, x + lx, heightAt(x + lx, z + lz) + lift, z + lz); }
    P.needsUpdate = true; this.show(alpha);
  }
  lane(x0: number, z0: number, x1: number, z1: number, width: number, alpha: number, lift = 0.35): void {
    const b = this.base, P = this.pos, dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, ax = -dz / L, az = dx / L;
    for (let i = 0; i < P.count; i++) {
      const across = (b[i * 3] ?? 0) * width, along = b[i * 3 + 2] ?? 0;
      const x = x0 + dx * along + ax * across, z = z0 + dz * along + az * across;
      P.setXYZ(i, x, heightAt(x, z) + lift, z);
    }
    P.needsUpdate = true; this.show(alpha);
  }
  /** Animal yaw convention: forward = (sin, cos); fill runs from the feet toward the tip. */
  wedge(x: number, z: number, yaw: number, reach: number, fill: number, alpha: number, lift = 0.06): void {
    const profile = this.wedgeStyle;
    if (profile === undefined) throw new Error('GroundTell is not a wedge');
    const c = Math.cos(yaw), s = Math.sin(yaw), p = this.pos.array;
    for (let i = 0; i < this.pos.count; i++) {
      const lx = (this.base[i * 3] ?? 0) * reach, lz = (this.base[i * 3 + 2] ?? 0) * reach;
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      p[i * 3] = wx; p[i * 3 + 1] = heightAt(wx, wz) + lift; p[i * 3 + 2] = wz;
    }
    this.pos.needsUpdate = true; profile.fill.value = fill; profile.alpha.value = alpha; this.mesh.visible = true;
  }
  private show(alpha: number): void { if (this.mat !== null) this.mat.uniforms.uAlpha.value = alpha; this.mesh.visible = alpha > 0.01; }
}
