// SHARD-PLATFORM M3 (look-family rows): look/fog.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/fog.ts passes (another module's GLSL, a number from the layout).
export const FOG_GLSL = {
  fog_pars_tail: /* glsl */`
      uniform sampler2D fogLutV2;
      uniform vec4 fogV2;
      uniform vec4 fogEdgeV2;
      @{V2_TINT_GLSL}
    #endif`,
  fog_fragment: /* glsl */`
    #ifdef USE_FOG
      {
        vec3 ray = vFogWorldPos - cameraPosition;
        float rayLen = length( ray );
        vec3 viewDir = ray / max( rayLen, 1e-3 );
        float dens = fogV2.x + max( fogDistDensity - fogV2.w, 0.0 );
        // thinner with height: the ray's mean height above the valley floor (a view from above looks through clear air)
        float aer = max( rayLen - fogV2.y, 0.0 ) * dens * exp( - max( 0.5 * ( vFogWorldPos.y + cameraPosition.y ) - fogV2.z, 0.0 ) * 0.035 );
        // the valley's height haze, integrated along the ray (as v1)
        float dy = vFogWorldPos.y - cameraPosition.y;
        float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
        float ht = fogHeightFalloff * dy;
        float integ = abs( ht ) > 1e-3 ? ( 1.0 - exp( - ht ) ) / ht : 1.0;
        float f = clamp( 1.0 - exp( - aer - fogHeightDensity * camF * integ * rayLen ), 0.0, 1.0 );
        // N19: the slab's edge dissolves into the haze the painting's land fades to (only seen from a distance)
        float edgeD = max( abs( vFogWorldPos.x ), abs( vFogWorldPos.z ) );
        float fe = fogEdgeV2.x * smoothstep( fogEdgeV2.y, fogEdgeV2.z, edgeD ) * smoothstep( fogEdgeV2.w, fogEdgeV2.w * 3.0, rayLen );
        f = 1.0 - ( 1.0 - f ) * ( 1.0 - fe );
        vec3 haze = v2Regrade( texture2D( fogLutV2, vec2( atan( - viewDir.x, viewDir.z ) * 0.15915494, 0.5 ) ).rgb );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, haze, f );
      }
    #endif`,
};
