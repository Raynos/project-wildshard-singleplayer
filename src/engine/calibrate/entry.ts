import { app } from '../app/runtime';
import { frameProbe } from '../core/tier';
import { saveSetting } from '../ui/Settings';
import { sendNote } from '../ui/review';
import { runCalibration, type CalibrationRun } from './run';

declare const __BUILD_ID__: string;
export async function enterCalibration(): Promise<void> {
  saveSetting('calibrate', 'off');
  app.setState('capture'); frameProbe.uncapped = true;
  // No level is loaded, hence no gameplay/render systems can run beside the synthetic scene.
  if (Object.values(app.systemsByPhase()).some((systems) => systems.length > 0)) throw new Error('Calibration capture must have no level systems');
  document.querySelector('#game')?.remove(); document.querySelector('#hud')?.remove(); document.querySelector('.ws-title-shell')?.remove(); document.querySelector('.ws-load')?.remove();
  const status = document.createElement('pre'); status.textContent = 'RUN CALIBRATION'; const parent = document.body; app.engineScope.capture('nodes', () => { status.remove(); }); parent.append(status);
  const handle = { status: 'starting', result: null as CalibrationRun | null, error: null as string | null, inbox: 'pending' };
  window.__calibration = handle;
  try {
    handle.result = await runCalibration((text) => { handle.status = text; status.textContent = text; });
    const sent = await sendNote({ category: 'perf', note: JSON.stringify(handle.result), context: { build: __BUILD_ID__, source: 'calibration', assumption: handle.result.phone.assumption }, screenshot: null });
    handle.inbox = typeof sent === 'string' ? sent : `sent:${sent.id}`;
    handle.status = 'done'; status.textContent = `CALIBRATION COMPLETE · inbox ${handle.inbox}`;
  } catch (error) { handle.error = error instanceof Error ? error.stack ?? error.message : String(error); handle.status = 'error'; status.textContent = handle.error; }
  finally { frameProbe.uncapped = false; }
}
