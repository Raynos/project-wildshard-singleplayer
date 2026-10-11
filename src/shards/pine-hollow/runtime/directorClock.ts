import { DirectorScriptStageLane, prepareDirectorModule, type DirectorLane } from '@wildshard/game/plugin/director';
import { parseDirector } from '@wildshard/format/director';
import declaration from '../data/director.json' with { type: 'json' };
import rows from '../data/watchStages.json' with { type: 'json' };
import module from '../behaviour/director.json' with { type: 'json' };
import type { LevelContext } from '@wildshard/engine/level/context';

/** The native quest's observation and publication ports. The sky, lights, flags and captions keep their owners. */
export interface PineClockPorts {
  readonly seen: () => boolean; readonly hasClock: () => boolean; readonly night: () => number;
  readonly publish: (event: PineClockEvent, value: number) => void;
}
/** Authored outputs admitted by the immutable Pine watch handler. */
export type PineClockEvent = 'night.consume' | 'night.start' | 'dawn.start' | 'dawn.sunrise' | 'dawn.lanterns' | 'dawn.caption' | 'dawn.finish';

/** Admit the exact shipping module once; every installation receives an independent native continuation. */
export async function preparePineDirector(): Promise<() => DirectorLane> {
  if (module.module !== declaration.module) throw new Error('Pine director bake is stale');
  const create = await prepareDirectorModule(parseDirector(declaration), Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0));
  return () => create(357);
}
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

/** The rendered quest clock and trusted headless clock use the same rows; no Debug variant chooses pacing authority. */
export async function installPineClock(context: Pick<LevelContext, 'scope'>, ports: PineClockPorts, dawnAtBoot: boolean): Promise<ReturnType<typeof pineDirectorClock>> {
  const scope = context.scope, create = await preparePineDirector();
  if (scope.disposed) throw new Error('Pine scope left during director admission');
  const clock = pineDirectorClock(create(), ports, () => !scope.disposed);
  if (dawnAtBoot) clock.dawn();
  return clock;
}
