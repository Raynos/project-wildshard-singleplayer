import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import { parse } from 'valibot';
import { ClientBossTelegraphSchema } from '@wildshard/format/clientNative';
import type { ShardContext } from '../plugin/context';
import { clientNativeBook } from './clientNativeBook';

/** Client-only telegraphs on the original encounter. Marked views are consumed
 * when the spawned fight binds; lane sheets read its real strike controller. */
export function installClientBossTelegraph(ctx: ShardContext, input: unknown): void {
  const row = parse(ClientBossTelegraphSchema, input), fight = clientNativeBook(ctx).fight, view = row.view;
  const world = ctx.game.runtime?.world;
  if (fight === null || world === undefined || world === null || row.actor !== ctx.product.section('sim/runtime-plan').recipe.population.owner.actor)
    throw new Error('Boss telegraph requires its actual encounter owner');
  if (view.kind === 'marked') return;
  const strike = ctx.product.section('actors/strikes').find(entry => entry.id === view.strike), body = fight.control;
  if (strike?.shape.kind !== 'lane' || body === null) throw new Error('Lane sheet requires its admitted lane strike and held controller');
  const width = strike.shape.width, reach = strike.shape.length;
  const wall = new Mesh(new BoxGeometry(width, view.height, view.thickness),
    new MeshBasicMaterial({ color: view.color, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false }));
  wall.visible = false; ctx.root.add(wall); ctx.scope.own(wall.geometry); ctx.scope.own(wall.material); ctx.scope.onDispose(() => { wall.removeFromParent(); });
  ctx.system({ id: view.system, phase: 'update', run: () => {
    const actor = fight.boss.body(); wall.visible = body.current?.id === strike.id && actor?.alive === true;
    if (!wall.visible || actor === null) return;
    const fraction = Math.min(1, body.windup / strike.windup), sweep = Math.max(0, body.windup - strike.windup) / strike.active;
    const distance = view.ahead + reach * Math.min(1, sweep);
    wall.position.set(actor.position.x + Math.sin(body.aim) * distance, world.player.position.y + view.y, actor.position.z + Math.cos(body.aim) * distance);
    wall.rotation.y = body.aim; wall.material.opacity = view.opacity[0] + (view.opacity[1] - view.opacity[0]) * fraction;
  } });
}
