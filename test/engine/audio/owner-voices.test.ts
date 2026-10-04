import { describe, expect, it } from 'vitest';
import { Audio } from '../../../src/engine/audio/Audio';
import { Scope } from '../../../src/engine/app/scope';
import { tap } from '../../../src/engine/core/harnessTap';
import { SteppeVoices, STEPPE_BED } from '../../../src/shards/nalati-grasslands/runtime/audio/synth';

// S3.5 (07 §6.5 A.3 / E): Nalati's synth voices left the engine mixer; the mixer keeps only the mechanisms.
describe('owner voices on the engine mixer', () => {
  it('a level synth bed is scope-bound: disposal unregisters it and stops its schedulers', () => {
    const audio = new Audio(), scope = new Scope('owner-voices');
    let stops = 0;
    audio.installSynthBed('test-bed', { start: () => undefined, stop: () => { stops++; } }, scope);
    audio.setAmbient('test-bed');
    expect(audio.bedId).toBe('test-bed');
    scope.dispose();
    expect(stops).toBe(1);
    scope.dispose();
    expect(stops).toBe(1);
  });

  it("the steppe's call table keeps the old reach / gap per call and samples its hooves per ground", () => {
    const voices = new SteppeVoices(new Audio());
    const table = voices.callTable(() => 'grass');
    expect(Object.keys(table).sort()).toEqual(['dog_bark', 'dog_yelp', 'eagle_cry', 'hoofsteps', 'horse_neigh', 'horse_snort', 'horse_squeal',
      'leopard_growl', 'marmot_whistle', 'sheep_bleat', 'wolf_bite', 'wolf_howl', 'wolf_snarl', 'wolf_yelp', 'wolf_yip']);
    const reach = Object.fromEntries(Object.entries(table).filter(([, v]) => v.reach).map(([k, v]) => [k, v.reach]));
    expect(reach).toEqual({ wolf_howl: [700, 60], horse_neigh: [260, 22], dog_bark: [220, 20], marmot_whistle: [180, 16], sheep_bleat: [160, 12], horse_squeal: [200, 18], eagle_cry: [420, 34] });
    const gap = Object.fromEntries(Object.entries(table).filter(([, v]) => v.gap !== undefined).map(([k, v]) => [k, v.gap]));
    expect(gap).toEqual({ wolf_howl: 5, wolf_snarl: 0.6, wolf_yip: 0.5, wolf_yelp: 0.25, horse_neigh: 2.2, horse_snort: 0.7, horse_squeal: 0.9, dog_bark: 0.7, dog_yelp: 0.4, sheep_bleat: 0.35, marmot_whistle: 0.9 });
    expect(table['hoofsteps']?.sampled).toBe(false);
    expect(Object.values(table).filter((v) => v.sampled === false)).toHaveLength(1);
    expect(STEPPE_BED).toBe('steppe');
  });

  it('every steppe voice keeps its literal tap before the gesture (no context is created)', () => {
    const ids: string[] = [];
    tap.sound = (id) => { ids.push(id); };
    try {
      const audio = new Audio(), voices = new SteppeVoices(audio);
      voices.thunder(100); voices.lightningCrackle(); voices.stampede(10); voices.bowTwang(1); voices.arrowWhoosh(); voices.bowDraw();
      voices.bowFullDraw(); voices.bowLetDown(); voices.arrowImpact('wood'); voices.javelinThrow(); voices.javelinImpact('flesh');
      voices.sabreSwing(); voices.sabreHit('flesh'); voices.spearThrust(); voices.setStorm(1, 1);
      expect(audio.ready).toBe(false);
    } finally { tap.sound = null; }
    expect(ids).toEqual(['thunder', 'lightningCrackle', 'stampede', 'bowTwang', 'arrowWhoosh', 'bowDraw', 'bowFullDraw', 'bowLetDown',
      'arrowImpact:wood', 'javelinThrow', 'javelinImpact:flesh', 'sabreSwing', 'sabreHit:flesh', 'spearThrust']);
  });
});
