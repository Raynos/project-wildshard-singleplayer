const FOG_GLSL = /* glsl */`
  uniform vec3 fogColor; uniform vec3 fogSunDir; uniform vec3 fogSunColor;
  uniform float fogHeight; uniform float fogHeightFalloff; uniform float fogHeightDensity; uniform float fogDistDensity;
  float atmosFogFactor( vec3 wp ) {
    vec3 ray = wp - cameraPosition; float rayLen = length( ray );
    float dy = wp.y - cameraPosition.y;
    float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
    float t = fogHeightFalloff * dy;
    float integ = abs( t ) > 1e-3 ? ( 1.0 - exp( - t ) ) / t : 1.0;
    return clamp( 1.0 - exp( - ( fogHeightDensity * camF * integ * rayLen + fogDistDensity * rayLen ) ), 0.0, 1.0 );
  }`;

export const RAIN_PROGRAM = {
vertexShader: /* glsl */`
        attribute vec4 seed; attribute vec2 corner;
        uniform vec3 uOffset; uniform float uR; uniform vec3 uVel; uniform float uLen; uniform float uWidth;
        varying float vA; varying vec3 vW;
        void main() {
          float R = uR;
          vec3 p = seed.xyz * 2.0 * R + uOffset * seed.w;
          vec3 c = cameraPosition + vec3(0.0, 2.0, 0.0);
          vec3 w = mod(p - c + R, 2.0 * R) - R + c;
          vec3 v = normalize(uVel);
          vec3 a = w + v * (corner.y * uLen * seed.w);
          vW = a;
          vec4 mv = viewMatrix * vec4(a, 1.0);
          vec3 vv = (viewMatrix * vec4(v, 0.0)).xyz;
          vec2 side = normalize(vec2(-vv.y, vv.x) + 1e-5);
          float dist = length(mv.xyz);
          mv.xy += side * corner.x * uWidth * max(dist, 1.0) * 0.12 * (0.6 + 0.4 * seed.w);
          vec3 off = abs(w - c);
          float edge = 1.0 - smoothstep(R * 0.65, R * 0.98, max(max(off.x, off.y), off.z));
          vA = edge * smoothstep(0.6, 2.5, dist) * (corner.y > 0.5 ? 1.0 : 0.15);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        ${FOG_GLSL}
        uniform vec3 uCol; uniform float uAlpha;
        varying float vA; varying vec3 vW;
        void main() {
          float a = vA * uAlpha;
          vec3 col = mix(uCol, fogColor, atmosFogFactor(vW) * 0.6);
          gl_FragColor = vec4(col, a);
        }`,
};
