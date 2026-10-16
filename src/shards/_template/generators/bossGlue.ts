import { scriptV1Layout, SCRIPT_V1_EVENTS, SCRIPT_V1_COMMANDS, SCRIPT_V1_READS } from '@wildshard/format/scriptAbiV1';
import { bossBindingMap, bossDecision } from '../data/bossDecision';

/** Temporary Template-only ABI transport, replaced by KA3's generated ws.ts.
 * All offsets and resolved ids come from the defining ABI and admitted row. No encounter law lives here. */
export function bossGlue(): string {
  const module = `blobs/wasm/${'0'.repeat(64)}.wasm`, row = bossDecision(module), map = bossBindingMap(module);
  const layout = scriptV1Layout(row.state.length, map.paramNames.length), io = 16384;
  const slot = (name: string): number => {
    const index = map.stateNames.indexOf(name); if (index === -1) throw new Error('Unknown reference state');
    return io + (layout.state + index) * 8;
  };
  const param = (name: string): number => {
    const index = map.paramNames.indexOf(name); if (index === -1) throw new Error('Unknown reference parameter');
    return io + (layout.params + index) * 8;
  };
  const id = (kind: 'moves' | 'strikes' | 'timers', name: string): number => {
    const value = map.ids[kind]?.[name]; if (value === undefined) throw new Error('Unknown reference id'); return value;
  };
  return `
@external("env", "ws_read") declare function read(op:i32,a:f64,b:f64):f64;
export const START:i32=${SCRIPT_V1_EVENTS.start}, TIMER:i32=${SCRIPT_V1_EVENTS.timer};
export const THRESHOLD:i32=${SCRIPT_V1_EVENTS.threshold}, DEATH:i32=${SCRIPT_V1_EVENTS.death}, STOP:i32=${SCRIPT_V1_EVENTS.stop};
export const BEAT:i32=${id('timers', 'beat')};
let count:i32=0;
export function begin():void { count=0; }
export function end():i32 { return count; }
export function self():f64 { return load<f64>(${io + 3 * 8}); }
export function events():i32 { return i32(load<f64>(${io + 4 * 8})); }
export function event(index:i32,field:i32):f64 { return load<f64>(${io + layout.inbox * 8}+index*48+field*8); }
export function phase():i32 { return i32(load<f64>(${slot('phase')})); }
export function setPhase(value:i32):void { store<f64>(${slot('phase')},f64(value)); }
export function swingNext():bool { return load<f64>(${slot('swingNext')})==1; }
export function setSwingNext(value:bool):void { store<f64>(${slot('swingNext')},value?1.0:0.0); }
export function beatSeconds():f64 { return load<f64>(phase()==2?${param('secondBeat')}:${param('firstBeat')}); }
function command(op:i32,target:f64,a:f64,b:f64):void {
  assert(count<32); let out=${io + layout.outbox * 8}+count*40;
  store<f64>(out,f64(op)); store<f64>(out+8,target); store<f64>(out+16,a); store<f64>(out+24,b); store<f64>(out+32,0); count++;
}
export function timer(seconds:f64):void { command(${SCRIPT_V1_COMMANDS.timer},0,${id('timers', 'beat')},seconds); }
export function stop():void { command(${SCRIPT_V1_COMMANDS.stop},self(),0,0); }
export function encounter(verb:i32,value:i32):void { command(${SCRIPT_V1_COMMANDS.encounter},0,f64(verb),f64(value)); }
export function action(swing:bool):void {
  let target=read(${SCRIPT_V1_READS.nearestPlayer},self(),0);
  if(target!=0) command(swing?${SCRIPT_V1_COMMANDS.strike}:${SCRIPT_V1_COMMANDS.move},self(),swing?${id('strikes', 'bump')}:${id('moves', 'approach')},target);
}
`;
}
