// SHARD-PLATFORM M3 (look-family rows): look/toon.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what that module passes (another module's GLSL, a number from its layout).
export const TOON_GLSL_ROWS = {
  toon: /* glsl */`
#ifndef NO_TOON
uniform vec3 uToonLift;
uniform vec3 uToonRim;
uniform vec3 uToonTerm;
uniform float uToonShadeGrade;
uniform float uCloudShadow;
uniform float uToonNight;
uniform float uSeaLevel;
uniform float uCaustics;
uniform float uCloudTime;
uniform vec2 uCloudWind;
uniform float uCloudScale;

float toonHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float toonNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( toonHash( i ), toonHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( toonHash( i + vec2( 0.0, 1.0 ) ), toonHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
/** 1 = open sky, lower = under a cloud's shadow (two octaves of value noise scrolled by the wind) */
float toonCloud( vec3 viewPos ) {
	if ( uCloudShadow <= 0.0 ) return 1.0;
	vec3 w = cameraPosition + ( vec4( viewPos, 0.0 ) * viewMatrix ).xyz;
	vec2 p = ( w.xz + uCloudWind * uCloudTime ) / uCloudScale;
	float n = toonNoise( p ) * 0.65 + toonNoise( p * 2.3 + 7.1 ) * 0.35;
	return 1.0 - uCloudShadow * smoothstep( 0.46, 0.68, n );
}
/** W4: sunlight focused by the swell onto everything under the sea — bright filaments where two drifting noise
 *  fields cross, strongest just under the surface, fading with depth (0 above the water and on the sea surface itself) */
float toonCaustics( vec3 viewPos ) {
	#ifdef OCEAN_SURFACE
	return 0.0;
	#else
	vec3 w = cameraPosition + ( vec4( viewPos, 0.0 ) * viewMatrix ).xyz;
	float d = uSeaLevel - w.y;
	if ( d <= 0.0 ) return 0.0;
	vec2 p = w.xz * 0.42; float t = uCloudTime * 0.55;
	float a = toonNoise( p + vec2( t * 0.31, t * 0.17 ) ), b = toonNoise( p * 1.63 - vec2( t * 0.21, -t * 0.29 ) + 3.7 );
	float c = pow( 1.0 - abs( a - b ), 9.0 );
	return c * uCaustics * smoothstep( 0.7, 1.8, d ) * exp( -d * 0.18 );   // none in the lagoon shallows (a net over the sand read as noise)
	#endif
}

void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	#if NUM_DIR_LIGHTS > 0
	if ( dot( directLight.direction, directionalLights[ 0 ].direction ) > 0.9999 ) {
		vec3 sunCol = directionalLights[ 0 ].color;
		float shadow = clamp( dot( directLight.color, vec3( 1.0 ) ) / max( dot( sunCol, vec3( 1.0 ) ), 1e-5 ), 0.0, 1.0 );
		float NdL = dot( geometryNormal, directLight.direction );
		// a hard step on the facet's turn to the light (a facet is lit or it is shade); a softer one on the cast shadow, whose
		// PCF penumbra is dithered noise that a hard threshold would turn into speckle
		float faceLit = smoothstep( 0.14, 0.2, NdL ), inSun = smoothstep( 0.25, 0.75, shadow );
		float band = faceLit * inSun;
		float grade = 0.8 + 0.2 * saturate( NdL );                  // the lit band keeps a faint facet grade
		vec3 alb = material.diffuseContribution;
		float cloud = toonCloud( geometryPosition );                  // L4: drifting cloud shade dims the lit band, never flips it
		vec3 irr = sunCol * ( band * grade * cloud + ( 1.0 - band ) * uToonShadeGrade * saturate( NdL ) * 0.5 )
			+ sunCol * vec3( 0.7, 1.0, 1.05 ) * band * cloud * toonCaustics( geometryPosition );   // caustics: a cool cyan-white, not the sun's yellow
		// the terminator: a thin warm, saturated band where the ramp turns (kept faint: on a flat-shaded model a whole
		// facet sits in it, and PCF acne makes a shadow-ratio edge unreliable)
		// only on the facet's turn, never round a cast shadow's edge (E145, the user: "not great" — the band was as wide as
		// the shadow map's penumbra: an orange halo round every shadow)
		float term = faceLit * ( 1.0 - faceLit ) * inSun * 4.0;
		vec3 satAlb = alb * alb / max( max( alb.r, max( alb.g, alb.b ) ), 1e-3 );
		reflectedLight.directDiffuse += RECIPROCAL_PI * ( alb * irr + satAlb * uToonTerm * term * sunCol );
		// rim on the lit side of vertical-ish faces (never the ground)
		vec3 nW = inverseTransformDirection( geometryNormal, viewMatrix );
		float fres = smoothstep( 0.55, 0.8, 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ) );   // a banded rim, not a soft glow
		float rim = fres * smoothstep( -0.3, 0.2, NdL ) * shadow * cloud * smoothstep( 0.85, 0.4, abs( nW.y ) );
		reflectedLight.directDiffuse += uToonRim * rim * sunCol * RECIPROCAL_PI * ( 0.35 + alb );
		if ( material.roughness < 0.72 ) {
			IncidentLight lit = directLight;
			lit.color = sunCol * band;
			ReflectedLight spec = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
			RE_Direct_Physical( lit, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, spec );
			reflectedLight.directSpecular += spec.directSpecular;
		}
		return;
	}
	#endif
	RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}

void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	// ambient + hemisphere (three's light uniforms) and the violet lift: the whole shade band
	reflectedLight.indirectDiffuse += ( irradiance + uToonLift ) * BRDF_Lambert( material.diffuseContribution );
}

void RE_IndirectSpecular_Toon( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	// the IBL's diffuse (irradiance) is dropped; its specular stays for metals and glossy bits
	RE_IndirectSpecular_Physical( radiance, vec3( 0.0 ), clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}

#undef RE_Direct
#undef RE_IndirectDiffuse
#undef RE_IndirectSpecular
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon
#define RE_IndirectSpecular		RE_IndirectSpecular_Toon
#endif
`,
  rampFogPars: /* glsl */`
#ifdef USE_FOG
  uniform vec3 uFogZenith; uniform vec3 uFogNear; uniform float uFogStart; uniform float uFogEnd;
#endif`,
  rampFog: /* glsl */`
#ifdef USE_FOG
  {
    vec3 ray = vFogWorldPos - cameraPosition;
    float rayLen = length( ray );
    vec3 viewDir = ray / max( rayLen, 1e-3 );
    // the old exponential height + distance fog (underwater drives these up)
    float dy = vFogWorldPos.y - cameraPosition.y;
    float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
    float t = fogHeightFalloff * dy;
    float integ = abs( t ) > 1e-3 ? ( 1.0 - exp( - t ) ) / t : 1.0;
    float expF = clamp( 1.0 - exp( - ( fogHeightDensity * camF * integ * rayLen + fogDistDensity * rayLen ) ), 0.0, 1.0 );
    // the ramp
    float r = smoothstep( uFogStart, uFogEnd, rayLen );
    float rampF = pow( r, 0.8 ) * mix( 1.0, 0.72, smoothstep( 4.0, 40.0, vFogWorldPos.y ) );
    float e = max( viewDir.y, 0.0 );
    vec3 skyCol = mix( fogColor, uFogZenith, pow( smoothstep( 0.0, 0.75, e ), 0.62 ) );
    vec3 col = mix( uFogNear, skyCol, smoothstep( 0.0, 0.55, r ) );
    col += fogSunColor * pow( max( dot( viewDir, fogSunDir ), 0.0 ), 8.0 ) * 0.3 * r;
    col = mix( col, fogColor, clamp( ( expF - rampF ) * 4.0, 0.0, 1.0 ) );   // under the sea the dense turquoise fog wins, in its own colour
    gl_FragColor.rgb = mix( gl_FragColor.rgb, col, max( rampF, expF ) );
  }
#endif`,
};
