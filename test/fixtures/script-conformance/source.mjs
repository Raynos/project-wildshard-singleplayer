/** Compiler input for the cross-engine gate: libm, integer state, queries, events, memory growth and actor effects. */
export const CONFORMANCE_SOURCE = `
@external("env", "query") declare function query(kind:i32,request:i32,response:i32):i32;
let counter:i64 = 0;
export function abi_version():i32 { return 0; }
export function init(lo:i32,hi:i32):void { counter = i64(lo); }
export function in_ptr():i32 { return 16384; }
export function in_cap():i32 { return 4096; }
export function out_ptr():i32 { return 24576; }
export function out_cap():i32 { return 32; }
export function out_count():i32 { return 4; }
export function on_tick():void {
  counter++;
  let tick = load<f64>(16384), actor = load<f64>(16384+32);
  if (tick == 2 && actor == 1) memory.grow(1);
  for(let i:i32=0;i<8;i++) store<f64>(32768+i*8,tick+f64(i));
  let kind = i32(tick)%5 == 0 ? 410 : i32(tick)%4+1;
  let n = query(kind,32768,33792);
  let result = n>0?load<f64>(33792):0;
  let angle = tick*0.03125+f64(counter)*0.001;
  let math = Math.sin(angle)+Math.cos(angle)+Math.atan2(angle,2)+Math.sqrt(angle+1)+Math.pow(1.01,angle);
  let narrow = f64(f32(math));
  store<f64>(24576,1);store<f64>(24584,1);store<f64>(24592,narrow+result);
  store<f64>(24616,5);store<f64>(24624,101);store<f64>(24632,1);
  store<f64>(24656,6);store<f64>(24664,202);store<f64>(24672,load<f64>(16384+72)+1);
  store<f64>(24696,3);store<f64>(24704,1);store<f64>(24712,actor==1?2:1);store<f64>(24720,load<f64>(16384+256)+f64(counter));
}`;
