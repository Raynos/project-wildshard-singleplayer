import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService } from '@wildshard/game/shard/retainedHooks';
import { bindRuntimeState } from '@wildshard/game/shardfile/hybridRows';
import { AMMO_ROWS } from './effects';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { CombatCues } from '@wildshard/engine/combat/cues';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { fixIBL, VIEWMODEL_GROUP, worldHit } from '@wildshard/engine/combat/view/ranged';
import { listenPage } from '@wildshard/engine/input/dom';
import { saves } from '@wildshard/engine/saves/runtime';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineCombatCues } from '../runtime/audio/combatCues';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../shard.config';
import * as valibot from 'valibot';
import * as THREE from 'three';


import { sharedWeaponVoices } from '@wildshard/kit/audio/weaponVoices';
import type { Bow } from '@wildshard/kit/weapons/bow/family';
import { MAX_BOLTS, PLAIN_BOLT, type BoltMod, type Crossbow } from '../runtime/weapons/crossbow/Crossbow';
import { bindLongbowCharge } from './events';
import type { LeverRifle } from '../runtime/weapons/LeverRifle';
import { QUIVER_MAX } from '../weapons/Longbow';
import type { Inventory } from '@wildshard/game/Inventory';
import type { Owned } from '@wildshard/game/loot/Owned';
import type { PineHollowSfx } from '../runtime/audio/sfx';
import { BOLT_KINDS, BOLT_LABEL, BOLT_NAME, POUCH_MAX, Quiver, boltDamage, type AmmoKind, type BoltKind } from './ammo';

const savedSchema = valibot.object({ pitch: valibot.optional(valibot.pipe(valibot.number(), valibot.finite())), broadhead: valibot.optional(valibot.pipe(valibot.number(), valibot.finite())), rounds: valibot.optional(valibot.pipe(valibot.number(), valibot.finite())), arrows: valibot.optional(valibot.pipe(valibot.number(), valibot.finite())) });
const savedSlot = saves.define({ key: 'loadout', scope: 'shard', version: 1, schema: savedSchema, initial: () => ({}) });

/**
 * Pine Hollow's LOADOUT (PINE-HOLLOW-REMASTER PH-C11; ranged only, PH-U15): the crossbow (the hero), the lever-action
 * (src/shards/pine-hollow/weapons/LeverRifle.ts, the cabin's rifle — PH-U5), the Warden's Longbow (src/engine/player/Longbow.ts, the Antler King's
 * reward), and the ammunition the trader swaps for (ammo.ts: pitch-tipped and broadhead bolts, cartridges, arrows).
 * main.ts calls `installPineLoadout` once on Pine Hollow, after the kit exists and before the boot's precompile.
 *
 *   · SPECIAL BOLTS — the loaded kind (B, or a tap on the touch ammo strip, cycles iron → pitch → broadhead, skipping
 *     empty stacks) dresses the crossbow's next bolt (`Crossbow.boltMod`: its flight by ammo.ts's rules, the rain read
 *     live, and its damage by the animal it lands in) and its HUD label; a special stack that runs dry falls back to iron.
 *     The specials are kept across sessions (`ws.ph.loadout.v1`); iron bolts refill as ever.
 *   · THE LEVER-ACTION'S SOUNDS — Pine Hollow's generated set (PineHollowSfx): the shot + its echo off the ridge, the
 *     lever's cycle, the hammer on an empty chamber (`leverDry`), a cartridge thumbed through the gate (`leverRoundIn`);
 *     Audio.ts's AR-15 shot / latch click until the set decodes.
 *   · THE LONGBOW — owned once the King falls (`grantLongbow`; Owned 'warden-longbow' re-grants it on load — E314 C: it
 *     rode in a pack slot, and a full pack lost the bow for good; an old save's pack flag moves across once);
 *   · KEPT (E314 C) — the lever-action once taken (Owned 'lever-rifle'), the rifle's spare cartridges and the arrows are
 *     saved with the special bolts; iron bolts are not (they refill to 30 on every death and every load). `room(kind, n)`
 *     says whether a trade's ammunition fits, so Mott never sells bolts into a full quiver;
 *     its draw creak (`longbowDraw`), its loose (`longbowLoose`; Audio.crossbowFire until the set decodes).
 *   · STONE — a bolt, an arrow or a round landing on rock / stone plays `boltImpact-rock` (the crack + the ricochet).
 *   · FEEL — weapon events resolve row hit-stop, kick, trauma and debris through installRangedFeel.
 *
 *   loadout.addAmmo('pitch', 10)     the trader, the contracts ('iron' / 'pitch' / 'broadhead' / 'cartridge' / 'arrow')
 *   loadout.onPlayerDeath()          back to iron bolts before main.ts's refill tops up the loaded stack
 *   loadout.useSfx(sfx)   once ambience exists; weather answers projectile.modify during flight
 *   dev: `?weapon=lever|longbow|crossbow` (held at start), `?ammo=pitch|broadhead` (10 loaded), `window.__loadout`
 */

