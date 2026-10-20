import type { ShardContext } from '@wildshard/game/plugin/context';
import { installForestWeather } from '@wildshard/sdk/looks/forestWeather';

/** Counted page entry; all weather behaviour and drawing use admitted rows. */
export const RainFx = {
  async installPage(ctx: ShardContext, _input: unknown): ReturnType<typeof installForestWeather> {
    return installForestWeather(ctx, await ctx.product.json('world/forest-weather.json'));
  },
};
