import { app } from '@wildshard/engine/app/runtime';
import type { NativeGroupHost } from './groupPorts';

/** The page's group host: the app's shared 'ai' decision stream and its aggression director (the declared policies' only app reads). */
export const APP_GROUP_HOST: NativeGroupHost = {
  sharedRng: () => app.rng.stream('ai'),
  register: (actor, director) => { app.aggression.register(actor, director); },
};
