/**
 * The painted golden-hour dome's program (SHARD-PLATFORM M3: a row of an SDK shader family; look/sky.ts skyDome builds it):
 * the panorama strip sampled by heading and elevation from the camera (so the painted sun stays on the true sun direction
 * wherever the camera stands), its zenith above and nadir below, a veil of the painted haze over the far-island band, the
 * glow round the sun rolled off (the sun glow cards carry the hot core).
 */

/** The dome program (its uniforms are look/sky.ts's: the panorama, the haze strip and the strip's wrap padding). */
export const SKY_DOME_PROGRAMS = {
  dome: { vertex: `varying vec3 d; void main(){ vec4 w=modelMatrix*vec4(position,1.0); d=w.xyz-cameraPosition; gl_Position=projectionMatrix*viewMatrix*w; }`, fragment: `
      uniform sampler2D pano; uniform sampler2D haze; uniform float padU; uniform float scaleU; varying vec3 d;
      float farHeading(vec3 v){ return fract(atan(v.x, -v.z) / 6.2831853 + 1.0); }
      void main(){
        vec3 n = normalize(d);
        float elev = degrees(asin(clamp(n.y, -1.0, 1.0)));
        float vTop = 0.5508 - elev / 66.667;
        vec3 c = texture2D(pano, vec2(padU + farHeading(n) * scaleU, 1.0 - clamp(vTop, 0.002, 0.998))).rgb;
        // a veil of the painted haze over the far-island band just above the horizon (council R1C-12: the matte's
        // islands must stay simpler than the playable ones in front of them)
        float band = smoothstep(-1.5, 1.0, elev) * (1.0 - smoothstep(9.0, 22.0, elev));
        c = mix(c, texture2D(haze, vec2(farHeading(n), 0.5)).rgb, band * 0.15);
        // less magenta (E392 judge: the mockups' sky is gold low and lavender-blue high, ours pink-magenta)
        float mag = max(0.0, min(c.r, c.b) - c.g);
        c.g += mag * 0.55; c.b -= mag * 0.25 * (1.0 - smoothstep(4.0, 30.0, elev));
        c = mix(c, c * vec3(0.92, 0.97, 1.08), smoothstep(14.0, 40.0, elev) * 0.6);
        // round 7 (measured on the views' upper sky, x 0.25-0.75, y 0.1-0.35: proposal B chroma 84 vs the mockup's 25, B 61
        // vs 40; C's higher sky cool, 44 vs 59): the band up to ~22 deg toward its own grey, the sky above it warmer
        float farL = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, vec3(farL) * vec3(1.04, 1.0, 0.95), (1.0 - smoothstep(16.0, 26.0, elev)) * smoothstep(-2.0, 2.0, elev) * 0.22);
        // (round 8, seats B and C: the upper sky 11-13 darker than the mockups': C 140 vs 205) warmer and lighter
        c = mix(c, c * vec3(1.28, 1.14, 0.98), smoothstep(18.0, 40.0, elev) * 0.6);
        // (round 9: C's upper sky 141 against the mockup's 205, still lavender) toward a warm peach of a higher luminance
        float farHi = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, vec3(1.22, 0.98, 0.8) * max(farHi * 1.35, 0.42), smoothstep(16.0, 34.0, elev) * 0.5);
        // the painted glow round the sun rolled off (round 7, seat B: D's middle band 13.6 % over 230 against the mockup's
        // 5.2 %, the hot blob ~0.35 of the frame wide): the glow card (look/sunGlow.ts) carries the hot core
        float farToSun = degrees(acos(clamp(dot(n, vec3(-0.1357, 0.1047, -0.9852)), -1.0, 1.0)));
        float farHot = smoothstep(0.55, 0.95, dot(c, vec3(0.2126, 0.7152, 0.0722)));
        c *= 1.0 - 0.42 * farHot * exp(-pow(farToSun / 18.0, 2.0)) * smoothstep(1.2, 3.0, farToSun);
        c = mix(c, vec3(0.2358,0.2063,0.3176), smoothstep(0.05, -0.12, vTop));
        c = mix(c, vec3(0.3573,0.1791,0.2178), smoothstep(0.95, 1.1, vTop));
        gl_FragColor = vec4(c, 1.0);
      }`, shared: [], depthWrite: false, side: 'back' },
} as const;
