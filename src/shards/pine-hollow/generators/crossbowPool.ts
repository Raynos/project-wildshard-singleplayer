import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clientSceneGlb, staticGlb } from '@wildshard/sdk/bake/glb';

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function cyl(rTop: number, rBot: number, len: number, seg: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function remapUV(g: THREE.BufferGeometry, u0: number, v0: number, su: number, sv: number): THREE.BufferGeometry {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * su, v0 + uv.getY(i) * sv);
  return g;
}
/** Lighten vertex colour on bevel/edge vertices (normals off-axis) → worn, handled edges. */
function edgeWear(g: THREE.BufferGeometry, amount = 0.28): void {
  const n = g.getAttribute('normal'), count = n.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const m = Math.max(ax, ay, az);
    const w = Math.max(0, Math.min(1, (0.97 - m) / 0.35)); // 1 on 45° bevels, 0 on flat faces
    const c = 1 + w * amount;
    colors[i * 3] = c; colors[i * 3 + 1] = c; colors[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
/** An all-white (×1) vertex-colour attribute where a geometry has none, so it can share a vertex-coloured program. */
function whiteColors(g: THREE.BufferGeometry): void {
  if (g.hasAttribute('color')) return;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
}
function stripExtra(geo: THREE.BufferGeometry): THREE.BufferGeometry { // non-indexed, only position/normal/uv, so merge works
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  return g;
}
const PEEP_R=.01, PEEP_TUBE=.12;
function sweepRect(curve: THREE.Curve<THREE.Vector3>, segs: number, halfW: (t: number) => number, halfH: (t: number) => number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], col: number[] = [];
  const p = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const faces: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; // corners in (N, B) space, ring order
  const c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    curve.getPointAt(t, p); curve.getTangentAt(t, T);
    N.crossVectors(T, up).normalize(); B.crossVectors(N, T).normalize();
    const hw = halfW(t), hh = halfH(t);
    for (let k = 0; k < 4; k++) { const ck = c[k], fk = faces[k]; if (ck === undefined || fk === undefined) continue; ck.copy(p).addScaledVector(N, fk[0] * hw).addScaledVector(B, fk[1] * hh); }
    // four faces, each with two verts per ring (hard edges)
    for (let f = 0; f < 4; f++) {
      const a = c[f], b = c[(f + 1) % 4];
      if (a === undefined || b === undefined) continue;
      const fn = new THREE.Vector3().subVectors(b, a).cross(T).normalize().negate();
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); nrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z); uv.push(t * 6, 0, t * 6, 1);
      const wear = (f % 2 === 1 ? 0.8 : 0.28) * (0.85 + 0.3 * Math.abs(Math.sin(t * 23 + f))); // edges worn bright, flats blackened
      col.push(wear, wear, wear, wear, wear, wear);
    }
  }
  for (let s = 0; s < segs; s++) for (let f = 0; f < 4; f++) {
    const o = s * 8 + f * 2, n = o + 8;
    idx.push(o, n, o + 1, o + 1, n, n + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Bevelled rectangular ring (iron band) around a w×h section, `len` long, oriented along Z. */
function bandGeometry(w: number, h: number, len: number, thick: number, bevel = 0.0015): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, h / 2 + thick); outer.lineTo(-w / 2 - thick, h / 2 + thick); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: len - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -len / 2 + bevel);
  return g;
}