export interface PineLoadoutHost {
  /** Retain ammunition data while transient input, cues and echo timers belong to the entered cell. */
  context?: ShardContext;
  scope: Scope; cues: CombatCues; scene: THREE.Scene; sky: Sky; weapons: EquipmentService; crossbow: Crossbow | null; rifle: LeverRifle; longbow: Bow;
  inventory: Inventory; owned: Owned; hud: HUD; audio: Audio; params: URLSearchParams;
}

export interface PineLoadout {
  addAmmo: (kind: AmmoKind, n: number) => void;
  count: (kind: AmmoKind) => number;
  /** the loaded bolt kind */
  readonly bolt: BoltKind;
  selectBolt: (kind: BoltKind) => void;
  cycleBolt: () => void;
  grantLongbow: () => void;
  /** can the kit hold `n` more of `kind`? (a trade's check) */
  room: (kind: AmmoKind, n: number) => boolean;
  /** the lever-action is kept (the cabin's pickup need not be there) */
  readonly hasRifle: boolean;
  onPlayerDeath: () => void;
  useSfx: (sfx: PineHollowSfx) => void;
  update: (dt: number) => void;
}

const echo = requireAudioProfile(source.audio.routing.flatMap((route) => route.actions).find((action) => action.voice === 'pine.leverEcho'), 'pine.leverEcho');
const ECHO_DELAY = echo.delay ?? 0, ECHO_GAIN = requireAudioProfile(echo.overrides?.gain, 'pine.leverEcho.gain');
/** the bolt dress per kind: a uniform-only tint of the iron bolt's material (no program) */
const TINT: Readonly<Record<Exclude<BoltKind, 'iron'>, { color: number; roughness: number }>> = {
  pitch: { color: 0x9a6a36, roughness: 0.55 },     // resin-dark, a warm sheen
  broadhead: { color: 0xc8ccd4, roughness: 0.8 },  // bright cold steel
};

/** the impact point sits on stone (the physics material a short probe through it meets, up / across / along) */
const PROBE = [[0, 1, 0], [1, 0, 0], [0, 0, 1]] as const;
function stony(p: { x: number; y: number; z: number }): boolean {
  for (const [x, y, z] of PROBE) {
    const m = worldHit({ x: p.x + x * 0.4, y: p.y + y * 0.4, z: p.z + z * 0.4 }, { x: p.x - x * 0.4, y: p.y - y * 0.4, z: p.z - z * 0.4 }, 0)?.material;
    if (m !== undefined) return m === 'rock' || m === 'stone';
  }
  return false;
}

/** the kept weapons on load: the Longbow and the lever-action live in Owned (E314 C); an old save's pack flag
 *  ('warden-longbow' in a pack slot, dropped by the pack that no longer keeps it) moves across first */
export function restoreKept(inventory: Pick<Inventory, 'had'>, owned: Pick<Owned, 'grant' | 'has'>): { bow: boolean; rifle: boolean } {
  if (inventory.had('warden-longbow')) owned.grant('warden-longbow');
  return { bow: owned.has('warden-longbow'), rifle: owned.has('lever-rifle') };
}

