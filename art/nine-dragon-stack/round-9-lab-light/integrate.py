#!/usr/bin/env python3
"""integrate.py <clean-room dir> <modules import prefix> — lab P6 "light" (E169): applies the light + grade hooks to a copy
of the clean room (src/dev/nine-dragon at HEAD 3c39b36f). Every hunk is anchored on text that must match exactly once,
so a drifted clean room fails loudly instead of half-patching.

  lab:   python3 art/nine-dragon-stack/round-9-lab-light/integrate.py src/dev/nd-lab/light/room .. --lab
  merge: copy src/dev/nd-lab/light/{lightvol,pools,glow,grade,lab}.ts into src/dev/nine-dragon/light/, then
         python3 art/nine-dragon-stack/round-9-lab-light/integrate.py src/dev/nine-dragon ./light

<modules import prefix> is the import path from the clean room's root to the modules ('..' in the lab, './light' when
merged); facade/material.ts gets one more '../'.
"""
import sys
from pathlib import Path

root, pre = Path(sys.argv[1]), sys.argv[2]
# the same modules seen from facade/, one level down
sub = '../' + pre[2:] if pre.startswith('./') else '../' + pre


def patch(rel, pairs):
    p = root / rel
    s = p.read_text()
    for a, b in pairs:
        n = s.count(a)
        if n != 1:
            sys.exit(f'{rel}: anchor found {n}× (want 1):\n{a}')
        s = s.replace(a, b)
    p.write_text(s)
    print('patched', rel)


# ── style.ts: the light volume's uniforms + GLSL, the wet film's sky sheen, the ambient, the pools ──
patch('style.ts', [
    ("import { METAL, Rng, SUTRA } from './util';",
     f"import {{ METAL, Rng, SUTRA }} from './util';\n// LIGHT LAB (P6): the baked light volume (warm pools from every lantern, shop, lamp, sign and lit window)\nimport {{ LIGHTVOL_GLSL, lightVolUniforms }} from '{pre}/lightvol';"),
    ("    uGroundY: { value: 0 },\n  };", "    uGroundY: { value: 0 },\n    ...lightVolUniforms(),\n  };"),
    ("${PAPER_GLSL}\n${STONES_GLSL}\nfloat bit(", "${PAPER_GLSL}\n${STONES_GLSL}\n${LIGHTVOL_GLSL}\nfloat bit("),
    ("  float wet = vMisc.z;\n", "  float wet = vMisc.z;\n  float wetPool = 0.0;\n"),
    ("    float wAmt = wet * mix(0.55, 1.0, st.z);\n", "    float wAmt = wet * mix(0.55, 1.0, st.z);\n    wetPool = wAmt * (1.0 - st.x);\n"),
    ("    emit += fogCol(vWorld) * fres * wAmt * 0.3 * (1.0 - st.x);\n",
     "    emit += fogCol(vWorld) * fres * wAmt * 0.3 * (1.0 - st.x);\n"
     "    // LIGHT LAB: + the water film's reflection of the blue-hour SKY (uFogBaseCol: fogCol() is ~black inside the first\n"
     "    // 16 m of clear air, so the near ground never got a sheen) over a broader lobe than Schlick; uLpSky 0 = off\n"
     "    emit += uFogBaseCol * (0.35 + 0.65 * pow(clamp(1.0 - ndv, 0.0, 1.0), 3.0)) * wAmt * uLpSky * (1.0 - st.x);\n"),
    ("  shaded += col * min(vSpill, vec3(0.7)) * 1.3 * (kind == 3.0 ? 1.0 : 1.0 - 0.5 * wet);",
     "  // LIGHT LAB: the blue-hour ambient scales the wash only (spill, pools, emitters and ink keep their value)\n"
     "  shaded *= uLpAmb;\n"
     "  shaded += col * min(vSpill, vec3(0.7)) * 1.3 * (kind == 3.0 ? 1.0 : 1.0 - 0.5 * wet);\n"
     "  // LIGHT LAB: the warm pools (lightvol.ts): diffuse on the wash; on wet stone a broad glossy sheen of the same light\n"
     "  vec3 lp = poolLight(vWorld, n);\n"
     "  shaded += col * lp * uLpGain.x;\n"
     "  emit += lp * wetPool * uLpGain.y * (0.35 + 0.65 * pow(clamp(1.0 - abs(V.y), 0.0, 1.0), 2.0));"),
])

