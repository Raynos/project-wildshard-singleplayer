import { ClampToEdgeWrapping, LinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { PAINTED_STAGES, paintedUrl, type PaintedStage } from '../boot/files';

/**
 * E407 row 5: the painted dusk sky at infinity, one seamless 360° strip per dusk stage (art/sunscar-dunes/round-25-sky:
 * pano.py outpaints them with codex image_gen from the mockups' skies, prep.py crops and sizes them). x = heading (0 =
 * the spawn's forward view, -z; 90 = +x), the strip spans ELEV_TOP down to ELEV_BOTTOM degrees; above it the top row
 * carries on, darkening a little to the zenith. The dome blends the stages by the dusk (look/dusk.ts duskOf: Sefa 0.50,
 * the waymarks 0.62 / 0.74 / 0.86), so the sky deepens with the quest as the procedural dome did.
 */
// round 18: two stages. Sampled at the five mock cameras, the late painting fits every mockup's sky bands best (the first
// early and mid paintings painted the afterglow too tall); early is the late painting re-coloured twenty minutes earlier
// (art/sunscar-dunes/round-25-sky early_fix.py). Early up to Sefa's dusk, late from just past the logbook's (B prefers it).
// round 19 (seat C: the 0.50-0.54 window swapped the whole sky's palette in about 2 s of play): one slow, continuous change
// over the quest; round 20 (seat C: its ends sat on the staged dusks, so no view ever showed a blend): a window of its
// own, wider than the quest's dusks
export const PAINTED = { dusk: [0.35, 0.95] as const, elevTop: 45, elevBottom: -8 } as const;

/** A painted strip as an sRGB texture, decoded off the main thread; null when it cannot be had (offline, a test page). */
async function loadStrip(stage: PaintedStage): Promise<Texture | null> {
  try {
    const response = await fetch(paintedUrl(stage));
    if (!response.ok) throw new Error(`${response.status} ${paintedUrl(stage)}`);
    const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
    const tex = new Texture(bitmap); tex.colorSpace = SRGBColorSpace; tex.name = `sunscar.sky.${stage}`;
    // the heading wraps (no seam at heading 0); the sky is magnified, so no mips
    tex.wrapS = RepeatWrapping; tex.wrapT = ClampToEdgeWrapping; tex.generateMipmaps = false;
    tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.needsUpdate = true;
    return tex;
  } catch (error: unknown) {
    console.warn(`[sunscar-dunes] painted sky ${stage} not loaded:`, error);
    return null;
  }
}

/** The painted stages, or null if any is missing (the procedural dome then stays). */
export async function loadPaintedSky(): Promise<readonly [Texture, Texture] | null> {
  const [early, late] = await Promise.all(PAINTED_STAGES.map(loadStrip));
  if (early && late) return [early, late];
  for (const t of [early, late]) t?.dispose();
  return null;
}

// The dome itself is the emissive family's sky (look/families.ts SKY_ENTRY: these numbers, the strips as its two maps, the
// dusk as its look's blend; SF50 retired this shard's own painted-sky shader under G112).
