import { InteractionRules } from '@wildshard/game/quest/interactionRows';
import { PointLight, type Vector3 } from 'three';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { questPagePrompt, bindClientChannels, bindQuestPageInteractions } from '@wildshard/game/plugin/ui';
import type { SignalDunesPlugin } from '../plugin';
import source from '../runtime/source';

import { BRAZIERS } from '../data/layout';
import { STRINGS } from '../data/strings';
import { buildPlace, type TowerParts, type BrazierParts, type WellParts } from './places';
import { WORLD, type BakedWorld } from './baked';
import { fireLight, tickFires } from './fireFx';
import { lastLightAll } from '../look/light';
import { FLAG } from '../data/flags';
import { SIGNAL_INTERACTIONS } from '../data/signalInteractions';

type ShardContext = Parameters<SignalDunesPlugin['world']>[0];

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
  // SF72: the tower's frame, the places' code-built parts and colliders, the rock field and its dressing are baked offline
  // (generators/*.ts); the client adds the models and what lives (data/pieces.ts lists them)
  const pieces = WORLD.placements(ctx.piece, ctx.root, baked);
  const tower = pieces.add('sunscar.tower', buildPlace('tower',baked)), caravan = pieces.add('sunscar.caravan', buildPlace('caravan',baked)), wellParts = pieces.add('sunscar.well', buildPlace('well',baked));
  pieces.baked('sunscar.rocks'); pieces.baked('sunscar.dressing');
  const interactables = ctx.game.runtime?.interactables, rules = new InteractionRules(flags, SIGNAL_INTERACTIONS);

  let page: (id: string) => boolean = () => { throw new Error('Quest page interactions are not bound'); };

  // The logbook on the caravan's tailboard: read it once, it points the way to the well.
  const logbook = questPagePrompt(STRINGS.readLog,caravan.logbookAt,2.4);

  // The well: a heavy crack on the crank hauls the bucket up; then take the oil jar.
  const programs = source.clientChannels;
  if (programs?.length !== 2) throw new Error('Missing declared bucket motion');
  const channels = bindClientChannels(programs, { targets: new Map<string, unknown>([['bucket', wellParts.bucket], ['rope', wellParts.rope]]) });
  channels.evaluate(programs[0]?.id ?? '', { time: 0, delta: 0, values: [Number(flags.has(FLAG.oil)), Number(rules.has('raised')), wellParts.drop] });
  channels.bindPrompts({ named: new Map([['sunscar.well.take', () => { page('well'); }]]) });
  channels.evaluate(programs[1]?.id ?? '', { time: 0, delta: 0, values: [wellParts.jarAt.x, wellParts.jarAt.y, wellParts.jarAt.z] });
  const wellSpot = channels.prompt(programs[1]?.id ?? '');
  const well: SignalWorld['well'] = { ...wellParts, get raised() { return rules.has('raised'); }, spot: wellSpot,
    pull: () => page('crank') };

  // The braziers: pour oil by hand, light with a crack.
  const braziers: Brazier[] = BRAZIERS.map((_, i) => {
    const parts = pieces.add(`sunscar.brazier.${String(i)}`, buildPlace('brazier',baked, i, pieces.colliders(`sunscar.brazier.${String(i)}`)));
    const oiled = `oiled.${String(i)}`, lit = `lit.${String(i)}`;
    const brazier: Brazier = { parts, get oiled() { return rules.has(oiled); }, set oiled(value) { rules.mark(oiled, value); }, get lit() { return rules.has(lit); }, set lit(value) { rules.mark(lit, value); },
      // radius 3: the bowl stands on its plinth, 2.35 m up, and is reached from the sand round it
      spot: questPagePrompt(STRINGS.needOil,parts.bowlAt,3),
      light: () => page(`light.${String(i)}`) };
    return brazier;
  });
  // the caravan's lantern lights its own wagon (the fourth firelight slot; always burning)
  fireLight(caravan.lampAt)(true, 0.22); // round 8 (the council: the whole canvas one even self-lit orange): a lantern, not a fire

  // The signal fire on the tower deck: lit by hand once the three waymarks burn.
  const fireCaught = (caught: SignalFire): void => { caught.tower.fire.visible = true; caught.tower.light.intensity = TOWER_LIGHT; caught.brazier.label = STRINGS.lit; };
  const fire: SignalFire = { tower, get lit() { return rules.has('fire'); }, set lit(value) { rules.mark('fire', value); }, onLight: null,
    brazier: questPagePrompt(STRINGS.light,tower.brazierAt,2.6),
    // a load that finds the fire lit: it burns at once, whatever the transient waymarks say
    light: () => {
      if (rules.has('fire')) return;
      rules.mark('fire'); fireCaught(fire); flags.set(FLAG.lit);
      fire.onLight?.();
    } };
  const presentation = bindQuestPageInteractions(source, { flags, rules,
    owners: new Map<string,unknown>([['world',{logbook,well,braziers,fire}],['commands',{catchFire:()=>{fireCaught(fire);}}]]),
    toast: text => { toast(ctx, text); } });
  page = presentation.run;

  if (flags.has(FLAG.lit)) fire.light();
  interactables?.push(logbook, wellSpot, ...braziers.map((b) => b.spot), fire.brazier);

  const crackables = [...presentation.world.targets];
  lastLightAll(ctx.root, ctx.scope); // the style bible's rim and shade floor on every prop
  ctx.scope.ownPrimitives(ctx.root);
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
    channels.evaluate(programs[0]?.id ?? '', { time: t, delta: dt, values: [Number(flags.has(FLAG.oil)), Number(well.raised), wellParts.drop] });
      if (!fire.lit) return;
    const flick = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29 + 1.3) * 0.04;
    tower.light.intensity = TOWER_LIGHT * flick;
  } });
  return { fire, braziers, well, logbook, crackables, flags, get litCount() { return braziers.filter((b) => b.lit).length; } };
}
