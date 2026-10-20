// SHARD-PLATFORM M3 (look-family rows): look/air.ts's trusted custom GLSL used by the shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/air.ts passes (another module's GLSL, a number from the layout).
export const AIR_GLSL = {
  fog_pars_fragment: /* glsl */`
    #ifdef USE_FOG
      uniform sampler2D fogCloudTex;
      uniform vec4 fogCloud;
      uniform vec2 fogCloudOff;
      #define P_CLOUDS 1
      // the sun's share left by the drifting cloud cover at this fragment (1 = clear sky above)
      float pCloudShadow() {
        vec2 uv = vFogWorldPos.xz * fogCloud.x + fogCloudOff;
        float c = texture2D( fogCloudTex, uv ).r * 0.72 + texture2D( fogCloudTex, uv * 2.3 + vec2( 0.37, 0.61 ) ).r * 0.28;
        return 1.0 - fogCloud.z * smoothstep( fogCloud.y - fogCloud.w, fogCloud.y + fogCloud.w, c );
      }
    #endif`,
};
