import { isPlainObject } from "../../shared/src";
import { MappedSchema, Schema, SchemaElement } from "./types";

export function defineSchema<T extends Schema>(schema: T): T {
  return schema;
}

export function validateSchema<T extends Schema>(typeDescription: T) {
  function validate(description: SchemaElement) {
    if (Array.isArray(description)) {
      if (description.length !== 1) {
        throw new Error(
          "Array initializer must have exactly one element to define its type."
        );
      }
      if (description[0] === "array") {
        return;
      }
      validate(description[0]);
    } else if (typeof description === "object") {
      for (let val of Object.values(description)) {
        validate(val);
      }
    } else if (
      description !== "string" &&
      !(
        typeof description === "string" ||
        typeof description === "number" ||
        typeof description === "boolean" ||
        typeof description === "symbol" ||
        typeof description === "bigint" ||
        description === null ||
        description === undefined
      )
    ) {
      throw new Error(`Unknown type initializer: ${description}`);
    }
  }

  for (let val of Object.values(typeDescription)) {
    validate(val);
  }
}

export function validateStateAgainstSchema<
  S extends Schema,
  T = MappedSchema<S>
>(schema: S, state: unknown): state is T {
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
      validateStateAgainstSchema(schemaValue as Schema, stateValue);
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
      validateStateAgainstSchema(schemaValue[0] as Schema, element);
    }
  }
}

export type { Schema, MappedSchema } from "./types";
