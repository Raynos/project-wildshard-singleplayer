import { replacePracticeCanvas } from './practiceCanvas';
import { installAppIdentity } from './engine/app/identity';
import { installAssetTables } from './engine/boot/tables';
import { installSaveEnvironment } from './engine/saves/environment';
import { Scope } from './engine/app/scope';
import { WILDSHARD_IDENTITY } from './game/identity';
import { PUBLIC_BYTES } from './game/boot/bytes.generated';
import { ASSET_VERSIONS } from './game/boot/versions.generated';

installAppIdentity(WILDSHARD_IDENTITY);
installSaveEnvironment({ storage: () => null, persistent: () => false, persist: () => Promise.resolve(false) });
installAssetTables({ bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: {}, sfx: {}, packs: {} });
const owner = new Scope('isolated-rooted-pitcher-page');
const status = document.getElementById('practice-status');
const start = document.getElementById('practice-start');
const retry = document.getElementById('practice-retry');
const back = document.getElementById('practice-back');
let canvas = document.getElementById('game');
if (!(start instanceof HTMLButtonElement) || !(retry instanceof HTMLButtonElement) ||
    !(back instanceof HTMLButtonElement) || !(canvas instanceof HTMLCanvasElement) || status === null)
  throw new Error('rooted Pitcher page is incomplete');
const report = (message: string): void => { status.textContent = message; };
/** A new real Game is created after Back. No native actor, clock or health is injected. */
async function begin(): Promise<void> {
  if (!(start instanceof HTMLButtonElement) || !(retry instanceof HTMLButtonElement) ||
      !(back instanceof HTMLButtonElement) || !(canvas instanceof HTMLCanvasElement) || start.disabled) return;
  start.disabled = true; report('Loading the isolated unadmitted diagnostic…');
  const bout = owner.child('rooted-pitcher-bout');
  try {
    const { bootPractice } = await import('./rootedPitcherProofBoot');
    const demo = await bootPractice(canvas, report);
    if (bout.disposed) { demo.dispose(); return; }
    bout.onDispose(demo.dispose);
    start.hidden = true; retry.hidden = false; back.hidden = false;
    bout.listen(retry, 'click', demo.retry);
    bout.listen(back, 'click', () => {
      bout.dispose();
      if (canvas instanceof HTMLCanvasElement) canvas = replacePracticeCanvas(canvas);
      start.hidden = false; start.disabled = false; retry.hidden = true; back.hidden = true;
      report('Diagnostic closed. Start creates a fresh isolated bout. NOT YET ADMITTED.');
    });
  } catch (error: unknown) {
    bout.dispose();
    if (canvas instanceof HTMLCanvasElement) canvas = replacePracticeCanvas(canvas);
    report(error instanceof Error ? error.message : 'Rooted Pitcher diagnostic failed to load.');
    start.disabled = false;
  }
}
owner.listen(start, 'click', () => { void begin(); });
owner.listen(window, 'pagehide', event => { if (!event.persisted) owner.dispose(); });
