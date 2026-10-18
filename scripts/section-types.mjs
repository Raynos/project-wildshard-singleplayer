// Standalone declarations from the same output JSON schemas the builder ships.
// Refuse unsupported shapes instead of silently weakening a product's type.
/** @param {import('../src/sdk/formatJsonSchema').FormatJsonSchema | boolean} schema @returns {string} */
export function sectionType(schema) {
  if (schema === true) return 'unknown';
  if (schema === false) return 'never';
  if (schema.$ref !== undefined) throw new Error(`Unresolved section type: ${schema.$ref}`);
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum !== undefined) return schema.enum.length === 0 ? 'never' : schema.enum.map(value => JSON.stringify(value)).join(' | ');
  const branches = schema.anyOf ?? schema.oneOf;
  if (branches !== undefined) return `(${branches.map(sectionType).join(' | ')})`;
  if (schema.allOf !== undefined) return `(${schema.allOf.map(sectionType).join(' & ')})`;
  if (Array.isArray(schema.type)) return `(${schema.type.map(type => sectionType({ ...schema, type })).join(' | ')})`;
  if (schema.type === 'string' || schema.type === 'boolean' || schema.type === 'null') return schema.type;
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'array') {
    if (Array.isArray(schema.items)) return `[${schema.items.map(sectionType).join(', ')}]`;
    const item = schema.items ?? true, type = sectionType(item);
    return `${typeof item === 'object' && item.enum !== undefined && item.enum.length > 1 ? `(${type})` : type}[]`;
  }
  if (schema.type === 'object') {
    const required = new Set(schema.required);
    const properties = Object.entries(schema.properties ?? {}).map(([name, value]) =>
      `${JSON.stringify(name)}${required.has(name) ? '' : '?'}: ${sectionType(value)};`);
    if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
      properties.push(`[key: string]: ${sectionType(schema.additionalProperties)};`);
    }
    return `{ ${properties.join(' ')} }`;
  }
  if (schema.not !== undefined && Object.keys(schema.not).length === 0) return 'never';
  if (Object.keys(schema).every(key => key === '$schema' || key === 'description' || key === 'title')) return 'unknown';
  throw new Error(`Unsupported section type: ${JSON.stringify(schema)}`);
}
