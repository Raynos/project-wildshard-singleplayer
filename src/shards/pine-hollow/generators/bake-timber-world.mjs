// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's timber world, baked in the program (GR8 G37,
// was the pine-timber-world job's bake-pine-lookout.mjs --world): the fire lookout, the site timbers, the crag assembly,
// the landmark facts, the prop and cabin material payloads and the world Scene's tiles and Explorer library, all read
// from the program's sources (pineSources.ts). `bakeTimberWorldFiles` gives the rows (`data/timberWorld.generated.json`'s
// former content), the world's hash-named assets and the material payloads by product name; readPineSources serves them
// as sources under the same keys.
import { bakeBeaverPool, pinePoolShapes } from './beaverPool.ts';
import { pinePropShapes } from './propShapes.ts';
import { pineCabinPropShapes } from './cabinPropShapes.ts';
import { pineCabinMaterialFiles, pineCabinPropParts } from './cabinPropMaterials.mjs';
import { pinePropScan } from './bake-pine-props.mjs';
import { compactMaterialGlb } from './materialGlb.mjs';
import { gpuTables } from './heroMaterialFiles.mjs';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { TIMBER_SOURCE, cragSource, sourceJson } from './pineSources.ts';
import { pineLandmarkSites } from './landmarkSites.ts';
import { pineLandmarkFacts } from './bake-pine-landmark-facts.mjs';
import { bakeQueryTerrain } from '@wildshard/sdk/bake/terrain';
import { bakeFireLookout } from './fireLookout.ts';
import { parseGlb } from '@wildshard/sdk/assets';
import { pineTimberWorldBake, pineTimberPlacements } from './timberWorld.ts';
import { bakeSiteTimberRows, pineTimberGround } from './bake-pine-site-timbers.mjs';
import { pineCragAssembly } from './cragAssembly.ts';
import { bakeCragRows, pineCragGround, pineCragKit } from './bake-pine-crags.mjs';

/** the lookout bake: the rows and the raw binary, the Pine level selected (its seed is the engine SEED, as on the page) */
export function bakeLookoutRows() {
  const { bin, rows } = bakeFireLookout();
  return { rows: { bin: hashImmutableBytes(bin), bytes: bin.length, ...rows }, bin };
}

/** A compacted payload's product file name (the material aliases name it; the client loads it through the product). */
const productName = (folder, url) => `models/${folder}/${url.slice('/assets/'.length).replace(/\.gltf$/u, '.glb')}`;

/** The cabin material recipes renamed as product files (their aliases name them). */
function cabinProductFiles(files) {
  const aliases = {}, outputs = {};
  for (const [url, target] of Object.entries(files.aliases)) {
    const name = productName('cabin-materials', url), bytes = files.outputs[`public${target}`];
    if (bytes === undefined) throw new Error(`Missing cabin material payload ${url}`);
    aliases[url] = name; outputs[name] = bytes;
  }
  return { aliases, outputs, costs: files.costs };
}

/** Retain every original material/image byte and drop the redundant source mesh payload. */
function pinePropMaterialFiles(sources) {
  const { gpu, astc } = gpuTables(sources);
  const aliases = {}, outputs = {}, costs = [];
  for (const id of ['rock_moss_set_01', 'tree_stump_01', 'dead_tree_trunk']) {
    const original = `/assets/models/${id}/${id}_lod.glb`, phone = original.replace('.glb', '.phone.glb'), folder = `/assets/gpu/models/${id}/`;
    const urls = [...new Set([original, phone, gpu.desktop[original], gpu.phone[phone], astc[phone], ...sources.list(folder).filter(url => !url.slice(folder.length).includes('/') && url.endsWith('.glb')).sort()].filter(Boolean))];
    for (const url of urls) {
      const bytes = sources.bytes(url), packed = new Uint8Array(compactMaterialGlb(Buffer.from(bytes))), target = productName('prop-materials', url);
      aliases[url] = target; outputs[target] = packed; costs.push({ original: url, before: bytes.length, after: packed.length });
    }
  }
  return { aliases, outputs, costs };
}

