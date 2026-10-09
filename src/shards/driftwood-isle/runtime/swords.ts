import * as v from 'valibot';
import { MathUtils, Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { CombatTag, DamageRequest } from '@wildshard/engine/combat/pipeline';
import type { MeleeProfile } from '@wildshard/engine/combat/meleeProfile';
import type { Move } from '@wildshard/engine/combat/view/melee';
import { SweptMeleeCore, sweptMoveDamage } from '@wildshard/engine/combat/sweptMeleeCore';
import { bladeBlocked } from '@wildshard/engine/player/MeleeSweep';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { SWORD_IRON, SWORD_WOOD } from '@wildshard/game/weapons/starterMeleeProfile';

/** The swords' fixed-step adapter id. */
export const SWORDS_STEP = 'item.driftwood-isle.swords';
/** The declared rows' ids (data/items.ts), in loadout order: the wooden sword (held from the start), then the iron one. */
export const SWORD_IDS = ['weapon.driftwood-isle.wood', 'weapon.driftwood-isle.iron'] as const;
/** Which sword is in hand: 0 the wooden sword, 1 the iron sword. */
export type SwordIndex = 0 | 1;
/** The fixed step's seconds (the host's 60 Hz tick), the world clock the combo gap is measured on. */
const DT = 1 / 60;
/** The browser player's eye above the feet (engine Player EYE): the sweep's rays leave the camera. */
const EYE = 1.68;
const Y_AXIS = new Vector3(0, 1, 0);

/**
 * The two swords' melee profiles exactly as the page builds them (loadout/rows.ts `driftwoodLoadoutRows`): the starter
 * wooden / iron profile with the declared row's light damage, reach, cooldown and heavy charge.
 */
export function driftwoodSwordProfiles(rows: readonly ItemSpec[]): readonly [MeleeProfile, MeleeProfile] {
  const wood = rows.find(row => row.id === SWORD_IDS[0]), iron = rows.find(row => row.id === SWORD_IDS[1]);
  if (wood?.kind !== 'weapon' || iron?.kind !== 'weapon') throw new Error('Driftwood declares both swords');
  return [{ ...SWORD_WOOD, damage: wood.light.damage, reach: wood.light.range, cooldown: wood.light.cooldown, heavyCharge: wood.charge },
    { ...SWORD_IRON, damage: iron.light.damage, reach: iron.light.range, cooldown: iron.light.cooldown, heavyCharge: iron.charge }];
}

/** What the swords ask of the island keeper: AnimalManager's 'weapon.fired' wake and its stagger hook. */
export interface SwordIsland {
  /** AnimalManager.interruptTargets('target.attack'): every aggressive or sensing body decides now */
  readonly alarm: () => void;
  /** AnimalManager.staggered: a blow's stagger on a fauna body reaches the hunting brain */
  readonly staggered: (a: AnimalSim, strength: number, running: boolean) => void;
}
/** The swords in the host: the hand's sword, swapping it, and the swings started and blows landed (continuation). */
export interface DriftwoodSwords {
  readonly held: () => SwordIndex;
  /** Weapons.select: the other sword goes to the hip (its swing and charge stop), this one comes to hand. */
  readonly equip: (index: SwordIndex) => void;
  readonly swings: () => number;
  readonly hits: () => number;
}

const finite = v.pipe(v.number(), v.finite()), count = v.pipe(finite, v.integer(), v.minValue(0));
const Clock = v.strictObject({ move: v.nullable(count), swingT: finite, comboIdx: count, lastSwingEnd: finite, cooldown: finite, charging: v.boolean(), chargeT: finite,
  releaseQueued: v.boolean(), chargePending: v.boolean(), heldPrev: v.boolean(), time: finite });
const Saved = v.strictObject({ held: v.picklist([0, 1]), queued: v.boolean(), struck: v.boolean(), target: v.nullable(v.string()), swings: count, hits: count, clocks: v.tuple([Clock, Clock]) });

/**
 * Driftwood's two swords as real items in the renderer-free host (SF72): each sword drives the swept melee family's own
 * clock (`SweptMeleeCore`, the one the browser's `Sword` drives) over the starter move set and the page's profile
 * (`driftwoodSwordProfiles`). A player command's attack is a light tap aimed at its named target (the tick protocol carries
 * no heavy hold, so the charged heavy stays the browser's). Every swing that starts is the page's 'weapon.fired': the
 * aggressive and sensing bodies wake (AnimalManager.interruptTargets 'target.attack'). While a swing's active window is
 * open the blade meets the target once (the page's struck list), when the target's skin (its head ball or body capsule)
 * is within the profile's reach of the eye and no world surface stands between (`bladeBlocked`): the move's damage
 * (`sweptMoveDamage`: the base × the move's factor, rounded) as `Melee.contact` files it, then, if it lives, the page's
 * knockback and stagger along the sweep, which on a fauna body reaches the hunting brain (`hunt.staggered`). The hand's
 * sword, both clocks, the queued tap, the swing's target and struck flag, and the counts are exact continuation.
 *
 * Not modelled (presentation or the page's own player): the blade's camera-space sweep rays (the target named by the
 * command is the one the crosshair is on), the lunge's dash onto the target, the first contact's hit-stop, the clang
 * off walls, and the dodge's 'target.dodge' wake (the tick protocol has no dodge).
 */
export function installDriftwoodSwords(host: SimHost, profiles: readonly [MeleeProfile, MeleeProfile], island: SwordIsland, attack: () => string | null): DriftwoodSwords {
  const state = { held: 0 as SwordIndex, queued: false, struck: false, target: null as string | null, swings: 0, hits: 0 };
  const clockFor = (profile: MeleeProfile): SweptMeleeCore<Move> => {
    const moves = profile.moves; if (moves === undefined) throw new Error('A Driftwood sword profile names its move set');
    return new SweptMeleeCore<Move>(moves, profile, { queue: () => { state.queued = true; }, consume: () => { const was = state.queued; state.queued = false; return was; } },
      // a swing starts: its blade has struck nothing yet, and the page's 'weapon.fired' wakes the island
      { start: () => { state.struck = false; state.swings++; island.alarm(); }, charge: () => { /* the heavy's charge is presentation */ } });
  };
  const clocks = [clockFor(profiles[0]), clockFor(profiles[1])] as const;
  /** each move's contact id (`Melee.contact`'s `move.<name>`), spelled once */
  const moveIds = new Map(profiles.flatMap(profile => { const m = profile.moves; return m === undefined ? [] : [...m.combo, m.heavy]; }).map(move => [move, `move.${move.name}`] as const));
  /** `Melee.contact`'s source tags for each sword */
  const tagsOf = (profile: MeleeProfile): readonly CombatTag[] => ['actor.player', profile.id, 'dmg.melee', 'cover.checked'];
  const tags = [tagsOf(profiles[0]), tagsOf(profiles[1])] as const;
  const eye = new Vector3(), centre = new Vector3(), a = new Vector3(), b = new Vector3(), near = new Vector3(), point = new Vector3();
  const fwd = new Vector3(), left = new Vector3(), dir = new Vector3(), push = new Vector3(), ab = new Vector3(), ea = new Vector3();
  /** the page's reused contact (SweptMelee's _hitPoint / _v1 / _aimOrigin): the pipeline copies it at its input boundary */
  const req: DamageRequest = { source: 'env', sourceTags: [], target: host.player.health, amount: 0, point, dir, from: eye, weaponId: '', moveId: '' };
  /** the nearest skin point of `actor` to the eye (its head ball or body capsule) into `point`; its distance */
  const skin = (actor: AnimalSim): number => {
    actor.headWorld(near);
    let best = Math.max(0, near.distanceTo(eye) - actor.dims.headRadius * actor.scale);
    point.copy(near).sub(eye).setLength(best).add(eye);
    actor.bodyCapsule(a, b);
    ab.subVectors(b, a);
    const f = ab.lengthSq() < 1e-12 ? 0 : MathUtils.clamp(ea.subVectors(eye, a).dot(ab) / ab.lengthSq(), 0, 1);
    near.copy(a).addScaledVector(ab, f);
    const body = Math.max(0, near.distanceTo(eye) - actor.dims.bodyRadius * actor.scale);
    if (body < best) { best = body; point.copy(near).sub(eye).setLength(body).add(eye); }
    return best;
  };
  /** SweptMelee.strike on `actor` with `move` from the hand's sword */
  const strike = (actor: AnimalSim, move: Move, index: SwordIndex): void => {
    const profile = profiles[index];
    centre.copy(actor.position); centre.y += actor.dims.bodyY * actor.scale;
    fwd.subVectors(centre, eye); if (fwd.lengthSq() < 1e-12) fwd.set(-Math.sin(host.player.yaw), 0, -Math.cos(host.player.yaw)); fwd.normalize();
    // the strike's direction is the sweep across the forward (an overhead chop drives forward and down)
    left.copy(fwd).applyAxisAngle(Y_AXIS, Math.PI / 2);
    dir.copy(fwd).multiplyScalar(0.7).addScaledVector(left, 0.7 * move.sweep).normalize();
    if (Math.abs(move.sweep) < 0.6) dir.y -= 0.35 * (1 - Math.abs(move.sweep));
    dir.normalize();
    req.sourceTags = tags[index]; req.target = actor.combatActor(); req.weaponId = profile.id; req.moveId = moveIds.get(move) ?? 'move.unknown';
    req.amount = Math.round(sweptMoveDamage(profile.damage, move, move === profile.moves?.heavy, 1));
    const dealt = host.combat.hit(req);
    if (dealt === null) return;
    state.hits++;
    if (dealt.killed) return;
    // the knockback: away from the player, biased the way the sweep travels; a running charge breaks (AnimalSim.stagger)
    push.set(fwd.x, 0, fwd.z).normalize().multiplyScalar(0.8).addScaledVector(left, 0.5 * move.sweep);
    const running = actor.speed > 1.5;
    actor.stagger(push, move.stagger);
    island.staggered(actor, MathUtils.clamp(move.stagger, 0, 1), running);
  };
  host.onStep(SWORDS_STEP, () => {
    const index = state.held, clock = clocks[index], profile = profiles[index];
    const target = attack();
    if (target !== null) {
      const idle = clock.move === null, swings = state.swings;
      clock.tryFire();
      // the tap that starts a swing aims it; a queued tap aims the chained swing it throws
      if (!idle || state.swings !== swings) state.target = target;
    }
    const { move, active } = clock.step(DT, host.state.tick * DT, profile.swingScale, false);
    if (move === null || !active || state.struck || state.target === null) return;
    const actor = host.entities.get(state.target);
    if (actor === undefined || !actor.alive) return;
    eye.copy(host.player.position); eye.y += EYE;
    if (skin(actor) > (move.reach ?? profile.reach) || bladeBlocked(host.physics, eye, point, host.player.motor.collider)) return;
    state.struck = true;
    strike(actor, move, index);
  }, { snapshot: () => JSON.stringify({ ...state, clocks: [clocks[0].snapshot(), clocks[1].snapshot()] }), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid Driftwood swords continuation');
    const saved = v.parse(Saved, JSON.parse(value));
    state.held = saved.held; state.queued = saved.queued; state.struck = saved.struck; state.target = saved.target; state.swings = saved.swings; state.hits = saved.hits;
    clocks[0].restore(saved.clocks[0]); clocks[1].restore(saved.clocks[1]);
  } });
  return {
    held: () => state.held,
    equip: index => { if (index === state.held) return; clocks[state.held].stop(); state.queued = false; state.target = null; state.held = index; },
    swings: () => state.swings, hits: () => state.hits,
  };
}
