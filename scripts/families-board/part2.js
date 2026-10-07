// SF10a part 2's panels for the material-family board (SHARD-PLATFORM §4 F1 SF10a). A MEASUREMENT TOOL, NOT GAME CODE:
// bundled with board.js by run.mjs. Each panel draws one shard's look TODAY (the shard's own material or full-screen
// pass) and FAMILY (the engine's painterly / emissive / PBR-ground family from renderer-neutral parameters), under the same
// light, camera and display. Signal Dunes and Nine Dragon render to a half-float target and go through one fixed display
// (AgX + sRGB, three's OutputPass) on both sides, so their shards' frame composites (Nine Dragon's Jiehua composite) are
// left out of both; Nalati's today side is its real chain (RenderPass → the v2 grade), its family side has no pass at all.
import * as THREE from 'three';
import { EffectComposer as PpComposer } from 'postprocessing';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Scope } from '@wildshard/engine/app/scope';
import { paintGeometry, painterlyMaterial, painterlyUniforms, setPainterlyLook } from '@wildshard/engine/world/painterly';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { PainterlyLook } from '@wildshard/engine/render/families/painterly';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { familyCompileJobs, familyMaterial } from '@wildshard/engine/render/families/registry';
import { lookV2Passes, ungrade } from '../../src/shards/nalati-grasslands/look/grade';
import { Shared } from '../../src/shards/nine-dragon-stack/look/style';
import { GlyphAtlas } from '../../src/shards/nine-dragon-stack/look/glyphs';
import { NeonSigns, NEON_LOOK } from '../../src/shards/nine-dragon-stack/look/neonsigns';
import { chars } from '../../src/shards/nine-dragon-stack/util';

