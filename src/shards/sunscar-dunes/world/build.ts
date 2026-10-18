import { InteractionRules } from '@wildshard/game/quest/interactionRows';
import type { PointLight, Vector3, Group, Mesh } from 'three';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { createQuestPagePrompts, bindClientChannels, bindQuestPageInteractions } from '@wildshard/game/plugin/ui';
import type { SignalDunesPlugin } from '../plugin';

import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { clientSceneHandles } from '@wildshard/game/shardfile/clientPlan';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { BakedWorld } from './baked';
import { productPainterLight } from '@wildshard/game/looks/paintedLook';

interface TowerParts { root: Group; colliders: readonly ColliderDesc[]; fire: Group; light: PointLight; brazierAt: Vector3; deckY: number }
interface WellParts { root: Group; colliders: readonly ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }
interface BrazierParts { root: Group; colliders: readonly ColliderDesc[]; fire: Group; oil: Mesh; bowlAt: Vector3; glowAt: Vector3 }

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

/**
 * Signal Dunes' places (C1): the signal tower, the half-buried caravan, the dry well, three waymark braziers and the
 * wind-cut rock field. The quest state lives in `flags`, so a later visit finds the world as it was left.
 */

export function buildWorld(ctx: ShardContext, flags: Flags, _baked: BakedWorld, keepChannels: (channels: ReturnType<typeof bindClientChannels>) => ReturnType<typeof bindClientChannels> = channels => channels): SignalWorld {
  const source = ctx.product.shardfile;
  const handles = clientSceneHandles(ctx.product, residentWorldScope(ctx));
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
    const prefix = `brazier.${String(i)}`, at = handles.vector(`${prefix}.glowAt`);
    const parts: BrazierParts = { root: handles.group(`${prefix}.root`), colliders: handles.colliders(`${prefix}.colliders`), fire: handles.group(`${prefix}.fire`), oil: handles.mesh(`${prefix}.oil`), bowlAt: handles.vector(`${prefix}.bowlAt`), glowAt: at };
    const oiled = `oiled.${String(i)}`, lit = `lit.${String(i)}`;
    const brazier: Brazier = { parts, get oiled() { return rules.has(oiled); }, get lit() { return rules.has(lit); },
      // radius 3: the bowl stands on its plinth, 2.35 m up, and is reached from the sand round it
      spot: createQuestPagePrompts(source,new Map([['parts',parts]]),[`brazier.${String(i)}`])[0],
      light: () => page(`light.${String(i)}`) };
    return brazier;
  });

  // The signal fire on the tower deck: lit by hand once the three waymarks burn.
  const fire: SignalFire = { tower, get lit() { return rules.has('fire'); }, onLight: null, brazier: firePrompt };
  const presentation = bindQuestPageInteractions(source, { flags, rules, context: ctx,
    owners: new Map<string,unknown>([['world',{logbook,well,braziers,fire}],['motion',channels]]),
    ...(interactables===undefined?{}:{interactables}),toast: text => { toast(ctx, text); } }, ctx.product.section('world/targets'));
  page = presentation.run;

  productPainterLight(ctx.product, ctx.root, ctx.scope); // the style bible's rim and shade floor on every prop
  ctx.scope.ownPrimitives(ctx.root);
  return { fire, braziers, well, logbook, contacts: presentation, flags, get litCount() { return braziers.filter((b) => b.lit).length; } };
}
