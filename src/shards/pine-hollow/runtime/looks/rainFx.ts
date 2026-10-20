import type { ShardContext } from '@wildshard/game/plugin/context';
import { forestWeatherObservations } from '@wildshard/game/looks/forestWeather';
import { RainPresentation } from '@wildshard/sdk/looks/rainPresentation';
import { installWeather } from '../../world/weather';

/** The page's rain and weather: the SDK rain presentation on world/rain.json's rows, read by the weather. */
export const RainFx = {
  /** Counted weather-view entry; native observations arrive as rows. */
  async installPage(ctx: ShardContext, input: unknown): ReturnType<typeof installWeather> {
    return installWeather(ctx, forestWeatherObservations(ctx, input), await RainPresentation.install(ctx, await ctx.product.json('world/rain.json')));
  },
};
