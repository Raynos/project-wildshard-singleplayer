(async () => {
  const g = window.__wildshard.world.game, gate = g.frameGate, delta = g.clock.getDelta, noiseFrame = Reflect.get(g.volumetrics, 'frame'), owner = g.engineScope.child('sf62-pixel-proof');
  g.frameGate = () => false; g.clock.getDelta = () => 0;
  async function pixels() {
    Reflect.set(g.volumetrics, 'frame', noiseFrame);
    const canvas = g.snapshot(402);
    if (!canvas) throw new Error('Snapshot unavailable');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const hash = await crypto.subtle.digest('SHA-256', data);
    return { width: canvas.width, height: canvas.height, hash: Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('') };
  }
  try {
    const before = await pixels(), repeat = await pixels();
    await g.warmEnteredFrame(owner);
    const after = await pixels(), afterRepeat = await pixels();
    return { before, repeat, after, afterRepeat, match: [repeat, after, afterRepeat].every(value => value.hash === before.hash) };
  } finally { owner.dispose(); g.frameGate = gate; g.clock.getDelta = delta; Reflect.set(g.volumetrics, 'frame', noiseFrame); }
})()