/** @param {THREE.WebGLRenderer} renderer @param {number} size */
export function part2(renderer, size) {
  const programs = () => (renderer.info.programs ?? []).length;
  const shot = (draw) => {
    draw();
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    if (g === null) throw new Error('no 2d context');
    g.drawImage(renderer.domElement, 0, 0);
    return { url: c.toDataURL('image/png'), pixels: g.getImageData(0, 0, size, size).data };
  };
  const compare = (a, b) => {
    let sum = 0, sq = 0, over = 0, max = 0;
    const n = a.length / 4;
    for (let i = 0; i < a.length; i += 4) {
      let px = 0;
      for (let k = 0; k < 3; k++) { const d = Math.abs((a[i + k] ?? 0) - (b[i + k] ?? 0)); sum += d; sq += d * d; px = Math.max(px, d); }
      if (px > 8) over++;
      max = Math.max(max, px);
    }
    const mse = sq / (n * 3);
    return { mean: Math.round((sum / (n * 3)) * 1000) / 1000, over8: Math.round((over / n) * 10000) / 100, max, psnr: mse === 0 ? Infinity : Math.round(10 * Math.log10((255 * 255) / mse) * 10) / 10 };
  };
  /** the shader step's family jobs, then what the first family draw still compiles */
  const precompiled = (scene, camera, draw, rt = null) => {
    const jobs = familyCompileJobs(scene, rt);
    const before = programs();
    for (const job of jobs) { renderer.setRenderTarget(job.rt); renderer.compile(job.root, camera, job.target ?? undefined); }
    renderer.setRenderTarget(null);
    const built = programs() - before, atDraw = programs();
    const frame = draw();
    const fresh = (renderer.info.programs ?? []).slice(atDraw).map((p) => p.name);
    return { frame, reading: { familyJobs: jobs.length, built, firstDraw: programs() - atDraw, fresh } };
  };
  /** one fixed display for both sides: half-float target → AgX + sRGB */
  const display = (scene, camera) => {
    renderer.toneMapping = THREE.AgXToneMapping;
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, samples: 4 }));
    composer.setPixelRatio(1); composer.setSize(size, size);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    // opaque out: Nine Dragon's programs write a silhouette depth into alpha for their composite, which is not drawn here
    composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }' }));
    const draw = () => composer.render();
    draw.rt = composer.readBuffer;
    return draw;
  };
  /** Nalati: a camp still life under its painterly material + the v2 grade pass, then the painterly family (grade in the material) */
  function painterly() {
    renderer.toneMapping = THREE.NoToneMapping;
    const SHADE = [0.1, 0.16, 0.36], RIM = [1.5, 1.28, 0.95];
    setPainterlyLook({ shadeTint: new THREE.Color(...SHADE), rimColor: new THREE.Color(...RIM), wind: { x: 1, z: 0.35, strength: 1 } });
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.85, 0.64), 3.0);
    sun.position.set(-7, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    scene.add(sun, new THREE.HemisphereLight(new THREE.Color(0.55, 0.62, 0.85), new THREE.Color(0.32, 0.3, 0.16), 1.0));
    painterlyUniforms.uPSunRef.value.copy(sun.color).multiplyScalar(sun.intensity);
    painterlyUniforms.uPSunDir.value.copy(sun.position).normalize();
    const SKY = new THREE.Color('#a9c4dc'); // the painting's sky: today the scene writes its ungraded value, the grade maps it back
    const parts = [];
    const add = (geo, opts, at, cast = true) => { const m = new THREE.Mesh(geo, painterlyMaterial(null, opts)); m.position.set(...at); m.castShadow = cast; m.receiveShadow = true; scene.add(m); parts.push([m, opts]); return m; };
    add(paintGeometry(new THREE.PlaneGeometry(40, 40, 40, 40).rotateX(-Math.PI / 2), '#8f9a4c', 0.12, 3), { bands: 0.45, rim: 0 }, [0, 0, 0], false);
    // a yurt: felt walls with a red band, a dome roof, a dark door
    const wall = paintGeometry(new THREE.CylinderGeometry(2.1, 2.2, 1.6, 28, 3, true), '#ece2cc', 0.05, 5);
    const col = wall.getAttribute('color'), pos = wall.getAttribute('position');
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i)) < 0.3) col.setXYZ(i, 0.62, 0.1, 0.07);
    add(wall, { rim: 0.35 }, [0.6, 0.8, -1.2]);
    add(paintGeometry(new THREE.SphereGeometry(2.25, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), '#e4d8bd', 0.04, 7), { rim: 0.35 }, [0.6, -0.69, -1.2]).scale.set(1, 1.9, 1); // the cap's rim (2.29 m up once scaled) sits on the wall's top
    add(paintGeometry(new THREE.BoxGeometry(0.8, 1.2, 0.1), '#3a2418', 0.05, 9), { rim: 0.2 }, [1.35, 0.6, 0.75]).rotation.y = 0.35;
    // a dark boulder (the painted floor keeps it off black), a spruce that sways, a red chest
    add(paintGeometry(new THREE.DodecahedronGeometry(0.9, 1), '#2f3540', 0.18, 11), { rim: 0.5, bands: 0.85 }, [-2.4, 0.5, 1.4]).scale.set(1.3, 0.8, 1);
    const spruce = new THREE.ConeGeometry(0.9, 3.2, 9, 4).translate(0, 1.6, 0);
    add(paintGeometry(spruce, '#3f6b3a', 0.12, 13), { sway: 0.02, rim: 0.4 }, [-3.4, 0, -3.4]);
    add(paintGeometry(new THREE.BoxGeometry(0.9, 0.55, 0.55), '#9a2a1c', 0.06, 15), { rim: 0.6, bands: 0.85 }, [-0.6, 0.28, 1.9]).rotation.y = -0.4;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(-1.2, 2.6, 8.2); camera.lookAt(0.2, 1.1, -0.6);

    scene.background = new THREE.Color().setRGB(...ungrade([SKY.r, SKY.g, SKY.b]));
    const composer = new PpComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    composer.setSize(size, size, false);
    for (const p of lookV2Passes({ scene, camera, tier: 'phone' })) composer.addPass(p);
    const today = shot(() => composer.render());

    // the family side: no pass; every painterly material → the painterly family with the same knobs; the grade in the material
    const look = new PainterlyLook({ shade: SHADE, rim: RIM, wind: { direction: [1, 0.35], strength: 1 } });
    const scope = new Scope('families-board-2');
    const fctx = { toon: new ToonLook(), painterly: look, textures: () => { throw new Error('no maps here'); }, scope };
    const notes = [];
    for (const [mesh, opts] of parts) {
      mesh.material = familyMaterial({ family: 'painterly', rim: opts.rim ?? 0.35, bands: opts.bands ?? 0.8, sway: opts.sway ?? 0 }, fctx);
    }
    notes.push(`${parts.length} painterly materials -> the painterly family; grade: Nalati's v2 numbers as GradeSchema defaults`);
    scene.background = SKY.clone();
    const { frame, reading } = precompiled(scene, camera, () => shot(() => renderer.render(scene, camera)));
    look.set({ grade: { ...look.params.grade, saturation: 1, shadowTint: [1, 1, 1], lightTint: [1, 1, 1], contrast: 0 } });
    const control = compare(today.pixels, shot(() => renderer.render(scene, camera)).pixels);
    notes.push(`control (family grade with saturation, split and S-curve off): mean ${control.mean}, ${control.over8}% of pixels off by > 8`);
    scope.dispose();
    return { today: today.url, family: frame.url, diff: compare(today.pixels, frame.pixels), precompile: reading, notes };
  }

  /** Nine Dragon: a neon calligraphy sign's tubes, its own SDF program, then the emissive family's tube (the board stays its own) */
  function neon() {
    const shared = new Shared();
    const atlas = new GlyphAtlas(chars('重慶小麵'), 'phone');
    const signs = new NeonSigns(shared, atlas);
    const gain = (5 / 4.4) * 4.2;
    const g = signs.one({ text: '重慶小麵', color: '#ff3b30', vertical: false, em: 0.5, at: new THREE.Vector3(0, 1.6, 0), facing: new THREE.Vector3(0, 0, 1), gain });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141a26);
    const board = new THREE.Mesh(g.boards, signs.boardMat);
    const tubes = new THREE.Mesh(g.tubes, signs.tubeMat); tubes.renderOrder = 5;
    scene.add(board, tubes);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0.25, 1.75, 3.3); camera.lookAt(0, 1.6, 0);
    // the silk fog clears within 4 m of the eye (style.ts silkFog): the sign is in clear air on both sides
    shared.u.uCam.value.copy(camera.position); shared.u.uNear.value = camera.near; shared.u.uRes.value.set(size, size);
    const draw = display(scene, camera);
    const today = shot(draw);

    // the family side: the tubes' quads with standard attributes (uv = the atlas cell, colour = the tint), the emissive family
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', g.tubes.getAttribute('position'));
    fg.setAttribute('uv', g.tubes.getAttribute('aAtlas'));
    const tint = g.tubes.getAttribute('aTint'), cols = new Float32Array(tint.count * 3);
    for (let i = 0; i < tint.count; i++) { cols[i * 3] = tint.getX(i); cols[i * 3 + 1] = tint.getY(i); cols[i * 3 + 2] = tint.getZ(i); }
    fg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    fg.setIndex(g.tubes.getIndex());
    fg.computeVertexNormals(); // a shardfile mesh carries normals (the family's stand-in program assumes them)
    const L = NEON_LOOK, lay = atlas.layout;
    const scope = new Scope('families-board-2');
    const look = new EmissiveLook();
    const fctx = { toon: new ToonLook(), emissive: look, textures: (ref) => { if (ref !== 'nd:glyphs') throw new Error(ref); return atlas.texture; }, scope };
    tubes.geometry = fg;
    tubes.material = familyMaterial({ family: 'emissive', blend: 'additive', vertexColours: true, intensity: gain, fog: 0.5,
      tube: { field: 'nd:glyphs', fillSpread: lay.spread / lay.fontPx, skeletonSpread: lay.skeletonSpread / lay.fontPx, mono: L.mono, radius: L.tubeRadius, rim: L.rim, thicken: L.thicken, seam: L.seam, seamWidth: L.seamWidth, haloReach: L.haloReach, haloGain: L.haloGain, cell: [lay.cell / atlas.size, lay.cell / atlas.size] } }, fctx);
    const { frame, reading } = precompiled(scene, camera, () => shot(draw), draw.rt);
    const notes = [`tubes: ${tint.count / 4} glyph quads; board, frame tube and rivets: Nine Dragon's own board program on both sides`];
    look.set({ gain: 0.5 });
    const control = compare(today.pixels, shot(draw).pixels);
    notes.push(`control (family look gain 0.5): mean ${control.mean}, ${control.over8}% of pixels off by > 8`);
    scope.dispose();
    return { today: today.url, family: frame.url, diff: compare(today.pixels, frame.pixels), precompile: reading, notes };
  }

  // (SF50 retired Signal Dunes' own sky and sand shaders under G112: the shard now draws the emissive family's sky and the PBR
  // family's ground layer, so their today-vs-family rows are history in progress/families/sf10a-painterly-emissive.jpg)

  return { painterly, neon };
}
