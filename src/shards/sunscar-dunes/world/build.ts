import { InteractionRules } from '@wildshard/game/quest/interactionRows';
import { Object3D, PointLight, type Vector3, type Group, type Mesh } from 'three';
import { SiteLights } from '@wildshard/engine/fx/SiteLights';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { createQuestPagePrompts, bindClientChannels, bindQuestPageInteractions } from '@wildshard/game/plugin/ui';
import type { SignalDunesPlugin } from '../plugin';

import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { sceneModelSource } from '@wildshard/game/shardfile/sceneSources';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { BakedWorld } from './baked';
import { addFire, addLampGlow, fireLight, tickFires } from './fireFx';
import { lastLightAll } from '../look/light';

interface TowerParts { root: Group; colliders: readonly ColliderDesc[]; fire: Group; light: PointLight; brazierAt: Vector3; deckY: number }
interface WellParts { root: Group; colliders: readonly ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }
interface BrazierParts { root: Group; colliders: readonly ColliderDesc[]; fire: Group; oil: Mesh; bowlAt: Vector3; glowAt: Vector3; glow: (lit: boolean) => void }

type ShardContext = Parameters<SignalDunesPlugin['world']>[0];

/** The signal fire's view and read-only state; admitted interactions own ignition. */
export interface SignalFire { tower: TowerParts; brazier: Interactable; readonly lit: boolean; onLight: (() => void) | null }
export interface Brazier { parts: BrazierParts; spot: Interactable; readonly oiled: boolean; readonly lit: boolean; light: () => boolean }
export interface SignalWorld {
  fire: SignalFire; braziers: Brazier[]; well: WellParts & { readonly raised: boolean; pull: () => boolean; spot: Interactable };
  logbook: Interactable; contacts: ReturnType<typeof bindQuestPageInteractions>; flags: Flags;
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

export async function buildWorld(ctx: ShardContext, flags: Flags, _baked: BakedWorld, keepChannels: (channels: ReturnType<typeof bindClientChannels>) => ReturnType<typeof bindClientChannels> = channels => channels): Promise<SignalWorld> {
  const STRINGS = ctx.product.strings(['lit']);
  const source = ctx.product.shardfile;
  const handles = await installWorldScenes(ctx, ctx.product.section('world/scenes'));
  const effects = await ctx.product.json<readonly { readonly part: string; readonly pool: string | null; readonly rows: unknown }[]>('world/places-effects.json');
  for (const effect of effects) {
    const group = handles.group(effect.part), pool = effect.pool === null ? null : sceneModelSource(ctx.product, 'models').geometry(effect.pool);
    if (effect.pool !== null && pool === null) throw new Error('Missing declared fire pool');
    if (typeof effect.rows !== 'object' || effect.rows === null) throw new Error('Invalid declared fire cards');
    if ('fire' in effect.rows) addFire(group, effect.rows, pool); else addLampGlow(group, effect.rows, pool);
  }
  const tower: TowerParts = { root: handles.group('tower.root'), colliders: handles.colliders('tower.colliders'), fire: handles.group('tower.fire'), light: handles.light('tower.light'), brazierAt: handles.vector('tower.brazierAt'), deckY: handles.number('tower.deckY') };
  const caravan = { root: handles.group('caravan.root'), colliders: handles.colliders('caravan.colliders'), logbookAt: handles.vector('caravan.logbookAt'), lampAt: handles.vector('caravan.lampAt') };
  const wellParts: WellParts = { root: handles.group('well.root'), colliders: handles.colliders('well.colliders'), bucket: handles.group('well.bucket'), rope: handles.mesh('well.rope'), jar: handles.mesh('well.jar'), crankAt: handles.vector('well.crankAt'), jarAt: handles.vector('well.jarAt'), drop: handles.number('well.drop') };
  const interactables = ctx.game.runtime?.interactables, rules = InteractionRules.fromDeclared(source, flags);

  let page: (id: string) => boolean = () => { throw new Error('Quest page interactions are not bound'); };

  // The logbook on the caravan's tailboard: read it once, it points the way to the well.
  const [logbook,firePrompt] = createQuestPagePrompts(source,new Map<string,unknown>([['caravan',caravan],['tower',tower]]),['logbook','fire']);

  // The well: a heavy crack on the crank hauls the bucket up; then take the oil jar.
  const programs = source.clientChannels;
  if (programs?.length !== 2) throw new Error('Missing declared bucket motion');
  const channels = keepChannels(bindClientChannels(programs, { nativeOwners: ['sunscar.well.bucket'], targets: new Map<string, unknown>([['bucket', wellParts.bucket], ['rope', wellParts.rope]]) }));
  channels.bindPrompts({ named: new Map([['sunscar.well.take', () => { page('well'); }]]) });
  channels.evaluate(programs[1]?.id ?? '', { time: 0, delta: 0, values: [wellParts.jarAt.x, wellParts.jarAt.y, wellParts.jarAt.z] });
  const wellSpot = channels.prompt(programs[1]?.id ?? '');
  const well: SignalWorld['well'] = { ...wellParts, get raised() { return rules.has('raised'); }, spot: wellSpot,
    pull: () => page('crank') };

  // The braziers: pour oil by hand, light with a crack.
  const braziers: Brazier[] = LAYOUT.BRAZIERS.map((_, i) => {
    const prefix = `brazier.${String(i)}`, at = handles.vector(`${prefix}.glowAt`), light = fireLight(at), embers = handles.materials(`${prefix}.embers`);
    const parts: BrazierParts = { root: handles.group(`${prefix}.root`), colliders: handles.colliders(`${prefix}.colliders`), fire: handles.group(`${prefix}.fire`), oil: handles.mesh(`${prefix}.oil`), bowlAt: handles.vector(`${prefix}.bowlAt`), glowAt: at, glow: lit => { light(lit); for (const ember of embers) ember.emissiveIntensity = lit ? 1.1 : 0; } };
    const oiled = `oiled.${String(i)}`, lit = `lit.${String(i)}`;
    const brazier: Brazier = { parts, get oiled() { return rules.has(oiled); }, get lit() { return rules.has(lit); },
      // radius 3: the bowl stands on its plinth, 2.35 m up, and is reached from the sand round it
      spot: createQuestPagePrompts(source,new Map([['parts',parts]]),[`brazier.${String(i)}`])[0],
      light: () => page(`light.${String(i)}`) };
    return brazier;
  });
  // the caravan's lantern lights its own wagon (the fourth firelight slot; always burning)
  fireLight(caravan.lampAt)(true, 0.22); // round 8 (the council: the whole canvas one even self-lit orange): a lantern, not a fire

  // The signal fire on the tower deck: lit by hand once the three waymarks burn.
  const fireCaught = (caught: SignalFire): void => { caught.tower.fire.visible = true; caught.tower.light.intensity = TOWER_LIGHT; caught.brazier.label = STRINGS.lit; };
  const fire: SignalFire = { tower, get lit() { return rules.has('fire'); }, onLight: null, brazier: firePrompt };
  const presentation = bindQuestPageInteractions(source, { flags, rules,
    owners: new Map<string,unknown>([['world',{logbook,well,braziers,fire}],['motion',channels],['commands',{catchFire:()=>{fireCaught(fire);}}]]),
    ...(interactables===undefined?{}:{interactables}),toast: text => { toast(ctx, text); } }, ctx.product.section('world/targets'));
  page = presentation.run;

  lastLightAll(ctx.root, ctx.scope); // the style bible's rim and shade floor on every prop
  ctx.scope.ownPrimitives(ctx.root);
  // round 18 (row 3: a warm light pool on the sand AND the plinth, from a real light): one short-range point light rides to
  // the lit waymark nearest the player and flickers (the engine's SiteLights); one light for all three keeps the shaders'
  // light count fixed (it is in the scene from the start, dark until a waymark burns). E409 second top-10 row 8 (mockup
  // B): the caravan's lantern, always burning, is one of its sites; round 21/23 (seat C, B): its light amber-yellow
  const wayLights = new SiteLights({ flicker: { depth: 1, waves: [[11, 0, 0.07], [23, 1, 0.05]] } });
  const site = (at: Vector3, lift: number): Object3D => { const o = new Object3D(); o.position.copy(at).setY(at.y + lift); ctx.root.add(o); return o; };
  ctx.root.add(wayLights.addLight(new PointLight(0xff7a30, 0, 10, 2)));
  const lightStates = braziers.map(b => ({ lit: b.lit }));
  for (const [i, b] of braziers.entries()) wayLights.addLamp(site(b.parts.bowlAt, 0.5), 0xff7a30, WAY_LIGHT, 10, lightStates[i], 'fire');
  wayLights.addLamp(site(caravan.lampAt, 0), 0xffd27a, LANTERN_LIGHT, 10);
  ctx.system({ id: 'sunscar.fire', phase: 'update', run: (_dt, t) => {
    for (const [i, state] of lightStates.entries()) state.lit = braziers[i]?.lit ?? false;
    tickFires(t);
    const me = ctx.game.runtime?.world?.player.position; if (me) wayLights.step(t, me);
    if (!fire.lit) return;
    const flick = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29 + 1.3) * 0.04;
    tower.light.intensity = TOWER_LIGHT * flick;
  } });
  return { fire, braziers, well, logbook, contacts: presentation, flags, get litCount() { return braziers.filter((b) => b.lit).length; } };
}
