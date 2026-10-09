import { InteractionRules } from '@wildshard/game/quest/interactionRows';
import { PointLight, type Vector3 } from 'three';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { ShardContext } from '@wildshard/game/shard/context';
import { BRAZIERS } from '../data/layout';
import { STRINGS } from '../data/strings';
import { ownPrimitives } from './resources';
import { buildTower, type TowerParts } from './tower';
import { buildBrazier, buildCaravan, buildWell, type BrazierParts, type WellParts } from './places';
import { bakedPiece, type BakedWorld } from './baked';
import { FIRE_RESOURCES, fireGeometries, fireLight, loadFireBook, resetFireLights, tickFires } from './fireFx';
import { lastLightAll } from '../look/light';
import { FLAG } from '../data/flags';
import { brazierFlag } from '../quests/brazierFlag';
import { SIGNAL_INTERACTIONS } from '../quests/interactions';

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

export function buildWorld(ctx: ShardContext, flags: Flags, baked: BakedWorld): SignalWorld {
  const terrain = ctx.manifest.ground.terrain, groundAt = (x: number, z: number): number => terrain?.heightAt(x, z) ?? 0;
  const file = 'src/shards/sunscar-dunes/generators/places.ts';
  // SF72: the tower's frame is baked offline (generators/tower.ts); the client adds its lamp, brazier and fire
  const tower = buildTower(baked);
  ctx.root.add(tower.root);
  ctx.piece({ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: 'src/shards/sunscar-dunes/generators/tower.ts', object: tower.root, colliders: tower.colliders, surface: 'wood' });
  // SF72: the places' code-built parts and colliders are baked offline (generators/places.ts); the client adds the models and what lives
  const caravan = buildCaravan(baked, groundAt); ctx.root.add(caravan.root);
  ctx.piece({ id: 'sunscar.caravan', name: STRINGS.caravan, category: 'props', file, object: caravan.root, colliders: caravan.colliders, surface: 'wood' });
  const wellParts = buildWell(baked); ctx.root.add(wellParts.root);
  ctx.piece({ id: 'sunscar.well', name: STRINGS.well, category: 'buildings', file, object: wellParts.root, colliders: wellParts.colliders, surface: 'stone' });
  // SF72: the rock field is baked offline (generators/rocks.ts); the client draws the bake and registers its colliders
  const rocks = bakedPiece(baked, 'rocks'); ctx.root.add(rocks.root);
  ctx.piece({ id: 'sunscar.rocks', name: STRINGS.rocks, category: 'nature', file: 'src/shards/sunscar-dunes/generators/rocks.ts', object: rocks.root, colliders: rocks.colliders, surface: 'rock' });
  const dressing = bakedPiece(baked, 'dressing'); ctx.root.add(dressing.root);
  ctx.piece({ id: 'sunscar.dressing', name: STRINGS.dressing, category: 'nature', file: 'src/shards/sunscar-dunes/generators/dressing.ts', object: dressing.root, colliders: dressing.colliders, surface: 'sand' });
  const interactables = ctx.game.runtime?.interactables, rules = new InteractionRules(flags, SIGNAL_INTERACTIONS);

  // The logbook on the caravan's tailboard: read it once, it points the way to the well.
  const logbook: Interactable = { label: STRINGS.readLog, position: caravan.logbookAt, radius: 2.4, onInteract: () => {
    if (!rules.run('logbook').ok) return; logbook.label = STRINGS.logRead; toast(ctx, STRINGS.logText);
  } };
  if (flags.has(FLAG.logbook)) logbook.label = STRINGS.logRead;

  // The well: a heavy crack on the crank hauls the bucket up; then take the oil jar.
  const lift = { t: flags.has(FLAG.oil) ? 1 : 0 };
  const wellSpot: Interactable = { label: STRINGS.wellDown, position: wellParts.jarAt, radius: 2.6, onInteract: () => {
    const result = rules.run('well');
    if (!result.ok) { if (result.reason === 'unraised') toast(ctx, STRINGS.wellHint); return; }
    wellParts.jar.visible = false; wellSpot.label = STRINGS.oilTaken; toast(ctx, STRINGS.oilGot);
  } };
  const well: SignalWorld['well'] = { ...wellParts, get raised() { return rules.has('raised'); }, spot: wellSpot, pull: () => {
    if (!rules.run('crank').ok) return false; wellSpot.label = STRINGS.takeOil; return true;
  } };
  if (flags.has(FLAG.oil)) { wellParts.jar.visible = false; wellSpot.label = STRINGS.oilTaken; wellParts.bucket.position.y = 1.85 - 0.5; wellParts.rope.scale.y = 0.2; }

  // The braziers: pour oil by hand, light with a crack.
  resetFireLights();
  const braziers: Brazier[] = BRAZIERS.map((_, i) => {
    const parts = buildBrazier(i, groundAt); ctx.root.add(parts.root);
    ctx.piece({ id: `sunscar.brazier.${String(i)}`, name: STRINGS.waymark, category: 'props', file, object: parts.root, colliders: parts.colliders, surface: 'stone' });
    const oiled = `oiled.${String(i)}`, lit = `lit.${String(i)}`;
    const brazier: Brazier = { parts, get oiled() { return rules.has(oiled); }, set oiled(value) { rules.mark(oiled, value); }, get lit() { return rules.has(lit); }, set lit(value) { rules.mark(lit, value); },
      // radius 3: the bowl stands on its plinth, 2.35 m up, and is reached from the sand round it
      spot: { label: STRINGS.needOil, position: parts.bowlAt, radius: 3, onInteract: () => {
        const result = rules.run(`pour.${String(i)}`);
        if (!result.ok) { if (result.reason === 'missing') toast(ctx, STRINGS.needOilHint); return; }
        parts.oil.visible = true; brazier.spot.label = STRINGS.crackToLight; toast(ctx, STRINGS.crackToLight);
      } },
      light: () => {
        if (!rules.run(`light.${String(i)}`, () => { parts.fire.visible = true; parts.glow(true); brazier.spot.label = STRINGS.waymarkLit; }).ok) return false;
        const n = braziers.filter((x) => x.lit).length; toast(ctx, n < braziers.length ? `${STRINGS.waymarkLit} · ${String(n)}/${String(braziers.length)}` : STRINGS.allLit);
        return true;
      } };
    if (flags.has(brazierFlag(i))) { brazier.oiled = true; brazier.lit = true; parts.oil.visible = true; parts.fire.visible = true; parts.glow(true); brazier.spot.label = STRINGS.waymarkLit; }
    else if (flags.has(FLAG.oil)) brazier.spot.label = STRINGS.pourOil;
    return brazier;
  });
  // the caravan's lantern lights its own wagon (the fourth firelight slot; always burning)
  fireLight(caravan.lampAt)(true, 0.22); // round 8 (the council: the whole canvas one even self-lit orange): a lantern, not a fire

  // The signal fire on the tower deck: lit by hand once the three waymarks burn.
  const fireCaught = (caught: SignalFire): void => { caught.tower.fire.visible = true; caught.tower.light.intensity = TOWER_LIGHT; caught.brazier.label = STRINGS.lit; };
  const fire: SignalFire = { tower, get lit() { return rules.has('fire'); }, set lit(value) { rules.mark('fire', value); }, onLight: null,
    brazier: { label: STRINGS.light, position: tower.brazierAt, radius: 2.6, onInteract: () => {
      const result = rules.run('fire', () => { fireCaught(fire); });
      if (!result.ok) { if (result.reason === 'unlit') toast(ctx, STRINGS.fireHint); return; }
      fire.onLight?.();
    } },
    // a load that finds the fire lit: it burns at once, whatever the transient waymarks say
    light: () => {
      if (rules.has('fire')) return;
      rules.mark('fire'); fireCaught(fire); flags.set(FLAG.lit);
      fire.onLight?.();
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
    tickFires(t);
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