function buildBoltGeometry(): THREE.BufferGeometry {
  const L = 0.36, r = 0.0045;
  const parts: THREE.BufferGeometry[] = [];
  // shaft (ash)
  parts.push(remapUV(cyl(r, r, L - 0.05, 10, 0, 0, 0.025, Math.PI / 2), 0, 0.02, 1, 0.44));
  // nock end cap
  parts.push(remapUV(cyl(r * 0.8, r, 0.012, 8, 0, 0, L / 2 - 0.006, Math.PI / 2), 0, 0.02, 1, 0.44));
  // socket (steel)
  parts.push(remapUV(cyl(0.0052, r, 0.03, 8, 0, 0, -L / 2 + 0.04, Math.PI / 2), 0.03, 0.55, 0.42, 0.42));
  // broadhead: flattened 4-sided cone = two-edged blade
  const head = new THREE.ConeGeometry(0.016, 0.07, 4);
  head.rotateY(Math.PI / 4); head.scale(0.22, 1, 1); head.rotateX(-Math.PI / 2); head.translate(0, 0, -L / 2 + 0.035 - 0.035);
  parts.push(remapUV(head, 0.03, 0.55, 0.42, 0.42));
  // fletchings ×3
  for (let k = 0; k < 3; k++) {
    const vane = new THREE.PlaneGeometry(0.075, 0.02);
    vane.translate(0, 0.01 + r * 0.7, 0); vane.rotateY(Math.PI / 2); // plane along Z, standing up from the shaft
    vane.rotateZ((k / 3) * Math.PI * 2 + Math.PI / 2);
    vane.translate(0, 0, L / 2 - 0.06);
    parts.push(remapUV(vane, 0.5, 0.5, 0.5, 0.5));
  }
  const g = mergeGeometries(parts.map(stripExtra), false);
  g.computeBoundingSphere();
  return g;
}

