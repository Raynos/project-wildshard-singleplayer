// KT2: reference encounter decisions. Engine move/strike rows own every fixed-step motion.
import { START, TIMER, THRESHOLD, DEATH, STOP, BEAT, begin, end, self, events, event,
  phase, setPhase, swingNext, setSwingNext, beatSeconds, timer, stop, encounter, action } from './ws';

export function ws_abi():i32 { return 1; }
export function ws_init(lo:i32,hi:i32):void {}
export function ws_io():i32 { return 16384; }

export function ws_handle():i32 {
  begin();
  for(let index:i32=0;index<events();index++) {
    let kind=i32(event(index,0));
    if(kind==STOP) {
      stop(); timer(0); setPhase(0); setSwingNext(true);
    } else if(kind==START && phase()==0) {
      setPhase(1); setSwingNext(true); encounter(1,0); action(false); timer(beatSeconds());
    } else if(kind==THRESHOLD && event(index,1)==self() && event(index,2)==1 && phase()==1) {
      setPhase(2); encounter(1,1); timer(beatSeconds());
    } else if(kind==DEATH && event(index,1)==self() && (phase()==1 || phase()==2)) {
      stop(); timer(0); setPhase(3); encounter(2,0);
    } else if(kind==TIMER && event(index,1)==BEAT && (phase()==1 || phase()==2)) {
      action(swingNext()); setSwingNext(!swingNext()); timer(beatSeconds());
    }
  }
  return end();
}
