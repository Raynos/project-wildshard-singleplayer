import type { BakedColliderInput } from '@wildshard/game/shardfile/bakedKinds';
import BRIDGE from '../data/bridgePhysics.generated.json' with { type: 'json' };
import PLACEMENTS from '../data/physicsPlacements.generated.json' with { type: 'json' };
import { SKY_GROUND_COLLIDERS } from '../data/groundScene.generated';
import { parseWorldScene, type WorldSceneRecipe, type PrivateScene } from '@wildshard/format/clientChannels';
import REST from '../data/restScenes.generated.json' with { type: 'json' };
import ISLETS from '../data/isletScenes.generated.json' with { type: 'json' };
import { MILL_SCENE } from '../data/millScene.generated';
import { CROWN_SCENE } from '../data/crownScene.generated';
import { SKY_PIECES } from './worldRows';
import { NOTES, WINCH, SUNREST, MILL } from '../data/layout';
import { KEEPER_STAND } from './keeperStand';
import { BOOK_STAND } from '../data/bookStand';

interface FixedWorldRows {
  readonly recipe: WorldSceneRecipe; readonly models: readonly string[]; readonly textureOnly: readonly string[];
  readonly halo: { readonly color: number; readonly transparent: boolean; readonly opacity: number; readonly blending: number; readonly depthWrite: boolean };
  readonly colliders: readonly { readonly id: string; readonly colliders: readonly BakedColliderInput[] }[];
  readonly bindings: Readonly<Record<'early' | 'mill' | 'furniture' | 'crown', readonly { readonly piece: string; readonly part: string; readonly baked?: string }[]>>;
}

