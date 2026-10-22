import * as THREE from 'three';

export function ghostArrowKind(): {geometry: THREE.BufferGeometry;material: THREE.MeshBasicMaterial;length:number;gravity:number;drag:number;windCoupling:number;bury:number;recover:number;maxFlying:number;maxStuck:number;stick:boolean;hitsAnimals:boolean;puffs:boolean;hurtsPlayer:{radius:number;height:number}} {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(0.008, 0.008, 0.8, 5); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.45); parts.push(shaft);
  const head = new THREE.ConeGeometry(0.03, 0.12, 5); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.06); parts.push(head);
  // the streak: two crossed tapering quads, 2.6 m
  for (const r of [0, Math.PI / 2]) {
    const q = new THREE.BufferGeometry();
    const L = 2.6, w0 = 0.07, w1 = 0.005;
    q.setAttribute('position', new THREE.Float32BufferAttribute([-w0, 0, 0.1, w0, 0, 0.1, -w1, 0, L, w1, 0, L], 3));
    q.setIndex([0, 2, 1, 1, 2, 3]);
    q.rotateZ(r); parts.push(q);
  }
  const pos: number[] = [], idx: number[] = [];
  for (const p of parts) {
    const base = pos.length / 3, a = p.getAttribute('position');
    for (let i = 0; i < a.count; i++) pos.push(a.getX(i), a.getY(i), a.getZ(i));
    const ix = p.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < a.count; i++) idx.push(i + base);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // brightest at the head, fading down the streak (vertex colour × the HDR cyan)
  const col = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) { const z = pos[i * 3 + 2] ?? 0; const k = z < 0.2 ? 1 : Math.max(0.02, 1 - (z - 0.2) / 2.4) ** 1.6; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.6, 3.0), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  mat.name = 'nalati-ghost-arrow';
  return {
    geometry: g, material: mat, length: 0.85, gravity: 5, drag: 0.004, windCoupling: 0, bury: 0, recover: 0,
    maxFlying: 16, maxStuck: 0, stick: false, hitsAnimals: false, puffs: false, hurtsPlayer: { radius: 0.42, height: 1.8 },
  };
}



export function ghostStyles(): Record<'rider' | 'captain' | 'storm', { key: string; common: string; fragment: string }> {
  const style = (core: string, rim: string, key: string) => ({ key,
    common: '#include <common>\nuniform float uGFade;\nuniform float uGTime;',
    fragment: `#include <dithering_fragment>
        vec3 gN = normalize( normal );
        vec3 gV = normalize( vViewPosition );
        float gF = pow( clamp( 1.0 - abs( dot( gN, gV ) ), 0.0, 1.0 ), 2.0 ); // clamped: |N·V| rounds past 1 on iOS mediump → pow(negative) = NaN → bloom's black square (E91)
        float gS = 0.75 + 0.25 * sin( gl_FragCoord.y * 0.045 + uGTime * 3.1 ) * sin( gl_FragCoord.x * 0.031 - uGTime * 2.3 );
        vec3 gC = mix( ${core}, ${rim}, gF ) * ( 0.8 + 1.3 * gF ) * gS;
        gl_FragColor = vec4( gC * uGFade, 1.0 );`,
  });
  return {
    rider: style('vec3(0.08, 0.42, 0.52)', 'vec3(0.45, 1.9, 2.3)', 'nalati-ghost'),
    captain: style('vec3(0.1, 0.5, 0.42)', 'vec3(0.6, 2.4, 1.9)', 'nalati-ghost-captain'),
    storm: style('vec3(0.34, 0.38, 0.48)', 'vec3(1.5, 1.8, 2.6)', 'nalati-ghost-storm'),
  };
}

/** The night's sprays and cues (game/audio/cueDirector): the balbals' soil, turf, stone, dust and amber (lit by the dusk,
 *  lumpy clumps) and the ghost riders' cyan mist (additive puffs), drawn in their look graphs (data/lookGraphs.json). */
