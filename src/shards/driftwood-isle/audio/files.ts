import { loadAudio, type LevelAudioProfile } from '#engine';

const SET = 'driftwood-isle', BED = 'island';
const SAMPLES = { loopGains: { island: 0.5 } };
type Ports = Awaited<ReturnType<typeof loadAudio>>;
type SfxBank = Awaited<ReturnType<Ports['decodeSfxSet']>>;

/** The selected base set plus the island's same-byte takes. Synth selects neither sampled set. */
async function samples(ports: Ports, set: Parameters<Ports['decodeSfxSet']>[0],
  read: Parameters<Ports['decodeSfxSet']>[2], decode: Parameters<Ports['decodeSfxSet']>[4], onFile?: () => void): Promise<SfxBank> {
  const [base, own] = await Promise.all([
    ports.decodeSfxSet(set, BED, read, onFile, decode, SAMPLES),
    ports.decodeSfxSet(set === 'synth' ? 'synth' : SET, BED, read, onFile, decode, SAMPLES),
  ]);
  // Keep the original selected-bed/common-loop order for diagnostics; each family retains its variant order.
  const loops = new Map([...base.loops, ...own.loops]);
  base.loops.clear();
  for (const name of ['island', 'underwater', 'pickup', 'shrine']) { const loop = loops.get(name); if (loop) base.loops.set(name, loop); }
  for (const [id, loop] of loops) if (!base.loops.has(id)) base.loops.set(id, loop);
  for (const [id, shot] of own.shots) base.shots.set(id, shot);
  return base;
}

export async function driftwoodSampleDecoder(): Promise<(set: Parameters<Ports['decodeSfxSet']>[0]) => Promise<SfxBank>> {
  const ports = await loadAudio();
  return (set) => samples(ports, set, ports.cachedBytes, ports.decodeBytes);
}

/** Preserve every base-style download and decode only title + island for the selected style. */
export async function createDriftwoodAudio(): Promise<LevelAudioProfile> {
  const ports = await loadAudio();
  const selectedSfx = (): string[] => [...ports.sfxFiles(ports.getSfxSet(), BED, SAMPLES),
    ...(ports.getSfxSet() === 'synth' ? [] : ports.sfxFiles(SET, BED, SAMPLES))];
  return {
    files: () => ports.audioFiles({ sfxSets: [SET] }),
    bootFiles: (style) => [...ports.styleFiles(style, ['title', 'island']), ...selectedSfx()],
    decode: async (style, read, decode, onFile) => {
      const [title, bank] = await Promise.all([
        ports.decodeStyle(style, ['title', 'island'], read, decode, onFile).catch(() => undefined),
        samples(ports, ports.getSfxSet(), read, decode, onFile),
      ]);
      return { title, samples: bank, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } };
    },
  };
}

export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createDriftwoodAudio()).files();
  return [...files.music, ...files.sfx];
}
