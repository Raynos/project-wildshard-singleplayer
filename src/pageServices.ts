import { ENGINE_CONTENT_STRINGS } from '#game/engineStrings';
import { installEngineStrings } from '#engine/strings';
import { startTelemetry } from '#engine/telemetry/runtime';

/** Install before the view module graph evaluates, on web and native after save hydration. */
export function startPageServices(): void {
  installEngineStrings(ENGINE_CONTENT_STRINGS);
  startTelemetry();
}