export function nightCues(): unknown {
  const SOIL = [0.26, 0.19, 0.12], TURF = [0.3, 0.36, 0.14], STONE = [0.55, 0.53, 0.49], DUST = [0.5, 0.44, 0.34], AMBER = [2.4, 1.1, 0.25], MIST = [0.18, 0.75, 0.85];
  const spray = (id: string, count: number, speed: number, up: number, life: number, size: number, colour: number[], jitter: number, flags: string[], spread: number, offset = [0, 0, 0], push = 0) =>
    ({ kind: 'spray', spray: id, count, speed, up, push, life, size, colour, jitter, spread, flags, offset });
  const debris = (...args: Parameters<typeof spray> extends [string, ...infer R] ? R : never) => spray('debris', ...args);
  const mist = (...args: Parameters<typeof spray> extends [string, ...infer R] ? R : never) => spray('mist', ...args);
  const fall = ['gravity', 'bounce'], stone = debris(14, 2.6, 2.2, 0.9, 0.07, STONE, 0.2, fall, 0.35), amber = debris(12, 3, 2.5, 0.5, 0.05, AMBER, 0.2, ['gravity'], 0.3);
  return { version: 1, fields: [],
    sprays: [
      // a lumpy clump: a squashed disc with a darker lower half, the light from above (data/lookGraphs.json)
      { id: 'debris', capacity: 900, lit: true, renderOrder: 11, fade: [4, 0, 1], look: 'nalati-spray-debris' },
      { id: 'mist', capacity: 900, lit: false, renderOrder: 12, fade: [2.2, 6, 0.2], look: 'nalati-spray-mist' },
    ],
    rows: [
      // a balbal tears out of the ground; soil pours off it as it moves through the ground, a clod falls as it walks
      { id: 'cue.balbal.wake', vfx: [debris(26, 2.2, 3.5, 1.6, 0.16, TURF, 0.25, fall, 0.6), debris(10, 1.2, 0.8, 2.2, 0.9, DUST, 0.15, ['grow'], 0.5)] },
      { id: 'cue.balbal.soil', vfx: [debris(3, 1.2, 3.45, 1.4, 0.13, SOIL, 0, fall, 0.6)] },
      { id: 'cue.balbal.dust', vfx: [debris(1, 0.6, 0.4, 2.2, 0.8, DUST, 0.15, ['grow'], 0.6)] },
      { id: 'cue.balbal.clod', vfx: [debris(1, 0.4, 0, 1.3, 0.08, SOIL, 0, fall, 0.3, [0, 0.95, 0])] },
      // a hit: stone chips (amber sparks off a crack or a heavy blow); the kill's rubble; the slam's turf, soil, dust and sparks
      { id: 'cue.balbal.chip', vfx: [stone] },
      { id: 'cue.balbal.chip.hard', vfx: [stone, amber] },
      { id: 'cue.balbal.crack', vfx: [{ ...stone, count: 6 }, amber] },
      { id: 'cue.balbal.broken', vfx: [debris(46, 3.2, 3, 1.8, 0.12, STONE, 0.25, fall, 0.6), debris(14, 1.5, 0.6, 2.4, 1.0, DUST, 0.15, ['grow'], 0.7)] },
      { id: 'cue.balbal.slam', vfx: [debris(30, 3.5, 4.5, 1.5, 0.12, TURF, 0.25, fall, 0.5), debris(18, 2.6, 3.5, 1.4, 0.1, SOIL, 0.25, fall, 0.4),
        debris(12, 3.2, 0.3, 1.8, 1.1, DUST, 0.12, ['grow'], 0.6, [0, 0.2, 0]), debris(10, 3.5, 2.5, 0.6, 0.05, AMBER, 0.2, ['gravity'], 0.4, [0, 0.2, 0])] },
      // a ghost rider forms, trails smoke behind its gallop (pushed back along the cue's direction), looses, is struck, tears apart
      { id: 'cue.ghost.form', vfx: [mist(24, 1.6, 0.8, 1.6, 0.9, MIST, 0.25, ['grow', 'rise'], 1.2)] },
      { id: 'cue.ghost.trail', vfx: [mist(1, 0.35, 0.25, 1.15, 0.19, MIST.map(c => c * 0.6), 0, ['grow', 'rise'], 0.35, [0, -0.5, 0], 2.2)] },
      { id: 'cue.ghost.loose', vfx: [mist(6, 0.8, 0.4, 0.5, 0.2, MIST, 0.2, ['grow'], 0.15)] },
      { id: 'cue.ghost.hurt', vfx: [mist(10, 1.5, 0.6, 0.8, 0.25, MIST, 0.2, ['grow'], 0.2)] },
      { id: 'cue.ghost.impact', vfx: [mist(8, 1.2, 1, 0.9, 0.3, MIST, 0.2, ['grow', 'rise'], 0.2)] },
      { id: 'cue.ghost.tear', vfx: [mist(4, 0.6, 1.1, 1.4, 0.55, MIST, 0, ['grow', 'rise'], 0.8, [0, -0.7, 0])] },
    ] };
}
