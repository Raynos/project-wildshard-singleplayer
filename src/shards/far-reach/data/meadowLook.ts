/**
 * The near meadow's look as data (SHARD-PLATFORM M3: a row of an SDK shader family drawn on an SDK tile field; world/meadow.ts
 * builds it): the field's lattice and card outline, the sward's paint and its one program. `@{name}` splices what the data
 * cannot hold as text — the field's numbers formatted for GLSL, the island, hole and path counts, the knoll and noise
 * fragments, the sward atlas's layout and the shard's fog — which world/meadow.ts passes when it builds the material.
 */

/**
 * The near meadow (loop 4; the targets' foreground is knee-deep golden grass, not a green plane): a field of single blades
 * that travels with the camera. One 8 m tile of blades is drawn as a grid of instances around the camera (the vertex
 * shader snaps the grid to the tile lattice, so nothing is uploaded per frame); a blade survives only on an island top,
 * off the bridge landings, the worn paths and the structures, and it shortens to nothing at the field's edge so the
 * grid's border never shows. Unlit-by-the-rig, painted in the shader (E407 row 4): three grasses by noise and slope,
 * dark green roots to warm lit tips, some strands catching the low sun, the sun through the blades when you look toward
 * it, the shard's rose fog. No colliders; the island dressing's clumps carry the far view.
 */
export const MEADOW = {
  /** the cards' seed (every load grows the same field) */
  seed: 6417,
  /** a tile's side (metres) */
  tile: 8,
  /** tiles across the field (odd, the camera's tile in the middle): 7 × 8 m = a 56 m square, blades out to `range` */
  across: 7,
  /** where the blades have shrunk to nothing (metres from the camera) */
  range: 24,
  /**
   * E392 foreground: the inner 3 × 3 tiles are drawn `layers` more times with the blades shuffled, so the near field is
   * (1 + layers) × as dense with no more blades in the buffer; the extra layers shrink away by `near` metres (inside
   * the inner tiles' 8 m reach), and a frustum test drops every blade off screen before its island and hole loops
   */
  layers: 4, near: 7.5,
  /** an island's grass height scale (1 when absent): the crown's arena a little shorter, so the dais reads (E399: mockup D's meadow is lush to the dais) */
  // (round 6: the seats: 'cut to 0.42 against mockup D's lush meadow'; from the rise's top the dais clears ~0.9 m of grass)
  grass: { crown: 0.85 } as Readonly<Record<string, number>>,
  /** the share of blades an island keeps (1 when absent): the crown a little thinner (round 2's carpet of chips was the old wide blades) */
  keep: { crown: 1 } as Readonly<Record<string, number>>,
} as const;

/**
 * The sward (E407 row 4, a green, varied meadow): three grasses (world/swardAtlas.ts), each its own height (metres, at the
 * tuft's full size) and body green, on one root-to-tip ramp (sRGB): dark roots, green bodies, warm tips. `light`: the
 * shade floor deep in the sward, the gain up the blade, the sun through the blades when you look toward it (one term for
 * every distance: the round-6-to-10 glow coefficients and their near/far split are gone) and the sun-side edge of a
 * broad blade. `share`: where the noise field turns lawn into broad blades, and broad blades into the wild grass.
 */
export const SWARD = {
  height: { lawn: [0.2, 0.38], broad: [0.34, 0.6], wild: [0.5, 0.9] },
  share: [0.3, 0.62],
  root: 0x141c18, low: 0x2a4234, lawn: 0x6a845c, broad: 0x5e7c56, wild: 0x7e805c, tip: 0xdcc887, sun: 0xf0d8b8,
  light: { floor: 0.03, gain: 0.36, through: 1.8, edge: 0.8, top: 0.45 },
  // how far the bodies of the warm-toned patches, and every blade's tip, turn toward `tip` (round 14 prep: at 0.45 / 0.5
  // with a peach tip the near sward read pale straw where the mockups' is green with gold-lit tips)
  straw: { body: 0.25, tip: 0.3 },
  // the colour light takes through a blade (a leaf passes yellow-green): the backlit sward glows green-gold, not cream
  leaf: 0xc8e070,
} as const;

/** One blade = 7 vertices (three pairs up the blade and the tip), 5 triangles: it tapers and bends (council R1C-15 / R1A-7);
 *  a flower reuses the same 7: a thin stem (the root pair to the head's bottom pair), then a kite head whose round middle is
 *  the flower (its corners are drawn as green sepals). */