function buildCrossbow(into: { readonly model: THREE.Group; readonly peep: THREE.Group; readonly peepRing: THREE.Group }) {
  const { model, peep, peepRing } = into;
  const [woodMat, ironMat, prodMat, leatherMat, cordMat, brassMat] = ['wood', 'iron', 'prod', 'leather', 'cord', 'brass'].map(name => { const material = new THREE.MeshStandardMaterial(); material.name = name; return material; });
  // model space: -Z forward (bolt direction), +Y up, rail top at y=0. Nut at z=+0.14, prod at z=-0.30.
  // ── stock: side profile extruded along X with bevels ──
  const s = new THREE.Shape(); // shape.x = forward (→ -Z), shape.y = up
  s.moveTo(0.40, 0.0);
  s.lineTo(-0.16, 0.0);
  s.quadraticCurveTo(-0.26, -0.006, -0.32, -0.035);
  s.lineTo(-0.43, -0.085);
  s.quadraticCurveTo(-0.455, -0.1, -0.445, -0.125);
  s.lineTo(-0.435, -0.15);
  s.quadraticCurveTo(-0.39, -0.16, -0.34, -0.135);
  s.lineTo(-0.23, -0.088);
  s.quadraticCurveTo(-0.12, -0.062, 0.0, -0.056);
  s.lineTo(0.30, -0.048);
  s.quadraticCurveTo(0.39, -0.046, 0.40, -0.018);
  s.closePath();
  const stockGeo = new THREE.ExtrudeGeometry(s, { depth: 0.038, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 10 });
  stockGeo.rotateY(Math.PI / 2); // shape.x → -Z, extrusion → +X
  stockGeo.translate(-0.019, 0, 0);
  // rail strips (two lighter wood rails with a groove for the bolt)
  const railL = box(0.008, 0.005, 0.52, -0.011, 0.0025, -0.12), railR = box(0.008, 0.005, 0.52, 0.011, 0.0025, -0.12);
  const stockNI = stripExtra(stockGeo);
  const woodGeo = mergeGeometries([stockNI, stripExtra(railL), stripExtra(railR)], false);
  edgeWear(woodGeo, 0.18);
  { // the groove rails sit in shadow of the bolt: darker, oil-soaked
    const c = woodGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = stockNI.getAttribute('position').count; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.62, c.getY(i) * 0.6, c.getZ(i) * 0.58);
  }
  const stock = new THREE.Mesh(woodGeo, woodMat);
  model.add(stock);

  // ── iron: nut, trigger, guard, tickler, bands, rivets, stirrup, prod bridle, tip caps ──
  const iron: THREE.BufferGeometry[] = [];
  // brass: nut (roller), side inlay strips, thumb plate, rivet heads on the grip
  const brass: THREE.BufferGeometry[] = [];
  brass.push(cyl(0.014, 0.014, 0.042, 18, 0, 0.004, 0.14, 0, 0, Math.PI / 2)); // nut
  brass.push(box(0.032, 0.006, 0.011, 0, 0.012, 0.133)); // nut fingers
  for (const sx of [-1, 1]) brass.push(box(0.0015, 0.0035, 0.30, sx * 0.0245, -0.03, -0.09)); // inlay lines along the flanks
  brass.push(box(0.03, 0.002, 0.05, 0, -0.088, 0.25, 0.3)); // thumb plate on the grip top edge
  const bead = new THREE.SphereGeometry(0.0035, 10, 8); bead.translate(0, 0.009, -0.375); brass.push(bead); // foresight bead
  brass.push(cyl(0.0015, 0.0015, 0.008, 6, 0, 0.004, -0.375)); // bead post
  const brassGeo = mergeGeometries(brass.map(stripExtra), false);
  model.add(new THREE.Mesh(brassGeo, brassMat));
  // trigger (curved) + guard
  const trig = new THREE.TorusGeometry(0.022, 0.0032, 8, 14, Math.PI * 0.6); trig.rotateY(Math.PI / 2); trig.rotateX(Math.PI * 0.55); trig.translate(0, -0.075, 0.205); iron.push(trig);
  const guard = new THREE.TorusGeometry(0.036, 0.0025, 6, 20, Math.PI); guard.rotateY(Math.PI / 2); guard.rotateX(Math.PI); guard.translate(0, -0.066, 0.21); iron.push(guard);
  // tickler lever under the stock, angled
  iron.push(box(0.012, 0.006, 0.19, 0, -0.088, 0.30, -0.08));
  iron.push(cyl(0.004, 0.004, 0.05, 8, 0, -0.08, 0.215, 0, 0, Math.PI / 2)); // pivot pin
  // bands
  const bandF = bandGeometry(0.048, 0.052, 0.022, 0.003); bandF.translate(0, -0.026, -0.27); iron.push(bandF);
  const bandM = bandGeometry(0.048, 0.062, 0.016, 0.0025); bandM.translate(0, -0.031, 0.02); iron.push(bandM);
  const bandR = bandGeometry(0.046, 0.07, 0.016, 0.0025); bandR.translate(0, -0.045, 0.27); iron.push(bandR);
  // rivets on bands
  for (const [z, y] of [[-0.27, -0.026], [0.02, -0.031], [0.27, -0.045]] as const) for (const sx of [-1, 1]) {
    iron.push(cyl(0.003, 0.0035, 0.004, 8, sx * 0.028, y, z, 0, 0, Math.PI / 2));
  }
  // prod bridle: a saddle over the stock nose holding the prod
  iron.push(box(0.062, 0.012, 0.03, 0, 0.007, -0.30));
  iron.push(box(0.064, 0.05, 0.012, 0, -0.026, -0.296)); // vertical plate in front of prod
  for (const sx of [-1, 1]) iron.push(cyl(0.0045, 0.0045, 0.04, 8, sx * 0.024, -0.025, -0.283, Math.PI / 2)); // bridle bolts
  // stirrup: two legs + half ring
  for (const sx of [-1, 1]) iron.push(cyl(0.004, 0.004, 0.06, 8, sx * 0.03, -0.055, -0.415, 0, 0, 0));
  const stir = new THREE.TorusGeometry(0.03, 0.004, 8, 18, Math.PI); stir.rotateZ(Math.PI); stir.translate(0, -0.085, -0.415); iron.push(stir);
  iron.push(box(0.07, 0.008, 0.02, 0, -0.03, -0.41)); // stirrup mount plate
  // limb tip caps
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205);
  for (const tip of [tipL, tipR]) iron.push(box(0.022, 0.024, 0.012, tip.x, tip.y, tip.z));
  // butt plate
  const butt = box(0.046, 0.06, 0.006, 0, -0.115, 0.44, 0.4); iron.push(butt);
  const ironGeo = mergeGeometries(iron.map(stripExtra), false);
  model.add(new THREE.Mesh(ironGeo, ironMat));

  // ── prod (steel limbs) ──
  const prodCurve = new THREE.CatmullRomCurve3([
    tipL.clone(), new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), tipR.clone(),
  ], false, 'catmullrom', 0.5);
  const prodGeo = sweepRect(prodCurve, 40, (t) => 0.008 - Math.abs(t - 0.5) * 0.009, (t) => 0.021 - Math.abs(t - 0.5) * 0.022);
  model.add(new THREE.Mesh(prodGeo, prodMat));

  // ── string (2 legs + serving), updated every frame ──
  const legGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 1, 7); legGeo.translate(0, 0.5, 0);
  const stringLeft = new THREE.Mesh(legGeo, cordMat), stringRight = new THREE.Mesh(legGeo, cordMat);
  const servGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.055, 8); servGeo.rotateZ(Math.PI / 2);
  const serving = new THREE.Mesh(servGeo, cordMat);
  model.add(stringLeft, stringRight, serving);
  const nockRest = new THREE.Vector3(0, 0.009, -0.215), nockDrawn = new THREE.Vector3(0, 0.009, 0.128);
  // cord whipping around the stock nose
  const wrap = new THREE.CylinderGeometry(0.031, 0.031, 0.024, 10); wrap.rotateX(Math.PI / 2); wrap.translate(0, -0.025, -0.34);
  model.add(new THREE.Mesh(wrap, cordMat));

  // ── leather grip ──
  const gripShape = new THREE.Shape(); // rounded rectangle section
  const gw = 0.026, gh = 0.047, gr = 0.012;
  gripShape.moveTo(-gw + gr, -gh); gripShape.lineTo(gw - gr, -gh); gripShape.quadraticCurveTo(gw, -gh, gw, -gh + gr);
  gripShape.lineTo(gw, gh - gr); gripShape.quadraticCurveTo(gw, gh, gw - gr, gh); gripShape.lineTo(-gw + gr, gh);
  gripShape.quadraticCurveTo(-gw, gh, -gw, gh - gr); gripShape.lineTo(-gw, -gh + gr); gripShape.quadraticCurveTo(-gw, -gh, -gw + gr, -gh);
  const grip = new THREE.ExtrudeGeometry(gripShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 3, curveSegments: 6 });
  grip.rotateX(0.35); grip.translate(0, -0.074, 0.30);
  const fw = 0.0245, fh = 0.033, fr = 0.009; const foreShape = new THREE.Shape();
  foreShape.moveTo(-fw + fr, -fh); foreShape.lineTo(fw - fr, -fh); foreShape.quadraticCurveTo(fw, -fh, fw, -fh + fr); foreShape.lineTo(fw, fh - fr); foreShape.quadraticCurveTo(fw, fh, fw - fr, fh); foreShape.lineTo(-fw + fr, fh); foreShape.quadraticCurveTo(-fw, fh, -fw, fh - fr); foreShape.lineTo(-fw, -fh + fr); foreShape.quadraticCurveTo(-fw, -fh, -fw + fr, -fh);
  const fore = new THREE.ExtrudeGeometry(foreShape, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
  fore.translate(0, -0.03, -0.24); // forearm wrap between the front band and the mid band
  model.add(new THREE.Mesh(fore, leatherMat));
  model.add(new THREE.Mesh(grip, leatherMat));

  // ── loaded bolt on the rail ──
  const { geometry: boltGeo, material: boltMat } = { geometry: buildBoltGeometry(), material: new THREE.MeshStandardMaterial() };
  const loadedBolt = new THREE.Mesh(boltGeo, boltMat);
  loadedBolt.position.set(0, 0.0095, 0.128 - 0.18);
  model.add(loadedBolt);
  boltGeo.computeBoundingBox();
  const boltBox = boltGeo.boundingBox;
  if (boltBox === null) throw new Error('Crossbow: bolt geometry has no bounding box');
  const tipLocal = new THREE.Vector3(0, 0, boltBox.min.z), nockZ = boltBox.max.z;
  const tipModel = tipLocal.clone().add(loadedBolt.position);

  // ── rear peep sight: dark iron ring with a faint cyan inner edge, on a post rising from the rail (posed per frame) ──
  // the stock's program (see the materials above): 1×1 filler maps leave colour, roughness and metalness as set
  const peepIron = new THREE.MeshStandardMaterial(); peepIron.name = 'peep-iron';
  const peepGlow = new THREE.MeshStandardMaterial(); peepGlow.name = 'peep-glow';
  const peepMats: THREE.Material[] = [peepIron, peepGlow];
  const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(PEEP_R, PEEP_R * PEEP_TUBE, 10, 40), peepIron);
  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(PEEP_R * (1 - PEEP_TUBE * 0.85), PEEP_R * 0.025, 6, 40), peepGlow);
  peepRing.add(ringOuter, ringInner);
  const postGeo = new THREE.BoxGeometry(0.0025, 1, 0.002); postGeo.translate(0, -0.5, 0); // top at 0, scaled to reach the rail
  const peepPost = new THREE.Mesh(postGeo, peepIron);
  peep.add(peepRing, peepPost);
  peep.visible = false;
  model.add(peep);
  return { stringLeft, stringRight, serving, loadedBolt, boltGeo, boltMat, peepPost, peepMats, tipL, tipR, nockRest, nockDrawn, tipLocal, tipModel, nockZ };
}


