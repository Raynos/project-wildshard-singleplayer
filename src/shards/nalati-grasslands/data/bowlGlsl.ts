// SHARD-PLATFORM M3 (look-family rows): world/Bowl.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what world/Bowl.ts passes (another module's GLSL, a number from the layout).
export const BOWL_GLSL = {
  GALLOP_GLSL: /* glsl */`
#ifdef USE_INSTANCING
{
  float gPh = uPTime * @{GALLOP_HZ} + float( gl_InstanceID ) * @{GALLOP_SPREAD};
  float legK = 1.0 - smoothstep( 0.35, 0.9, position.y );
  float lp = gPh + step( 0.0, position.z ) * 3.1416 + sign( position.x ) * 0.45;
  float fromHip = max( 0.0, 0.95 - position.y );
  transformed.z += sin( lp ) * 0.5 * legK * fromHip;
  transformed.y += max( 0.0, cos( lp ) ) * 0.22 * legK * fromHip;
  float neck = smoothstep( 0.8, 1.35, position.z ) * smoothstep( 0.9, 1.3, position.y );
  transformed.y += sin( gPh * 2.0 + 0.8 ) * 0.06 * neck;
  float rid = smoothstep( 1.5, 1.8, position.y );
  transformed.z += ( 0.08 + sin( gPh * 2.0 - 0.6 ) * 0.05 ) * rid * ( position.y - 1.5 );
  transformed.y -= ( 0.5 + 0.5 * sin( gPh * 2.0 + 0.9 ) ) * 0.05 * rid;
}
#endif
`,
};