/** Compose fixed visual hierarchies offline; the client keeps the existing scene/registry owners. */
export function fixedWorld(standalone: boolean): FixedWorldRows {
  const children: string[] = [];
  const scene: PrivateScene = { version: 1, root: 'fixed', nodes: [{ kind: 'group', id: 'fixed', children }], materials: [], textures: [] };
  const imports: WorldSceneRecipe['imports'] = [];
  const models = new Set(['lectern-hd', 'lantern-hd', 'mill-tower', 'mill-foot', ...CROWN_SCENE.models.map(row => row.model)]);
  function append(id: string, input: unknown, at?: readonly [number,number,number], yaw?: number): void {
    const row = parseWorldScene(input), key = (name: string): string => `${id}.${name}`;
    children.push(key(row.scene.root));
    for (const node of row.scene.nodes) scene.nodes.push({ ...node, ...(node.kind === 'anchor' ? {} : { name: node.name ?? node.id }), id: key(node.id), children: node.children.map(key),
      ...(node.id === row.scene.root && at !== undefined ? { position: [...at] } : {}),
      ...(node.id === row.scene.root && yaw !== undefined ? { rotation: [0,yaw,0] } : {}),
      ...(node.kind === 'mesh' ? { material: key(node.material) } : {}),
      ...(node.kind === 'object' || node.kind === 'anchor' ? { source: key(node.source) } : {}),
      ...('whenTexture' in node ? { whenTexture: { ...node.whenTexture, texture: key(node.whenTexture.texture) } } : {}),
    });
    for (const material of row.scene.materials) scene.materials.push({ ...material, id: key(material.id),
      ...(material.kind === 'standard' && material.maps !== undefined ? { maps: {
        ...(material.maps.map === undefined ? {} : {map:key(material.maps.map)}),
        ...(material.maps.normalMap === undefined ? {} : {normalMap:key(material.maps.normalMap)}),
        ...(material.maps.roughnessMap === undefined ? {} : {roughnessMap:key(material.maps.roughnessMap)}),
      } } : {}) });
    for (const texture of row.scene.textures) scene.textures.push({ ...texture, id: key(texture.id) });
    for (const entry of row.imports) imports.push({ ...entry, id: key(entry.id) });
  }
  function painted(input: unknown, mappings: readonly {id:string;model:string;look:string|null}[], ready: readonly string[]): WorldSceneRecipe {
    const row = parseWorldScene(input);
    for (const node of row.scene.nodes) if (node.kind === 'mesh') {
      const found = mappings.find(entry => entry.id === node.geometry);
      if (found !== undefined) node.geometry = `hero-${found.model}`;
    }
    row.scene.materials = row.scene.materials.map(material => {
      const found = mappings.find(entry => entry.id === material.id);
      return found === undefined ? material : found.look === null
        ? { kind:'standard', id:material.id, properties:{roughness:.85,metalness:0},maps:{map:found.model} }
        : { kind:'port', id:material.id, source:`${found.look}:${found.model}` };
    });
    const keys = [...new Set([...mappings.map(entry => entry.model), ...ready])];
    row.scene.textures = keys.map(id => ({kind:'port',id,source:id}));
    // All original ready tests keep the same conjunction, through identity groups.
    const gated = row.scene.nodes.filter(node => 'whenTexture' in node);
    for (const node of gated) {
      if (!('whenTexture' in node)) continue;
      const first=ready[0];if(first===undefined)throw new Error('Missing painted readiness');
      node.whenTexture={texture:first,present:true};
      for (const [index,texture] of ready.slice(1).entries()) {
        const id=`${node.id}.ready-${index}`;
        for (const parent of row.scene.nodes) parent.children = parent.children.map(child => child === node.id ? id : child);
        row.scene.nodes.push({kind:'group',id,whenTexture:{texture,present:true},children:[node.id]});
      }
    }
    return row;
  }
  append('islets',{scene:ISLETS.staticScene,imports:[]});
  append('winch',{scene:REST.winch,imports:[]},[WINCH.x,WINCH.y,WINCH.z]);
  for (const keeper of [false,true]) {
    const row=painted(REST.books[keeper?'keeper':'notes'],[{id:'lectern',model:'lectern-hd',look:null},
      ...(keeper?[{id:'lantern',model:'lantern-hd',look:'lantern-glow'}]:[])],keeper?['lectern-hd','lantern-hd']:['lectern-hd']);
    // The halo retains its existing unlit additive material port.
    append(keeper?'keeper':'notes',row,keeper?[KEEPER_STAND.x,SUNREST.y,KEEPER_STAND.z]:[NOTES.x,NOTES.y,NOTES.z],keeper?KEEPER_STAND.yaw:.6);
  }
  append('mill',painted(MILL_SCENE.recipe,[{id:'tower',model:'mill-tower',look:'mill-tower'},{id:'foot',model:'mill-foot',look:null}],['mill-tower','mill-foot']),[MILL.x,30,MILL.z],MILL.yaw);
  const crown=painted(CROWN_SCENE.recipe,CROWN_SCENE.models,['crown-stone','crown-stone-b','crown-dais']);
  for(const node of crown.scene.nodes)if(node.kind==='mesh')node.whenTexture={texture:'crown-stone',present:true};
  // Crown geometry was all-or-nothing; gate its mesh subtree on all three maps.
  const crownRoot=crown.scene.nodes.find(node=>node.id===crown.scene.root);
  if(crownRoot===undefined)throw new Error('Missing crown root');
  const meshIds=crownRoot.children.filter(id=>id!=='bake');crownRoot.children=['bake','painted'];
  crown.scene.nodes.push({kind:'group',id:'painted',whenTexture:{texture:'crown-stone-b',present:true},children:['complete']},
    {kind:'group',id:'complete',whenTexture:{texture:'crown-dais',present:true},children:meshIds});
  append('crown',crown);
  const baked = [{id:'house',piece:'far.step.winch-house'},{id:'roost',piece:'far.roost.nest'},...(standalone?[{id:'docks',piece:'far.docks'}]:[])];
  for(const entry of baked){const piece=SKY_PIECES.find(row=>row.id===entry.piece);if(piece===undefined||!('baked'in piece))throw new Error('Missing fixed bake');
    append(entry.id,{scene:{version:1,root:'root',nodes:[{kind:'group',id:'root',...('node'in piece?{name:piece.node}:{}),children:['bake']},{kind:'object',id:'bake',source:'bake',missing:'refuse'}],materials:[],textures:[]},imports:[{kind:'baked',id:'bake',piece:piece.baked}]},'at'in piece?piece.at:undefined);}
  const top=SUNREST.y+BOOK_STAND.height;
  return {recipe:parseWorldScene({scene,imports}),models:[...models],textureOnly:['mill-tower','mill-foot'],halo:{color:0xffb860,transparent:true,opacity:.18,blending:2,depthWrite:false},
    colliders:[...BRIDGE,...PLACEMENTS,...SKY_GROUND_COLLIDERS,{id:'far.keeper.stand',colliders:[{kind:'box',x:KEEPER_STAND.x,y:(top+SUNREST.y)/2,z:KEEPER_STAND.z,hx:BOOK_STAND.footprint,hy:Math.max(.005,(top-SUNREST.y)/2),hz:BOOK_STAND.footprint,yaw:-KEEPER_STAND.yaw,surface:'wood'}]}],
    bindings:{early:standalone?[{piece:'far.docks',part:'docks.root',baked:'docks.bake'}]:[],mill:[{piece:'far.windmill',part:'mill.mill'}],
      furniture:[{piece:'far.winch',part:'winch.winch'},{piece:'far.notes',part:'notes.stand'},{piece:'far.keeper.stand',part:'keeper.stand'}],
      crown:[{piece:'far.crown.ruin',part:'crown.crown',baked:'crown.bake'},{piece:'far.step.winch-house',part:'house.root',baked:'house.bake'},{piece:'far.roost.nest',part:'roost.root',baked:'roost.bake'}]}};
}
