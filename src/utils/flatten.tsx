// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenObject(obj: any, prefix = ''): Record<string, string> {
  let result: Record<string, string> = {};

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null) {
      const flattened = flattenObject(value, newKey);
      result = { ...result, ...flattened };
    } else {
      result[newKey] = value;
    }
  }

  return result;
}
