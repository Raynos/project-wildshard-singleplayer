import * as THREE from 'three';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { modelContext } from '@wildshard/engine/models/model';
import type { Placed } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import { instancedQuad } from '@wildshard/engine/render/instancedGeometry';
import { hasLentLook, lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { Flutter } from './Flutter';
import { preloadNalatiPlaces, bakedPlaceAnchors, bakedSignLettering, applyBakedPlaceEffects, bakedPlaceBounds } from './places';
import { EncounterSites } from '@wildshard/game/boss/encounterView';
import { balbal } from '../models/balbal';
import balbalSpecimen from '../boot/balbalSpecimen.generated.json' with { type: 'json' };
import modelMetrics from '../boot/modelMetrics.generated.json' with { type: 'json' };
import type { SceneDressing } from '@wildshard/game/shardfile/sceneDressing';
import poiLayout from '../boot/poiLayout.generated.json' with { type: 'json' };
import type { Box } from './solid';
import type { Plumes, PoiCtx, PoiPiece } from './types';


import type { NalatiPOIs } from './viewTypes';
import prepared from '../boot/placeRuntime.generated.json' with { type: 'json' };

const SMOKE_LOOK = 'nalati-camp-smoke';
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export async function buildNalatiPOIs(sky: Sky, scene: THREE.Object3D, player: { position: THREE.Vector3 }, yieldTask: () => Promise<void>, registry: WorldRegistry, declared: SceneDressing): Promise<NalatiPOIs> {
 const group = new THREE.Group(); group.name = 'nalati-pois';
 const flutter = new Flutter();
 const smoke: Plumes = { emitter: () => undefined };
 const ctx: PoiCtx = { sky, ground: heightAt, flutter, smoke }, models = modelContext(sky);
 const pieces: PoiPiece[] = [], placed = new Map<string, readonly Placed[]>(), colliders: Box[] = [], timings: Record<string, number> = {};

 const kurgan = bakedPlaceAnchors('kurgans'), crags = bakedPlaceAnchors('crags'), cairn = poiLayout.WIND_CAIRN;
 const statues = new EncounterSites({ ...balbalSpecimen.sites, generated: balbalSpecimen.generated, sites: kurgan.balbalSpots ?? [] });   // the crown balbals (B11 wakes them)
 const declaredPiece=(name:string):PoiPiece=>{const piece=declared.pieces.get(name);if(piece===undefined)throw new Error(`Missing declared place ${name}`);return{name,object:piece.object,tris:piece.tris,colliders:prepared.view.sequence.some(row=>row.name===name&&row.kind==='static')?bakedPlaceBounds(name).map(box=>structuredClone(box)):[],surface:'ground',register:()=>piece.placed};};
 const live = new Map<string, () => PoiPiece>([['balbals', () => ({ name: 'balbals', object: statues.object, colliders: [...statues.colliders], surface: 'stone', tris: modelMetrics.triangles.balbal * statues.sites.length, register: ({ registry: r, ctx: c }) => [statues.place(balbal, c, r, sky)] })], ...['kokpar','farHerds','snowLotus','glacier'].map(name=>[name,()=>declaredPiece(name)] as const)]);
 await preloadNalatiPlaces();
 for (const row of prepared.view.sequence) {
  const t0 = diagnosticNow(), builder = live.get(row.name);
  const p = row.kind === 'live' && builder !== undefined ? builder() : declaredPiece(row.name);
  if(row.kind==='static')applyBakedPlaceEffects(row.name,ctx);
  if (row.name === 'roads') { const text = bakedSignLettering(sky, 'roads'); p.object.children.splice(1, 0, text); text.parent = p.object; p.tris += (text.geometry.index?.count ?? 0) / 3; }
  timings[row.name] = Math.round(diagnosticNow() - t0); pieces.push(p); group.add(p.object); colliders.push(...p.colliders); await yieldTask();
 }
 if (flutter.count > 0) group.add(flutter.build(sky));
 const smokeMesh = prepared.view.smoke.puffs > 0 && hasLentLook(SMOKE_LOOK) ? buildSmoke() : null;
 if (smokeMesh !== null) group.add(smokeMesh);
 scene.add(group);
 for (const p of pieces) { if (p.register !== undefined) placed.set(p.name, p.register({ registry, ctx: models })); else if (p.colliders.some(b => b.ghost !== true) || (p.descs?.length ?? 0) > 0) throw new Error(`Place ${p.name} lacks its model registration`); await yieldTask(); }
 statues.register(registry);
 return { group, pieces, flutter, smoke, colliders, timings, placed, balbals: statues, kurganEntrance: kurgan.entrance ?? null, cragLedges: crags.ledges ?? [], cragCave: crags.cave ?? null,
  cairnTieSpot: new THREE.Vector3(cairn.x + 3.6, heightAt(cairn.x, cairn.z), cairn.z),
  update: dt => { flutter.update(dt); if (smokeMesh !== null) { const wind = painterlyUniforms.uPWind.value, shade = painterlyUniforms.uPShade.value, sun = sky.sunColor; setLentParam(SMOKE_LOOK, 'wind', [clamp(wind.x, -8, 8), clamp(wind.y, -8, 8), clamp(wind.z, -8, 8)]); setLentParam(SMOKE_LOOK, 'shade', [shade.r, shade.g, shade.b]); setLentParam(SMOKE_LOOK, 'sunColour', [sun.r, sun.g, sun.b]); } for (const p of pieces) p.update?.(dt, player.position); },
  stats: () => ({ ...Object.fromEntries(pieces.map(p => [p.name, p.tris])), cloth: (flutter.mesh?.geometry.index?.count ?? 0) / 3, smoke: smokeMesh === null ? 0 : 2 * prepared.view.smoke.puffs }),
 };
}

function buildSmoke(): THREE.Mesh {
 const row = prepared.view.smoke, attribute = (data: readonly number[], width: number): THREE.InstancedBufferAttribute => new THREE.InstancedBufferAttribute(Float32Array.from(data), width);
 const geometry = instancedQuad(new THREE.PlaneGeometry(1, 1), { aEmitter: attribute(row.attributes.aEmitter, 3), aSeed: attribute(row.attributes.aSeed, 4), aCfg: attribute(row.attributes.aCfg, 4) });
 geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(row.centre), row.radius);
 const mesh = new THREE.Mesh(geometry, lentLook(SMOKE_LOOK)); mesh.name = 'nalati-smoke'; mesh.renderOrder = 3; return mesh;
}
