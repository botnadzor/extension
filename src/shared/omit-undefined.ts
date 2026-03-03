type UndefinedKeys<T> = {
  [K in keyof T]: T[K] extends undefined ? K : never;
}[keyof T];

export type WithoutUndefined<T> = Omit<T, UndefinedKeys<T>> & {
  [K in keyof T]: Exclude<T[K], undefined>;
};

/**
 * This function scans for undefined values in a record and returns a new record without those keys.
 * If no undefined values are found, the original record is returned.
 */
export function omitUndefined<T extends Record<string, unknown>>(
  record: T,
): WithoutUndefined<T> {
  let hasUndefined = false;

  const result: Partial<T> = {};
  for (const key in record) {
    if (record[key] === undefined) {
      hasUndefined = true;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ensured by the implementation logic
      result[key as keyof T] = record[key];
    }
  }

  return hasUndefined
    ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ensured by the implementation logic
      (result as WithoutUndefined<T>)
    : // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ensured by the implementation logic
      (record as WithoutUndefined<T>);
}
