import { PointLight, type Vector3 } from 'three';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { ShardContext } from '@wildshard/game/shard/context';
import { BRAZIERS, TOWER } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from './resources';
import { buildTower, type TowerParts } from './tower';
import { buildBrazier, buildCaravan, buildWell, type BrazierParts, type WellParts } from './places';
import { buildRocks } from './rocks';
import { buildDressing } from './dressing';
import { buildButtes } from './buttes';
import { FIRE_RESOURCES, fireGeometries, fireLight, loadFireBook, resetFireLights, tickFires } from './fireFx';
import { lastLightAll } from '../look/light';
import { FLAG } from '../data/flags';
import { brazierFlag } from '../quest/brazierFlag';

/** Something the whip's lash can crack: a lever to pull or a brazier to light. `crack` says whether it reacted. */
export interface Crackable { at: Vector3; radius: number; crack: (heavy: boolean, second: boolean) => boolean }

/** The signal fire: the tower piece, the brazier interactable and the flicker. `light()` is idempotent. */
export interface SignalFire { tower: TowerParts; brazier: Interactable; lit: boolean; onLight: (() => void) | null; light: () => void }
export interface Brazier { parts: BrazierParts; spot: Interactable; oiled: boolean; lit: boolean; light: () => boolean }
export interface SignalWorld {
  fire: SignalFire; braziers: Brazier[]; well: WellParts & { readonly raised: boolean; pull: () => boolean; spot: Interactable };
  logbook: Interactable; crackables: Crackable[]; flags: Flags;
  /** the braziers lit so far */
  readonly litCount: number;
}

const toast = (ctx: ShardContext, text: string): void => { ctx.game.runtime?.play?.hud.toast(text); };
/** The tower fire's light (candela-ish, three's units): warm on the deck without washing out the hands beside it (loop 4: 28 overexposed them). */
const TOWER_LIGHT = 14;

/**
 * Signal Dunes' places (C1): the signal tower, the half-buried caravan, the dry well, three waymark braziers and the
 * wind-cut rock field. The quest state lives in `flags`, so a later visit finds the world as it was left.
 */
/** The waymark fire's point light (candela; physical decay over its 10 m reach). */
const WAY_LIGHT = 9;
/** The caravan lantern's share of the same light: a lantern, not a fire. */
const LANTERN_LIGHT = 5; // round 25: the steeper key-facing term also scales the point lights on flat sand (x0.55 of round 24's)

