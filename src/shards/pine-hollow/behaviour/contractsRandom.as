/** JavaScript ToUint32, including the legacy board's f64 multiply/add before
 * the first coercion. Do not replace the seed expression with u32 products. */
@inline function uint(value:f64):u32 {
  if(!isFinite(value)||value==0)return 0;
  const integer=value<0?Math.ceil(value):Math.floor(value);
  return <u32>(integer-Math.floor(integer/4294967296.0)*4294967296.0);
}
/** The original serial/salt stream. It is independent of the page random stream. */
@inline export function contractRandom(serial:f64,salt:f64):f64 {
  // At this magnitude the legacy sum overflows to Infinity, then >>>0 is 0.
  let t:u32=Math.abs(serial)>f64.MAX_VALUE/2654435761.0?0:uint(serial*2654435761.0+salt*2246822507.0);
  t+=0x6d2b79f5;
  t=(t^(t>>>15))*(t|1);
  t^=t+(t^(t>>>7))*(t|61);
  return <f64>(t^(t>>>14))/4294967296.0;
}
