import {RopeChain} from '../../../src/engine/physics/ropeChain';
import type {SimHost} from '../../../src/engine/sim';
import type {ShardProduct} from '../../../src/game/shardfile/shardProduct';
import type {WorldAssemblyStage} from '../../../src/format/worldAssembly';

/** Static native proof rows omit dynamic rope planks. Physics walks install
 * the actual engine chain from the same admitted deck/chain stages as play.
 * The chain consumes admitted rest poses, as RopeDeck.chainSpec does; its
 * physics API has no terrain query. The model's separate analytic-ground
 * admission remains in RopeDeckSite. No drawn or guessed deck enters Node. */
export function installWalkRopeBodies(host:SimHost,product:ShardProduct|undefined):()=>void {
  const chains:RopeChain[]=[];
  if(product?.has('client/plan')!==true)return ()=>{};
  const decks=new Map<string,Extract<WorldAssemblyStage,{kind:'rope-deck'}>>();
  try {
    for(const feature of product.section('client/plan').features){
      if(feature.kind!=='world.assembly')continue;
      for(const stage of feature.rows.stages){
        if(stage.kind==='rope-deck'){
          if(decks.has(stage.id))throw new Error('Duplicate native rope deck');decks.set(stage.id,stage);
        }else if(stage.kind==='rope-chain'){
          const deck=decks.get(stage.deck);if(deck===undefined)throw new Error('Native rope chain needs its declared deck');
          const {span,site}=deck,rows=site.deck,key=JSON.stringify([span.a,span.b,span.width??rows.width,span.sag??rows.sag]);
          const facts=site.spans.find(row=>row.key===key);if(facts===undefined)throw new Error('Unbaked native rope span');
          if(facts.segments.length>rows.maxSegments)throw new Error('Native rope deck exceeds its segment bound');
          const chain=new RopeChain(host.physics,{segments:structuredClone(facts.segments),hx:facts.width/2+rows.margin,hy:rows.halfY,mass:rows.mass,
            owners:facts.segments.map(()=>({...rows.owner}))});chains.push(chain);
          host.onStep(stage.capture,()=>{chain.capture();},undefined,'afterBodies');
        }
      }
    }
  }catch(error){for(const chain of chains)chain.dispose();throw error;}
  return ()=>{for(const chain of chains)chain.dispose();};
}
