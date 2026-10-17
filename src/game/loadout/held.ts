import * as THREE from 'three';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { LoadoutSchema, type LoadoutRows } from '@wildshard/format/loadout';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCues, CombatCueOpts } from '@wildshard/engine/combat/cues';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { fixIBL, VIEWMODEL_GROUP, worldHit } from '@wildshard/engine/combat/view/ranged';
import { listenPage } from '@wildshard/engine/input/dom';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { ShardContext } from '../plugin/context';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { bindRuntimeState } from '../plugin/headless';
import { readItemAmmunition } from '../plugin/nativeItems';
import { runtimeAudio, sharedWeaponVoices } from '../plugin/audio';
import { PLAIN_BOLT, type HeldBolt } from '../plugin/heldLauncher';
import type { CatalogueLauncher, CatalogueFirearm } from '../plugin/heldEquipment';
import type { Bow } from '../weapons/Bow';
import { AmmoPouch } from './pouch';
import { loadoutLegacySlot } from './persistence';
import { bindLoadoutDeath } from './events';

/** Existing entered-world ports; ammunition and ownership choices are declared by LoadoutRows. */
export interface HeldLoadoutHost {
  context?: ShardContext;
  source: Shardfile;
  scope: Scope; cues: CombatCues; scene: THREE.Scene; sky: SkyRig; weapons: EquipmentService;
  crossbow: CatalogueLauncher | null; rifle: CatalogueFirearm; longbow: Bow;
  inventory: HeldInventory; owned: HeldOwnership; hud: HUD; audio: Audio; params: URLSearchParams;
}
/** Content identities are checked by the owner's inventory and ownership service. */
export interface HeldInventory { had: (id: string) => boolean }
/** A held loadout needs only stable grants and membership from its owner's service. */
export interface HeldOwnership { grant: (id: string) => unknown; has: (id: string) => boolean }
/** The page and quests share one live ammunition/ownership service. */
export interface HeldLoadout {
  addAmmo: (kind: string, n: number) => void;
  count: (kind: string) => number;
  readonly bolt: string;
  selectBolt: (kind: string) => void;
  cycleBolt: () => void;
  grantLongbow: () => void;
  room: (kind: string, n: number) => boolean;
  readonly hasRifle: boolean;
  onPlayerDeath: () => void;
  useSfx: (bank: DeclaredSoundBank) => void;
  update: (dt: number) => void;
}
/** Restore owned equipment, migrating the old pack flag once before checking ownership. */
export function restoreHeldOwnership(inventory: HeldInventory, owned: HeldOwnership, rows: LoadoutRows): { bow: boolean; rifle: boolean } {
  if (inventory.had(rows.bow.legacyItem)) owned.grant(rows.bow.owned);
  return { bow: owned.has(rows.bow.owned), rifle: owned.has(rows.firearm.owned) };
}
const PROBE = [[0, 1, 0], [1, 0, 0], [0, 0, 1]] as const;
function stony(point: { x: number; y: number; z: number }, row: LoadoutRows['audio']): boolean {
  for (const [x, y, z] of PROBE) {
    const reach = row.probe;
    const material = worldHit({ x: point.x + x * reach, y: point.y + y * reach, z: point.z + z * reach }, { x: point.x - x * reach, y: point.y - y * reach, z: point.z - z * reach }, 0)?.material;
    if (material !== undefined) return row.surfaces.includes(material);
  }
  return false;
}
const message = (template: string, name: string, count: number): string => template.replaceAll('{name}', name).replaceAll('{count}', String(count));

/** Client-only installation of a data-driven held loadout. Native actions still own fire/reload; this host owns parked stacks,
 * owned-equipment restoration, row cues, transient input and the unchanged declared save ABI. */