export const MEADOW_CARD = {
  shape: [[-1, 0], [1, 0], [-0.82, 0.34], [0.82, 0.34], [-0.52, 0.68], [0.52, 0.68], [0, 1]] as [number, number][],
  triangles: [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6],
};

/** The hash both the grass and the ground paint use for patchiness (GLSL). */
export const MEADOW_GLSL = /* glsl */`
  float mh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mh(i), mh(i + vec2(1.0, 0.0)), u.x), mix(mh(i + vec2(0.0, 1.0)), mh(i + vec2(1.0, 1.0)), u.x), u.y); }
  float mfbm(vec2 p){ return mn(p) * 0.55 + mn(p * 2.1 + 7.3) * 0.3 + mn(p * 4.3 - 3.1) * 0.15; }
  float segDist(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); return length(p - a - ab * t); }
`;

/** The meadow's program (its uniforms are world/meadow.ts's: the tile origin, camera, time, sun, sward atlas, islands,
 *  holes, paths and the sward's paint). */
export const MEADOW_PROGRAMS = {
  meadow: { side: 'double', vertex: /* glsl */`
      #define TILE @{tile}
      #define RANGE @{range}
      #define NEAR @{near}
      #define NI @{isles}
      #define NH @{holes}
      #define NP @{paths}
      uniform vec2 uOrigin; uniform vec3 uCam; uniform float uTime;
      uniform vec4 uIsles[NI]; uniform float uIsleGrass[NI]; uniform float uIsleKeep[NI]; uniform vec4 uHoles[NH]; uniform vec4 uPaths[NP];
      attribute vec3 aRoot; attribute vec2 aShape; attribute vec3 aTile;
      varying float vH; varying float vTone; varying vec3 vWorld; varying float vShade; varying float vFlower; varying vec2 vPetal; varying float vAcross; varying vec2 vUv; varying float vDist; varying float vSpecies;
      @{meadowNoise}
      @{knoll}
      void cull(){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vH = 0.0; vTone = 0.0; vWorld = vec3(0.0); vShade = 0.0; vFlower = 0.0; vPetal = vec2(0.0); vAcross = 0.0; vUv = vec2(0.0); vDist = 0.0; vSpecies = 0.0; }
      void main(){
        // a layer above 0 is the same tile's blades shuffled (offset, mirrored), so the near field thickens without a seam
        float layer = aTile.z; vec2 j = aRoot.xy; float r = aRoot.z;
        if (layer > 0.5) { j = fract((mod(layer, 2.0) > 0.5 ? j.yx : j) + vec2(0.6180, 0.3819) * layer); r = fract(r + 0.2718 * layer); }
        vec2 p = uOrigin + (aTile.xy + j) * TILE;
        // tufts (E399, every seat: 'even upright blades'; the mockups' sward grows in clumps of mixed height with darker gaps):
        // three blades in four lean in toward their cell's tuft centre, and each tuft has its own height
        vec2 tCell = floor(p * 1.4); vec2 tCentre = (tCell + 0.25 + 0.5 * vec2(mh(tCell), mh(tCell + 7.1))) / 1.4;
        p = mix(p, tCentre, step(0.25, fract(r * 61.3)) * 0.25);
        float tuftK = 0.7 + 0.7 * mh(tCell + 3.3);
        float dist = distance(p, uCam.xz);
        // off screen (behind, or a metre past either side) or out of reach: drop it before the loops
        vec4 probe = projectionMatrix * viewMatrix * vec4(p.x, uCam.y - 1.5, p.y, 1.0);
        if (dist > (layer > 0.5 ? NEAR : RANGE) || probe.w < -1.0 || abs(probe.x) > probe.w + 3.0) { cull(); return; }
        float y = -1.0e4, rim = 1.0, tall = 1.0, keep = 1.0;
        for (int i = 0; i < NI; i++) { vec4 s = uIsles[i]; float d = distance(p, s.xy);
          // a ragged edge just short of the rim, by noise (E392 foreground: close enough that no bare band shows between the
          // blades and the grassy lip). The rim is the 12-gon's (layout rimAlong: a vertex every 30 deg from +x), not a circle:
          // round the apothem the corners stayed bare, a band C's camera saw 4-5 m ahead as a smooth olive dome (round 6)
          float edge = s.z / cos(mod(atan(p.y - s.y, p.x - s.x), 0.5236) - 0.2618) * (0.975 + 0.02 * mn(p * 0.6));
          // an island's trodden arena (the crown) is trodden only in its middle: the outer ring stays a full meadow
          if (d < edge) { y = s.w; rim = d / edge; float wild = smoothstep(0.55, 0.8, rim); tall = mix(uIsleGrass[i], 1.0, wild); keep = mix(uIsleKeep[i], 1.0, wild); } }
        // the grassy rises (layout KNOLLS)
        if (y > -1.0e3) y += farKnoll(p);
        float clear = 1.0, worn = 1.0;
        for (int i = 0; i < NH; i++) { vec4 h = uHoles[i]; float o = smoothstep(h.z, h.z + 0.6, distance(p, h.xy)); clear = min(clear, h.w > 0.5 ? mix(0.3, 1.0, o) : o); }
        // a worn path keeps a short, thin sward (E392 foreground: a cleared path showed the bare ground as a grey band); round 7
        // (the seats: A's foreground, on the bridge landing's apron, read as mown; mockup A's meadow grows to the posts): faint
        for (int i = 0; i < NP; i++) { vec4 s = uPaths[i]; worn = min(worn, smoothstep(0.15, 0.7, segDist(p, s.xy, s.zw) + 0.3 * mn(p * 1.7))); }
        float pt = mfbm(p * 0.23);
        // three grasses (E407 row 4): placed by a noise field, the lawn on the slopes of the rises and the worn ground, the
        // wild grass toward the rims; each its own height, the patches of one grass running into the next
        vec2 kd = vec2(farKnoll(p + vec2(0.4, 0.0)) - farKnoll(p - vec2(0.4, 0.0)), farKnoll(p + vec2(0.0, 0.4)) - farKnoll(p - vec2(0.0, 0.4))) / 0.8;
        float spN = mfbm(p * 0.19 + 31.0) + 0.3 * (fract(r * 37.7) - 0.5) - 0.6 * min(length(kd), 0.6) - 0.15 * (1.0 - worn) + 0.1 * smoothstep(0.8, 1.0, rim);
        float species = spN < @{share0} ? 0.0 : spN < @{share1} ? 1.0 : 2.0;
        vec2 hr = species < 0.5 ? vec2(@{lawn}) : species < 1.5 ? vec2(@{broad}) : vec2(@{wild});
        float h = mix(hr.x, hr.y, smoothstep(0.2, 0.8, pt) * 0.4 + r * 0.6) * mix(0.85, 1.15, mn(p * 0.37 + 11.0));
        h *= tall * mix(0.85, 1.15, (tuftK - 0.7) / 0.7) * (1.0 - 0.3 * smoothstep(0.85, 1.0, rim)) * clear * mix(0.8, 1.0, worn);
        h *= 1.0 - smoothstep(layer > 0.5 ? NEAR - 2.5 : RANGE * 0.55, layer > 0.5 ? NEAR : RANGE, dist + (layer > 0.5 ? 1.5 * mn(p * 0.9) : 0.0));
        if (y < -1.0e3 || h < 0.04 || fract(r * 53.1) > keep * mix(0.88, 1.0, worn)) { cull(); return; }
        float ang = r * 40.0; vec2 dir = vec2(cos(ang), sin(ang));
        vec2 toCam = normalize(uCam.xz - p + 1e-3);
        // flowers: clustered drifts (daisies, buttercup patches), a few strays; never on a path
        // tight drifts (council round 3: 'scattered evenly where the mockups cluster daisies'): patches a metre or two across
        float drift = smoothstep(0.55, 0.72, mfbm(p * 0.16 + 4.0)) * smoothstep(0.45, 0.65, mn(p * 0.9 + 2.0));
        // (E399 seat: 'an even field of large white daisies'; the mockups' flowers are sparse, small, white and yellow)
        // (round 6, seat A: 'fewer, smaller round flower heads')
        // (round 10, seat A: 'small embedded daisy groups'): tighter, denser drifts, the heads small and low
        // (E407 row 4, mockups A, B and D: small white daisies in clumps all through the near meadow, a yellow and an
        // orange wildflower among them)
        float flower = step(fract(r * 91.7), (0.004 + 0.3 * drift * drift) * worn) * step(0.6, dist);
        float kind = (mn(p * 0.45 + 20.0) + 0.35 * fract(r * 17.3)) > 0.82 ? (fract(r * 41.9) > 0.6 ? 3.0 : 2.0) : 1.0;
        vec2 wind = normalize(vec2(0.6, 0.8));
        float sway = (0.16 + 0.1 * sin(uTime * 1.3 + dot(p, wind) * 0.35)) + 0.05 * sin(uTime * 4.1 + r * 30.0);
        vec3 world = vec3(p.x, y, p.y);
        float t = aShape.y;
        vShade = 0.55 + 0.45 * fract(r * 3.3); vTone = pt; vSpecies = 0.0; vFlower = 0.0; vPetal = vec2(0.0, -3.0); vAcross = aShape.x; vUv = vec2(0.0); vDist = dist;
        if (flower > 0.5) {
          // a stem in the grass, the head a kite tilted half up, half to you (a daisy reads round, a buttercup a cup)
          float stem = mix(0.07, 0.18, fract(r * 5.7));
          float R = (kind > 1.5 ? 0.017 : 0.021) * mix(0.8, 1.2, fract(r * 7.9)) * clamp(dist / 6.0, 1.0, 1.4);
          vec3 sideV = vec3(-toCam.y, 0.0, toCam.x), upV = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(-toCam.x, 0.0, -toCam.y), 0.5));
          vec2 nod = dir * stem * 0.12 + wind * sway * stem * 0.3;
          vec3 head = world + vec3(nod.x, stem, nod.y);
          vec2 q = t < 0.2 ? vec2(aShape.x * 0.1, -3.0) : t < 0.5 ? vec2(sign(aShape.x) * 0.16, -0.97) : t < 0.9 ? vec2(sign(aShape.x) * 1.05, -0.05) : vec2(0.0, 1.05);
          world = t < 0.2 ? world + sideV * q.x * R : head + sideV * q.x * R + upV * q.y * R;
          vH = t; vPetal = q; vFlower = kind;
        } else {
          // a tuft card (E399, the council every round: 'a flat lit plane under dark tufts'): a quad of the sward atlas
          // (world/swardAtlas.ts), seventy fine strands each, facing you, so the blades overlap into a carpet. The 7-vertex
          // blade maps onto it: its pairs at 0 / 0.34 / 0.68 become the card's bottom, middle and top, the tip folds onto
          // the top right corner (a degenerate triangle)
          float cy = t < 0.2 ? 0.0 : t < 0.5 ? 0.5 : 1.0, cx = t > 0.9 ? 1.0 : sign(aShape.x);
          float wCard = (species < 0.5 ? mix(0.5, 0.75, fract(r * 13.7)) : species < 1.5 ? mix(0.4, 0.62, fract(r * 13.7)) : mix(0.36, 0.55, fract(r * 13.7))) * mix(0.9, 1.25, smoothstep(2.0, 12.0, dist));
          vec2 face = normalize(mix(dir, toCam, 0.85)), side = vec2(-face.y, face.x);
          float bend = 0.1 + 0.25 * fract(r * 7.1);
          vec2 lean = dir * bend + wind * sway;
          h *= mix(0.8, 1.0, smoothstep(0.5, 3.0, dist));
          // seen from above (D's rise, the aerials) an upright card squashes to a dark blot: its top leans back, away from
          // the camera, by how steeply the camera looks down on it, so the tuft's face stays toward you
          float down = clamp((uCam.y - y) / max(dist, 0.5) - 0.15, 0.0, 1.2);
          world.xz += side * cx * wCard * 0.5 + lean * h * cy * cy - toCam * h * cy * down * 0.8;
          world.y += h * cy - 0.04;
          vUv = vec2(species * @{perSpecies} + floor(fract(r * 29.3) * @{perSpecies}) + (cx * 0.5 + 0.5) * (fract(r * 5.1) > 0.5 ? 1.0 : -1.0) + (fract(r * 5.1) > 0.5 ? 0.0 : 1.0), cy);
          vH = cy; vAcross = 0.0; vSpecies = species;
        }
        vWorld = world;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragment: /* glsl */`
      uniform vec3 uCam; uniform vec3 uSun; uniform sampler2D uAtlas;
      uniform vec3 uRootC; uniform vec3 uLowC; uniform vec3 uLawnC; uniform vec3 uBroadC; uniform vec3 uWildC; uniform vec3 uTipC; uniform vec3 uSunC; uniform vec4 uLight; uniform float uTop;
      varying float vH; varying float vTone; varying vec3 vWorld; varying float vShade; varying float vFlower; varying vec2 vPetal; varying float vAcross; varying vec2 vUv; varying float vDist; varying float vSpecies;
      void main(){
        vec3 view = normalize(vWorld - uCam);
        float back = pow(max(dot(view, uSun), 0.0), 3.0);
        // the sun through a blade: a tight forward-scattering lobe (E407 row 4), so the grass you look along toward the low
        // sun glows and the grass at your feet, seen from above, does not (one term at every distance)
        float through = pow(max(dot(view, uSun), 0.0), 8.0);
        vec3 lit;
        if (vFlower > 0.5 && (vPetal.y < -0.96 || length(vPetal) > 0.74)) {
          // a flower's stem, and the kite's corners round the round head: a thin dark green, lit like the blades round it
          lit = vec3(0.1022, 0.1946, 0.0194) * (0.55 + 0.25 * vH) * vShade + vec3(0.5841, 0.7157, 0.1070) * back * 0.2;
        } else if (vFlower > 0.5) {
          // the head: a daisy's white petal ring round a gold eye, or a buttercup's glossy yellow cup
          float d = length(vPetal) / 0.74, a = atan(vPetal.y, vPetal.x);
          vec3 petal = vFlower > 2.5 ? vec3(0.8714, 0.2542, 0.0116) : vFlower > 1.5 ? vec3(0.9047, 0.5395, 0.0137) : vec3(0.9647, 0.9301, 0.8550);
          petal *= 0.82 + 0.18 * cos(a * (vFlower > 1.5 ? 5.0 : 13.0)) * smoothstep(0.25, 0.6, d);
          petal *= 1.0 - 0.25 * smoothstep(0.75, 1.05, d);
          vec3 eye = vFlower > 1.5 ? vec3(0.7454, 0.3564, 0.0070) : vec3(0.8070, 0.4621, 0.0232);
          vec3 c = mix(eye, petal, smoothstep(0.24, 0.34, d));
          lit = c * (0.95 + 0.2 * back);
        } else {
          // the tuft: each strand's own shade (R) and how far along it this texel is (G); thin strands thin out in the far
          // mips, so the cut-off eases with distance
          vec4 tx = texture2D(uAtlas, vec2(vUv.x / @{variants}, vUv.y));
          if (tx.a < mix(0.5, 0.22, smoothstep(3.0, 16.0, vDist))) discard;
          // the data channels are 0 off the strands, so a filtered (far, mipped) texel holds them scaled by its coverage:
          // divide it back out (E407 row 4: without it the far sward read as roots, dark and unlit, and no strand caught the sun)
          vec3 dat = min(tx.rgb / max(tx.a, 0.004), vec3(1.0));
          float along = dat.g, sh = dat.r, across = dat.b;
          // E407 row 4: dark roots deep in the sward, each grass its own green body (patches warmer by the tone field), warm
          // lit tips; the sun-side edge of a broad blade catches the light, the sun shines through the blades toward it
          vec3 body = vSpecies < 0.5 ? uLawnC : vSpecies < 1.5 ? uBroadC : uWildC;
          body = mix(body, uTipC * vec3(0.78, 0.74, 0.5), smoothstep(0.5, 1.0, vTone + (vShade - 0.8) * 0.4) * @{strawBody});
          float up = along * mix(0.55, 1.0, vH);
          vec3 c = mix(uRootC, uLowC, smoothstep(0.0, 0.25, up));
          c = mix(c, body, smoothstep(0.2, 0.6, up));
          c = mix(c, uTipC, smoothstep(0.8, 1.0, up) * @{strawTip});
          lit = c * (uLight.x + uLight.y * up) * (0.3 + 1.0 * sh) * (0.85 + 0.3 * vTone);
          lit *= 1.0 + uLight.w * smoothstep(0.62, 1.0, across) * up;
          // the low sun on the sward's top layer, whatever way you look (the blades below lie in their neighbours' shade):
          // the mockups' gold-lit tips over green bodies
          // only some strands catch it (by each strand's own shade), so the field is green blades and gold blades side by
          // side, as the mockups' sward is, not one even olive-gold
          float catchS = smoothstep(0.62, 0.95, sh);
          lit += uSunC * uTipC * smoothstep(0.3, 0.9, up) * catchS * uTop;
          // the light through a blade glows at its thin edges and tip (the mockups' backlit sward: dark bodies, gold rims)
          float rimB = smoothstep(0.5, 1.0, abs(across * 2.0 - 1.0));
          lit += uSunC * @{leaf} * through * up * up * (0.2 + 0.8 * catchS) * uLight.z * (0.3 + 0.7 * rimB);
        }
        lit *= vec3(1.0000, 0.9216, 0.8388) * 1.1;
        float f = clamp((length(vWorld - uCam) - @{fogNear}) / @{fogSpan}, 0.0, 1.0) * @{fogMax};
        gl_FragColor = vec4(mix(lit, @{fog}, f), 1.0);
      }` },
} as const;
