/** COMMON frozen-rest harness. Both variants use identical existing public controls. */
export function prepareRest(game) {
  if (game.frameCount !== 0 || game.frameTime !== 0 || game.app.clock.frame !== 0 || game.app.clock.real !== 0)
    throw new Error('Rest controls must precede any simulation');
  game.app.clock.setCapture(30);
  game.frameGate = () => {
    // Game.start starts THREE.Clock even when its frame gate is closed. Stop it before
    // the first simulation delta; elapsedTime is THREE.Clock's public writable field.
    // No game simulation clock, actor root, bone or private field is rewritten.
    game.clock.stop();
    game.clock.elapsedTime = 0;
    return false;
  };
}
export function assertRest(game) {
  const snapshot = game.app.clock.snapshot();
  if (game.frameCount !== 0 || game.frameTime !== 0 || game.clock.elapsedTime !== 0 || game.clock.running !== false ||
      snapshot.frames !== 0 || snapshot.wall !== 0 || snapshot.elapsed !== 0 || snapshot.captureFps !== 30)
    throw new Error('Frozen-rest public controls were bypassed');
}