function poolMesh(node:THREE.Object3D):node is THREE.Mesh{return node instanceof THREE.Mesh;}
export function crossbowPool():{glb:Uint8Array;rows:{pool:{url:string;parts:string[]};hierarchy:unknown}} {
  const model=new THREE.Group(), peep=new THREE.Group(), peepRing=new THREE.Group();
  model.name='root'; peep.name='peep'; peepRing.name='peep-ring';
  const parts=buildCrossbow({model,peep,peepRing});
  const named=new Map<THREE.Object3D,string>([[parts.stringLeft,'string-left'],[parts.stringRight,'string-right'],[parts.serving,'serving'],[parts.loadedBolt,'loaded-bolt'],[parts.peepPost,'peep-post']]);
  const ports=new Map<THREE.Material,string>();let index=0;
  model.traverse(node=>{if(poolMesh(node)){node.name=named.get(node)??`part${index++}`; const material=node.material;
    if(Array.isArray(material))throw new Error('Crossbow requires one material');
    if(node===parts.loadedBolt)material.name='bolt';
    // Only the original vertex-coloured material owners need this channel.
    if(material.name!=='bolt'&&material.name!=='peep-glow')whiteColors(node.geometry);
    ports.set(material,material.name);
  }});
  const result=clientSceneGlb(model,ports), source=new Map<string,THREE.BufferGeometry>();
  model.traverse(node=>{if(poolMesh(node))source.set(node.name,node.geometry);});
  // Both string legs still share one immutable source geometry and GPU buffer.
  source.delete('string-right');
  const neutral=new THREE.MeshStandardMaterial();
  const glb=staticGlb([...source].map(([name,geometry])=>({name,geometry,material:neutral,compactIndex:true,
    extras:{restGroups:geometry.groups.map(group=>[group.start,group.count,group.materialIndex??0]),
      restBox:geometry.boundingBox===null?null:[geometry.boundingBox.min.x,geometry.boundingBox.min.y,geometry.boundingBox.min.z,geometry.boundingBox.max.x,geometry.boundingBox.max.y,geometry.boundingBox.max.z],
      restSphere:geometry.boundingSphere===null?null:[geometry.boundingSphere.center.x,geometry.boundingSphere.center.y,geometry.boundingSphere.center.z,geometry.boundingSphere.radius]}})),'crossbow-pool');
  const hierarchy={...result.scene,nodes:result.scene.nodes.map(node=>node.kind==='group'&&node.id!=='root'?Object.assign(node,{kind:'object',source:node.id,missing:'refuse'}):node.kind==='mesh'&&node.id==='string-right'?Object.assign(node,{geometry:'string-left'}):node)};
  return {glb,rows:{pool:{url:'/assets/pine-hollow/baked/crossbow-pool.glb',parts:[...source.keys()]},hierarchy}};
}
