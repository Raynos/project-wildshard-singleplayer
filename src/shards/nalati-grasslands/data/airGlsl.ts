// SHARD-PLATFORM M3 (look-family rows): look/air.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/air.ts passes (another module's GLSL, a number from the layout).
export const AIR_GLSL = {
  fog_pars_fragment: /* glsl */`
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform vec3 fogSunDir;
      uniform vec3 fogSunColor;
      uniform float fogHeight;
      uniform float fogHeightFalloff;
      uniform float fogHeightDensity;
      uniform float fogDistDensity;
      uniform vec4 fogAerial;
      uniform sampler2D fogCloudTex;
      uniform vec4 fogCloud;
      uniform vec2 fogCloudOff;
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
      #define P_CLOUDS 1
      // the sun's share left by the drifting cloud cover at this fragment (1 = clear sky above)
      float pCloudShadow() {
        vec2 uv = vFogWorldPos.xz * fogCloud.x + fogCloudOff;
        float c = texture2D( fogCloudTex, uv ).r * 0.72 + texture2D( fogCloudTex, uv * 2.3 + vec2( 0.37, 0.61 ) ).r * 0.28;
        return 1.0 - fogCloud.z * smoothstep( fogCloud.y - fogCloud.w, fogCloud.y + fogCloud.w, c );
      }
    #endif`,
  fog_fragment: /* glsl */`
    #ifdef USE_FOG
      {
        vec3 ray = vFogWorldPos - cameraPosition;
        float rayLen = length( ray );
        vec3 viewDir = ray / max( rayLen, 1e-3 );
        // the valley's height haze, integrated along the ray (as the default fog)
        float dy = vFogWorldPos.y - cameraPosition.y;
        float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
        float ht = fogHeightFalloff * dy;
        float integ = abs( ht ) > 1e-3 ? ( 1.0 - exp( - ht ) ) / ht : 1.0;
        float heightAmt = fogHeightDensity * camF * integ * rayLen;
        // aerial perspective: clear air for fogAerial.x m, then layered haze up to the cap (a storm lifts the cap)
        float cap = mix( fogAerial.y, 1.0, smoothstep( 0.0025, 0.012, fogDistDensity ) );
        float aer = cap * ( 1.0 - exp( - max( rayLen - fogAerial.x, 0.0 ) * fogDistDensity ) );
        float f = clamp( 1.0 - ( 1.0 - aer ) * exp( - heightAmt ), 0.0, 1.0 );
        float sunAmt = max( dot( viewDir, fogSunDir ), 0.0 );
        vec3 haze = mix( fogColor, fogSunColor * dot( fogColor, vec3( 0.3333 ) ) * 1.15, pow( sunAmt, 5.0 ) * fogAerial.w );
        // the painter's order: distance takes the saturation first, then the value dissolves into the sky
        float lum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( lum ), min( 1.0, f * 1.6 ) * fogAerial.z );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, haze, f );
      }
    #endif`,
};
