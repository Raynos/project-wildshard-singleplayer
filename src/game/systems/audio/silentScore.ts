import type { Scope } from '@wildshard/engine/app/scope';

/** Silence this score's output, preserving the user's volume setting and the other sound buses. */
export function installSilentScore(music: { readonly out: { readonly gain: { value: number } } }, scope: Scope): void {
  const gain = music.out.gain, old = gain.value;
  gain.value = 0;
  scope.onDispose(() => { gain.value = old; });
}
