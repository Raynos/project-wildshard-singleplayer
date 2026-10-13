import { FAN_VIEW } from './fanView';
/** Original page claim/aim order, phase durations and held placement; contacts remain the admitted item rows. */
export const FAN_PHASE = { version:1, mode:'immediate', charge:FAN_VIEW.charge, spring:FAN_VIEW.spring,
 position:[FAN_VIEW.hold.x,FAN_VIEW.hold.y,FAN_VIEW.hold.z], rotation:[FAN_VIEW.hold.pitch,FAN_VIEW.hold.yaw,FAN_VIEW.hold.roll], scale:FAN_VIEW.hold.scale,
 phases:[{id:'swing',move:0,seconds:FAN_VIEW.motions.swing.seconds,channel:'swing'},{id:'heavy',move:1,seconds:FAN_VIEW.motions.heavy.seconds,channel:'heavy'}],
 secondary:{phase:{id:'gust',move:2,seconds:FAN_VIEW.motions.gust.seconds,channel:'gust'},action:'far.gust'} } as const;
