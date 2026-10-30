import * as v from 'valibot';
import {placesWithDiscovery} from '../../src/engine/quest/discovery';
import {parsePersistedQuestPage} from '../../src/format/questStory';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {prepareHeadlessRuntime as prepareSky} from '../proof/far-reach/worker';

/** The page's discovery kernel observes actual native feet and admitted page
 * places. No authored capture, progression flag or player pose is applied. */
export const prepareHeadlessRuntime:PrepareHeadlessRuntime=async preparation=>{
  const base=await prepareSky(preparation);
  const plan=v.parse(v.object({features:v.array(v.object({kind:v.string(),rows:v.exactOptional(v.unknown())}))}),preparation.product.section('client/plan'));
  const feature=plan.features.find(row=>row.kind==='quest.page');
  if(feature===undefined)throw new Error('Sky verbs require the admitted quest page');
  const page=parsePersistedQuestPage(feature.rows);
  return {...base,install:(host,context)=>{
    base.install(host,context);
    const places=placesWithDiscovery(structuredClone(page.places),host.flags,text=>context.emit({kind:'hint',text}),()=>[]);
    host.onStep('far.verbs.discovery',()=>{
      const p=host.player.position;places.update(p.x,p.z,p.y);
    },undefined,'afterBodies');
  }};
};
