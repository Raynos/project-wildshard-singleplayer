// Bounded authoring adaptation of V8's fdlibm sine, retaining the original ARM64 fused operations.
// https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/base/ieee754.cc
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely granted,
// provided that this notice is preserved.
// The original source has been modified significantly by Google Inc.
// Copyright 2016 the V8 project authors. All rights reserved.

const words = new DataView(new ArrayBuffer(8));
function parts(value: number): { mantissa: bigint; exponent: number } {
  words.setFloat64(0, value);
  const bits = words.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n);
  const mantissa = (bits & ((1n << 52n) - 1n)) | (exponent === 0 ? 0n : 1n << 52n);
  return { mantissa: bits >> 63n ? -mantissa : mantissa, exponent: exponent === 0 ? -1074 : exponent - 1075 };
}

/** Round each bounded fused operation once, ties to even, independently of host FMA support.
 * Kernel intermediates are finite normal doubles; the tiny-angle branch bypasses subnormal arithmetic. */
function fused(a: number, b: number, c: number): number {
  if (a === 0 || b === 0) return c;
  if (c === 0) return a * b;
  const x = parts(a), y = parts(b), z = parts(c), productExponent = x.exponent + y.exponent;
  const exponent = Math.min(productExponent, z.exponent);
  let value = (x.mantissa * y.mantissa << BigInt(productExponent - exponent)) + (z.mantissa << BigInt(z.exponent - exponent));
  const sign = value < 0n ? -1 : 1;
  if (value < 0n) value = -value;
  if (value === 0n) return 0;
  const shift = Math.max(0, value.toString(2).length - 53);
  if (shift > 0) {
    const bits = BigInt(shift), half = 1n << (bits - 1n), rounded = value >> bits, remainder = value - (rounded << bits);
    value = rounded + (remainder > half || (remainder === half && (rounded & 1n) !== 0n) ? 1n : 0n);
  }
  return sign * Number(value) * 2 ** (exponent + shift);
}

function highWord(value: number): number { words.setFloat64(0, value); return words.getUint32(0) & 0x7fffffff; }
function sineKernel(x: number, y: number, tail: boolean): number {
  if (Math.abs(x) < 2 ** -27) return x;
  const z = x * x, cube = z * x;
  const r = fused(z, fused(z, fused(z, fused(z, 1.58969099521155010221e-10, -2.50507602534068634195e-8),
    2.75573137070700676789e-6), -1.98412698298579493134e-4), 8.33333333332248946124e-3);
  const first = -1.66666666666666324348e-1;
  return tail ? x - fused(-cube, first, fused(z, fused(0.5, y, -cube * r), -y)) : fused(cube, fused(z, r, first), x);
}

function cosineKernel(x: number, y: number): number {
  const high = highWord(x);
  if (Math.abs(x) < 2 ** -27) return 1;
  const z = x * x, r = z * fused(z, fused(z, fused(z, fused(z, fused(z, -1.13596475577881948265e-11,
    2.08757232129817482790e-9), -2.75573143513906633035e-7), 2.48015872894767294178e-5), -1.38888888888741095749e-3), 4.16666666666666019037e-2);
  const correction = fused(z, r, -x * y);
  if (high < 0x3fd33333) return 1 - (0.5 * z - correction);
  let quarter = 0.28125;
  if (high <= 0x3fe90000) { words.setUint32(0, high - 0x00200000); words.setUint32(4, 0); quarter = words.getFloat64(0); }
  return (1 - quarter) - ((0.5 * z - quarter) - correction);
}

/** Original authoring sine for a clamped rope phase in [0, pi], with exact original ARM64 rounding.
 * This is neither a general trigonometry service nor a runtime physics change. */
export function bridgeSine(x: number): number {
  if (!Number.isFinite(x) || x < 0 || x > Math.PI) throw new Error('Bridge sine phase outside [0, pi]');
  const high = highWord(x);
  if (high <= 0x3fe921fb) return sineKernel(x, 0, false);
  const first = 1.57079632673412561417, firstTail = 6.07710050650619224932e-11;
  const second = 6.07710050630396597660e-11, secondTail = 2.02226624879595063154e-21;
  let head: number, tail: number, quadrant: number;
  if (high < 0x4002d97c) {
    let z = x - first;
    if (high !== 0x3ff921fb) { head = z - firstTail; tail = (z - head) - firstTail; }
    else { z -= second; head = z - secondTail; tail = (z - head) - secondTail; }
    quadrant = 1;
  } else {
    quadrant = Math.trunc(x * 6.36619772367581382433e-1 + 0.5);
    let r = x - quadrant * first, w = quadrant * firstTail;
    head = r - w;
    const exponent = high >> 20;
    if (exponent - ((highWord(head) >> 20) & 2047) > 16) {
      let previous = r;
      w = quadrant * second; r = previous - w; w = quadrant * secondTail - ((previous - r) - w); head = r - w;
      if (exponent - ((highWord(head) >> 20) & 2047) > 49) {
        previous = r; w = quadrant * 2.02226624871116645580e-21; r = previous - w;
        w = quadrant * 8.47842766036889956997e-32 - ((previous - r) - w); head = r - w;
      }
    }
    tail = (r - head) - w;
  }
  return quadrant === 1 ? cosineKernel(head, tail) : -sineKernel(head, tail, true);
}
