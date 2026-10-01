import * as THREE from 'three';
import { median } from '../calibrate/math';

export interface Timing { submitMs: number; throughputMs: number; samples: number[]; calls: number; tris: number }
export interface Work { draw: () => void; dispose: () => void }
export class CalibrationGpu {
  readonly renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  private readonly pixel = new Uint8Array(4);
  constructor() {
    this.renderer.setPixelRatio(2); this.renderer.setSize(402, 874);
    this.camera.position.z = 10;
    this.renderer.info.autoReset = false;
  }
  sync(): void {
    const r = this.renderer, gl = r.getContext();
    // A pending write followed by readPixels is the Metal ruler's real sync; gl.finish is ineffective in ANGLE.
    r.setRenderTarget(null); r.setScissor(0, 0, 1, 1); r.setScissorTest(true); r.clear(); r.setScissorTest(false);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);
  }
  measure(work: Work): Timing {
    const r = this.renderer; work.draw(); this.sync();
    const submit: number[] = [], samples: number[] = [];
    for (let repeat = 0; repeat < 5; repeat++) {
      r.info.reset(); this.sync(); const start = performance.now();
      for (let i = 0; i < 128; i++) work.draw();
      const cpu = (performance.now() - start) / 128; this.sync();
      submit.push(cpu); samples.push((performance.now() - start) / 128);
    }
    return { submitMs: median(submit), throughputMs: median(samples), samples, calls: r.info.render.calls / 128, tris: r.info.render.triangles / 128 };
  }
  sceneWork(scene: THREE.Scene, disposables: { dispose: () => void }[]): Work {
    return { draw: () => { this.renderer.setRenderTarget(null); this.renderer.render(scene, this.camera); }, dispose: () => { for (const d of disposables) d.dispose(); } };
  }
  draws(n: number, programs = 1, textures = 1): Work {
    const scene = new THREE.Scene(), geo = new THREE.PlaneGeometry(0.005, 0.005), maps: THREE.DataTexture[] = [], materials: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < textures; i++) { const map = new THREE.DataTexture(new Uint8Array([i, 160, 200, 255]), 1, 1); map.needsUpdate = true; maps.push(map); }
    for (let i = 0; i < Math.max(programs, textures); i++) { const mat = new THREE.MeshBasicMaterial({ map: maps[i % textures] ?? null }); mat.defines = { CALIBRATION_PROGRAM: i % programs }; materials.push(mat); }
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, materials[i % materials.length]); m.position.set(-0.9 + (i % 40) / 22, -0.9 + Math.floor(i / 40) / 12, 0); m.frustumCulled = false; scene.add(m); }
    return this.sceneWork(scene, [geo, ...maps, ...materials]);
  }
  triangles(n: number, kind: 'static' | 'wind' | 'skinned'): Work {
    const scene = new THREE.Scene(), geo = new THREE.PlaneGeometry(0.012, 0.012, 128, 128), count = Math.ceil(n / (128 * 128 * 2));
    const vertex = `varying vec2 vUv;
      void main() { vUv=uv; vec3 p=position;
        ${kind === 'wind' ? 'p.x += sin(p.y * 19. + 0.7) * 0.002;' : ''}
        ${kind === 'skinned' ? 'p = (skinA * vec4(p,1.) * 0.6 + skinB * vec4(p,1.) * 0.4).xyz;' : ''}
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.); }`;
    const mat = new THREE.ShaderMaterial({ uniforms: { skinA: { value: new THREE.Matrix4() }, skinB: { value: new THREE.Matrix4().makeRotationY(0.2) } },
      vertexShader: `uniform mat4 skinA; uniform mat4 skinB; ${vertex}`, fragmentShader: 'varying vec2 vUv; void main(){gl_FragColor=vec4(vUv,0.5,1.);}', side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, count), matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, matrix.makeTranslation(-0.8 + (i % 16) / 10, -0.8 + Math.floor(i / 16) / 10, 0));
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; scene.add(mesh);
    return this.sceneWork(scene, [geo, mat, mesh]);
  }
  fill(n: number, kind: 'flat' | 'toon' | 'pbr' | 'alphaTest' | 'blend'): Work {
    const scene = new THREE.Scene(), geo = new THREE.PlaneGeometry(2, 2), tex = new THREE.DataTexture(new Uint8Array([180, 160, 130, 200]), 1, 1); tex.needsUpdate = true;
    const opts = { depthTest: false, depthWrite: false, map: tex };
    const mat = kind === 'pbr' ? new THREE.MeshStandardMaterial({ ...opts, roughness: 0.6, metalness: 0.3 }) : kind === 'toon' ? new THREE.MeshToonMaterial(opts) : new THREE.MeshBasicMaterial({ ...opts, alphaTest: kind === 'alphaTest' ? 0.5 : 0, transparent: kind === 'blend' });
    scene.add(new THREE.AmbientLight(0xffffff, 0.8), new THREE.DirectionalLight(0xffffff, 2));
    for (let i = 0; i < n; i++) { const mesh = new THREE.Mesh(geo, mat); mesh.position.z = i * 0.01; scene.add(mesh); }
    return this.sceneWork(scene, [geo, tex, mat]);
  }
  passes(n: number, scale: number, halfFloat: boolean): Work {
    const a = new THREE.WebGLRenderTarget(Math.round(804 * scale), Math.round(1748 * scale), { type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false });
    const b = a.clone(), scene = new THREE.Scene(), geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicMaterial({ map: a.texture, depthTest: false, depthWrite: false }); scene.add(new THREE.Mesh(geo, mat));
    return { draw: () => { for (let i = 0; i < n; i++) { mat.map = i % 2 === 0 ? a.texture : b.texture; this.renderer.setRenderTarget(i % 2 === 0 ? b : a); this.renderer.render(scene, this.camera); } this.renderer.setRenderTarget(null); }, dispose: () => { geo.dispose(); mat.dispose(); a.dispose(); b.dispose(); } };
  }
  async link(n: number): Promise<number> {
    const scene = new THREE.Scene(), geo = new THREE.PlaneGeometry(1, 1), mats: THREE.ShaderMaterial[] = [];
    for (let i = 0; i < n; i++) { const mat = new THREE.ShaderMaterial({ vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `void main(){gl_FragColor=vec4(${(i / (n + 1)).toFixed(6)},0.2,0.4,1.);}` }); mats.push(mat); scene.add(new THREE.Mesh(geo, mat)); }
    const t = performance.now(); await this.renderer.compileAsync(scene, this.camera); const ms = performance.now() - t;
    geo.dispose(); for (const m of mats) m.dispose(); return ms;
  }
  dispose(): void { this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); }
}
