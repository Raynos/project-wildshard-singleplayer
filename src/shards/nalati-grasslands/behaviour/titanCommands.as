// Same-call effects and finite clock/gate projections at the original native barriers.
import {onSignal as project} from './titanClockFrame';
import {Signal,Field,Channel,Read,Do} from './generated/nalatiTitanCombined';
export function onSignal(signal:i32,value:f64,source:i32):void{
  if(signal==Signal.zzzzIgnite)Do.ignite(1,Read.field(0,Field.x),Read.field(0,Field.z));
  else if(signal==Signal.zzzzDismount)Do.dismount(1,true);
  else if(signal==Signal.zzzzIntroClock){
    const t=Read.field(0,Field.t),old=Read.field(0,Field.zzzzIntroT),tick=old<0||t-old>=.1-1e-9;
    Do.channel(Channel.zzzzIntroT,tick?t:old);Do.channel(Channel.zzzzIntroTick,tick?1:0);
  }else if(signal==Signal.zzzzWhirlArm||signal==Signal.zzzzWhirlGate){
    const count=i32(Read.field(0,Field.count)),arm=signal==Signal.zzzzWhirlArm,index=arm?-1:i32(Read.field(0,Field.index));
    if(0<count){
      let k=Read.field(0,Field.zzzzWhirl0K),on=Read.field(0,Field.zzzzWhirl0On),shown=Read.field(0,Field.zzzzWhirl0Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<0))!=0?1:0;
      else if(index==0){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl0K,k);Do.channel(Channel.zzzzWhirl0On,on);Do.channel(Channel.zzzzWhirl0Shown,shown);
    }
    if(1<count){
      let k=Read.field(0,Field.zzzzWhirl1K),on=Read.field(0,Field.zzzzWhirl1On),shown=Read.field(0,Field.zzzzWhirl1Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<1))!=0?1:0;
      else if(index==1){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl1K,k);Do.channel(Channel.zzzzWhirl1On,on);Do.channel(Channel.zzzzWhirl1Shown,shown);
    }
    if(2<count){
      let k=Read.field(0,Field.zzzzWhirl2K),on=Read.field(0,Field.zzzzWhirl2On),shown=Read.field(0,Field.zzzzWhirl2Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<2))!=0?1:0;
      else if(index==2){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl2K,k);Do.channel(Channel.zzzzWhirl2On,on);Do.channel(Channel.zzzzWhirl2Shown,shown);
    }
    if(3<count){
      let k=Read.field(0,Field.zzzzWhirl3K),on=Read.field(0,Field.zzzzWhirl3On),shown=Read.field(0,Field.zzzzWhirl3Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<3))!=0?1:0;
      else if(index==3){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl3K,k);Do.channel(Channel.zzzzWhirl3On,on);Do.channel(Channel.zzzzWhirl3Shown,shown);
    }
    if(4<count){
      let k=Read.field(0,Field.zzzzWhirl4K),on=Read.field(0,Field.zzzzWhirl4On),shown=Read.field(0,Field.zzzzWhirl4Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<4))!=0?1:0;
      else if(index==4){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl4K,k);Do.channel(Channel.zzzzWhirl4On,on);Do.channel(Channel.zzzzWhirl4Shown,shown);
    }
    if(5<count){
      let k=Read.field(0,Field.zzzzWhirl5K),on=Read.field(0,Field.zzzzWhirl5On),shown=Read.field(0,Field.zzzzWhirl5Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<5))!=0?1:0;
      else if(index==5){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl5K,k);Do.channel(Channel.zzzzWhirl5On,on);Do.channel(Channel.zzzzWhirl5Shown,shown);
    }
    if(6<count){
      let k=Read.field(0,Field.zzzzWhirl6K),on=Read.field(0,Field.zzzzWhirl6On),shown=Read.field(0,Field.zzzzWhirl6Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<6))!=0?1:0;
      else if(index==6){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl6K,k);Do.channel(Channel.zzzzWhirl6On,on);Do.channel(Channel.zzzzWhirl6Shown,shown);
    }
    if(7<count){
      let k=Read.field(0,Field.zzzzWhirl7K),on=Read.field(0,Field.zzzzWhirl7On),shown=Read.field(0,Field.zzzzWhirl7Shown);
      if(arm)on=(i32(Read.field(0,Field.zzMask))&(1<<7))!=0?1:0;
      else if(index==7){
        k+=((Read.field(0,Field.open)>0&&on>0?1:0)-k)*Math.min(1,Read.field(0,Field.dt)*Read.field(0,Field.amount));
        shown=k>.02?1:0;
      }
      Do.channel(Channel.zzzzWhirl7K,k);Do.channel(Channel.zzzzWhirl7On,on);Do.channel(Channel.zzzzWhirl7Shown,shown);
    }
  }else project(signal,value,source);
}
