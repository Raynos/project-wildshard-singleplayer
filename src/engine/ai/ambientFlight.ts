/** Circling/heading law for ambient flyers. The caller owns the clock, body and wing posing. */
export interface AmbientFlightPose {x:number;y:number;z:number;yaw:number;pitch:number;roll:number}
export interface AmbientOrbit {ox:number;oz:number;orad:number;oalt:number;ow:number;oph:number}
export interface AmbientFlightTuning {wave:number;amplitude:number;pitch:number;pitchRate:number;bank:number;bankLimit:number;bankRate:number;directionEpsilon?:number}
/** Harmonic wheel offsets around a caller's actual flock centre. */
export interface AmbientWheelTuning {xAmplitude:number;xFrequency:number;zScale:number;zAmplitude:number;zFrequency:number;altitudeFrequency:number;altitudeAmplitude:number;detailFrequency:number;detailAmplitude:number}
export interface AmbientWheelOrbit {cx:number;cz:number;r:number;alt:number;w:number;p1:number;p2:number;p3:number;p4:number}
export interface AmbientWheelBody {phase:number;scale:number;altOff:number}
export class CirclingFlyer {
  private readonly tuning:AmbientFlightTuning;
  private readonly wheelTuning:AmbientWheelTuning|undefined;
  constructor(tuning:AmbientFlightTuning,wheel?:AmbientWheelTuning) {
    this.tuning=tuning;this.wheelTuning=wheel;
    if([tuning.wave,tuning.amplitude,tuning.pitch,tuning.pitchRate,tuning.bank,tuning.bankLimit,tuning.bankRate,tuning.directionEpsilon??1e-5].some(value=>!Number.isFinite(value))||tuning.pitchRate<=0||tuning.bankRate<=0||tuning.bankLimit<=0||(tuning.directionEpsilon!==undefined&&tuning.directionEpsilon<=0))throw new Error('Invalid ambient flight tuning');
    if(wheel!==undefined&&[wheel.xAmplitude,wheel.xFrequency,wheel.zScale,wheel.zAmplitude,wheel.zFrequency,wheel.altitudeFrequency,wheel.altitudeAmplitude,wheel.detailFrequency,wheel.detailAmplitude].some(value=>!Number.isFinite(value)||Math.abs(value)>100000))throw new Error('Invalid ambient wheel tuning');
  }
  face(p:AmbientFlightPose,dx:number,dy:number,dz:number,dt:number,bank=this.tuning.bank):void {
    const dh=Math.hypot(dx,dz);if(dh<(this.tuning.directionEpsilon??1e-5))return;
    const turn=Math.atan2(dx,dz)-p.yaw,dyaw=Math.atan2(Math.sin(turn),Math.cos(turn));p.yaw+=dyaw;
    p.pitch+=(Math.atan2(dy,dh)*this.tuning.pitch-p.pitch)*Math.min(1,dt*this.tuning.pitchRate);
    const turnBank=Math.max(-this.tuning.bankLimit,Math.min(this.tuning.bankLimit,dyaw/Math.max(dt,1e-3)*bank));
    p.roll+=(turnBank-p.roll)*Math.min(1,dt*this.tuning.bankRate);
  }
  step(p:AmbientFlightPose,o:AmbientOrbit,dt:number):void {
    o.oph+=o.ow*dt;const x=o.ox+Math.cos(o.oph)*o.orad,z=o.oz+Math.sin(o.oph)*o.orad,y=o.oalt+Math.sin(o.oph*this.tuning.wave)*this.tuning.amplitude;
    this.face(p,x-p.x,y-p.y,z-p.z,dt);p.x=x;p.y=y;p.z=z;
  }
  /** Sample a moving wheel into a borrowed target, also used by takeoff/landing approaches. */
  wheel(o:AmbientWheelOrbit,b:AmbientWheelBody,time:number,out:{x:number;y:number;z:number}):void {
    const tuning=this.wheelTuning;if(tuning===undefined)throw new Error('Missing declared ambient wheel');
    const phase=o.w*time+b.phase,radius=o.r*b.scale;
    out.x=o.cx+radius*(Math.sin(phase+o.p1)+tuning.xAmplitude*Math.sin(tuning.xFrequency*phase+o.p2));
    out.z=o.cz+radius*tuning.zScale*(Math.cos(phase+o.p1)+tuning.zAmplitude*Math.cos(tuning.zFrequency*phase+o.p3));
    out.y=o.alt+b.altOff+tuning.altitudeAmplitude*Math.sin(tuning.altitudeFrequency*phase+o.p4)+tuning.detailAmplitude*Math.sin(tuning.detailFrequency*phase+b.phase);
  }
}
