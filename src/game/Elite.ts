import { ExternalElitePage } from './quest/elitePage';
import { NativeEliteController } from '@wildshard/engine/ai/view/eliteController';
import type { DeclaredEliteEntry, EliteEntryLoans } from '@wildshard/engine/ai/view/eliteEntry';
import { ObservationColumnsV2, type V2EnvironmentColumns } from '@wildshard/engine/script/observationColumnsV2';
import { parseEliteEntryPageRows } from '@wildshard/format/eliteEntryRows';
import type { ReturnProgram } from './population/returnProgram';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { PouncerLedge } from '@wildshard/engine/ai/stalker';
import type { PatrolEncounterView } from './boss/encounterView';
import type { PageWildlife } from './population/wildlife';
import type { PageWildEnvironment } from './population/pageGroups';
import type { AdventurePersistence } from './quest/persistence';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { canReach } from '@wildshard/engine/ai/reach';
import { strikeFromData, type StrikeData } from '@wildshard/engine/ai/strikeRows';
import { app } from '@wildshard/engine/app/runtime';
import type { CrowdTargets } from './shardfile/crowdRuntime';
import { parseEliteOutputActions, parseEliteOutputBank, type EliteEnteredPresentation, type EliteOutputAction, type EliteOutput } from '@wildshard/format/eliteFeature';
import { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import type { HUD } from '@wildshard/engine/ui/HUD';
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

/** Concrete entered owners; no author callbacks or service-name resolution. */
export interface EliteEnteredOwners {
  readonly scope: Scope; readonly interactables: Interactable[];
  readonly hud: HUD; readonly audio: Audio; readonly music: Music;
}
type PresentationCallbacks = 'addInteractable' | 'removeInteractable' | 'toast' | 'sting' | 'pickupHum';
type PageEliteHost = Omit<EliteHost, PresentationCallbacks> & Partial<Pick<EliteHost, PresentationCallbacks>>;
type Entry = EliteCoreEntry<EliteScript>;
interface PreparedEliteOutputs { readonly validate: () => void; readonly operations: readonly (() => void)[] }
type EliteOutputPrepare = (bank: readonly EliteOutput[], actors: readonly (Animal | null)[]) => PreparedEliteOutputs;

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
  private entered: { readonly owners: EliteEnteredOwners; readonly rows: EliteEnteredPresentation; readonly outputs?: EliteOutputPrepare; readonly actions?: readonly EliteOutputAction[]; readonly validateOutputs?: () => void; readonly drainOutputs?: () => void } | null = null;
  /** the lairs' first-kill orbs while they float */
  private readonly drops = new Map<Entry, WeaponPickup>();
  /** the elite whose bar is up (nearest aware / engaged) */
  focus: Entry | null = null;
  /** the focus's head in line of sight (re-cast every SIGHT_EVERY s while its bar floats over its head) */
  private seen = true; private sightT = 0;

  constructor(private readonly host: PageEliteHost, private readonly bar: EliteBar, slug: string, private readonly persistence: ElitePersistence = elitesSave) {
    this.core = new EliteCore<EliteScript>(host, {
      spawned: (e) => { this.drops.delete(e); },
      broken: (e, entering) => {
        if (entering) { this.focus = e; this.bar.show(e.script.def.name, e.script.def.epithet); this.bar.caption('BROKEN'); }
        const a = e.script.animal; if (a === null) return;
        a.headWorld(_h); _h.y += 0.55 * a.scale;
        this.bar.set(0, 'pinned', _h, this.host.camera, false, true);
      },
      banner: (e) => { this.bar.banner(e.script.def.name, e.script.def.epithet); this.sting(e, 'banner'); },
      phase2: (e) => { if (this.focus === e) this.bar.caption(e.script.def.phase2); this.sting(e, 'phase2'); },
      signature: (e) => { if (this.focus === e) this.bar.caption(e.script.def.signature); },
      fell: (e, firstSkin) => {
        const a = e.script.animal;
        this.sting(e, 'kill');
        if (firstSkin && a && e.script.def.drop.skin !== null) this.dropSkin(e, a.position);
        if (this.focus === e) { this.bar.set(0, 'pinned', null, this.host.camera, false); this.focus = null; this.scope.timeout(1600, () => { if (this.focus === null) this.bar.hide(); }); }
      },
      // Argymaq: no skin, the horse is the prize
      won: (e, firstSkin) => { const skin = e.script.def.drop.skin; if (firstSkin && skin !== null) this.host.ownSkin?.(skin); },
      retired: (e) => { if (this.focus === e) { this.focus = null; this.bar.hide(); } },
    }, slug, persistence);
  }

  get entries(): readonly Entry[] { return this.core.entries; }
  add(script: EliteScript): void {
    if (this.entered !== null) throw new Error('Elite presentation identities are already bound');
    this.core.add(script);
  }
  /** Resolve only original typed authorities for an admitted engine entry.
   * Controller selection, condition cadence and lifecycle ordering live in the
   * engine; this owner retains presentation, native effects and persistence. */
  bindDeclaredEntry<T extends CrowdTargets>(entry: DeclaredEliteEntry<ExternalElitePage>, input: unknown,
    owners: EliteDeclaredEntryOwners<T>): void {
    const rows = parseEliteEntryPageRows(input), { construction, entered, game, player, animals, models, program, controllers } = owners;
    if (this.entered !== null || entered.scope.disposed || entered.scope.disposing || construction.disposed || construction.disposing
      || game.levelScope !== construction || this.host.player !== player || this.host.scene !== game.scene || this.host.camera !== game.camera
      || this.persistence !== owners.persistence.elites || JSON.stringify(rows.entry) !== JSON.stringify(entry.rows) || new Set(controllers.map(row => row.def.id)).size !== controllers.length
      || controllers.some(row => !(row instanceof ExternalElitePage)) || !this.scope.belongsTo(entered.scope)
      || Object.keys(rows.presentation).length !== rows.entry.entries.length || rows.entry.entries.some(row => !Object.hasOwn(rows.presentation, row.id))) throw new Error('Foreign declared elite entry owner');
    preflightEliteEffectServices(rows.actions, { game, player, animals, environment: owners.environment, hud: entered.hud, audio: entered.audio,
      persistence: owners.persistence, contacts: owners.contacts, patrol: owners.patrol, wildlife: owners.wildlife });
    const emptyActors = new Map<number, Animal>();
    const observations = rows.observations.map(row => ({ id: row.id, columns: new ObservationColumnsV2(row.rows, entered.scope), owners: {
      scope: entered.scope, self: { group: rows.entry.id, slot: 0, identity: '', actor: null }, player, observed: emptyActors, t: 0, dt: 0,
      environment: owners.environment, clock: owners.clock, weather: owners.weather } }));
    const loans: EliteEntryLoans<ExternalElitePage> = { construction, entered: entered.scope, ui: { id: rows.entry.ui,
      services: { game, player, lifecycle: this, bar: this.bar, ledges: owners.ledges, rock: owners.rock } },
      profiles: rows.profiles, bodies: rows.entry.entries.some(row => row.controller.kind !== 'borrowed') ? [{ id: owners.body, manager: animals }] : [], models: [...new Set(rows.entry.entries.flatMap(row => row.controller.kind === 'borrowed' ? [] : [row.controller.model]))].map(id => { const object = models.get(id); if (object === undefined) throw new Error('Missing elite model loan'); return { id, object }; }), observations,
      programs: [{ id: program.id, owner: program.scope, program: program.value }], controllers: controllers.map(controller => ({ id: controller.def.id, controller })), actions: rows.actions };
    if (this.host.renderer !== undefined && this.host.renderer !== game.renderer) throw new Error('Foreign elite presentation renderer');
    this.host.renderer = game.renderer;
    entry.bind(loans, this, app.encounters);
    const outputs: ElitePageOutputLoans<T> = { construction, entered: entered.scope, game,
      controllers: entry.scripts.map(owner => owner instanceof NativeEliteController ? { kind: 'keeper', owner } : { kind: 'external', owner }),
      patrol: owners.patrol, wildlife: owners.wildlife, animals, environment: owners.environment, player,
      hud: entered.hud, audio: entered.audio, persistence: owners.persistence, contacts: owners.contacts,
      strikes: rows.strikes, fallbackStrike: rows.fallbackStrike };
    this.bindEnteredPresentation(entered, rows.presentation, { actions: rows.actions, loans: outputs });
    if (rows.debug !== undefined) construction.onDispose(app.debug.scopedExpose(rows.debug, { scripts: entry.scripts, elites: this, bar: this.bar }));
    for (const row of rows.prewarm) { try { animals.factory.model(row.kind, row.variant); } catch (cause) { console.warn('[elites] prewarm failed', row.kind, cause); } }
  }
  /** Bind after registering every lair and before initialization. The entered scope owns this exact Elites instance. */
  bindEnteredPresentation<T extends CrowdTargets>(owners: EliteEnteredOwners, rows: EliteEnteredPresentation,
    outputs?: { readonly actions: readonly EliteOutputAction[]; readonly loans: ElitePageOutputLoans<T> }): void {
    if (this.entered !== null || owners.scope.disposed || !this.scope.belongsTo(owners.scope)) throw new Error('Invalid entered elite presentation owner');
    const ids = this.entries.map(entry => entry.script.def.id), keys = Object.keys(rows);
    if (keys.length !== ids.length || ids.some(id => !Object.hasOwn(rows, id))) throw new Error('Invalid entered elite presentation identities');
    if (outputs === undefined) { this.entered = { owners, rows }; return; }
    const loans = outputs.loans, actions = parseEliteOutputActions(outputs.actions, loans.controllers.length);
    const identity = (): void => {
      if (loans.entered !== owners.scope || loans.player !== this.host.player || loans.game.scene !== this.host.scene || loans.game.camera !== this.host.camera
        || loans.hud !== owners.hud || loans.audio !== owners.audio || loans.persistence.elites !== this.persistence
        || loans.controllers.length !== this.entries.length || loans.controllers.some((controller, index) => this.entries[index]?.script !== controller.owner)) throw new Error('Foreign elite output binding');
    };
    identity();
    for (const action of actions) {
      if (action.kind === 'wildlife-pack') Object.freeze(action.variants);
      else if (action.kind === 'wildlife-herd') Object.freeze(action.offset);
      Object.freeze(action);
    }
    Object.freeze(actions);
    const initial = prepareElitePageOutputs(actions, [], loans, []);
    const validate = (): void => { if (this.entered?.actions !== actions) throw new Error('Replaced elite output binding'); identity(); initial.validate(); };
    const prepare: EliteOutputPrepare = (bank, actors) => {
      validate();
      const prepared = prepareElitePageOutputs(actions, bank.map(row => ({ action: row.id, values: row.values })), loans, actors);
      return { validate: () => { validate(); prepared.validate(); }, operations: prepared.operations.map(apply => () => { validate(); apply(); }) };
    };
    this.entered = { owners, rows, outputs: prepare, actions, validateOutputs: validate, drainOutputs: () => { validate(); drainElitePageOutputs(this, actions, loans); } };
  }
  /** Page-only output preparation borrows the SAME entered controllers and
   * persistence. Actor slots are transient original emitted pointers, never a
   * controller lookup, an additional body book or a serialized outbox. */
  get v2OutputActions(): readonly EliteOutputAction[] {
    const entered = this.entered;
    if (entered?.actions === undefined || entered.validateOutputs === undefined) throw new Error('Missing live elite output binding');
    entered.validateOutputs();
    return entered.actions;
  }
  prepareV2Outputs(bank: readonly EliteOutput[], actors: readonly (Animal | null)[]): PreparedEliteOutputs {
    const entered = this.entered;
    if (entered?.outputs === undefined || entered.owners.scope.disposed || entered.owners.scope.disposing) throw new Error('Missing live elite output binding');
    return entered.outputs(bank, actors);
  }
  /** Drain at the original page post-update slot, never at native stage commit.
   * Every native/page transaction validates before the first operation applies. */
  drainEnteredOutputs(): void {
    const entered = this.entered;
    if (entered?.drainOutputs === undefined) throw new Error('Missing live elite output binding');
    entered.drainOutputs();
  }
  private sting(entry: Entry, event: 'banner' | 'phase2' | 'kill'): void {
    const entered = this.entered;
    if (entered === null) { this.host.sting?.(event); return; }
    if (entered.owners.scope.disposed) return;
    const row = entered.rows[entry.script.def.id];
    if (row === undefined) throw new Error('Missing entered elite presentation');
    if (event === 'kill') entered.owners.music.sting(row.sting.kill);
    else entered.owners.music.combat(row.sting[event]);
  }
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
    const entered = this.entered, row = entered?.rows[def.id];
    if (entered?.owners.scope.disposed === true) return;
    if (entered === null && (this.host.addInteractable === undefined || this.host.removeInteractable === undefined || this.host.toast === undefined)) throw new Error('Elite pickup requires its entered presentation');
    const drop = new WeaponPickup({ scene: this.host.scene, item: e.script.dropModel(), position: new THREE.Vector3(at.x, heightAt(at.x, at.z), at.z), tier: 'rare', prompt: row?.prompt ?? `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, scale: 1.4 });
    this.drops.set(e, drop);
    if (entered === null) this.host.addInteractable?.(drop.interactable);
    else entered.owners.interactables.push(drop.interactable);
    drop.onNear = (inside) => {
      if (entered === null) this.host.pickupHum?.(inside);
      else if (!entered.owners.scope.disposed && row?.hum === true) entered.owners.audio.pickupHum(inside);
    };
    drop.onPickup = () => {
      if (entered?.owners.scope.disposed === true) return;
      const s = this.core.record(def.id);
      if (s) s.skinTaken = true;
      this.core.save();
      this.host.ownSkin?.(skin);
      if (entered === null) {
        this.host.removeInteractable?.(drop.interactable);
        this.host.pickupHum?.(false);
        this.host.toast?.(`${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`);
      } else {
        const index = entered.owners.interactables.indexOf(drop.interactable);
        if (index !== -1) entered.owners.interactables.splice(index, 1);
        if (row?.hum === true) entered.owners.audio.pickupHum(false);
        if (row !== undefined) entered.owners.hud.toast(row.toast);
      }
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
  material: THREE.Material;
  /** the fill (0 at the feet .. 1 at the tip) and opacity the material reads: a uniform, or a port onto a look's params */
  fill: { value: number };
  alpha: { value: number };
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

/** Compiled native admission produces these tags beside the real controller;
 * authored action rows cannot construct or reclassify a controller loan. */
export type EliteOutputController = { readonly kind: 'keeper'; readonly owner: NativeEliteController }
  | { readonly kind: 'external'; readonly owner: ExternalElitePage };
/** Compiled loans for the existing page owner; no authored factory, callback
 * map or opaque shard object is admitted. Construction and entered may be siblings. */
export interface EliteDeclaredEntryOwners<T extends CrowdTargets = CrowdTargets> {
  readonly construction: Scope; readonly entered: EliteEnteredOwners;
  readonly game: Game; readonly player: Player; readonly body: string; readonly animals: AnimalManager;
  readonly models: ReadonlyMap<string, THREE.Object3D>;
  readonly program: { readonly id: string; readonly scope: Scope; readonly value: ReturnProgram };
  readonly controllers: readonly ExternalElitePage[];
  readonly environment: PageWildEnvironment & V2EnvironmentColumns;
  readonly clock: DayCycleClock; readonly weather: { readonly stormActive: boolean };
  readonly ledges: readonly PouncerLedge[]; readonly rock: { readonly x: number; readonly z: number; readonly top: number };
  readonly patrol: PatrolEncounterView | null; readonly wildlife: PageWildlife<T> | null;
  readonly persistence: AdventurePersistence; readonly contacts: StrikeRunner;
}
/** Existing entered owners lent to the effect application. None is authored
 * content, an additional body registry, clock, continuation or installer. */
export interface ElitePageOutputLoans<T extends CrowdTargets = CrowdTargets> {
  readonly construction: Scope; readonly entered: Scope; readonly game: Game;
  readonly controllers: readonly EliteOutputController[];
  readonly patrol: PatrolEncounterView | null; readonly wildlife: PageWildlife<T> | null;
  readonly animals: AnimalManager; readonly environment: PageWildEnvironment;
  readonly player: Player; readonly hud: HUD; readonly audio: Audio;
  readonly persistence: AdventurePersistence; readonly contacts: StrikeRunner;
  readonly strikes: readonly { readonly amount: number; readonly strike: StrikeData }[];
  readonly fallbackStrike: StrikeData;
}
/** Admit every effect sink before engine construction; optional absent native
 * services retain the original no-result semantics. No body/UI allocation. */
function preflightEliteEffectServices<T extends CrowdTargets>(actions: readonly EliteOutputAction[],
  loans: Pick<ElitePageOutputLoans<T>, 'game' | 'player' | 'animals' | 'environment' | 'hud' | 'audio' | 'persistence' | 'contacts' | 'patrol' | 'wildlife'>): void {
  if (loans.game.app !== app) throw new Error('Foreign elite effect service owner');
  const need = <O extends object>(owner: O | null, key: keyof O): void => {
    if (owner !== null && typeof owner[key] !== 'function') throw new Error('Missing elite effect sink');
  };
  for (const action of actions) switch (action.kind) {
    case 'contact': need(loans.contacts, 'contact'); need(app.combat, 'hit'); break;
    case 'knockdown': need(loans.environment, 'onKnockdown'); break;
    case 'feed': need(loans.hud, 'killFeed'); break;
    case 'sound': need(loans.audio, 'animal'); break;
    case 'record': need(loans.persistence, 'kill'); need(loans.persistence, 'feat'); break;
    case 'patrol-rider': need(loans.patrol, 'spawnRider'); break;
    case 'patrol-line': need(loans.patrol, 'spawnLine'); break;
    case 'patrol-dissolve': need(loans.patrol, 'dissolve'); break;
    case 'wildlife-pack': need(loans.wildlife, 'spawnPack'); break;
    case 'wildlife-herd': need(loans.wildlife, 'spawnHerd'); need(loans.animals, 'spawn'); break;
    default: throw new Error('Invalid elite effect sink');
  }
}
/** Prepare the COMPLETE native suffix without effects. The existing combined
 * command authority interleaves these synchronous operations only after every
 * actor/world/elite branch has passed validation. Actor pointers are captured
 * once here, so an earlier adoption cannot retarget a later emitted contact. */
function prepareElitePageOutputs<T extends CrowdTargets>(actions: readonly EliteOutputAction[], input: unknown,
  loans: ElitePageOutputLoans<T>, actors: readonly (Animal | null)[]): { readonly validate: () => void; readonly operations: readonly (() => void)[] } {
  const { construction, entered, game, controllers, patrol, wildlife, animals, environment, player, hud, audio, persistence, contacts, strikes, fallbackStrike } = loans;
  const bank = parseEliteOutputBank(parseEliteOutputActions(actions, controllers.length), input, actors.length);
  preflightEliteEffectServices(actions, loans);
  const controls = [...controllers], tags = controls.map(loan => loan.kind), controllerOwners = controls.map(loan => loan.owner), bodies = [...actors], level = game.levelScope, health = app.player, physics = app.physics, combat = app.combat;
  // Identities are compared only; all calls retain the concrete native receiver.
  const method = <O extends object>(owner: O | null, key: keyof O): unknown => owner === null ? undefined : owner[key];
  const nativeMethods = (): readonly unknown[] => [method(loans.patrol, 'spawnRider'), method(loans.patrol, 'spawnLine'), method(loans.patrol, 'dissolve'),
    method(loans.wildlife, 'spawnPack'), method(loans.wildlife, 'spawnHerd'), method(loans.animals, 'spawn'), method(loans.environment, 'onKnockdown'),
    method(loans.hud, 'killFeed'), method(loans.audio, 'animal'), method(loans.persistence, 'kill'), method(loans.persistence, 'feat'), method(loans.contacts, 'contact'), method(combat, 'hit'),
    ...controllers.flatMap(loan => [method(loan.owner, 'row'), method(loan.owner, 'def'),
      loan.kind === 'external' ? method(loan.owner, 'adopt') : undefined, loan.kind === 'external' ? method(loan.owner, 'support') : undefined])];
  const methods = nativeMethods();
  const live = (): void => {
    if (!(construction instanceof Scope) || !(entered instanceof Scope) || construction.disposed || construction.disposing || entered.disposed || entered.disposing
      || game.levelScope !== level || game.app !== app || app.player !== health || app.physics !== physics || app.combat !== combat
      || loans.construction !== construction || loans.entered !== entered || loans.game !== game || loans.controllers !== controllers
      || loans.patrol !== patrol || loans.wildlife !== wildlife || loans.animals !== animals || loans.environment !== environment || loans.player !== player
      || loans.hud !== hud || loans.audio !== audio || loans.persistence !== persistence || loans.contacts !== contacts || loans.strikes !== strikes || loans.fallbackStrike !== fallbackStrike
      || controls.length !== controllers.length || controls.some((loan, index) => controllers[index] !== loan || loan.kind !== tags[index] || loan.owner !== controllerOwners[index])
      || bodies.length !== actors.length || bodies.some((actor, index) => actors[index] !== actor) || nativeMethods().some((value, index) => value !== methods[index])) throw new Error('Retired or replaced elite output owner');
  };
  live();
  if (new Set(controllerOwners).size !== controllerOwners.length || new Set(bodies.filter(actor => actor !== null)).size !== bodies.filter(actor => actor !== null).length
    || controls.some(loan => { const row: object = loan.owner.row; return loan.kind === 'keeper' ? !('pattern' in row) || 'mode' in row : !('mode' in row) || 'pattern' in row; })
) throw new Error('Invalid elite output loan');
  for (const action of actions) {
    const loan = controls[action.controller];
    if (loan === undefined || action.kind === 'wildlife-pack' && loan.kind !== 'keeper'
      || (action.kind === 'patrol-rider' || action.kind === 'patrol-line') && (loan.kind !== 'external' || loan.owner.row.mode !== 'script')
      || action.kind === 'wildlife-herd' && (loan.kind !== 'external' || loan.owner.row.mode !== 'herd')) throw new Error('Invalid elite action controller');
  }
  const prepared: (() => void)[] = [];
  for (const row of bank) {
    const controllerLoan = controls[row.controller]; if (controllerLoan === undefined) throw new Error('Missing elite output controller');
    let apply: () => void;
    switch (row.kind) {
      case 'contact': case 'patrol-dissolve': {
        const actor = bodies[row.values[0]]; if (actor === undefined || actor === null) throw new Error('Missing emitted elite output actor');
        if (row.kind === 'patrol-dissolve') { apply = () => { patrol?.dissolve(actor); }; break; }
        const strike = strikeFromData(strikes.find(value => value.amount === row.amount)?.strike ?? fallbackStrike);
        apply = () => {
          if (health === null) return;
          contacts.contact(strike, { actor, target: player.position, canReach: () => canReach(actor, player.position, physics), hit: () => {
            if (!canReach(actor, player.position, physics)) return;
            combat.hit({ source: 'env', sourceTags: [`elite.${actor.variant}`, 'feel.blow', 'cover.checked'], target: health, amount: row.amount,
              point: actor.position, dir: new THREE.Vector3(), cause: { kind: actor.kind, label: actor.label } });
          } });
        }; break;
      }
      case 'knockdown': apply = () => { const [x, z] = row.values, length = Math.hypot(x, z) || 1; environment.onKnockdown(x / length, z / length, row.duration); }; break;
      case 'feed': apply = () => { hud.killFeed(row.text); }; break;
      case 'sound': apply = () => { audio.animal(row.cue, new THREE.Vector3(...row.values), player.position, player.yaw); }; break;
      case 'record': apply = () => { persistence.kill(row.actorKind, row.variant); persistence.feat(row.actorKind); }; break;
      case 'patrol-rider': {
        if (controllerLoan.kind !== 'external' || controllerLoan.owner.row.mode !== 'script') throw new Error('Invalid rider result controller');
        const controller = controllerLoan.owner;
        apply = () => { const [x, z, yaw] = row.values, actor = patrol?.spawnRider({ x, z, yaw, variant: row.variant }); if (actor !== undefined && actor !== null) controller.adopt(actor); }; break;
      }
      case 'patrol-line': {
        if (controllerLoan.kind !== 'external' || controllerLoan.owner.row.mode !== 'script') throw new Error('Invalid support result controller');
        const controller = controllerLoan.owner;
        apply = () => { controller.support(patrol?.spawnLine({ count: row.values[0] }) ?? []); }; break;
      }
      case 'wildlife-pack': {
        if (controllerLoan.kind !== 'keeper') throw new Error('Invalid pack result controller');
        const controller = controllerLoan.owner;
        apply = () => { const [x, z, homeX, homeZ] = row.values, pack = wildlife?.spawnPack(x, z, row.variants) ?? null;
          if (pack !== null) { pack.homeX = homeX; pack.homeZ = homeZ; } controller.pack = pack; }; break;
      }
      case 'wildlife-herd': {
        if (controllerLoan.kind !== 'external' || controllerLoan.owner.row.mode !== 'herd') throw new Error('Invalid herd result controller');
        const controller = controllerLoan.owner;
        apply = () => {
          const [x, z, yaw] = row.values, herd = wildlife?.spawnHerd(x + row.offset[0], z + row.offset[1], row.mares, row.foals, row.stallion);
          if (herd === undefined) return;
          const actor = animals.spawn(row.actorKind, x, z, yaw, row.variant), index = herd.members[0]?.herd ?? -1;
          actor.herd = index; if (index >= 0) animals.herds[index]?.members.push(actor); herd.adoptStallion(actor); controller.adopt(actor, herd);
        }; break;
      }
      default: throw new Error('Unsupported elite output');
    }
    prepared.push(() => { live(); apply(); });
  }
  return { validate: live, operations: prepared };
}

/** Native kernels already chose these events. Match only admitted finite action
 * metadata; guest-prepared page banks retain their place in this SAME drain. */
function drainElitePageOutputs<T extends CrowdTargets>(elites: Elites, actions: readonly EliteOutputAction[], loans: ElitePageOutputLoans<T>): void {
  const events = loans.controllers.flatMap((loan, controller) => loan.owner.drainEffects().map(effect => ({ controller, effect })));
  const actors: Animal[] = [];
  for (const { effect } of events) if (effect.kind === 'hit' || effect.kind === 'retire') {
    const actor = effect.kind === 'hit' ? effect.animal : effect.actor;
    if (!actors.includes(actor)) actors.push(actor);
  }
  const prepared = events.map(({ controller, effect }): PreparedEliteOutputs => {
    if (effect.kind === 'page-bank') return effect.bank;
    const loan = loans.controllers[controller]; if (loan === undefined) throw new Error('Missing elite output controller');
    const candidates = actions.filter(action => action.controller === controller);
    const choose = (matches: (action: EliteOutputAction) => boolean): EliteOutputAction => {
      const rows = candidates.filter(matches), row = rows[0];
      if (rows.length !== 1 || row === undefined) throw new Error('Missing or ambiguous elite native output');
      return row;
    };
    let action: EliteOutputAction, values: readonly number[];
    switch (effect.kind) {
      case 'hit': action = choose(row => row.kind === 'contact' && row.amount === effect.amount); values = [actors.indexOf(effect.animal)]; break;
      case 'knock': action = choose(row => row.kind === 'knockdown'); values = [effect.x, effect.z]; break;
      case 'feed': action = choose(row => row.kind === 'feed' && row.text === effect.id); values = []; break;
      case 'sound': action = choose(row => row.kind === 'sound' && row.cue === effect.id); values = [effect.at.x, effect.at.y, effect.at.z]; break;
      case 'record': action = choose(row => row.kind === 'record' && row.actorKind === effect.species && row.variant === effect.variant); values = []; break;
      case 'retire': action = choose(row => row.kind === 'patrol-dissolve'); values = [actors.indexOf(effect.actor)]; break;
      case 'support': action = choose(row => row.kind === 'patrol-line'); values = [effect.count]; break;
      case 'pack': action = choose(row => row.kind === 'wildlife-pack' && row.variants.length === effect.variants.length && row.variants.every((value, index) => value === effect.variants[index]));
        values = [effect.x, effect.z, loan.owner.def.lair.x, loan.owner.def.lair.z]; break;
      case 'request': {
        if (loan.kind !== 'external' || effect.row !== loan.owner.row) throw new Error('Foreign elite request row');
        const spawn = effect.row.spawn;
        action = spawn.source === 'rider' ? choose(row => row.kind === 'patrol-rider' && row.variant === spawn.variant)
          : choose(row => row.kind === 'wildlife-herd' && row.actorKind === spawn.kind && row.variant === spawn.variant
            && row.mares === spawn.mares && row.foals === spawn.foals && row.stallion === spawn.stallion
            && row.offset.every((value, index) => Object.is(value, spawn.offset[index])));
        values = [effect.row.def.lair.x, effect.row.def.lair.z, spawn.yaw]; break;
      }
      default: throw new Error('Unsupported elite native effect');
    }
    return elites.prepareV2Outputs(parseEliteOutputBank(actions, [{ action: action.id, values }], actors.length), actors);
  });
  for (const transaction of prepared) transaction.validate();
  for (const transaction of prepared) for (const apply of transaction.operations) apply();
}
