import { ENGINE_CONTENT_STRINGS } from './game/engineStrings';
import { installEngineStrings } from './engine/strings';
import { installScore } from './engine/audio/score/score';
import { WILDSHARD_SCORE } from './game/audio/theme';
import { startTelemetry } from './engine/telemetry/runtime';
import { installAudioUnlock } from '@wildshard/engine/audio/unlock';
import { Scope } from '@wildshard/engine/app/scope';

/** Install before the view module graph evaluates, on web and native after save hydration. */
export function startPageServices(): void {
  installEngineStrings(ENGINE_CONTENT_STRINGS);
  installScore(WILDSHARD_SCORE); // the game's theme, for the engine's synth score (E405)
  startTelemetry();
  // G325: the page's AudioContext on the first gesture, never during load. A page-lifetime scope of its own: importing the
  // app runtime here would evaluate the engine before the save slots exist (Developer mode then reads off).
  installAudioUnlock(new Scope('page.audio-unlock'));
}
