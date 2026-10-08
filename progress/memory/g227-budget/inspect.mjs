// Shared non-restoring WebKit attribution; never a substitute for Simulator WC + GL.
export const WASM_INIT = `(() => {
 if(window.__g227Wasm) return; window.__g227Wasm=[];
 const record=(instance,source) => { for(const [name,value] of Object.entries(instance.exports)) if(value instanceof WebAssembly.Memory && !window.__g227Wasm.some(row=>row.memory.deref()===value)) window.__g227Wasm.push({source,name,memory:new WeakRef(value)}); };
 for(const name of ['instantiate','instantiateStreaming']) { const original=WebAssembly[name]; WebAssembly[name]=function(...args){return original.apply(this,args).then(result=>{record(result.instance ?? result,name);return result;});}; }
 const Original=WebAssembly.Instance;
 WebAssembly.Instance=new Proxy(Original,{construct(target,args,newTarget){const instance=Reflect.construct(target,args,newTarget);record(instance,'Instance');return instance;}});
})();`;
export const snapshotExpression = `(() => {
      const api = window.__wildshard, grid = api.shard.grid;
      const roots = [];
      api.world.game.rootScene.traverse(object => {
        if (object.isMesh && object.name.startsWith('grid-')) roots.push({ name: object.name, visible: object.visible,
          vertices: object.geometry?.attributes.position?.count, indices: object.geometry?.index?.count });
      });
      const allocations = new Map(), textures = new Map(), releasedAttributes = []; let next = 0;
      // Memory saver's array getter restores CPU storage from GL. Observe data descriptors only: the census must not undo the cut.
      const attributeArray = (attribute, user, role) => {
        if (!attribute) return;
        const own = Object.getOwnPropertyDescriptor(attribute, 'array');
        if (own && 'value' in own) return own.value;
        if (own?.get) { releasedAttributes.push({user,role,count:attribute.count,itemSize:attribute.itemSize}); return; }
        const data = Object.getOwnPropertyDescriptor(attribute, 'data')?.value;
        return data ? Object.getOwnPropertyDescriptor(data, 'array')?.value : undefined;
      };
      const addArray = (value, user, role) => {
        if (!ArrayBuffer.isView(value)) return;
        const buffer = value.buffer;
        let item = allocations.get(buffer);
        if (!item) { item = { id: ++next, bytes: buffer.byteLength, uses: [] }; allocations.set(buffer, item); }
        const key = user + ':' + role;
        if (!item.uses.some(use => use.key === key)) item.uses.push({ key, user, role, viewBytes: value.byteLength });
      };
      const original = window.__sc_gl().flatMap(c => c.resources);
      const textureHandles = new Map();
      api.world.game.rootScene.traverse(object => {
        const names = []; let parent = object;
        while (parent) { names.unshift(parent.name || parent.type); parent = parent.parent; }
        const user = names.join('/');
        if (object.geometry) {
          for (const [role, attribute] of Object.entries(object.geometry.attributes)) addArray(attributeArray(attribute, user, role), user, role);
          addArray(attributeArray(object.geometry.index, user, 'index'), user, 'index');
        }
        addArray(attributeArray(object.instanceMatrix, user, 'instanceMatrix'), user, 'instanceMatrix'); addArray(attributeArray(object.instanceColor, user, 'instanceColor'), user, 'instanceColor');
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (!material) continue;
          const values = [...Object.values(material), ...Object.values(material.uniforms ?? {}).map(uniform => uniform?.value)].flat();
          for (const texture of values) {
            if (!texture?.isTexture) continue;
            let item = textures.get(texture);
            if (!item) {
              item = { uuid: texture.uuid, name: texture.name, uses: [], imageKind: texture.image?.constructor?.name,
                width: texture.image?.width, height: texture.image?.height, depth: texture.image?.depth };
              textures.set(texture, item);
              const handle = api.world.game.renderer.properties.get(texture).__webglTexture;
              if (handle) { textureHandles.set(texture.uuid, handle); window.__sc_label_gl(handle, 'g227:scene-texture', texture.uuid); }
            }
            if (!item.uses.includes(user)) item.uses.push(user);
            addArray(texture.image?.data, user, 'texture:' + texture.uuid);
            for (const mip of texture.mipmaps ?? []) addArray(mip.data, user, 'mip:' + texture.uuid);
          }
        }
      });
      const linked = window.__sc_gl().map(({gl, ...context}) => context);
      const usageById = new Map(linked.flatMap(c => c.resources).filter(r => r.owner === 'g227:scene-texture').map(r => [r.id, r.asset]));
      const originalById = new Map(original.map(r => [r.id, r]));
      for (const resource of linked.flatMap(c => c.resources)) {
        const originalResource = originalById.get(resource.id);
        if (originalResource) { resource.owner = originalResource.owner; resource.asset = originalResource.asset; resource.labelled = originalResource.labelled; }
        const uuid = usageById.get(resource.id);
        if (uuid) {
          resource.sceneTextureUuid = uuid;
          const tag = originalById.get(resource.id);
          if (tag) window.__sc_label_gl(textureHandles.get(uuid), tag.owner, tag.asset);
        }
      }
      const census = { gl: linked, cpuAllocations: [...allocations.values()], releasedAttributes, textures: [...textures.values()],
        note: 'GPU allocations plus deduplicated directly retained scene ArrayBuffers. ImageBitmap/canvas/native costs are not inferred from dimensions.' };
      return { census, state: grid.state(), residency: grid.residency(), road: grid.roadResident(), roots, longTasks: window.__gridAdmissionLongTasks,
        settings: JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}').keys?.settings?.data,
        runtime: { texture: api.world.game.level.assets?.texture, level: api.world.game.level.id },
        wasm: (window.__g227Wasm ?? []).map(({source,name,memory})=>({source,name,bytes:memory.deref()?.buffer.byteLength ?? 0})), reveal: window.__wsReveal, originDrift: window.__frameFloorGridOriginDrift };
})()`;
export async function heapOwners(connection, heap) {
  const targets = [], classes = new Set(['ArrayBuffer','ImageBitmap','Float32Array','HTMLCanvasElement','AudioBuffer']);
  for(let i=0;i<heap.nodes.length;i+=4) {
    const className=heap.nodeClassNames[heap.nodes[i+2]], bytes=heap.nodes[i+1];
    if(classes.has(className) && bytes>=500000) targets.push({id:heap.nodes[i],className,bytes});
  }
  targets.sort((a,b)=>b.bytes-a.bytes);
  const rows=[],objectGroup='g227-centre-owner-audit';
  try {
    for(const target of targets.slice(0,64)) {
      try {
        const remote=await connection.send('Heap.getRemoteObject',{heapObjectId:target.id,objectGroup});
        if(!remote.result.objectId) {rows.push({...target,remote:remote.result});continue;}
        const details=await connection.send('Runtime.callFunctionOn',{objectId:remote.result.objectId,returnByValue:true,
          functionDeclaration:`function(){
            const target=this,matches=[],api=window.__wildshard;
            const attributeArray=a=>{const own=a && Object.getOwnPropertyDescriptor(a,'array');if(own && 'value' in own)return own.value;const data=a && Object.getOwnPropertyDescriptor(a,'data')?.value;return data ? Object.getOwnPropertyDescriptor(data,'array')?.value : undefined;};
            const add=(value,owner,role)=>{if(value===target || (ArrayBuffer.isView(value)&&value.buffer===target)) matches.push({owner,role,viewBytes:value?.byteLength});};
            api?.world?.game?.rootScene?.traverse(object=>{
              const names=[];let parent=object;while(parent){names.unshift(parent.name||parent.type);parent=parent.parent;}const owner=names.join('/');
              if(object.geometry){for(const [role,attribute] of Object.entries(object.geometry.attributes)) add(attributeArray(attribute),owner,role);add(attributeArray(object.geometry.index),owner,'index');}
              add(attributeArray(object.instanceMatrix),owner,'instances');add(attributeArray(object.instanceColor),owner,'instance-colours');
              for(const material of (Array.isArray(object.material)?object.material:[object.material])){
                if(!material)continue;
                for(const texture of [...Object.values(material),...Object.values(material.uniforms??{}).map(u=>u?.value)].flat()){
                  if(!texture?.isTexture)continue;add(texture.image,owner,'texture-image:'+texture.uuid);add(texture.source?.data,owner,'texture-source:'+texture.uuid);add(texture.image?.data,owner,'texture-data:'+texture.uuid);
                  for(const mip of texture.mipmaps??[])add(mip.data,owner,'texture-mip:'+texture.uuid);
                }
              }
            });
            for(const row of window.__g227Wasm??[]){const memory=row.memory.deref();if(memory?.buffer===target)matches.push({owner:'WASM:'+row.source+':'+row.name,role:'memory',viewBytes:memory.buffer.byteLength});}
            return {kind:target.constructor?.name,byteLength:target.byteLength??null,length:target.length??null,width:target.width??null,height:target.height??null,duration:target.duration??null,matches};
          }`});
        rows.push({...target,details:details.result?.value,thrown:details.wasThrown??false});
      } catch(error){rows.push({...target,error:String(error)});}
    }
  } finally {await connection.send('Runtime.releaseObjectGroup',{objectGroup});}
  return {protocol:'Exact object-identity match through Heap.getRemoteObject + Runtime.callFunctionOn against active scene attributes/textures and weak WASM memory registrations. Strong remote handles released before the post-heap footprint. Unmatched objects require retainer paths; no owner is inferred from equal sizes.',rows};
}

