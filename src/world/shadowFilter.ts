/**
 * E138: the shadow filter on the low-poly shard's phone rig. three r186's PCF is 5 hardware-compared taps on a Vogel
 * disc, rotated per pixel by interleaved gradient noise. The toon ramp (stylize.ts, `smoothstep(0.25, 0.75, shadow)`)
 * turns that 5-tap penumbra back into a hard line. The line follows the map's texel staircase, so the pier pennant's
 * shadow read as a saw ("super jagged", while the flag itself looks "10 times smoother"), and the dither frayed the edge.
 *
 * `soft`, the default, is Castaño's optimised PCF (The Witness; MJP's shadow sample; the tent that Unity's high-quality
 * soft shadows use). Hardware 2×2 compares are placed and weighted so that 16 taps are an exact 7×7-texel tent (9 taps a
 * 5×5, 4 taps a 3×3): a smooth, noise-free ramp whose 0.5 contour is a curve, not a staircase. A light picks its tent by
 * its `shadow.radius`: ≥ 1.5 is 7×7, ≥ 1 is 5×5, below that 3×3 (Sky.ts sets the radii per filter). Per tap it adds a
 * receiver-plane depth bias (Isidoro 2006): the depth slope along the receiver, taken from screen derivatives of the
 * shadow coordinate and clamped. A wide kernel on a sloped deck then does not reach under its own surface and speckle.
 *
 * `?pshadowfilter=` picks another at boot:
 *   `tent`    the same tents one size down (5×5 near, 3×3 far);
 *   `poisson` 16 Poisson taps rotated per pixel by interleaved gradient noise;
 *   `vsm`     three's variance shadow map;
 *   `cheap`   three's own 5-tap filter (the look before E138).
 * The filter is patched into three's shader chunk before anything compiles. It never switches mid-play: a switch would
 * recompile every material.
 */
import * as THREE from 'three';

export type ShadowFilter = 'soft' | 'tent' | 'poisson' | 'vsm' | 'cheap';
const FILTERS: readonly ShadowFilter[] = ['soft', 'tent', 'poisson', 'vsm', 'cheap'];
/** the phone's default (E138, the user: "do the shadows properly and not use like a cheap phone filter") */
export const PHONE_SHADOW_FILTER: ShadowFilter = 'soft';

/** the filter the URL asks for, else `fallback` */
export function shadowFilterFromUrl(fallback: ShadowFilter): ShadowFilter {
  const want = new URLSearchParams(location.search).get('pshadowfilter');
  if (want === null) return fallback;
  const hit = FILTERS.find((f) => f === want);
  if (hit === undefined) console.warn(`[sky] ?pshadowfilter=${want}: not a filter (${FILTERS.join(' · ')})`);
  return hit ?? fallback;
}

/** [near cascade, far cascade] `shadow.radius` per filter: the tent sizes above, or the disc radius in texels */
export const FILTER_RADII: Record<ShadowFilter, readonly [number, number]> = {
  soft: [1.5, 1], tent: [1, 0.6], poisson: [2.5, 1.2], vsm: [3, 2], cheap: [1.2, 0.6],
};

/** three's 5-tap body of the 2D PCF getShadow (r186): from the texel size to the average */
const PCF_BODY = /vec2 texelSize = vec2\( 1\.0 \) \/ shadowMapSize;[\s\S]*?\) \* 0\.2;/;

