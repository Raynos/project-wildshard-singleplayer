// The app identity, installed before any other module runs (E405 E414): index.html loads it as its first module
// script and src/native.ts imports it first, because the service-worker entry and the saves build keys from it.
// Two tiny modules only, so it costs the first paint nothing.
import { installAppIdentity } from '#engine/app/identity';
import { WILDSHARD_IDENTITY } from '#game/identity';

installAppIdentity(WILDSHARD_IDENTITY);