/** Identical byte views share storage; every accessor, type and native shape stays independent. */
function compactLibraryGlb(original, compactMaterials = false) {
  const bytes=Buffer.from(original), length=bytes.readUInt32LE(12), doc=JSON.parse(bytes.subarray(20,20+length).toString()), input=bytes.subarray(28+length), pieces=[], seen=new Map();
  if (compactMaterials) {
    const materials = [], seenMaterials = new Map(), indices = doc.materials.map(material => {
      const key = JSON.stringify(material), present = seenMaterials.get(key);
      if (present !== undefined) return present;
      const index = materials.length; materials.push(material); seenMaterials.set(key, index); return index;
    });
    for (const mesh of doc.meshes) for (const primitive of mesh.primitives) if (primitive.material !== undefined) primitive.material = indices[primitive.material];
    doc.materials = materials;
  }
  let offset=0;
  for(const view of doc.bufferViews){const block=input.subarray(view.byteOffset ?? 0,(view.byteOffset ?? 0)+view.byteLength), key=JSON.stringify([hashImmutableBytes(block),view.byteStride ?? 0,view.target ?? null]);
    const existing=seen.get(key);
    if(existing!==undefined)view.byteOffset=existing;
    else{view.byteOffset=offset;seen.set(key,offset);pieces.push(block,Buffer.alloc((-block.length)&3));offset+=block.length+((-block.length)&3);}
  }
  if (compactMaterials) {
    const uniqueViews = [], seenViews = new Map(), views = doc.bufferViews.map(view => {
      const key = JSON.stringify(view), prior = seenViews.get(key); if (prior !== undefined) return prior;
      const index = uniqueViews.length; uniqueViews.push(view); seenViews.set(key, index); return index;
    });
    for (const accessor of doc.accessors) {
      if (accessor.sparse !== undefined) throw new Error('Pine shape compaction requires its original dense accessors');
      if (accessor.bufferView !== undefined) accessor.bufferView = views[accessor.bufferView];
    }
    const uniqueAccessors = [], seenAccessors = new Map(), accessors = doc.accessors.map(accessor => {
      const key = JSON.stringify(accessor), prior = seenAccessors.get(key); if (prior !== undefined) return prior;
      const index = uniqueAccessors.length; uniqueAccessors.push(accessor); seenAccessors.set(key, index); return index;
    });
    const remap = attributes => { for (const name of Object.keys(attributes)) attributes[name] = accessors[attributes[name]]; };
    for (const mesh of doc.meshes) for (const primitive of mesh.primitives) { remap(primitive.attributes); if (primitive.indices !== undefined) primitive.indices = accessors[primitive.indices]; }
    for (const node of doc.nodes) if (node.extensions?.EXT_mesh_gpu_instancing !== undefined) remap(node.extensions.EXT_mesh_gpu_instancing.attributes);
    doc.bufferViews = uniqueViews; doc.accessors = uniqueAccessors;
  }
  doc.buffers[0].byteLength=offset;
  const json=Buffer.from(JSON.stringify(doc)), text=Buffer.concat([json,Buffer.alloc((-json.length)&3,0x20)]), bin=Buffer.concat(pieces), header=Buffer.from(bytes.subarray(0,20)), binaryHeader=Buffer.alloc(8);
  header.writeUInt32LE(28+text.length+bin.length,8);header.writeUInt32LE(text.length,12);binaryHeader.writeUInt32LE(bin.length);binaryHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,text,binaryHeader,bin]);
}

