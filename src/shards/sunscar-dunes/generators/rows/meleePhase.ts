import { WHIP_VIEW } from './whip';
import { WHIP_ITEM, WHIP_TIMING } from './items';
/** Original delayed contact/presentation order; phase data cannot mutate contacts or the script host. */
export const WHIP_PHASE = {version:1,mode:'delayed',charge:WHIP_ITEM.charge,spring:WHIP_VIEW.spring,position:WHIP_VIEW.hold.hero,
 phases:[{id:'light',move:0,seconds:WHIP_ITEM.contacts[0].show,channel:'active'},{id:'heavy',move:1,seconds:WHIP_ITEM.contacts[1].show,channel:'active'}],
 channels:{root:'root',rest:'rest',active:'active',deformation:'cord'},bindings:{moving:'grip',resting:'coil',deformation:'cord'},
 unroll:WHIP_TIMING.unroll,second:WHIP_TIMING.second,show:WHIP_TIMING.show,overlap:WHIP_VIEW.flick.overlap,
 caughtSeconds:WHIP_VIEW.wrap.hold,reach:[WHIP_ITEM.light.range,WHIP_ITEM.heavy.range]} as const;
