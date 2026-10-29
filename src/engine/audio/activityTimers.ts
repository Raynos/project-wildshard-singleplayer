import type {Scope} from '../app/scope';

type Clock=EventTarget&Pick<BaseAudioContext,'state'|'currentTime'>;
/** Pump only a running native clock; suspension keeps its arrangement and source positions intact. */
export function audioInterval(scope:Scope,context:Clock,ms:number,action:()=>void):Scope{
  const owner=scope.child('audio.pump');let timer:number|undefined;
  const update=():void=>{
    if(timer!==undefined){owner.cancelTimer(timer);timer=undefined;}
    if(owner.disposed||owner.disposing||context.state!=='running')return;
    action();if(!owner.disposed&&!owner.disposing)timer=owner.interval(ms,action);
  };
  owner.listen(context,'statechange',update);update();return owner;
}
/** Fade completion follows AudioContext time, which stops while the hardware is suspended. */
export function audioTimeout(scope:Scope,context:Clock,ms:number,action:()=>void):void{
  const owner=scope.child('audio.deadline'),end=context.currentTime+ms/1000;let timer:number|undefined;
  const update=():void=>{
    if(timer!==undefined){owner.cancelTimer(timer);timer=undefined;}
    if(owner.disposed||owner.disposing||context.state!=='running')return;
    const remaining=(end-context.currentTime)*1000;
    if(remaining<=0){owner.dispose();action();return;}
    timer=owner.timeout(remaining,update);
  };
  owner.listen(context,'statechange',update);update();
}
