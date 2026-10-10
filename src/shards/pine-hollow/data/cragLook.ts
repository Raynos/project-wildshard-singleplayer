// Pine Hollow's crag and cave looks as data (SHARD-PLATFORM M3, look-family rows): the triplanar granite's edits of the
// standard material (world/crags.ts `cragMaterial` applies them through @wildshard/sdk/looks/shaderEdits inside its
// patch) and the cave shaft's program. The vertex `cdata` = (AO, sun reach, wet, rock): AO multiplies the indirect light,
// sun reach the directional lights only; `ctint` = (tint shade, tint path / face skin).
import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/** the granite's albedo lift (E322 F-L1) */
const CRAG_LIFT = 1.3;
/** the granite's tile (m): one mossy_rock repeat per 4.6 m on the faces, the grit per 3.4 m */
const ROCK_TILE = 4.6, GRIT_TILE = 3.4;

/**
 * Triplanar granite in world space for the BatchedMesh (and the cave inside it): albedo / normal / ARM from `mossy_rock`
 * on the X and Z projections and on the Y one blended with `rock_ground` grit on the ledges, moss on the up-facing,
 * dark rain streaks down the faces, and a tint path for the cave's bedding and bones.
 */
export const CRAG_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <common>', put: `#include <common>
        attribute vec4 cdata;
        attribute vec2 ctint;
        varying vec3 vCW;
        varying vec3 vCN;
        varying vec4 vCD;
        varying vec2 vCT;` },
  { stage: 'vertex', find: '#include <project_vertex>', put: `#include <project_vertex>
        {
          vec4 cw = vec4( transformed, 1.0 );
          vec3 cn = objectNormal;
          #ifdef USE_BATCHING
            cw = batchingMatrix * cw; cn = mat3( batchingMatrix ) * cn;
          #endif
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw; cn = mat3( instanceMatrix ) * cn;
          #endif
          vCW = ( modelMatrix * cw ).xyz;
          vCN = normalize( mat3( modelMatrix ) * cn );
          vCD = cdata; vCT = ctint;
        }` },
  { stage: 'fragment', find: '#include <common>', put: `#include <common>
        uniform sampler2D tRockD, tRockN, tRockA, tGritD, tGritN;
        uniform float uCaveFill;
        varying vec3 vCW;
        varying vec3 vCN;
        varying vec4 vCD;
        varying vec2 vCT;
        float cHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
        float cNoise( vec2 p ) {
          vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( cHash( i ), cHash( i + vec2( 1, 0 ) ), f.x ), mix( cHash( i + vec2( 0, 1 ) ), cHash( i + vec2( 1, 1 ) ), f.x ), f.y );
        }
        // whiteout-blended tangent normal → world, for a projection whose tangent plane is (a, b) and axis c
        vec3 cUnpack( vec4 t ) { return t.xyz * 2.0 - 1.0; }
        ` },
  { stage: 'fragment', find: '#include <map_fragment>', put: `
        vec3 cwn = normalize( vCN );
        vec3 cln = cwn; // the base normal the lighting sees
        // the face skin (ctint.y = 1) is projected by its facets: its smoothed normals average a riser with the tread
        // above it, and the projection laid the tread's texture down the riser (the stretch). It is lit half by its
        // facets, half smooth: fully faceted, a 0.7 m grid read as low-poly
        {
          vec3 cfn = normalize( cross( dFdx( vCW ), dFdy( vCW ) ) );
          cfn *= sign( dot( cfn, cwn ) + 1e-4 );
          float skin = step( 0.5, vCT.y ) * step( 0.5, vCD.a );
          cln = normalize( mix( cwn, cfn, 0.5 * skin ) );
          cwn = normalize( mix( cwn, cfn, skin ) );
        }
        vec3 cb = pow( abs( cwn ), vec3( 4.0 ) ); cb /= max( cb.x + cb.y + cb.z, 1e-5 );
        vec3 sg = sign( cwn + 1e-4 );
        vec2 uvX = vec2( vCW.z * sg.x, vCW.y ) * ${(1 / ROCK_TILE).toFixed(4)};
        vec2 uvY = vec2( vCW.x * sg.y, vCW.z ) * ${(1 / ROCK_TILE).toFixed(4)};
        vec2 uvZ = vec2( -vCW.x * sg.z, vCW.y ) * ${(1 / ROCK_TILE).toFixed(4)};
        float up = smoothstep( 0.45, 0.9, cwn.y );
        float outside = vCD.g;
        float rockW = step( 0.5, vCD.a );
        // the grit on the ledges (the Y projection): patchy
        float gritN = cNoise( vCW.xz * 0.35 ) * 0.65 + cNoise( vCW.xz * 1.3 ) * 0.35;
        float grit = up * smoothstep( 0.35, 0.65, gritN ) * rockW;
        vec3 aX = texture2D( tRockD, uvX ).rgb, aZ = texture2D( tRockD, uvZ ).rgb;
        vec3 aY = texture2D( tRockD, uvY ).rgb;
        vec2 uvG = vCW.xz * ${(1 / GRIT_TILE).toFixed(4)};
        if ( grit > 0.01 ) aY = mix( aY, texture2D( tGritD, uvG ).rgb * vec3( 0.95, 0.93, 0.9 ), grit );
        vec3 alb = aX * cb.x + aY * cb.y + aZ * cb.z;
        vec3 armX = texture2D( tRockA, uvX ).rgb, armY = texture2D( tRockA, uvY ).rgb, armZ = texture2D( tRockA, uvZ ).rgb;
        vec3 carm = armX * cb.x + armY * cb.y + armZ * cb.z;
        // granite, not a lichen carpet: the lichen's green / yellow cools toward grey on the steep faces and in the dark
        float lum = dot( alb, vec3( 0.299, 0.587, 0.114 ) );
        float keep = mix( 0.58, 0.9, up ) * mix( 0.5, 1.0, outside );
        alb = mix( vec3( lum ) * vec3( 0.98, 1.0, 1.04 ), alb, keep );
        // rain streaks down the faces: dark vertical stains under the ledges
        float streak = cNoise( vec2( ( vCW.x + vCW.z ) * 0.9, vCW.y * 0.06 ) ) * cNoise( vec2( ( vCW.x - vCW.z ) * 0.33, vCW.y * 0.02 + 7.0 ) );
        alb *= 1.0 - 0.2 * smoothstep( 0.12, 0.45, streak ) * ( 1.0 - up ) * outside;
        // moss on the up-facing, outside (the cave's floor stays bare)
        float mossN = cNoise( vCW.xz * 0.21 + 3.0 ) * 0.6 + cNoise( vCW.xz * 0.9 ) * 0.4;
        float moss = smoothstep( 0.62, 0.92, cwn.y ) * smoothstep( 0.42, 0.62, mossN ) * outside * rockW * ( 1.0 - grit * 0.6 );
        alb = mix( alb, vec3( 0.075, 0.095, 0.035 ) * ( 0.8 + 0.4 * mossN ), moss * 0.85 );
        // a macro variation so a face does not tile
        alb *= 0.86 + 0.28 * cNoise( vCW.xz * 0.045 + vCW.y * 0.03 );
        alb *= mix( vec3( 1.0 ), vec3( 1.1, 1.0, 0.86 ), smoothstep( 0.35, 0.75, cNoise( vCW.xz * 0.018 + 9.0 ) ) * rockW ); // warm iron-stained patches
        // E322 F-L1: the look targets' pale granite (the Ridge's rock was ΔE00 8.8 darker and blotchier): lifted, the
        // blotches pulled toward their mean
        {
          float gl = dot( alb, vec3( 0.299, 0.587, 0.114 ) );
          alb = mix( alb, mix( vec3( gl ), vec3( 0.36, 0.35, 0.33 ), 0.35 ), 0.3 * rockW * ( 1.0 - moss ) ) * mix( 1.0, ${CRAG_LIFT.toFixed(3)}, rockW );
        }
        // the tint path (the cave's bedding, bones, twigs): its own albedo, the granite's normal for grain
        vec3 tintCol = vCT.y < 0.25 ? vec3( 0.62, 0.58, 0.49 ) : vCT.y < 0.5 ? vec3( 0.42, 0.33, 0.19 ) : vec3( 0.19, 0.13, 0.08 );
        alb = mix( tintCol * vCT.x * ( 0.85 + 0.3 * cNoise( vCW.xz * 6.0 ) ), alb, rockW );
        diffuseColor.rgb *= alb;
        float cRough = mix( 0.95, carm.g, rockW );
        cRough = mix( cRough, 0.9, moss );
        float cAO = mix( 1.0, carm.r, 0.75 * rockW );
        // the cave's wet (drips, the damp floor): darker, glossier
        diffuseColor.rgb *= 1.0 - 0.35 * vCD.b;
        cRough = mix( cRough, 0.28, vCD.b );` },
  { stage: 'fragment', find: '#include <roughnessmap_fragment>', put: 'float roughnessFactor = roughness * cRough;' },
  { stage: 'fragment', find: '#include <metalnessmap_fragment>', put: 'float metalnessFactor = 0.0;' },
  { stage: 'fragment', find: '#include <normal_fragment_maps>', put: `
        {
          vec3 nX = cUnpack( texture2D( tRockN, uvX ) ), nY = cUnpack( texture2D( tRockN, uvY ) ), nZ = cUnpack( texture2D( tRockN, uvZ ) );
          if ( grit > 0.01 ) nY = normalize( mix( nY, cUnpack( texture2D( tGritN, uvG ) ), grit ) );
          nX.x *= sg.x; nY.x *= sg.y; nZ.x *= -sg.z;
          float str = mix( 0.35, 1.0, rockW ) * ( 1.0 - 0.6 * moss );
          nX.xy *= str; nY.xy *= str; nZ.xy *= str;
          // whiteout blend (the tangent frames: X ← (z, y), Y ← (x, z), Z ← (x, y))
          vec3 tX = vec3( nX.xy + cln.zy, abs( nX.z ) * cln.x );
          vec3 tY = vec3( nY.xy + cln.xz, abs( nY.z ) * cln.y );
          vec3 tZ = vec3( nZ.xy + vec2( -cln.x, cln.y ), abs( nZ.z ) * cln.z );
          vec3 wN = normalize( tX.zyx * cb.x + tY.xzy * cb.y + vec3( -tZ.x, tZ.y, tZ.z ) * cb.z );
          normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );
        }` },
  { stage: 'fragment', find: '#include <emissivemap_fragment>', put: `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uCaveFill * vCD.r * ( 1.0 - vCD.g );` },
  // the directional lights (the sun / the moon through CSM) × sun reach; point lights (the lantern, the lamps) untouched
  { stage: 'fragment', find: '#include <lights_fragment_begin>', put: { chunk: 'lights_fragment_begin', edits: [{ find: 'getDirectionalLightInfo\\(([^;]+)\\);', flags: 'g', put: 'getDirectionalLightInfo($1); directLight.color *= vCD.g;' }] } },
  // the haze belongs outside: in the cave (sun reach 0) the fog's bright sky colour is kept off the rock
  { stage: 'fragment', find: '#include <fog_fragment>', put: `vec3 cPreFog = gl_FragColor.rgb;
        #include <fog_fragment>
        gl_FragColor.rgb = mix( cPreFog, gl_FragColor.rgb, mix( 0.06, 1.0, vCD.g ) );` },
  { stage: 'fragment', find: '#include <aomap_fragment>', put: `
        {
          // inside, the fill (the emissive term) is the cave's light
          // (the sky's own light has no business under the roof: there the fill carries it, the same from every side)
          float amb = cAO * max( vCD.r, 0.012 ) * mix( 0.08, 1.0, vCD.g );
          reflectedLight.indirectDiffuse *= amb;
          reflectedLight.indirectSpecular *= amb * mix( 0.35, 1.0, vCD.g );
        }` },
];

/** the cave's shaft of light: an open cone from the crack to the floor, additive, brightest at the crack, fading to the
 *  floor and toward its rim (uI the intensity, uLen the cone's length) */
export const CAVE_SHAFT_GLSL = {
  vertex: /* glsl */`
        varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        uniform float uLen;
        void main() {
          vT = -position.y / uLen;
          vec4 w = modelMatrix * vec4( position, 1.0 );
          vP = w.xyz;
          vN = normalize( mat3( modelMatrix ) * normal );
          vV = normalize( cameraPosition - w.xyz );
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
  fragment: /* glsl */`
        varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        uniform float uI; uniform float uTime;
        void main() {
          float rim = abs( dot( normalize( vN ), vV ) );
          float body = pow( rim, 2.2 );
          float along = ( 1.0 - vT * 0.75 ) * smoothstep( 0.0, 0.06, vT ) * smoothstep( 1.0, 0.82, vT );
          float mote = 0.85 + 0.15 * sin( vP.y * 3.1 + uTime * 0.7 + vP.x * 5.0 ) * sin( vP.z * 4.3 - uTime * 0.4 );
          float near = smoothstep( 0.8, 4.0, length( vP - cameraPosition ) ); // walked into, it thins out instead of whiting the view
          gl_FragColor = vec4( vec3( 1.0, 0.93, 0.78 ) * body * along * mote * near * uI, 1.0 );
        }`,
};