# ── facade/material.ts: the tower shells take the pools and the ambient; dark rooms / glass take the ambient ──
patch('facade/material.ts', [
    ("import { FOG_GLSL, NOISE_GLSL, PAPER_GLSL, type Shared } from '../style';",
     f"import {{ FOG_GLSL, NOISE_GLSL, PAPER_GLSL, type Shared }} from '../style';\n// LIGHT LAB (P6): the baked light volume on the tower shells\nimport {{ LIGHTVOL_GLSL }} from '{sub}/lightvol';"),
    ("flat varying vec2 vMisc;\n${COMMON_GLSL}\nvoid main() {\n  vec3 n = normalize(vNormal);",
     "flat varying vec2 vMisc;\n${COMMON_GLSL}\n${LIGHTVOL_GLSL}\nvoid main() {\n  vec3 n = normalize(vNormal);"),
    ("  col = mix(col * uShade, col, lit);\n  col *= mix(1.0, 0.5, smoothstep(0.35, 0.8, -n.y));\n",
     "  vec3 albedo = col;\n  col = mix(col * uShade, col, lit);\n  col *= mix(1.0, 0.5, smoothstep(0.35, 0.8, -n.y));\n"
     "  // LIGHT LAB: the ambient, then warm pools from the lanterns / shops / lit windows (lightvol.ts)\n"
     "  col *= uLpAmb;\n  col += albedo * poolLight(vWorld, n) * uLpGain.x;\n"),
    ("uniform vec3 uSky;\nuniform vec3 uShade;\nvarying vec3 vP;", "uniform vec3 uSky;\nuniform vec3 uShade;\nuniform float uLpAmb;\nvarying vec3 vP;"),
    ("  col = mix(avg, col, det);\n",
     "  col = mix(avg, col, det);\n  // LIGHT LAB: the blue-hour ambient dims the dark rooms, the reveal and the glass, never a lit room\n  col *= mix(uLpAmb, 1.0, clamp(lit, 0.0, 1.0));\n"),
])

# ── post.ts: the window glow in the bloom pyramid's alpha, the LUT as the composite's last colour step ──
patch('post.ts', [
    ("import { FOG_GLSL, NOISE_GLSL, type Shared } from './style';",
     "import { FOG_GLSL, NOISE_GLSL, type Shared } from './style';\n"
     "// LIGHT LAB (P6): the window glow rides in the bloom pyramid's alpha; the learned LUT is the composite's last colour step\n"
     f"import {{ GLOW_COMP_GLSL, GLOW_PRE_GLSL, glowUniforms }} from '{pre}/glow';\nimport {{ GRADE_GLSL, gradeUniforms }} from '{pre}/grade';"),
    ("uniform vec2 uPre; // x: threshold, y: knee\nvarying vec2 vUv;", "uniform vec2 uPre; // x: threshold, y: knee\nuniform float uNearP;\nvarying vec2 vUv;\n${GLOW_PRE_GLSL}"),
    ("""  vec3 a = pick(texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  vec3 b = pick(texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb);
  vec3 c = pick(texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb);
  vec3 d = pick(texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);""", """  vec4 ta = texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 tb = texture(tSrc, vUv + uTexel * vec2(1.0, -1.0));
  vec4 tc = texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 td = texture(tSrc, vUv + uTexel * vec2(1.0, 1.0));
  float glow = 0.25 * (glowSrc(ta, uNearP) + glowSrc(tb, uNearP) + glowSrc(tc, uNearP) + glowSrc(td, uNearP));
  vec3 a = pick(ta.rgb);
  vec3 b = pick(tb.rgb);
  vec3 c = pick(tc.rgb);
  vec3 d = pick(td.rgb);"""),
    ("  gl_FragColor = vec4(min(o, vec3(64.0)), 1.0);", "  gl_FragColor = vec4(min(o, vec3(64.0)), glow);"),
    ("""  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);""", """  vec4 s = texture(tSrc, vUv) * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0));
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0));
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0));
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0));
  gl_FragColor = s / 8.0;"""),
    ("""  vec3 s = vec3(0.0);
  s += texture(tSrc, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(2.0, 0.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(0.0, -2.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(0.0, 2.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture(tAdd, vUv).rgb, 1.0);""", """  vec4 s = vec4(0.0);
  s += texture(tSrc, vUv + uTexel * vec2(-2.0, 0.0));
  s += texture(tSrc, vUv + uTexel * vec2(2.0, 0.0));
  s += texture(tSrc, vUv + uTexel * vec2(0.0, -2.0));
  s += texture(tSrc, vUv + uTexel * vec2(0.0, 2.0));
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)) * 2.0;
  gl_FragColor = s / 12.0 + texture(tAdd, vUv);"""),
    ("varying vec2 vUv;\n${NOISE_GLSL}\n${FOG_GLSL}\n// inverse depth", "varying vec2 vUv;\n${NOISE_GLSL}\n${FOG_GLSL}\n${GLOW_COMP_GLSL}\n${GRADE_GLSL}\n// inverse depth"),
    ("""  vec3 tight = texture(tTight, vUv + warp * 0.5).rgb;
  vec3 wide = texture(tWide, vUv + warp).rgb;""", """  vec4 tight4 = texture(tTight, vUv + warp * 0.5);
  vec4 wide4 = texture(tWide, vUv + warp);
  vec3 tight = tight4.rgb;
  vec3 wide = wide4.rgb;"""),
    ("  c += (tight * uBleed.x + wide * uBleed.y) * soak;",
     "  c += (tight * uBleed.x + wide * uBleed.y) * soak;\n"
     "  // LIGHT LAB: warm window glow in the fog (the pyramid's alpha), kept off anything nearer than the glow\n"
     "  c += glowAdd(tight4.a, wide4.a * 0.25, wc > 1e-5 ? 1.0 / wc : 1e4) * soak;"),
    ("  vec3 o = toSRGB(c);", "  vec3 o = gradeLut(toSRGB(c));"),
    ("  private readonly uPre = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uPre: { value: new Vector2(BLEED.threshold, BLEED.knee) } };",
     "  readonly glow = glowUniforms();\n  readonly grade = gradeUniforms();\n"
     "  private readonly uPre = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uPre: { value: new Vector2(BLEED.threshold, BLEED.knee) }, uNearP: { value: 0.1 }, uGlow: this.glow.uGlow, uGlow2: this.glow.uGlow2 };"),
    ("      uGrade: { value: new Vector3(B.vignette, B.grain, B.shadowBlue) },\n    };",
     "      uGrade: { value: new Vector3(B.vignette, B.grain, B.shadowBlue) },\n      ...this.glow, ...this.grade,\n    };"),
    ("    this.uPre.uTexel.value.set(1 / this.w, 1 / this.h);", "    this.uPre.uTexel.value.set(1 / this.w, 1 / this.h);\n    this.uPre.uNearP.value = camera.near;"),
])

