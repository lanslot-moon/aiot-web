export type Schema = Record<string, unknown>;
export function schemaObject(value: unknown): Schema {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Schema : {};
}
export function fieldsOf(schema: unknown): Record<string, unknown> {
  return schemaObject(schemaObject(schema).properties);
}
export function schemaType(schema: unknown): string {
  const value = schemaObject(schema);
  return typeof value.type === 'string' ? value.type : value.properties ? 'object' : '';
}
export function supportsForm(schema: unknown, depth = 0): boolean {
  const value = schemaObject(schema);
  if (depth > 8 || ['$ref', 'oneOf', 'anyOf', 'allOf', 'not', 'if', 'const', 'patternProperties', 'dependentSchemas'].some(key => key in value)) return false;
  if (Array.isArray(value.enum)) return value.enum.every(item => ['string', 'number', 'boolean'].includes(typeof item));
  switch (schemaType(schema)) {
    case 'boolean': case 'string': case 'number': case 'integer': return true;
    case 'object': return ('properties' in value || value.additionalProperties === false) && (Array.isArray(value.required) ? value.required : []).every(key => typeof key === 'string' && supportsForm(fieldsOf(schema)[key], depth + 1));
    case 'array': return supportsForm(value.items, depth + 1);
    default: return false;
  }
}
export function initialValue(schema: unknown): unknown {
  const value = schemaObject(schema);
  if (Array.isArray(value.enum)) return value.enum[0];
  switch (schemaType(schema)) {
    case 'boolean': return false;
    case 'object': return Object.fromEntries((Array.isArray(value.required) ? value.required : []).filter((key): key is string => typeof key === 'string' && key in fieldsOf(schema)).map(key => [key, initialValue(fieldsOf(schema)[key])]));
    case 'array': return [];
    default: return '';
  }
}
// Reject values the form cannot faithfully display before leaving the JSON editor.
export function canRepresent(schema: unknown, data: unknown): boolean {
  if (!supportsForm(schema)) return false;
  const value = schemaObject(schema);
  if (Array.isArray(value.enum)) return value.enum.some(item => Object.is(item, data));
  switch (schemaType(schema)) {
    case 'boolean': return typeof data === 'boolean';
    case 'number': case 'integer': return typeof data === 'number' || data === '';
    case 'string': return typeof data === 'string';
    case 'array': return Array.isArray(data) && data.every(item => canRepresent(value.items, item));
    case 'object': return data !== null && typeof data === 'object' && !Array.isArray(data) && Object.entries(data).every(([key, item]) => Object.prototype.hasOwnProperty.call(fieldsOf(schema), key) && canRepresent(fieldsOf(schema)[key], item));
    default: return false;
  }
}
export function fieldError(schema: unknown, data: unknown): string | undefined {
  const value = schemaObject(schema);
  if (!supportsForm(schema)) return undefined; // Advanced schema validation remains server-owned.
  if (schemaType(schema) === 'object') {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return '请输入对象';
    if (value.additionalProperties === false && Object.keys(data).some(key => !Object.prototype.hasOwnProperty.call(fieldsOf(schema), key))) return '包含未定义的参数';
  } else if (!canRepresent(schema, data)) return '值类型与功能定义不符';
  if (schemaType(schema) === 'number' || schemaType(schema) === 'integer') {
    if (data === '' || typeof data !== 'number' || !Number.isFinite(data)) return '请输入有效数字';
    if (schemaType(schema) === 'integer' && !Number.isInteger(data)) return '请输入整数';
    if (typeof value.minimum === 'number' && data < value.minimum) return `不能小于 ${value.minimum}`;
    if (typeof value.maximum === 'number' && data > value.maximum) return `不能大于 ${value.maximum}`;
    if (typeof value.exclusiveMinimum === 'number' && data <= value.exclusiveMinimum) return `必须大于 ${value.exclusiveMinimum}`;
    if (typeof value.exclusiveMaximum === 'number' && data >= value.exclusiveMaximum) return `必须小于 ${value.exclusiveMaximum}`;
    if (typeof value.multipleOf === 'number' && value.multipleOf > 0 && Math.abs(data / value.multipleOf - Math.round(data / value.multipleOf)) > 1e-8) return `须为 ${value.multipleOf} 的倍数`;
  }
  if (typeof data === 'string') {
    if (typeof value.minLength === 'number' && [...data].length < value.minLength) return `至少 ${value.minLength} 个字符`;
    if (typeof value.maxLength === 'number' && [...data].length > value.maxLength) return `最多 ${value.maxLength} 个字符`;
  }
  if (schemaType(schema) === 'object') {
    const object = schemaObject(data);
    for (const key of Array.isArray(value.required) ? value.required : []) {
      if (typeof key === 'string' && !Object.prototype.hasOwnProperty.call(object, key)) return `请填写 ${key}`;
    }
    for (const [key, item] of Object.entries(object)) {
      const error = fieldError(fieldsOf(schema)[key], item);
      if (error) return `${key}：${error}`;
    }
  }
  if (Array.isArray(data)) {
    if (typeof value.minItems === 'number' && data.length < value.minItems) return `至少 ${value.minItems} 项`;
    if (typeof value.maxItems === 'number' && data.length > value.maxItems) return `最多 ${value.maxItems} 项`;
    if (value.uniqueItems === true && new Set(data.map(item => JSON.stringify(item))).size !== data.length) return '列表项不能重复';
    for (const [index, item] of data.entries()) {
      const error = fieldError(value.items, item);
      if (error) return `第 ${index + 1} 项：${error}`;
    }
  }
  return undefined;
}
