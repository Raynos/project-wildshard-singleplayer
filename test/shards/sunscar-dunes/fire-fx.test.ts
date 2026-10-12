import { describe, expect, it } from 'vitest';
import { Group, Mesh, Points, Vector3, type ShaderMaterial } from 'three';
import { createFireFx, type FireStyle } from '../../../src/shards/sunscar-dunes/runtime/looks/fireFx';
import { FIRE_STYLE, WAYMARK_FIRE, COOKFIRE } from '../../../src/shards/sunscar-dunes/data/fire';
// The seven fire materials as Signal Dunes' own code built them before its fires became rows (HEAD c08ce5e69, world/fireFx.ts).
import before from './fire-shaders.json' with { type: 'json' };

/** GLSL as the compiler reads it: comments dropped, whitespace collapsed. */
const glsl = (source: string): string => source.replaceAll(/\/\/[^\n]*/gu, '').replaceAll(/\s+/gu, ' ').trim();
const NAMES = ['flame', 'smoke', 'wisp', 'glow', 'lampGlow', 'ember', 'pool'] as const;
const materials = (fx: ReturnType<typeof createFireFx>): ShaderMaterial[] => fx.resources.slice(0, 7).filter((r): r is ShaderMaterial => 'fragmentShader' in r);

/** A second look on the same effect: a cold blue spirit flame on its own flipbook (the system is generic, the look is data). */
const SPIRIT: FireStyle = {
  breeze: [0.6, 0.8], book: { url: '/spirit-book.webp', columns: 4, rows: 4, fps: 12, name: 'spirit.book' }, bookGrade: { power: [1.6, 1.1, 0.8], tint: [0.05, 0.2, 0.9], core: 2 },
  flame: { drift: { lean: 0.02, widen: 0, sway: 0.4 } },
  plume: { drift: { lean: 0.1, widen: 1, sway: 0.2 }, foot: [0.1, 0.12, 0.2], top: [0.02, 0.02, 0.03], fade: 0.3, alpha: 0.6 },
  wisp: { drift: { lean: 0.01, widen: 3, sway: 1 }, foot: [0.2, 0.2, 0.25], top: [0.1, 0.1, 0.12], fade: 0.4, alpha: 0.4 },
  glow: { colour: [0.2, 0.5, 1], gain: 0.2, lampGain: 0.5 }, embers: { hot: [0.6, 0.9, 1], cool: [0.1, 0.2, 0.8], gain: 1 },
  pool: { colour: [0.1, 0.3, 1], wide: 0.05, hot: 0.2 },
};

describe('the platform fire effect runs a shard\'s fires from rows (SHARD-PLATFORM SF72, effect rows)', () => {
  it('Signal Dunes\' style compiles to exactly the shaders its own code built (pixel parity by construction)', () => {
    const got = materials(createFireFx(FIRE_STYLE));
    expect(got).toHaveLength(7);
    NAMES.forEach((name, i) => {
      const m = got[i], want = before[name];
      if (m === undefined) throw new Error(`missing ${name}`);
      expect([m.blending, m.depthWrite, m.transparent]).toEqual([want.blending, want.depthWrite, want.transparent]);
      expect(glsl(m.vertexShader)).toBe(glsl(want.vertexShader));
      // G345: the flame is its flipbook alone (the procedural fallback drew only while the book was missing)
      if (name !== 'flame') { expect(glsl(m.fragmentShader)).toBe(glsl(want.fragmentShader)); return; }
      const book = /if \(uHasBook > 0\.5\) \{(.*?) return; \}/u.exec(glsl(want.fragmentShader))?.[1];
      expect(book).toBeDefined();
      expect(glsl(m.fragmentShader)).toContain(`if (uHasBook < 0.5) discard;${book ?? ''} }`);
      expect(m.fragmentShader).not.toContain('fxNoise');
    });
  });

  it('a second style draws the same parts in its own look, and each instance owns its clock and lights', () => {
    const spirit = createFireFx(SPIRIT), signal = createFireFx(FIRE_STYLE);
    const [flame] = materials(spirit);
    expect(flame?.fragmentShader).toContain('vec3(0.05, 0.2, 0.9)');
    expect(flame?.fragmentShader).not.toContain('vec3(1.2, 0.95, 0.75)');
    const group = new Group(), parts = spirit.addFire(group, WAYMARK_FIRE, { at: new Vector3(0, 1, 0), groundAt: () => 0.5 });
    // four flame quads, the glow, the embers, the smoke, the pool
    expect([parts.length, parts.filter((p) => p instanceof Points).length, group.children.length]).toEqual([8, 1, 8]);
    expect(spirit.addFire(new Group(), COOKFIRE).map((p) => p instanceof Mesh && p.material === materials(spirit)[2])).toContain(true);
    const on = spirit.fireLight(new Vector3(1, 2, 3)); on(true, 0.5);
    expect([spirit.lights.value[0]?.toArray(), signal.lights.value[0]?.toArray()]).toEqual([[1, 2, 3, 0.5], [0, 0, 0, 1]]);
    spirit.resetLights(); expect(spirit.lights.value[0]?.w).toBe(0);
  });
});
