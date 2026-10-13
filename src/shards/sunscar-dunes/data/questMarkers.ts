import caravan from './caravan.json' with { type: 'json' };
import well from './well.json' with { type: 'json' };
import tower from './tower.json' with { type: 'json' };
import braziers from './braziers.json' with { type: 'json' };
import ground from './manifestGround.generated.json' with { type: 'json' };
import { SCOUT_AT } from './flags';
import { BRAZIERS, TOWER, WELL } from './layout';

const [logX, logY, logZ] = caravan.anchors.logbook;
if (caravan.anchors.logbook.length !== 3 || logX === undefined || logY === undefined || logZ === undefined
  || !Number.isFinite(logX) || !Number.isFinite(logY) || !Number.isFinite(logZ)) throw new Error('Invalid authored logbook anchor');

/** Quest points on immutable authored anchors, retaining every numeric addition in the original order. */
export const QUEST_MARKERS: Readonly<Record<string, {poi:'world';x:number;y:number;z:number}>> = {
  scout: {poi:'world',x:SCOUT_AT.x,y:ground.heights.scout,z:SCOUT_AT.z},
  logbook: {poi:'world',x:logX,y:logY+0.4,z:logZ},
  well: {poi:'world',x:WELL.x,y:(well.anchors.y+1)+0.6,z:WELL.z},
  tower: {poi:'world',x:TOWER.x-0.4,y:(tower.anchors.deckY+1.1)+1,z:TOWER.z-0.5},
  ...Object.fromEntries(BRAZIERS.map((row,i)=>{const anchor=braziers.braziers[i];if(anchor===undefined)throw new Error('Missing authored waymark');return [`waymark.${String(i)}`,{poi:'world' as const,x:row.x,y:(anchor.y+1.6)+0.8,z:row.z}];})),
};