# ── main.ts: bake the volume, wire glow + grade + ramp (window.__light), the lab's ground cards for the A/B ──
patch('main.ts', [
    ("import { glbBox, guardMatrix, loadGlb } from './hero/glb';", f"import {{ glbBox, guardMatrix, loadGlb }} from './hero/glb';\nimport {{ installLightLab }} from '{pre}/lab';"),
    ("  type LookName, Shared, jiehuaMaterial,", "  FOG_GLSL, NOISE_GLSL, type LookName, Shared, jiehuaMaterial,"),
    ("  const pipe = new Pipeline(renderer, shared);\n",
     "  const pipe = new Pipeline(renderer, shared);\n"
     "  // LIGHT LAB (P6): bake the light volume from every emitter + lit window, wire the window glow, the ramp and the grade\n"
     "  installLightLab({\n"
     "    shared, pipe, lanterns: paper.emitters, ctxEmitters: ctx.emitters, signs: [...neonSigns.emitters, ...signs.lights], windows: ctx.fd.windows,\n"
     "    cards: { scene, fogGlsl: `${NOISE_GLSL}${FOG_GLSL}`, groundY: Y0, uniforms: shared.u },\n"
     "  });\n"),
])

# ── square.ts: the four lamps become lights (a pool each, a streak in the wet stone) ──
patch('square.ts', [
    ("import { Matrix4, Quaternion, Vector3 } from 'three';", "import { Color, Matrix4, Quaternion, Vector3 } from 'three';"),
    ("  lamp(props, 21, Y0, -6, 4.2);\n",
     "  lamp(props, 21, Y0, -6, 4.2);\n"
     "  // LIGHT LAB: the lamps are lights too (a warm pool under each, a streak in the wet stone)\n"
     "  for (const [x, z] of [[1.1, 12], [1.1, -9], [1.1, -19], [21, -6]] as const) {\n"
     "    ctx.emitters.push({ at: new Vector3(x, Y0 + 4.1, z), color: new Color(0xffc987), w: 0.34, h: 0.3, power: 0.5, spill: 0.25 });\n"
     "  }\n"),
])

# the lab's copy only: its window global must not collide with the clean room's `window.__nd` declaration (TS2717)
if '--lab' in sys.argv:
    patch('main.ts', [
        ("declare global { interface Window { __nd?: NdApi } }", "declare global { interface Window { __ndLight?: NdApi } }"),
        ("  window.__nd = {", "  window.__ndLight = {"),
        ("// window.__nd (no URL switches):", "// window.__ndLight (LIGHT LAB: renamed from __nd so it cannot collide with the clean room; no URL switches):"),
    ])
print('done')