export function buildWorld(ctx: ShardContext, flags: Flags): SignalWorld {
  const terrain = ctx.manifest.ground.terrain, groundAt = (x: number, z: number): number => terrain?.heightAt(x, z) ?? 0;
  const trailDistance = (x: number, z: number): number => terrain?.trailDistance(x, z) ?? 99;
  const file = (name: string): string => `src/shards/sunscar-dunes/world/${name}.ts`;
  const tower = buildTower(groundAt(TOWER.x, TOWER.z), groundAt);
  ctx.root.add(tower.root);
  ctx.piece({ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: file('tower'), object: tower.root, colliders: tower.colliders, surface: 'wood' });
  const caravan = buildCaravan(groundAt); ctx.root.add(caravan.root); for (const t of caravan.textures) ctx.scope.own(t);
  ctx.piece({ id: 'sunscar.caravan', name: STRINGS.caravan, category: 'props', file: file('places'), object: caravan.root, colliders: caravan.colliders, surface: 'wood' });
  const wellParts = buildWell(groundAt); ctx.root.add(wellParts.root);
  ctx.piece({ id: 'sunscar.well', name: STRINGS.well, category: 'buildings', file: file('places'), object: wellParts.root, colliders: wellParts.colliders, surface: 'stone' });
  const rocks = buildRocks(groundAt, trailDistance); ctx.root.add(rocks.root);
  ctx.piece({ id: 'sunscar.rocks', name: STRINGS.rocks, category: 'nature', file: file('rocks'), object: rocks.root, colliders: rocks.colliders, surface: 'rock' });
  const dressing = buildDressing(groundAt, trailDistance, ctx.scope); ctx.root.add(dressing.root);
  ctx.piece({ id: 'sunscar.dressing', name: STRINGS.dressing, category: 'nature', file: file('dressing'), object: dressing.root, colliders: dressing.colliders, surface: 'sand' });
  // E399: the mockups show low hazy dune ranges at the horizon, no mesas: the buttes stay built only for the Model
  // Explorer's sake when a debug row asks; the world shows none
  void buildButtes;
  const interactables = ctx.game.runtime?.interactables;

  // The logbook on the caravan's tailboard: read it once, it points the way to the well.
  const logbook: Interactable = { label: STRINGS.readLog, position: caravan.logbookAt, radius: 2.4, onInteract: () => {
    if (flags.has(FLAG.logbook)) return;
    flags.set(FLAG.logbook); logbook.label = STRINGS.logRead; toast(ctx, STRINGS.logText);
  } };
  if (flags.has(FLAG.logbook)) logbook.label = STRINGS.logRead;

  // The well: a heavy crack on the crank hauls the bucket up; then take the oil jar.
  const lift = { t: flags.has(FLAG.oil) ? 1 : 0, raised: flags.has(FLAG.oil) };
  const wellSpot: Interactable = { label: STRINGS.wellDown, position: wellParts.jarAt, radius: 2.6, onInteract: () => {
    if (flags.has(FLAG.oil)) return;
    if (!lift.raised) { toast(ctx, STRINGS.wellHint); return; }
    flags.set(FLAG.oil); wellParts.jar.visible = false; wellSpot.label = STRINGS.oilTaken; toast(ctx, STRINGS.oilGot);
  } };
  const well: SignalWorld['well'] = { ...wellParts, get raised() { return lift.raised; }, spot: wellSpot, pull: () => {
    if (lift.raised) return false;
    lift.raised = true; wellSpot.label = STRINGS.takeOil; return true;
  } };
  if (flags.has(FLAG.oil)) { wellParts.jar.visible = false; wellSpot.label = STRINGS.oilTaken; wellParts.bucket.position.y = 1.85 - 0.5; wellParts.rope.scale.y = 0.2; }

  // The braziers: pour oil by hand, light with a crack.
  resetFireLights();
  const braziers: Brazier[] = BRAZIERS.map((b, i) => {
    const parts = buildBrazier(b.x, b.z, groundAt); ctx.root.add(parts.root);
    ctx.piece({ id: `sunscar.brazier.${String(i)}`, name: STRINGS.waymark, category: 'props', file: file('places'), object: parts.root, colliders: parts.colliders, surface: 'stone' });
    const brazier: Brazier = { parts, oiled: false, lit: false,
      // radius 3: the bowl stands on its plinth, 2.35 m up, and is reached from the sand round it
      spot: { label: STRINGS.needOil, position: parts.bowlAt, radius: 3, onInteract: () => {
        if (brazier.lit) return;
        if (!flags.has(FLAG.oil)) { toast(ctx, STRINGS.needOilHint); return; }
        if (!brazier.oiled) { brazier.oiled = true; parts.oil.visible = true; brazier.spot.label = STRINGS.crackToLight; toast(ctx, STRINGS.crackToLight); }
      } },
      light: () => {
        if (brazier.lit || !brazier.oiled) return false;
        brazier.lit = true; parts.fire.visible = true; parts.glow(true); brazier.spot.label = STRINGS.waymarkLit; flags.set(brazierFlag(i));
        const n = braziers.filter((x) => x.lit).length; toast(ctx, n < braziers.length ? `${STRINGS.waymarkLit} · ${String(n)}/${String(braziers.length)}` : STRINGS.allLit);
        return true;
      } };
    if (flags.has(brazierFlag(i))) { brazier.oiled = true; brazier.lit = true; parts.oil.visible = true; parts.fire.visible = true; parts.glow(true); brazier.spot.label = STRINGS.waymarkLit; }
    else if (flags.has(FLAG.oil)) brazier.spot.label = STRINGS.pourOil;
    return brazier;
  });
  // the caravan's lantern lights its own wagon (the fourth firelight slot; always burning)
  fireLight(caravan.lampAt)(true, 0.22); // round 8 (the council: the whole canvas one even self-lit orange): a lantern, not a fire
  const allLit = (): boolean => braziers.every((b) => b.lit);

  // The signal fire on the tower deck: lit by hand once the three waymarks burn.
  const fire: SignalFire = { tower, lit: false, onLight: null,
    brazier: { label: STRINGS.light, position: tower.brazierAt, radius: 2.6, onInteract: () => {
      if (fire.lit) return;
      if (!allLit()) { toast(ctx, STRINGS.fireHint); return; }
      fire.light();
    } },
    light: () => {
      if (fire.lit) return;
      fire.lit = true; tower.fire.visible = true; tower.light.intensity = TOWER_LIGHT; fire.brazier.label = STRINGS.lit; flags.set(FLAG.lit); fire.onLight?.();
    } };
  if (flags.has(FLAG.lit)) fire.light();
  interactables?.push(logbook, wellSpot, ...braziers.map((b) => b.spot), fire.brazier);

  const crackables: Crackable[] = [
    { at: wellParts.crankAt, radius: 0.8, crack: (heavy, second) => {
      if (well.raised) return false;
      if (!heavy) { toast(ctx, STRINGS.pullHint); return true; }
      return second ? well.pull() : true; // the double crack's first lash wraps the crank, the second pulls
    } },
    ...braziers.map((b): Crackable => ({ at: b.parts.bowlAt, radius: 1.2, crack: () => b.light() })),
  ];
  lastLightAll(ctx.root, ctx.scope); // the style bible's rim and shade floor on every prop
  ownPrimitives(ctx.root, ctx.scope);
  for (const r of FIRE_RESOURCES) ctx.scope.own(r);
  ctx.scope.onDispose(() => { for (const g of fireGeometries()) g.dispose(); });
  ctx.scope.onDispose(loadFireBook()); // E407 row 6: the flame's flipbook, freed with the shard
  // round 18 (row 3: a warm light pool on the sand AND the plinth, from a real light): one short-range point light rides to
  // the lit waymark nearest the player and flickers; one light for all three keeps the shaders' light count fixed (it is
  // in the scene from the start, dark until a waymark burns)
  const wayLight = new PointLight(0xff7a30, 0, 10, 2); ctx.root.add(wayLight);
  ctx.system({ id: 'sunscar.fire', phase: 'update', run: (dt, t) => {
    tickFires(t); dressing.tick(t);
    // E409 second top-10 row 8 (mockup B: the lantern lights the canvas, the tailboard and the sand): the caravan's lantern,
    // always burning, is one of the light's sources; the light goes to whichever lit source is nearest the player
    const me = ctx.game.runtime?.world?.player.position; let near: Vector3 | null = null, gain = 0, best = Infinity;
    if (me) {
      for (const b of braziers) { if (!b.lit) continue; const d = b.parts.bowlAt.distanceToSquared(me); if (d < best) { best = d; near = b.parts.bowlAt; gain = WAY_LIGHT; } }
      if (caravan.lampAt.distanceToSquared(me) < best) { near = caravan.lampAt; gain = LANTERN_LIGHT; }
    }
    // round 21 (seat C: the fire's orange turned the violet sand under B's wagon red-pink): the lantern's light amber-yellow
    wayLight.color.setHex(gain === WAY_LIGHT ? 0xff7a30 : 0xffd27a); // round 23: yellower (seat B: B's pool still h356)
    if (near) { wayLight.position.copy(near).setY(near.y + (gain === WAY_LIGHT ? 0.5 : 0)); wayLight.intensity = gain * (1 + Math.sin(t * 11) * 0.07 + Math.sin(t * 23 + 0.7) * 0.05); } else wayLight.intensity = 0;
    // The bucket rides up over 1.2 s once pulled.
    if (well.raised && lift.t < 1) { lift.t = Math.min(1, lift.t + dt / 1.2); wellParts.bucket.position.y = 1.85 - wellParts.drop + (wellParts.drop - 0.5) * lift.t; wellParts.rope.scale.y = 1 - lift.t * 0.8; wellParts.crank.rotation.x = lift.t * 12; }
    if (!fire.lit) return;
    const flick = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29 + 1.3) * 0.04;
    tower.light.intensity = TOWER_LIGHT * flick;
  } });
  return { fire, braziers, well, logbook, crackables, flags, get litCount() { return braziers.filter((b) => b.lit).length; } };
}
