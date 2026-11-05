import { Vector3 } from 'three';
import * as v from 'valibot';
import type { Player } from '@wildshard/engine/player/Player';
import { WeatherWorldSchema } from '@wildshard/format/weatherProgram';
import type { ShardContext } from '../plugin/context';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import type { WeatherReactions } from '../../server/weather/reactions';

/** Client-only intake of the same damage policy used by native weather. The
 * entered lifetime owns its subscription; no content damage callback binds. */
export function bindPageWeatherHit(ctx: ShardContext, player: Player, storm: WeatherReactions, input: unknown): void {
  const rows = v.parse(WeatherWorldSchema, input);
  installEnteredRuntimeService(ctx, scope => { scope.onDispose(storm.on('hurt', event => {
    const target = ctx.app.player; if (target === null) return;
    ctx.app.combat.hit({ source: 'env', sourceTags: rows.hit.tags, target, amount: ctx.app.events.ask(rows.hit.ask, event['damage'] ?? 0), point: player.position.clone(), dir: new Vector3(), cause: rows.hit.cause, toast: rows.hit.toast });
  })); });
}