const TENT = /* glsl */`
				// E138: Castaño's optimised PCF — hardware 2x2 compares placed and weighted into a 7x7 / 5x5 / 3x3 texel tent
				vec2 tuv = shadowCoord.xy * shadowMapSize;
				vec2 tbase = floor( tuv + 0.5 );
				float ts = tuv.x + 0.5 - tbase.x, tt = tuv.y + 0.5 - tbase.y;
				vec2 inv = vec2( 1.0 ) / shadowMapSize;
				tbase = ( tbase - 0.5 ) * inv;
				// receiver-plane depth bias: d(depth)/d(uv) along the receiver, from the screen derivatives of the shadow coordinate
				vec3 sdx = dFdx( shadowCoord.xyz ), sdy = dFdy( shadowCoord.xyz );
				float sdet = sdx.x * sdy.y - sdx.y * sdy.x;
				vec2 zSlope = abs( sdet ) > 1e-12 ? vec2( sdy.y * sdx.z - sdx.y * sdy.z, sdx.x * sdy.z - sdy.x * sdx.z ) / sdet : vec2( 0.0 );
				zSlope = clamp( zSlope, -2.0, 2.0 ) * inv; // per texel of tap offset; clamped where the receiver turns edge-on
				#define TENT_TAP( u, v ) texture( shadowMap, vec3( tbase + vec2( u, v ) * inv, shadowCoord.z + min( 0.0, dot( vec2( u, v ) - vec2( ts, tt ), zSlope ) ) ) )
				if ( shadowRadius >= 1.5 ) {
					float uw0 = 5.0 * ts - 6.0, uw1 = 11.0 * ts - 28.0, uw2 = -( 11.0 * ts + 17.0 ), uw3 = -( 5.0 * ts + 1.0 );
					float vw0 = 5.0 * tt - 6.0, vw1 = 11.0 * tt - 28.0, vw2 = -( 11.0 * tt + 17.0 ), vw3 = -( 5.0 * tt + 1.0 );
					float u0 = ( 4.0 * ts - 5.0 ) / uw0 - 3.0, u1 = ( 4.0 * ts - 16.0 ) / uw1 - 1.0, u2 = -( 7.0 * ts + 5.0 ) / uw2 + 1.0, u3 = -ts / uw3 + 3.0;
					float v0 = ( 4.0 * tt - 5.0 ) / vw0 - 3.0, v1 = ( 4.0 * tt - 16.0 ) / vw1 - 1.0, v2 = -( 7.0 * tt + 5.0 ) / vw2 + 1.0, v3 = -tt / vw3 + 3.0;
					shadow = ( uw0 * vw0 * TENT_TAP( u0, v0 ) + uw1 * vw0 * TENT_TAP( u1, v0 ) + uw2 * vw0 * TENT_TAP( u2, v0 ) + uw3 * vw0 * TENT_TAP( u3, v0 )
						+ uw0 * vw1 * TENT_TAP( u0, v1 ) + uw1 * vw1 * TENT_TAP( u1, v1 ) + uw2 * vw1 * TENT_TAP( u2, v1 ) + uw3 * vw1 * TENT_TAP( u3, v1 )
						+ uw0 * vw2 * TENT_TAP( u0, v2 ) + uw1 * vw2 * TENT_TAP( u1, v2 ) + uw2 * vw2 * TENT_TAP( u2, v2 ) + uw3 * vw2 * TENT_TAP( u3, v2 )
						+ uw0 * vw3 * TENT_TAP( u0, v3 ) + uw1 * vw3 * TENT_TAP( u1, v3 ) + uw2 * vw3 * TENT_TAP( u2, v3 ) + uw3 * vw3 * TENT_TAP( u3, v3 ) ) / 2704.0;
				} else if ( shadowRadius >= 1.0 ) {
					float uw0 = 4.0 - 3.0 * ts, uw2 = 1.0 + 3.0 * ts, vw0 = 4.0 - 3.0 * tt, vw2 = 1.0 + 3.0 * tt;
					float u0 = ( 3.0 - 2.0 * ts ) / uw0 - 2.0, u1 = ( 3.0 + ts ) / 7.0, u2 = ts / uw2 + 2.0;
					float v0 = ( 3.0 - 2.0 * tt ) / vw0 - 2.0, v1 = ( 3.0 + tt ) / 7.0, v2 = tt / vw2 + 2.0;
					shadow = ( uw0 * vw0 * TENT_TAP( u0, v0 ) + 7.0 * vw0 * TENT_TAP( u1, v0 ) + uw2 * vw0 * TENT_TAP( u2, v0 )
						+ uw0 * 7.0 * TENT_TAP( u0, v1 ) + 49.0 * TENT_TAP( u1, v1 ) + uw2 * 7.0 * TENT_TAP( u2, v1 )
						+ uw0 * vw2 * TENT_TAP( u0, v2 ) + 7.0 * vw2 * TENT_TAP( u1, v2 ) + uw2 * vw2 * TENT_TAP( u2, v2 ) ) / 144.0;
				} else {
					float uw0 = 3.0 - 2.0 * ts, uw1 = 1.0 + 2.0 * ts, vw0 = 3.0 - 2.0 * tt, vw1 = 1.0 + 2.0 * tt;
					float u0 = ( 2.0 - ts ) / uw0 - 1.0, u1 = ts / uw1 + 1.0, v0 = ( 2.0 - tt ) / vw0 - 1.0, v1 = tt / vw1 + 1.0;
					shadow = ( uw0 * vw0 * TENT_TAP( u0, v0 ) + uw1 * vw0 * TENT_TAP( u1, v0 )
						+ uw0 * vw1 * TENT_TAP( u0, v1 ) + uw1 * vw1 * TENT_TAP( u1, v1 ) ) / 16.0;
				}
				#undef TENT_TAP`;

const POISSON = /* glsl */`
				// E138: 16 Poisson taps (hardware-compared, so each is a bilinear 2x2), rotated per pixel by interleaved gradient noise
				const vec2 PD[ 16 ] = vec2[]( vec2( -0.94201624, -0.39906216 ), vec2( 0.94558609, -0.76890725 ), vec2( -0.09418410, -0.92938870 ),
					vec2( 0.34495938, 0.29387760 ), vec2( -0.91588581, 0.45771432 ), vec2( -0.81544232, -0.87912464 ), vec2( -0.38277543, 0.27676845 ),
					vec2( 0.97484398, 0.75648379 ), vec2( 0.44323325, -0.97511554 ), vec2( 0.53742981, -0.47373420 ), vec2( -0.26496911, -0.41893023 ),
					vec2( 0.79197514, 0.19090188 ), vec2( -0.24188840, 0.99706507 ), vec2( -0.81409955, 0.91437590 ), vec2( 0.19984126, 0.78641367 ),
					vec2( 0.14383161, -0.14100790 ) );
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				mat2 rot = mat2( cos( phi ), sin( phi ), -sin( phi ), cos( phi ) );
				shadow = 0.0;
				for ( int k = 0; k < 16; k ++ ) shadow += texture( shadowMap, vec3( shadowCoord.xy + rot * PD[ k ] * shadowRadius * texelSize, shadowCoord.z ) );
				shadow *= 0.0625;`;

/**
 * Patch the filter into three's shadow chunk (once, at boot, before any material compiles) and return the shadow map
 * type the renderer must use.
 */
export function installShadowFilter(filter: ShadowFilter): THREE.ShadowMapType {
  if (filter === 'vsm') return THREE.VSMShadowMap;
  if (filter === 'cheap') return THREE.PCFShadowMap;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (!PCF_BODY.test(chunk)) { console.warn('[sky] shadowmap_pars_fragment changed: the E138 shadow filter is off'); return THREE.PCFShadowMap; }
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk.replace(PCF_BODY, filter === 'poisson' ? POISSON : TENT);
  return THREE.PCFShadowMap;
}
