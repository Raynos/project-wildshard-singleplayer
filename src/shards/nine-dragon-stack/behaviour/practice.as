import { Signal, Field, Channel, Read, Do } from './generated/ninePractice';
@inline function f(id:i32):f64 { return Read.field(0,id); }
/** Course rules run on requests sampled no faster than 10 Hz. */
export function onSignal(signal:i32,value:f64,source:i32):void {
  let phase=f(Field.phase),started=f(Field.started),elapsed=f(Field.elapsed),best=f(Field.best),checkpoint=f(Field.checkpoint);
  let finish:f64=0,visit:f64=-1;
  if(signal==Signal.reset) { phase=0;elapsed=0;checkpoint=f(Field.startPad); }
  else if(signal==Signal.step) {
    const pad=f(Field.pad);
    if(pad>=0) { checkpoint=pad;if(f(Field.eligible)!=0)visit=pad; }
    if(phase==0&&f(Field.z)<f(Field.startZ)-f(Field.startDepth)/2&&f(Field.x)>f(Field.startX)-f(Field.startWidth)/2-1) {
      phase=1;started=f(Field.now);
    }
    if(phase==1) {
      elapsed=f(Field.now)-started;
      if(pad==f(Field.finishPad)) { phase=2;best=best<0?elapsed:Math.min(best,elapsed);finish=1; }
    }
  } else return;
  Do.channel(Channel.phase,phase);Do.channel(Channel.started,started);Do.channel(Channel.elapsed,elapsed);
  Do.channel(Channel.best,best);Do.channel(Channel.checkpoint,checkpoint);Do.channel(Channel.visit,visit);Do.channel(Channel.finish,finish);
  Do.channel(Channel.fell,signal==Signal.step&&f(Field.y)<f(Field.lowest)-f(Field.fallY)?1:0);
}