async function bakeTimberWorld(sources) {
  const crags = await bakeCragRows(sources), ground = pineTimberGround(sources);
  const landmarkSites=pineLandmarkSites(ground.heightAt), placements=pineTimberPlacements(ground.heightAt), lookout=bakeLookoutRows().rows, sites=bakeSiteTimberRows(sources).rows;
  const landmarkFacts=await pineLandmarkFacts(sources,landmarkSites,placements,lookout,sites.landing.world,sites.bridge.world);
  const [kit,cave]=await Promise.all([pineCragKit(sources),pineCragKit(sources,['cave.glb'])]);
  const caveMeta=sourceJson(sources,cragSource('cave.json'));
  const cragAssembly=pineCragAssembly(kit,cave,caveMeta,{phone:{bin:crags.bins.phone,tiles:crags.rows.skin.phone.tiles},desktop:{bin:crags.bins.desktop,tiles:crags.rows.skin.desktop.tiles}},crags.rows.places,ground);
  const scanMaterials = pinePropMaterialFiles(sources), cabinMaterials = cabinProductFiles(pineCabinMaterialFiles(sources));
  const materialFiles = { aliases: { ...scanMaterials.aliases, ...cabinMaterials.aliases }, outputs: { ...scanMaterials.outputs, ...cabinMaterials.outputs }, costs: [...scanMaterials.costs, ...cabinMaterials.costs] };
  const shapes = pinePropShapes({ rocks: await pinePropScan(sources, 'rock_moss_set_01'), stumps: await pinePropScan(sources, 'tree_stump_01'), logs: await pinePropScan(sources, 'dead_tree_trunk') });
  const cabinProps = pineCabinPropShapes(shapes.piece, await pineCabinPropParts(sources));
  const pool = bakeBeaverPool(pineCragGround(sources).heightAt); pinePoolShapes(shapes.piece, pool);
  const baked = pineTimberWorldBake(ground.heightAt, ground, shapes.piece);
  const piece = baked.pieces.find(row => row.name === 'pine-timber-explorer'), cabins = baked.pieces.find(row => row.name === 'pine.cabins'), under = baked.pieces.find(row => row.name === 'pine.undergrowth'), propsPiece = baked.pieces.find(row => row.name === 'pine.props');
  if (piece === undefined || cabins === undefined || under === undefined || propsPiece === undefined || baked.props === null) throw new Error('Pine timber Scene omitted its declared sources');
  // The cabins piece ships only its rows: the baked cabin scenes own their geometry, so its shape library has no reader.
  const library = [piece, under, propsPiece].map(part => {
    const bytes=compactLibraryGlb(part.glb, part.name === 'pine.props'), hash = hashImmutableBytes(bytes); baked.assets.set(hash,bytes);
    const file = { hash, kind: 'glb', compressed: bytes.length };
    const parsed = Object.assign(file, parseGlb(bytes));
    return Object.assign(parsed, { dependencies: [], critical: false });
  });
  const props = { ...baked.props.props, wholeLibrary: library.map(file => file.hash) };
  const query = bakeQueryTerrain(ground, { family: 'pbr' });
  for (const [hash, bytes] of query.assets) baked.assets.set(hash, bytes);
  const shardfile = { ...baked.shardfile, terrain: query.terrain, critical: [...baked.shardfile.critical, ...query.critical], library: [...baked.shardfile.library ?? [], ...props.wholeLibrary], files: [...baked.shardfile.files, ...library, ...query.files].sort((a,b) => a.hash.localeCompare(b.hash)) };
  // the scene description's canonical hash, as the retired job's publication named it
  const scene = hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(baked.scene)));
  const rows = { scene, props, shardfile, cragAssembly, poolGround: pool.still.ground, propShapes: shapes.rows, cabinProps, propMaterials: materialFiles.aliases, propMaterialCosts: materialFiles.costs, landmarks: { ...landmarkSites, ...landmarkFacts }, placements, lookout, sites, cabins: cabins.rows };
  return new Map([[TIMBER_SOURCE, new TextEncoder().encode(`${JSON.stringify(rows)}\n`)], ...[...baked.assets].map(([hash, bytes]) => [`assets/${hash}`, new Uint8Array(bytes)]),
    ...Object.entries(materialFiles.outputs).map(([name, bytes]) => [name, new Uint8Array(bytes)])]);
}

/** The timber world's rows, hash-named assets and material payloads, by source key. */
export const bakeTimberWorldFiles = bakeTimberWorld;
