(() => {
  const w = window.__world ?? window.__wildshard?.world, cam = w.game.camera;
  if (window.__weather?.clock) window.__weather.clock.paused = true;
  window.__cv = null;
  const hook = typeof w.game.onLate === 'function' ? w.game.onLate.bind(w.game) : w.game.onUpdate.bind(w.game);
  hook(() => {
    const v = window.__cv; if (!v) return;
    cam.position.set(v.cam[0], v.cam[1], v.cam[2]); cam.lookAt(v.at[0], v.at[1], v.at[2]);
    const f = v.fov || 60;
    if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.far = Math.max(cam.far, 6000); cam.updateProjectionMatrix(); }
    for (const c of cam.children) c.visible = false;
  });
  // v: { cam, at, fov, fp } — fp: heights are metres over the ground under cam (read after player.spawn settles)
  window.__ground = 0;
  window.__pose = (v, spawn) => {
    if (spawn) w.player.spawn(v.cam[0], v.cam[2], 0);
    if (spawn || v.fp) window.__ground = v.fp ? w.player.position.y : 0;
    const y = window.__ground;
    window.__cv = { ...v, cam: [v.cam[0], y + v.cam[1], v.cam[2]], at: [v.at[0], y + v.at[1], v.at[2]] };
    return Math.round(w.player.position.y * 10) / 10;
  };
  return Object.keys(w).length;
})()
