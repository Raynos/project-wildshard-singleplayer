import type { PineClockPorts, PineClockEvent } from './clock';
/** All state published by the admitted script crosses this typed recipe port. */
function clockEvent(key: string): PineClockEvent {
  if (key === 'night.consume' || key === 'night.start' || key === 'dawn.start' || key === 'dawn.sunrise' || key === 'dawn.lanterns' || key === 'dawn.caption' || key === 'dawn.finish') return key;
  throw new Error('Unknown Pine director event');
}
/** Native recipe hooks and observation/publication ports used by the bounded lane. */
export interface PineDirectorRecipe {
  night: () => void; dawn: () => void; tick: (dt: number) => void;
  bind: (send: (key: 'night.request' | 'dawn.request') => void) => void;
  observe: () => Readonly<Record<string, number>>; publish: (key: string, value: number) => void;
}
/** Requests are consumed by the next fixed script tick; only the author lane advances the dawn clock. */
export function pineDirectorRecipe(ports: PineClockPorts, dawnAtBoot = false): PineDirectorRecipe {
  let nightRequest = false, dawnRequest = dawnAtBoot;
  let send: ((key: 'night.request' | 'dawn.request') => void) | undefined;
  return {
    night: (): void => { if (send === undefined) nightRequest = true; else send('night.request'); }, dawn: (): void => { if (send === undefined) dawnRequest = true; else send('dawn.request'); },
    bind: (value): void => { send = value; },
    tick: (_dt: number): void => { /* The game installer owns the fixed script tick. */ },
    observe: (): Readonly<Record<string, number>> => {
      const observation = { 'night-request': Number(nightRequest), 'dawn-request': Number(dawnRequest),
        seen: Number(ports.seen()), 'has-clock': Number(ports.hasClock()), night: ports.night() };
      nightRequest = false; dawnRequest = false; // Admission consumes the boot requests; later requests live in the host queue.
      return observation;
    },
    publish: (key: string, value: number): void => {
      const event = clockEvent(key);
      if (!Number.isFinite(value) || value !== (event === 'night.start' ? 6 : event === 'dawn.sunrise' ? 7 : 0)) throw new Error('Invalid Pine director payload');
      if (event === 'night.consume') nightRequest = false;
      if (event === 'dawn.start') dawnRequest = false;
      ports.publish(event, value);
    },
  };
}