export function installHeldLoadout(h: HeldLoadoutHost, input: unknown): HeldLoadout {
  const row = v.parse(LoadoutSchema, input), { source, weapons, crossbow, rifle, longbow, hud, audio, inventory, owned, params } = h;
  const base = row.pouch.fallback, kinds = row.pouch.kinds;
  const savedSlot = loadoutLegacySlot(row);
  const audioRows = h.context === undefined ? source.audio : runtimeAudio(h.context, source.audio);
  const echo = audioRows.routing.flatMap(route => route.actions).find(action => action.voice === row.audio.echoVoice);
  if (echo?.overrides?.gain === undefined) throw new Error('Missing declared loadout echo profile');
  const echoDelay = echo.delay ?? 0, echoGain = echo.overrides.gain;
  const state = bindRuntimeState(h.context ?? { app, scope: h.scope }, source, row.persistence.state, () => JSON.stringify(savedSlot.read(source.identity.slug)));
  const savedSchema = v.object(Object.fromEntries([...kinds.filter(kind => kind !== base), row.persistence.firearm, row.persistence.bow].map(key => [key, v.optional(v.pipe(v.number(), v.finite()))])));
  let saved: Record<string, number | undefined> = {};
  try { saved = v.parse(savedSchema, JSON.parse(String(state.read())) as unknown); } catch { /* Existing malformed state falls back to empty stacks. */ }
  const ammunition = readItemAmmunition(h.context?.product.shardfile.items ?? source.items, row.launcher.item);
  const ammoFor = (kind: string) => { const ammo = ammunition.get(kind); if (ammo === undefined) throw new Error(`Unknown ammo ${kind}`); return ammo; };
  const quiver = new AmmoPouch(row.pouch, Object.fromEntries(kinds.filter(kind => kind !== base).map(kind => [kind, saved[kind] ?? 0])));
  const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  const rounds = num(saved[row.persistence.firearm]), arrows = num(saved[row.persistence.bow]);
  if (rounds !== null) rifle.state.reserve = rounds;
  if (arrows !== null) longbow.state.bolts = Math.min(longbow.magazine, arrows);
  const kept = { rounds: rifle.state.reserve, arrows: longbow.state.bolts };
  let sfx: DeclaredSoundBank | null = null, dirty = false, saveT = 0;
  const live = (): number => crossbow?.state.bolts ?? 0;
  const dress = new Map<string, THREE.Material>();
  if (crossbow !== null) for (const [kind, tint] of Object.entries(row.tints)) {
    const material = crossbow.boltMaterial.clone() as THREE.MeshStandardMaterial;
    material.name = row.parked.materialPrefix + kind; material.color.setHex(tint.color); material.roughness = tint.roughness;
    fixIBL(material, VIEWMODEL_GROUP); h.sky.setupMaterial(material); dress.set(kind, material);
  }
  const parked = new THREE.Group(); parked.name = row.parked.name; parked.position.y = row.parked.y;
  for (const material of dress.values()) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(.01, .01, .01), material); mesh.visible = false; parked.add(mesh); }
  h.scene.add(parked);
  const mods = new Map<string, HeldBolt>();
  for (const kind of kinds) mods.set(kind, { gravity: 1, drag: 1, damage: ammoFor(kind).damage, material: dress.get(kind) });
  const applyBolt = (): void => {
    if (crossbow === null) return;
    const kind = quiver.selected, mod = mods.get(kind) ?? PLAIN_BOLT, ammo = ammoFor(kind).row;
    crossbow.selectedAmmo = ammo; mod.gravity = ammo.flight.gravity; mod.drag = ammo.flight.drag;
    crossbow.boltMod = mod; crossbow.ammoLabel = ammo.label;
  };
  const save = (): void => {
    if (crossbow !== null) quiver.stash(live());
    kept.rounds = rifle.state.reserve; kept.arrows = longbow.state.bolts;
    const value = { ...Object.fromEntries(kinds.filter(kind => kind !== base).map(kind => [kind, quiver.counts[kind]])), [row.persistence.firearm]: kept.rounds, [row.persistence.bow]: kept.arrows };
    try { state.write(JSON.stringify(value)); } catch { /* Existing non-persistent hosts remain playable. */ }
    dirty = false;
  };
  const selectBolt = (kind: string, quiet = false): void => {
    if (crossbow === null) return;
    const count = quiver.select(kind, live()); if (count === null) return;
    crossbow.state.bolts = count; crossbow.state.loaded = count > 0 && crossbow.state.loaded;
    applyBolt(); dirty = true;
    if (!quiet) { hud.toast(message(row.text.selected, ammoFor(kind).row.name, count)); audio.weaponSwap(); }
  };
  const cycleBolt = (): void => { if (crossbow !== null) selectBolt(quiver.next()); };
  if (crossbow !== null) crossbow.ammoSelect = cycleBolt;
  const addAmmo = (kind: string, count: number): void => {
    if (kind === row.firearm.ammo) { rifle.addRounds(count); return; }
    if (kind === row.bow.ammo) { longbow.addBolts(count); return; }
    if (crossbow === null) return;
    if (kind === quiver.selected) crossbow.addBolts(count); else quiver.add(kind, count); dirty = true;
  };
  const count = (kind: string): number => kind === row.firearm.ammo ? rifle.state.reserve + rifle.state.ammo : kind === row.bow.ammo ? longbow.state.bolts : quiver.count(kind, live());
  const room = (kind: string, n: number): boolean => count(kind) + n <= (kind === row.firearm.ammo ? Infinity : kind === row.bow.ammo ? longbow.magazine : row.pouch.capacity);
  const health = app.player;
  const bind = (scope: Scope): void => {
    bindLoadoutDeath(app.events, scope, health, { active: () => app.player === health,
      reset: () => { if (quiver.selected !== base) selectBolt(base, true); } });
    const action = row.input.action;
    app.input.register({ id: row.input.id, actions: [action], keys: { [action]: [row.input.key] }, touch: { relabel: {}, verbs: { 'verb.1': { action, label: row.input.label, icon: row.input.icon } } }, enabled: () => weapons.current.ammoSelect !== undefined && weapons.enabled && weapons.current.enabled }, scope);
    app.input.push(row.input.id, scope); app.input.bind(action, () => { weapons.current.ammoSelect?.(); }, scope, () => weapons.enabled && weapons.current.ammoSelect !== undefined);
    listenPage(scope, 'pointerdown', event => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('.ws-game-bolts') === null || weapons.current.ammoSelect === undefined || !weapons.enabled) return;
      event.stopPropagation(); weapons.current.ammoSelect();
    }, { capture: true, on: 'document' });
    const cues = h.cues, ports = { shot: (name: string, opts?: Parameters<DeclaredSoundBank['shot']>[1]) => sfx?.shot(name, opts) ?? false,
      later: (fn: () => void, seconds: number) => { scope.timeout(seconds * 1000, fn); }, echoDelay, echoGain };
    const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>([[row.audio.impactVoice, opts => opts.point !== undefined && stony(opts.point, row.audio) && ports.shot(row.audio.impact, { at: opts.point })]]);
    const routes = structuredClone(audioRows.routing);
    for (const route of routes) for (const actionRow of route.actions) if (actionRow.voice === row.audio.echoVoice) actionRow.delay = echoDelay;
    cues.use(createCueRouter(routes, { voices, later: ports.later, bindings: source.audio.voiceBindings, owners: new Map([[row.audio.owner, ports]]) }), scope);
    const events = weapons.events;
    events?.on('weapon.action', ({ id, phase }) => { if (id === rifle.row.id && phase === 'cycle') cues.cue(row.audio.cycleCue); }, scope);
    events?.on('weapon.reload', ({ id, phase }) => { if (id === rifle.row.id && phase === 'round' && !cues.cue(row.audio.roundCue)) sharedWeaponVoices(audio).dryFire(); }, scope);
    events?.on('weapon.charge', ({ id, phase, value }) => {
      if (id !== longbow.row.id) return;
      if (phase === 'recover') hud.toast(value === 1 ? row.text.recovered : row.text.broken);
      else if (phase !== 'draw' || value !== 1) cues.charge(longbow.row, phase);
    }, scope);
  };
  if (h.context === undefined) bind(h.scope); else installEnteredRuntimeService(h.context, bind);
  const keep = restoreHeldOwnership(inventory, owned, row);
  if (keep.bow) weapons.unlock(row.bow.slot);
  if (keep.rifle) weapons.unlock(row.firearm.slot);
  const grantLongbow = (): void => { owned.grant(row.bow.owned); weapons.unlock(row.bow.slot); weapons.select(row.bow.slot); hud.toast(row.bow.grantToast); };
  const want = params.get('weapon');
  if (want !== null && row.development.firearm.includes(want)) { weapons.unlock(row.firearm.slot); weapons.select(row.firearm.slot, true); }
  else if (want !== null && row.development.bow.includes(want)) { weapons.unlock(row.bow.slot); weapons.select(row.bow.slot, true); }
  else if (want !== null && row.development.launcher.includes(want)) weapons.select(row.launcher.slot, true);
  const ammoParam = params.get('ammo');
  if (ammoParam !== null && row.development.ammunition.includes(ammoParam)) { quiver.add(ammoParam, row.development.grant); selectBolt(ammoParam, true); }
  applyBolt();
  const api: HeldLoadout = { addAmmo, count, selectBolt, cycleBolt, grantLongbow, room,
    get bolt() { return quiver.selected; }, get hasRifle() { return owned.has(row.firearm.owned); },
    onPlayerDeath: () => { if (quiver.selected !== base) selectBolt(base, true); },
    useSfx: bank => { sfx = bank; bank.prewarm(row.audio.prewarm); },
    update: dt => {
      if (crossbow === null) return;
      quiver.stash(live());
      if (quiver.selected !== base && live() <= 0 && !crossbow.state.loaded && !crossbow.state.reloading) {
        const was = quiver.selected; selectBolt(base, true); hud.toast(message(row.text.spent, ammoFor(was).row.name, live()));
      }
      applyBolt();
      if (weapons.has(row.firearm.slot) && !owned.has(row.firearm.owned)) owned.grant(row.firearm.owned);
      saveT += dt;
      if (saveT > row.persistence.interval) { saveT = 0; const moved = rifle.state.reserve !== kept.rounds || longbow.state.bolts !== kept.arrows;
        if (moved || (weapons.current.id === row.launcher.slot && (dirty || quiver.selected !== base))) save(); }
    },
  };
  h.scope.onDispose(app.debug.scopedExpose(row.debug.loadout, api)); h.scope.onDispose(app.debug.scopedExpose(row.debug.firearm, rifle)); h.scope.onDispose(app.debug.scopedExpose(row.debug.bow, longbow));
  return api;
}
