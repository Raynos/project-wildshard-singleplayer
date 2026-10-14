/** Native encounter assembly around the existing admitted fight scripts. */
interface EliteHostRow {
  lanes: readonly ('ironhide'|'blackpaw'|'imperial'|'rival')[];
  actions:readonly string[];
  ring: boolean; home: 'wander'|'cave'; force: 'lane'|'fade'; special: string|null;
  cancelSlot: string|null; hitSlot: string|null; leashParameter: number|null;
  hidden: boolean; rivals: boolean;
  slots: readonly {field:string;kind:'number'|'boolean';never:number|null}[];
}
export const PINE_ELITE_HOSTS:Readonly<Record<string,EliteHostRow>>={
  ironhide:{actions:[],lanes:['ironhide'],ring:false,home:'wander',force:'lane',special:null,cancelSlot:null,hitSlot:null,leashParameter:null,hidden:false,rivals:false,
    slots:[{field:'again',kind:'boolean',never:null}]},
  'ghost-stag':{actions:['fade','comeBack'],lanes:[],ring:false,home:'wander',force:'fade',special:null,cancelSlot:null,hitSlot:'lastHit',leashParameter:2,hidden:true,rivals:false,
    slots:[{field:'cd',kind:'number',never:null},{field:'lastHit',kind:'number',never:-1e6},{field:'fadeT',kind:'number',never:null},{field:'autoT',kind:'number',never:null}]},
  blackpaw:{actions:['burstOut','roarFx'],lanes:['blackpaw'],ring:true,home:'cave',force:'lane',special:'roar',cancelSlot:'swipeT',hitSlot:null,leashParameter:null,hidden:true,rivals:false,
    slots:[{field:'roarCd',kind:'number',never:null},{field:'swipeT',kind:'number',never:null}]},
  'imperial-bull':{actions:['callRivals'],lanes:['imperial','rival','rival'],ring:false,home:'wander',force:'lane',special:'bugle',cancelSlot:null,hitSlot:null,leashParameter:null,hidden:false,rivals:true,
    slots:[{field:'bugledPhase',kind:'number',never:null}]},
};
