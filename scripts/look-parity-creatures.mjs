// The look-parity harnesses' creature shots (scripts/proof-sky-look-parity.mjs, scripts/proof-signal-look-parity.mjs; page code, run through page.evaluate):
// one frame per creature kind on the level, staged so two builds draw the same pixels whatever the herd did while the
// page ran. The page must be gated (no frame advancing). For each kind the first live animal of that kind (spawn order)
// is set on its skeleton's bind pose with a fixed bend per bone (so skin indices and weights move pixels), turned 3/4 to
// a camera high over the level, and drawn alone: every object that is not that animal, its ancestors or a light (and a
// light's ancestors) is hidden for the render and restored after. A creature body's geometry, colours, normals, skin,
// maps and material all reach the frame; the herd's state does not.

/** The kinds on the level, sorted (run in the page). */
export const creatureKinds = () => [...new Set(window.__wildshard.world.animals.animals.filter(a => a.alive && !a.hidden).map(a => a.kind))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** Stage one kind and render it; returns the frame like a pose shot (run in the page). */
export async function creatureShot(kind) {
  const w = window.__wildshard.world, g = w.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene, cam = g.camera;
  const a = w.animals.animals.find(x => x.kind === kind && x.alive && !x.hidden), mesh = a.mesh;
  const saved = [];
  const keep = new Set();
  for (let o = mesh; o !== null; o = o.parent) keep.add(o);
  scene.traverse(o => { if (o.isLight) for (let p = o; p !== null; p = p.parent) keep.add(p); if (o.isLight && o.target) keep.add(o.target); });
  const hide = o => {
    if (o === mesh) return;
    if (!keep.has(o)) { if (o.visible) { o.visible = false; saved.push(o); } return; }
    for (const child of o.children) hide(child);
  };
  hide(scene);
  // a creature the level keeps hidden for now (a dormant boss, a far LOD) is shown for its shot, at its own size: past
  // the tier's animal draw distance the manager shrinks the rig to scale 0 as well as hiding it (AnimalManager's fade;
  // the phone's 150 m hid the Roc and the strider, and their shots came out black)
  const shown = [], size = mesh.scale.clone();
  for (let o = mesh; o !== null; o = o.parent) if (!o.visible) { o.visible = true; shown.push(o); }
  mesh.scale.setScalar(a.scale);
  for (const child of cam.children) if (child.visible) { child.visible = false; saved.push(child); }
  const pose = { position: mesh.position.clone(), quaternion: mesh.quaternion.clone() };
  const bones = mesh.skeleton.bones.map(b => ({ b, p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  mesh.skeleton.pose();
  mesh.skeleton.bones.forEach((b, i) => { b.rotateX(0.12 * Math.sin(i * 1.7)); b.rotateZ(0.1 * Math.cos(i * 2.3)); });
  // the camera high over the level looking north and a little down, the creature framed by its bind-pose sphere
  const THREE_V = cam.position.constructor;
  const eye = new THREE_V(0, 400, 0);
  if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
  const scale = mesh.getWorldScale(new THREE_V()).x, radius = Math.max(0.3, mesh.geometry.boundingSphere.radius * scale);
  const half = Math.tan((cam.fov * Math.PI) / 360), dist = (radius * 1.15) / Math.min(half, half * cam.aspect);
  const at = new THREE_V(0, 400 - dist * 0.25, -dist);
  cam.position.copy(eye); cam.up.set(0, 1, 0); cam.lookAt(at); cam.updateMatrixWorld(true);
  const centre = mesh.geometry.boundingSphere.center.clone().multiplyScalar(scale);
  const local = mesh.parent.worldToLocal(at.clone().sub(centre));
  mesh.position.copy(local); mesh.rotation.set(0, Math.PI * 0.75, 0); mesh.updateMatrixWorld(true);
  scene.traverse(o => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      const u = m.uniforms;
      if (u?.uTime !== undefined && typeof u.uTime.value === 'number') u.uTime.value = 10;
      if (u?.time !== undefined && typeof u.time.value === 'number') u.time.value = 10;
    }
  });
  r.setRenderTarget(null); r.setScissorTest(false);
  const ratio = r.getPixelRatio(); r.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
  r.clear(true, true, true); r.render(scene, cam);
  r.info.reset(); r.clear(true, true, true); r.render(scene, cam);
  const calls = r.info.render.calls, triangles = r.info.render.triangles;
  const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  for (const o of saved) o.visible = true;
  for (const o of shown) o.visible = false;
  for (const { b, p, q, s } of bones) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); }
  mesh.position.copy(pose.position); mesh.quaternion.copy(pose.quaternion); mesh.scale.copy(size); mesh.updateMatrixWorld(true);
  let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 0) lit++;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
  let bin = ''; for (let i = 0; i < pixels.length; i += 0x8000) bin += String.fromCodePoint(...pixels.subarray(i, i + 0x8000));
  return { player: [Math.round(scale * 1000) / 1000, mesh.skeleton.bones.length, 0], width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, calls, triangles, lit, pixels: Array.from(digest, x => x.toString(16).padStart(2, '0')).join(''), data: btoa(bin) };
}
