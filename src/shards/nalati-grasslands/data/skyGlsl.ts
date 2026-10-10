// SHARD-PLATFORM M3 (look-family rows): look/sky.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/sky.ts passes (another module's GLSL, a number from the layout).
export const SKY_GLSL = {
  VERT: /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0);
    gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
  }`,
  FRAG: /* glsl */`
  @{V2_GRADE_GLSL}
  @{V2_TINT_GLSL}
  uniform sampler2D tPano;
  uniform sampler2D tRidge;
  uniform sampler2D tFogLut;
  uniform float uHorizonV;
  uniform float uPad;
  uniform float uVPerDeg;
  uniform float uElShift;
  uniform vec3 uZenith;
  uniform vec3 uSunNow;
  uniform vec3 uSunPainted;
  uniform float uNight;
  varying vec3 vDir;
  // a blurred tap (explicit mip), cross-faded into the other copy at north like the crisp one
  vec3 panoLod(float u, float uX, float wX, float v, float lod) {
    vec3 c = textureLod(tPano, vec2(u, v), lod).rgb;
    return wX > 0.0 ? mix(c, textureLod(tPano, vec2(uX, v), lod).rgb, wX) : c;
  }
  void main() {
    vec3 d = normalize(vDir);
    float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
    float az = atan(-d.x, d.z) * 0.15915494;                 // compass turns
    float v = uHorizonV + (el - uElShift) * uVPerDeg;
    // the u seam at north: the derivatives of whichever azimuth branch is continuous here
    float azB = fract(az + 0.5) - 0.5;
    vec2 gA = vec2(dFdx(az), dFdy(az)), gB = vec2(dFdx(azB), dFdy(azB));
    vec2 g = dot(gA, gA) < dot(gB, gB) ? gA : gB;
    // every tap reads the inner strip (inside the pads), and over the pad's width either side of north it also reads the
    // other copy of those columns, half-and-half at north itself, so both sides of the jump show the very same texels
    // (the copies differ by the codec's noise, and their mips by the NPOT mip chain's rounding)
    float uLoop = fract(az);
    float uSpan = 1.0 - 2.0 * uPad;
    float u = uPad + uLoop * uSpan;
    g *= uSpan;
    float edge = uPad / uSpan;
    float wR = smoothstep(1.0 - edge, 1.0, uLoop), wL = smoothstep(edge, 0.0, uLoop);
    float wX = 0.5 * (wR + wL), uX = wR > 0.0 ? u - uSpan : u + uSpan;
    vec2 dv = vec2(dFdx(el), dFdy(el)) * uVPerDeg;
    float vc = clamp(v, 0.002, 0.998);
    vec3 c = textureGrad(tPano, vec2(u, vc), vec2(g.x, dv.x), vec2(g.y, dv.y)).rgb;
    if (wX > 0.0) c = mix(c, textureGrad(tPano, vec2(uX, vc), vec2(g.x, dv.x), vec2(g.y, dv.y)).rgb, wX);
    // up: into the strip's own top rows, blurred per azimuth, then one zenith colour
    float elTop = (1.0 - uHorizonV) / uVPerDeg + uElShift;     // where the painting ends (~ +52°)
    vec3 top = panoLod(u, uX, wX, 0.985, 9.0);
    c = mix(c, top, smoothstep(elTop - 22.0, elTop - 1.0, el));
    c = mix(c, uZenith, smoothstep(elTop - 10.0, 80.0, el));
    c = v2Ungrade(c);
    // down: under the painted land, the fog colour (the same LUT the 3D fog reads)
    float elBot = -uHorizonV / uVPerDeg + uElShift;
    vec3 fogC = texture2D(tFogLut, vec2(az, 0.5)).rgb;
    c = mix(c, fogC, smoothstep(elBot + 7.0, elBot + 0.5, el));
    // N19 (the user's pick: blend the painting): painted land behind a near 3D crest read as "one paint ends and another
    // starts" — crisp, saturated painted detail right over the 3D skyline. Aerial perspective instead: under the ridge
    // line the painting softens (a blurrier mip of itself) and drifts toward the sky colour just above that ridge, most at
    // its foot; below the horizon it meets the 3D slab's edge haze (fog.ts fogEdgeV2) in the fog LUT's colour.
    float ridgeV = texture2D(tRidge, vec2(az, 0.5)).r;
    float ridgeEl = (ridgeV - uHorizonV) / uVPerDeg + uElShift;
    float land = 1.0 - smoothstep(ridgeEl - 0.5, ridgeEl + 1.5, el);
    float foot = smoothstep(ridgeEl + 1.0, -1.5, el);
    vec3 soft = v2Ungrade(panoLod(u, uX, wX, vc, 3.5));
    c = mix(c, soft, land * 0.7 * foot);
    vec3 skyH = v2Ungrade(panoLod(u, uX, wX, clamp(ridgeV + 0.035, 0.002, 0.998), 6.0));
    c = mix(c, skyH, land * (0.15 + 0.38 * foot));
    c = mix(c, fogC, land * 0.9 * smoothstep(0.5, -3.0, el));
    // the painted sun dims as the clock moves the real one away from it
    float away = smoothstep(0.9986, 0.975, dot(uSunNow, uSunPainted));
    float disc = smoothstep(0.975, 0.997, dot(d, uSunPainted));
    c *= 1.0 - 0.6 * disc * away;
    c = v2Regrade(c);
    // night: the painted sky above the ridge line fades out, the rig's star dome shows through
    float ridge = texture2D(tRidge, vec2(az, 0.5)).r;
    float sky = smoothstep(ridge - 0.004, ridge + 0.03, v);
    gl_FragColor = vec4(c, 1.0 - uNight * sky);
  }`,
};
