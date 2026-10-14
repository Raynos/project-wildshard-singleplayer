/**
 * The bear cave's arch (E315 M2): a TRELLIS.2 generation (PINE-HOLLOW-REMASTER PH-B3,
 * public/assets/models/pine-hollow-hero/cave-arch/ + its LOD1): a rock arch with its mouth facing local +Z. It was
 * generated with the mouth closed; set into the Den's wall in front of the Blender cave (PH-B2) it is opened —
 * `openCaveArch` drops every triangle inside the passage's section, its jambs and lintel stay. Without the cave (a build
 * without the crag kit) it stays shut: the `closed` variant, a dark plane just inside its opening and a back wall.
 * It collides as two jambs and a lintel (boxes from its LOD1's bounds), rock. LOD0 (with shadow) within 70 m, LOD1 past.
 */
import * as THREE from 'three';
import { defineModel, type ColliderSpec, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { heroFar, heroLod0, heroLod1, heroNear } from '../world/hero';

export interface CaveArchParams {
  /** as generated: the mouth shut (no cave behind it) */
  readonly closed: boolean;
}

const ARCH = authored.landmarks.archShape;
const archRow = (ctx:ModelContext):typeof ARCH.fine|null=>heroLod1(ctx,'cave-arch')?ARCH.coarse:heroLod0(ctx,'cave-arch')?ARCH.fine:null;

/** the closed arch's dark plane just inside its opening (the chinking's program) */
function darkPlane(ctx: ModelContext): ModelPart[] {
  const b = archRow(ctx);
  if (!b) return [];
  const {w,h,x,y,z} = b.dark;
  return ctx.once('pine-hollow/cave-arch:dark', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 1, metalness: 0 });
    ctx.sky.setupMaterial(material);
    return [{ geometry: new THREE.PlaneGeometry(w,h).translate(x,y,z), material }];
  });
}

/**
 * Open the arch into the cave behind it (both LODs, once): every triangle inside the passage's section goes — cave
 * frame (BEAR_CAVE, its mouth facing (−sin rot, −cos rot)): |lx| < 2.6, from the floor to 4.8 m up, from 0.6 m inside
 * its lip back. The authored mask uses the shipped arch placement and mouth ground.
 */
export function openCaveArch(ctx: ModelContext): void {
  ctx.once('pine-hollow/cave-arch:open', () => {
    const fine=heroLod0(ctx,'cave-arch'),coarse=heroLod1(ctx,'cave-arch');
    if(fine)hollow(fine.geometry,ARCH.fine);if(coarse)hollow(coarse.geometry,ARCH.coarse);
    return true;
  });
}

function hollow(g: THREE.BufferGeometry, row: typeof ARCH.fine): void {
  const pos=g.getAttribute('position'),idx=g.getIndex(),tri=(idx?.count??pos.count)/3,keep:number[]=[];
  if(pos.count!==row.vertices||tri!==row.triangles||tri>65536||row.excluded.length!==Math.ceil(tri/4)||!/^[0-9a-f]+$/u.test(row.excluded))throw new Error('Arch passage facts differ from admitted geometry');
  for(let t=0;t<Math.min(tri,65536);t++)if((Number.parseInt(row.excluded[Math.floor(t/4)]??'',16)&(1<<(t%4)))===0)for(const k of [0,1,2])keep.push(idx?idx.getX(t*3+k):t*3+k);
  g.setIndex(keep);
}

export const caveArch = defineModel<CaveArchParams>({
  id: 'pine-hollow/cave-arch', name: 'Cave arch', category: 'nature', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/caveArch.ts', surface: 'rock',
  defaults: { closed: false },
  variants: [{ id: 'open', label: 'Open (the cave behind)', params: { closed: false } }, { id: 'closed', label: 'Closed (no cave)', params: { closed: true } }],
  build: (ctx, p) => [...heroNear(ctx, 'cave-arch'), ...(p.closed ? darkPlane(ctx) : [])],
  lods: [{ from: 70, build: (ctx, p) => [...heroFar(ctx, 'cave-arch'), ...(p.closed ? darkPlane(ctx) : [])] }],
  // the rock round the opening: two jambs and a lintel; shut, a back wall too
  colliders: (p, ctx) => {
    const b = archRow(ctx);
    if (!b) return [];
    return (p.closed ? [...b.boxes,b.wall] : b.boxes).map((row):ColliderSpec=>({kind:'box',x:row.x,y:row.y,z:row.z,hx:row.hx,hy:row.hy,hz:row.hz,surface:'rock'}));
  },
});
