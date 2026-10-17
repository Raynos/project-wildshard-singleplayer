import { DirectorScriptStageLane, type DirectorLane } from '../../../src/game/plugin/director';
import rows from '../../../src/shards/pine-hollow/data/watchStages.json';
import type { PineClockPorts, PineClockEvent } from './clock';

// Frozen pre-deletion wrapper: compare complete stage and AS continuation bytes.
function eventKey(key: string): PineClockEvent {
  if (key === 'night.consume' || key === 'night.start' || key === 'dawn.start' || key === 'dawn.sunrise' || key === 'dawn.lanterns' || key === 'dawn.caption' || key === 'dawn.finish') return key;
  throw new Error('Unknown Pine director event');
}

/** Only native ports and request delivery: the authored rows and their AS handler own every pacing decision. */
export function pineDirectorClock(lane: DirectorLane, ports: PineClockPorts, live: () => boolean = () => true): {
  night: () => void; dawn: () => void; tick: (dt: number) => void; save: () => string; load: (saved: string) => void;
} {
  const observe = (): Readonly<Record<string, number>> => ({ 'night-request': 0, 'dawn-request': 0,
    seen: Number(ports.seen()), 'has-clock': Number(ports.hasClock()), night: ports.night() });
  const stages = new DirectorScriptStageLane(rows, lane, { observe, publish: action => {
    if (!('emit' in action)) throw new Error('Invalid Pine stage action');
    const key = eventKey(action.emit), value = key === 'night.start' ? 6 : key === 'dawn.sunrise' ? 7 : 0;
    if (action.value !== value) throw new Error('Invalid Pine director payload');
    if (live()) ports.publish(key, value);
  } }, false, 1 / 60);
  const request = (key: 'night.request' | 'dawn.request'): void => {
    if (!live()) return;
    lane.enqueue(key); stages.changed();
  };
  return { night: () => { request('night.request'); }, dawn: () => { request('dawn.request'); },
    tick: dt => { if (live()) stages.update(dt); }, save: () => stages.snapshot(), load: saved => { stages.restore(saved); } };
}
