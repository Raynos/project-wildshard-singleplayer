import { installObservation } from '/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/observe.mjs';
Reflect.set(window, '__installConchTentObservation', installObservation);
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

const owner = new Scope('practice-page');
const status = document.getElementById('practice-status');
const start = document.getElementById('practice-start');
const select = document.getElementById('practice-opponent');
const retry = document.getElementById('practice-retry');
let canvas = document.getElementById('game');
if (!(start instanceof HTMLButtonElement) || !(select instanceof HTMLSelectElement) ||
    !(retry instanceof HTMLButtonElement) || !(canvas instanceof HTMLCanvasElement) || status === null)
  throw new Error('Practice page is incomplete');
const report = (message: string): void => { status.textContent = message; };
async function begin(): Promise<void> {
  if (!(start instanceof HTMLButtonElement) || !(select instanceof HTMLSelectElement) ||
      !(retry instanceof HTMLButtonElement) || !(canvas instanceof HTMLCanvasElement)) return;
  start.disabled = true; report('Loading the isolated arena…');
  try {
    const { bootPractice } = await import('/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/tent-practiceBoot.ts');
    const demo = await bootPractice(canvas, report);
    start.hidden = true;
    const note = document.getElementById('practice-fixture-note'); if (note !== null) note.hidden = true;
    for (const choice of demo.choices) { const option = document.createElement('option'); option.value = choice.id; option.textContent = choice.label; select.append(option); }
    select.hidden = false; retry.hidden = false;
    const change = async (): Promise<void> => {
      select.disabled = true; retry.disabled = true;
      try { if (!await demo.select(select.value)) report('Opponent could not load. Select again to retry.'); }
      catch (error: unknown) { report(error instanceof Error ? error.message : 'Opponent failed to load.'); }
      finally { select.disabled = false; retry.disabled = false; }
    };
    owner.listen(select, 'change', () => { void change(); });
    owner.listen(retry, 'click', demo.retry);
    owner.listen(window, 'pagehide', event => { if (!event.persisted) { demo.dispose(); owner.dispose(); } });
  } catch (error: unknown) {
    if (canvas instanceof HTMLCanvasElement) canvas = replacePracticeCanvas(canvas);
    report(error instanceof Error ? error.message : 'Arena failed to load.'); start.disabled = false;
  }
}
owner.listen(start, 'click', () => { void begin(); });
