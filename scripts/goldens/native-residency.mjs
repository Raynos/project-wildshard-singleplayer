import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

/** Rebind the release reader to this actual shared preview, never a copied chunk name.
 * @param {string} base @param {{build:string,sha:string}} source */
export async function goldenRefinementBinding(base,source) {
  const url=new URL(base);
  if (!['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Nine settled reader requires a local serve-build preview');
  const registry=join(homedir(),'.dev-servers','.shared');
  const matches=readdirSync(registry).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(readFileSync(join(registry,file),'utf8')))
    .filter(row=>row.status==='ready'&&String(row.port)===url.port&&row.sha.startsWith(source.sha)&&row.coverage==='all'&&row.mode==='production');
  if (matches.length!==1) throw new Error('Nine settled reader needs one exact all-product preview binding');
  const dist=join(matches[0].out,'dist','assets');
  const chunks=readdirSync(dist).filter(file=>file.endsWith('.js')).map(file=>({file,bytes:readFileSync(join(dist,file))}))
    .filter(row=>row.bytes.includes('Invalid or duplicate refinement job'));
  if (chunks.length!==1) throw new Error('Native refinement chunk is missing or ambiguous');
  const {file,bytes}=chunks[0],binding=refinementExports(bytes.toString('utf8'));
  const chunk=`/assets/${file}`,served=Buffer.from(await(await fetch(new URL(chunk,base))).arrayBuffer());
  if (!served.equals(bytes)) throw new Error('Served native refinement differs from exact preview');
  return {...binding,sha:matches[0].sha,build:source.build,chunk,chunkSHA256:createHash('sha256').update(served).digest('hex')};
}

/** Fail closed when the compiler shape changes; no guessed export or copied release binding.
 * @param {string} source */
export function refinementExports(source) {
  const classes=[...source.matchAll(/([\w$]+)=class\{view;waiting=new Map;known=new Set/gu)];
  if (classes.length!==1) throw new Error('Native refinement class identity ambiguous');
  const match=classes[0],initializers=[...source.slice(0,match.index).matchAll(/function ([\w$]+)\(\)\{return\(/gu)];
  const initializer=initializers.at(-1)?.[1];
  if (initializer===undefined) throw new Error('Native refinement initializer unavailable');
  const exports=source.slice(source.lastIndexOf('export'));
  const alias=name=>{
    const escaped=name.replaceAll(/[.*+?^${}()|[\]\\]/gu,String.raw`\$&`);
    const rows=[...exports.matchAll(new RegExp(`(?<![\\w$])${escaped}\\s+as\\s+([\\w$]+)`,'gu'))];
    if (rows.length!==1) throw new Error('Native refinement export unavailable or ambiguous');
    return rows[0][1];
  };
  return {initializerExport:alias(initializer),classExport:alias(match[1])};
}

/** Observe publication without changing the native receiver, arguments or returned promise.
 * Serialized into the pre-navigation observer. */
export function observeRefinement(proto) {
  const original=proto.add,jobs=[];
  if (typeof original!=='function') throw new Error('Native refinement add missing');
  proto.add=function add(...args) {
    const promise=Reflect.apply(original,this,args),row={id:args[0],at:args[1],state:'pending'};
    jobs.push(row);
    void (async()=>{
      try {row.state=await promise?'published':'retired';}
      catch(error) {row.state='failed';row.error=String(error);}
    })();
    return promise;
  };
  return {jobs};
}

/** Same native publication fence as sp-ci-deploy's reader; the golden camera/composer protocol stays intact. */
export async function heldGoldenResidency() {
  const w=window.__wildshard.world,g=w.game,ledger=window.__goldenResidency;
  const snapshot=()=>JSON.stringify({frame:g.frameCount,clock:g.app.clock.snapshot(),camera:g.camera.matrixWorld.elements,player:w.player.position.toArray()});
  if (!g.hold||!ledger||ledger.jobs.length===0) throw new Error('Native residency observer is not bound to a held world');
  const before=snapshot(),start=Date.now();let turns=0;
  for (;;) {
    await new Promise(resolve=>{requestAnimationFrame(resolve);});turns++;
    if (ledger.jobs.some(row=>row.state==='failed'||row.state==='retired')) throw new Error('Native publication failed or retired');
    if (!ledger.jobs.some(row=>row.state==='pending')) {
      await new Promise(resolve=>{setTimeout(resolve,0);});
      if (!ledger.jobs.some(row=>row.state==='pending')) break;
    }
    if (Date.now()-start>=29000) throw new Error('Native publication did not settle');
  }
  if (snapshot()!==before) throw new Error('Native wait changed frame, clock, camera or player');
  return {jobs:ledger.jobs,heldState:JSON.parse(before),turns,elapsedMs:Date.now()-start,pending:0};
}
