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


export function wedgeMaterial(): THREE.ShaderMaterial {
  const fill = { value: 0 }, alpha = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { uFill: fill, uAlpha: alpha, uColor: { value: new THREE.Color(2.2, 0.95, 0.2) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // the rim + the edges always; the body fills from the balbal's feet toward the tip as the wind-up runs; a crackle of noise
      fragmentShader: `varying vec2 vUv; uniform float uFill; uniform float uAlpha; uniform vec3 uColor;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float r = vUv.y, e = min(vUv.x, 1.0 - vUv.x);
          float rim = smoothstep(0.93, 1.0, r) + smoothstep(0.035, 0.0, e) * 0.8;
          float fill = smoothstep(uFill + 0.02, uFill - 0.04, r) * (0.22 + 0.25 * r);
          float front = smoothstep(0.05, 0.0, abs(r - uFill)) * 0.7;
          float n = h(floor(vUv * vec2(26.0, 14.0)));
          float a = (rim * 0.75 + fill * (0.7 + 0.3 * n) + front) * uAlpha * smoothstep(0.0, 0.12, r);
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
  mat.name = 'balbal-telegraph';
  return mat;
}

