import {
  MappedSchema,
  Schema,
  SchemaElement,
} from "@crdt-wrapper/schema/dist/types";
import {
  JSONObject,
  Path,
  RecurseIntoObject,
} from "@crdt-wrapper/shared-types";

export function validateState<S extends Schema, T = MappedSchema<S>>(
  schema: S,
  state: unknown
): state is T {
  if (typeof state !== "object" || state === null) {
    throw new Error(`State is not an object or is null`);
  }

  for (const [key, schemaValue] of Object.entries(schema)) {
    if (!(key in state)) {
      throw new Error(`Key '${key}' is missing in the state`);
    }

    const stateValue: unknown = (state as Record<string, unknown>)[key];

    if (typeof schemaValue === "string" && typeof stateValue !== schemaValue) {
      throw new Error(`Key '${key}' should be of type '${schemaValue}'`);
    } else if (Array.isArray(schemaValue)) {
      if (!Array.isArray(stateValue)) {
        throw new Error(`Key '${key}' should be an array`);
      }
      validateArray(schemaValue, stateValue, key);
    } else if (typeof schemaValue === "object") {
      if (!isPlainObject(stateValue)) {
        throw new Error(`Key '${key}' should be a plain object`);
      }
      validateState(schemaValue as Schema, stateValue);
    } else if (schemaValue === null && stateValue !== null) {
      throw new Error(`Key '${key}' should be 'null'`);
    }
  }
  return true;
}

function validateArray(
  schemaValue: SchemaElement[],
  stateValue: unknown[],
  key: string
) {
  for (const element of stateValue) {
    if (
      typeof schemaValue[0] === "string" &&
      typeof element !== schemaValue[0] &&
      schemaValue[0] !== "array"
    ) {
      throw new Error(
        `Elements of array '${key}' should be of type '${schemaValue[0]}'`
      );
    } else if (Array.isArray(schemaValue[0]) && Array.isArray(element)) {
      validateArray(schemaValue[0] as SchemaElement[], element, key);
    } else if (typeof schemaValue[0] === "object") {
      validateState(schemaValue[0] as Schema, element);
    }
  }
}

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
