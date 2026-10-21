/** Host-owned numeric output locations. Guest lengths and pointers never create
 * these ranges; the admitted binding layout does. Offsets are absolute bytes. */
export interface FloatColumnV2 { readonly offset: number; readonly count: number; readonly width: 4 | 8; readonly stride?: number }
/** Validate every scalar before a caller publishes any candidate. Integer IDs,
 * capabilities and domain constraints still require their defining validators. */
export function validateV2FloatColumns(view: DataView,columns: readonly FloatColumnV2[]): void {
  for (const column of columns) {
    const stride = column.stride ?? column.width;
    if (![4,8].includes(column.width) || !Number.isSafeInteger(column.offset) || column.offset < 0 || column.offset%column.width !== 0 || column.offset > view.byteLength
      || !Number.isSafeInteger(column.count) || column.count < 0 || !Number.isSafeInteger(stride) || stride < column.width || stride%column.width !== 0
      || (column.count > 0 && (column.width > view.byteLength-column.offset || column.count-1 > Math.floor((view.byteLength-column.offset-column.width)/stride)))) throw new Error('V2 output column outside fixed memory');
    for (let i = 0,at = column.offset; i < column.count; i++,at += stride) {
      const value = column.width === 4 ? view.getFloat32(at,true) : view.getFloat64(at,true);
      if (!Number.isFinite(value)) throw new Error('Non-finite v2 output column');
    }
  }
}