export function installPineLoadout(h: PineLoadoutHost): PineLoadout {
  const { weapons, crossbow, rifle, longbow, hud, audio, inventory, owned, params } = h;
  const state = bindRuntimeState(h.context ?? { app, scope: h.scope }, source, 'pine.loadout', () => JSON.stringify(savedSlot.read('pine-hollow')));
  let saved: valibot.InferOutput<typeof savedSchema> = {};
  try { saved = valibot.parse(savedSchema, JSON.parse(String(state.read())) as unknown); } catch { /* defaults */ }
  const quiver = new Quiver({ pitch: saved.pitch ?? 0, broadhead: saved.broadhead ?? 0 });
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null);
  const rounds = num(saved.rounds), arrows = num(saved.arrows);
  if (rounds !== null) rifle.state.reserve = rounds;
  if (arrows !== null) longbow.state.bolts = Math.min(QUIVER_MAX, arrows);
  const kept = { rounds: rifle.state.reserve, arrows: longbow.state.bolts };
  let sfx: PineHollowSfx | null = null;
  let dirty = false, saveT = 0;
  const live = (): number => crossbow?.state.bolts ?? 0;

  // the special bolts' dresses: clones of the iron bolt's material, re-hooked like Skins.ts's (dfg fix + the sky's CSM)
  const dress = new Map<BoltKind, THREE.Material>();
  if (crossbow) for (const k of ['pitch', 'broadhead'] as const) {
    const m = crossbow.boltMaterial.clone() as THREE.MeshStandardMaterial;
    m.name = `xbow-bolt-${k}`; m.color.setHex(TINT[k].color); m.roughness = TINT[k].roughness;
    fixIBL(m, VIEWMODEL_GROUP); h.sky.setupMaterial(m);
    dress.set(k, m);
  }
  // the dresses must be in the scene for the boot's precompile (they share the bolt's program; this proves it)
  const parked = new THREE.Group(); parked.name = 'pine-loadout-parked'; parked.position.y = -500;
  for (const m of dress.values()) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), m); mesh.visible = false; parked.add(mesh); }
  h.scene.add(parked);

  const mods = new Map<BoltKind, BoltMod>();
  for (const k of BOLT_KINDS) mods.set(k, { gravity: 1, drag: 1, damage: (animal) => boltDamage(k, animal), material: dress.get(k) });
  const applyBolt = (): void => {
    if (!crossbow) return;
    const k = quiver.selected, m = mods.get(k) ?? PLAIN_BOLT, row = AMMO_ROWS.find((ammo) => ammo.id === `ammo.${k}`);
    if (row === undefined) throw new Error(`Unknown ammo ${k}`);
    crossbow.selectedAmmo = row;
    const f = row.flight;
    m.gravity = f.gravity; m.drag = f.drag;
    crossbow.boltMod = m; crossbow.ammoLabel = BOLT_LABEL[k];
  };
  const markDirty = (): void => { dirty = true; };
  const save = (): void => {
    if (crossbow) quiver.stash(live());
    kept.rounds = rifle.state.reserve; kept.arrows = longbow.state.bolts;
    try { state.write(JSON.stringify({ pitch: quiver.counts.pitch, broadhead: quiver.counts.broadhead, rounds: kept.rounds, arrows: kept.arrows })); } catch { /* not persisted */ }
    dirty = false;
  };

  const selectBolt = (kind: BoltKind, quiet = false): void => {
    if (!crossbow) return;
    const n = quiver.select(kind, live());
    if (n === null) return;
    crossbow.state.bolts = n; crossbow.state.loaded = n > 0 && crossbow.state.loaded; // the bolt on the rail is swapped for one of the new kind
    applyBolt(); markDirty();
    if (!quiet) { hud.toast(`${BOLT_NAME[kind]} loaded · ${n}`); audio.weaponSwap(); }
  };
  const cycleBolt = (): void => { if (crossbow) selectBolt(quiver.next()); };
  if (crossbow) crossbow.ammoSelect = cycleBolt;

  const addAmmo = (kind: AmmoKind, n: number): void => {
    if (kind === 'cartridge') { rifle.addRounds(n); return; }
    if (kind === 'arrow') { longbow.addBolts(n); return; }
    if (!crossbow) return;
    if (kind === quiver.selected) crossbow.addBolts(n); else quiver.add(kind, n);
    markDirty();
  };
  const count = (kind: AmmoKind): number => kind === 'cartridge' ? rifle.state.reserve + rifle.state.ammo : kind === 'arrow' ? longbow.state.bolts : quiver.count(kind, live());
  const CAP: Record<AmmoKind, number> = { iron: MAX_BOLTS, pitch: POUCH_MAX, broadhead: POUCH_MAX, arrow: QUIVER_MAX, cartridge: Infinity };
  const room = (kind: AmmoKind, n: number): boolean => count(kind) + n <= CAP[kind];

  const bind = (scope: Scope): void => {
    // ── input: B cycles the bolt kind while the crossbow is held; the touch ammo strip, tapped, does the same ──
    app.input.register({ id: 'crossbow.bolts', actions: ['bolt.cycle'], keys: { 'bolt.cycle': ['KeyB'] }, touch: { relabel: {}, verbs: { 'verb.1': { action: 'bolt.cycle', label: 'Bolts', icon: '<svg viewBox="0 0 24 24"><path d="M5 19 19 5m-6 0h6v6M5 14v5h5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' } } }, enabled: () => weapons.current.ammoSelect !== undefined && weapons.enabled && weapons.current.enabled }, scope);
    app.input.push('crossbow.bolts', scope);
    app.input.bind('bolt.cycle', () => { weapons.current.ammoSelect?.(); }, scope, () => weapons.enabled && weapons.current.ammoSelect !== undefined);

    listenPage(scope, 'pointerdown', (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest('.ws-game-bolts') === null || weapons.current.ammoSelect === undefined || !weapons.enabled) return;
      e.stopPropagation(); weapons.current.ammoSelect();
    }, { capture: true, on: 'document' });

    // ── sounds (chained over main.ts's: the held weapon decides) ──
    const cues = h.cues;
    cues.use(pineCombatCues({
      shot: (name, opts) => sfx?.shot(name, opts) ?? false, stony,
      later: (fn, seconds) => { scope.timeout(seconds * 1000, fn); }, echoDelay: ECHO_DELAY, echoGain: ECHO_GAIN,
    }), scope);
    const events = weapons.events;
    events?.on('weapon.action', ({ id, phase }) => {
      if (id === rifle.row.id && phase === 'cycle') cues.cue('cue.lever.cycle');
    }, scope);
    events?.on('weapon.reload', ({ id, phase }) => {
      if (id === rifle.row.id && phase === 'round' && !cues.cue('cue.lever.round')) sharedWeaponVoices(audio).dryFire();
    }, scope);
    if (events) bindLongbowCharge(events, scope, longbow.row, cues, (ok) => { hud.toast(ok ? 'Arrow recovered' : 'Arrow broke'); });

  };
  if (h.context === undefined) bind(h.scope); else installEnteredRuntimeService(h.context, bind);

  // ── the longbow: the King's reward, and the lever-action: kept in Owned, never in a pack slot (E314 C) ──
  const keep = restoreKept(inventory, owned);
  if (keep.bow) weapons.unlock('bow');
  if (keep.rifle) weapons.unlock('rifle');
  const grantLongbow = (): void => {
    owned.grant('warden-longbow');
    weapons.unlock('bow');
    weapons.select('bow');
    hud.toast("The Warden's Longbow · hold FIRE to draw, let go at full draw");
  };

  // ── dev ──
  const want = params.get('weapon');
  if (want === 'lever' || want === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle', true); }
  else if (want === 'longbow' || want === 'bow') { weapons.unlock('bow'); weapons.select('bow', true); }
  else if (want === 'crossbow') weapons.select('crossbow', true);
  const ammoParam = params.get('ammo');
  if (ammoParam === 'pitch' || ammoParam === 'broadhead') { quiver.add(ammoParam, 10); selectBolt(ammoParam, true); }

  applyBolt();
  const api: PineLoadout = {
    addAmmo, count, selectBolt, cycleBolt, grantLongbow, room,
    get bolt() { return quiver.selected; },
    get hasRifle() { return owned.has('lever-rifle'); },
    onPlayerDeath: () => { if (quiver.selected !== 'iron') selectBolt('iron', true); },
    useSfx: (s) => { sfx = s; s.prewarm(['leverShot', 'leverEcho', 'leverCycle', 'leverDry', 'leverRoundIn', 'longbowDraw', 'longbowLoose', 'boltImpact-rock']); },
    update: (dt) => {
      if (!crossbow) return;
      quiver.stash(live());
      // a special stack ran dry (nothing on the rail): back to iron, which the crossbow spans itself
      if (quiver.selected !== 'iron' && live() <= 0 && !crossbow.state.loaded && !crossbow.state.reloading) {
        const was = quiver.selected;
        selectBolt('iron', true); hud.toast(`${BOLT_NAME[was]} spent · iron bolts loaded`);
      }
      applyBolt();
      // the lever-action once taken (the cabin's pickup, a rifle finish's drop) is kept
      if (weapons.has('rifle') && !owned.has('lever-rifle')) owned.grant('lever-rifle');
      saveT += dt;
      if (saveT > 2) {
        saveT = 0;
        const ammoMoved = rifle.state.reserve !== kept.rounds || longbow.state.bolts !== kept.arrows;
        if (ammoMoved || (weapons.current.id === 'crossbow' && (dirty || quiver.selected !== 'iron'))) save();
      }
    },
  };
  h.scope.onDispose(app.debug.scopedExpose('loadout', api)); h.scope.onDispose(app.debug.scopedExpose('lever', rifle)); h.scope.onDispose(app.debug.scopedExpose('longbow', longbow)); // dev: `__lever.freezeCycle = 0.45`, `__longbow.freezeDraw = 1`
  return api;
}
