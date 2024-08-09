import type { JSONObject, Path, RecurseIntoObject } from "../types/index";

export function isPlainObject(value: unknown): value is JSONObject {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function recurseIntoObject<T, P extends Path>(
  base: T,
  path: P
): RecurseIntoObject<T, P> {
  let current: any = base;
  for (const key of path) {
    if (current == null) {
      return undefined as RecurseIntoObject<T, P>;
    }
    current = current[key];
  }
  return current as RecurseIntoObject<T, P>;
}

export function isUint8ArrayArray<T, U>(data: T | U[]): data is U[] {
  return (
    Array.isArray(data) && data.every((item) => item instanceof Uint8Array)
  );
}
