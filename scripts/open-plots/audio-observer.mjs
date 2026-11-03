/** Observe actual looping sources without changing routing, gain or clocks. */
export function observeAudioGraph() {
  /** @type {{sources: {node: AudioBufferSourceNode, stopped: boolean, read: () => {loopStart:number,loopEnd:number,duration:number|undefined,stopped:boolean,context:string,gains:number[],pans:number[]}}[], errors:string[]}} */
  const observed = { sources: [], errors: [] };
  Object.defineProperty(window, '__ob7Audio', { value: observed });
  addEventListener('error', event => { if (observed.errors.length < 20) observed.errors.push(event.message); });
  addEventListener('unhandledrejection', event => { if (observed.errors.length < 20) observed.errors.push(String(event.reason)); });
  const links = new WeakMap(), originalConnect = Reflect.get(AudioNode.prototype, 'connect');
  AudioNode.prototype.connect = function connect(node, ...args) {
    const prior = links.get(this) ?? []; prior.push(node); links.set(this, prior);
    return Reflect.apply(originalConnect, this, [node, ...args]);
  };
  const originalStart = Reflect.get(AudioBufferSourceNode.prototype, 'start'), originalStop = Reflect.get(AudioBufferSourceNode.prototype, 'stop');
  AudioBufferSourceNode.prototype.start = function start(...args) {
    if (this.loop && observed.sources.length < 100) {
      observed.sources.push({ node: this, stopped: false, read() {
        const source = this.node;
        const nodes = [], visit = node => {
          if (nodes.includes(node) || nodes.length >= 12) return;
          nodes.push(node); for (const next of links.get(node) ?? []) visit(next);
        };
        visit(source);
        return { loopStart: source.loopStart, loopEnd: source.loopEnd, duration: source.buffer?.duration,
          stopped: this.stopped, context: source.context.state,
          gains: nodes.filter(node => node instanceof GainNode).map(node => node.gain.value),
          pans: nodes.filter(node => node instanceof StereoPannerNode).map(node => node.pan.value) };
      } });
    }
    Reflect.apply(originalStart, this, args);
  };
  AudioBufferSourceNode.prototype.stop = function stop(...args) {
    const row = observed.sources.find(item => item.node === this); if (row) row.stopped = true;
    Reflect.apply(originalStop, this, args);
  };
}

/** Read live bank identities, actual gains/pans and the ordinary music deck. */
export function audioSnapshot() {
  const api = window.__wildshard, world = api.requireWorld(), audio = world.audio, music = world.music;
  const cues = audio.levelBank?.cues.loops ?? new Map(), observed = window.__ob7Audio;
  const loops = observed.sources.filter(row => !row.stopped).map(row => {
    const id = [...cues].find(([, sample]) => sample.buffer === row.node.buffer)?.[0]
      ?? (music.deck?.audio.calm === row.node.buffer ? 'score' : 'other');
    return Object.assign(row.read(), { id });
  });
  return { scoreId: music.scoreId, stems: music.stems, ready: audio.ready, muted: audio.muted,
    position: world.player.position.toArray(), viewport: [innerWidth, innerHeight],
    tier: api.boot.tier, renderScale: world.game.renderer.getPixelRatio(), mode: api.app.clock.mode,
    bank: [...cues.keys()], loops, errors: observed.errors };
}
