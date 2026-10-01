import { currentScope } from '../app/legacyCapture';

/** Legacy sound makers keep their graph; the level owns only scheduled source handles. */
export function ownAudioSource<T extends AudioScheduledSourceNode>(source: T): T {
  const scope = currentScope()?.owner;
  if (!scope) return source;
  let ended = false;
  const forget = scope.capture('sounds', () => {
    if (!ended) {
      try { source.stop(); } catch (error) { if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error; }
    }
    source.disconnect();
  });
  source.addEventListener('ended', () => { ended = true; forget(); source.disconnect(); }, { once: true });
  return source;
}
