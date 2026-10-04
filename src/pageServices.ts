import { ENGINE_CONTENT_STRINGS } from './game/engineStrings';
import { installEngineStrings } from './engine/strings';
import { installScore } from './engine/audio/score/score';
import { WILDSHARD_SCORE } from './game/audio/theme';
import { startTelemetry } from './engine/telemetry/runtime';

/** Install before the view module graph evaluates, on web and native after save hydration. */
export function startPageServices(): void {
  installEngineStrings(ENGINE_CONTENT_STRINGS);
  installScore(WILDSHARD_SCORE); // the game's theme, for the engine's synth score (E405)
  startTelemetry();
}
