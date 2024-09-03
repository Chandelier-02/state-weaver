import { JsonValue, JsonObject, JsonArray, JsonPrimitive } from "type-fest";

export function isJsonCompatible(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonCompatible);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isJsonCompatible);
  }

  return false;
}

export function isJsonObject(value: unknown): value is JsonObject {
  const valueIsCompatible = isJsonCompatible(value);
  if (!valueIsCompatible) {
    return false;
  }

  return typeof value === "object" && !Array.isArray(value);
}

export function isJsonArray(value: unknown): value is JsonArray {
  const valueIsCompatible = isJsonCompatible(value);
  if (!valueIsCompatible) {
    return false;
  }

  return typeof value === "object" && Array.isArray(value);
}

export function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    value === null
  );
}

export class IllegalValueError extends Error {
  readonly illegalValue: unknown;

  constructor(illegalValue: unknown) {
    super(`Value does not align with Json`);
    this.illegalValue = illegalValue;
    this.name = this.constructor.name;
    // @ts-ignore // TODO: Figure out why this is giving my type issues...
    if (
      "captureStackTrace" in Error &&
      typeof Error.captureStackTrace === "function"
    ) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
