import { isPlainObject } from "../../shared/src";
import {
  MappedSchema,
  Schema,
  SchemaElement,
  SchemaPrimitiveType,
} from "./types";

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
      validate(description[0]); // Recursively validate the type of array elements
    } else if (typeof description === "object" && description !== null) {
      for (let val of Object.values(description)) {
        validate(val); // Recursively validate nested objects
      }
    } else if (
      description !== "string" &&
      description !== "number" &&
      description !== "boolean" &&
      description !== "symbol" &&
      description !== "bigint" &&
      description !== "null" &&
      description !== "undefined"
    ) {
      throw new Error(`Unknown type initializer: ${description}`);
    }
  }

  for (let val of Object.values(typeDescription)) {
    validate(val); // Validate each element in the schema
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

    if (typeof schemaValue === "string") {
      validatePrimitive(schemaValue, stateValue, key);
    } else if (Array.isArray(schemaValue)) {
      if (!Array.isArray(stateValue)) {
        throw new Error(`Key '${key}' should be an array`);
      }
      validateArray(schemaValue, stateValue, key);
    } else if (typeof schemaValue === "object" && schemaValue !== null) {
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

function validatePrimitive(
  schemaType: SchemaPrimitiveType,
  stateValue: unknown,
  key: string
) {
  const typeMapping: Record<SchemaPrimitiveType, string> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    symbol: "symbol",
    bigint: "bigint",
    null: "object", // Note that `null` is of type "object" in JS
    undefined: "undefined",
  };

  if (typeof stateValue !== typeMapping[schemaType]) {
    throw new Error(`Key '${key}' should be of type '${schemaType}'`);
  }
}

function validateArray(
  schemaValue: SchemaElement[],
  stateValue: unknown[],
  key: string
) {
  for (const element of stateValue) {
    if (Array.isArray(schemaValue[0])) {
      if (!Array.isArray(element)) {
        throw new Error(`Elements of array '${key}' should be arrays`);
      }
      validateArray(schemaValue[0] as SchemaElement[], element, key);
    } else if (typeof schemaValue[0] === "object" && schemaValue[0] !== null) {
      if (!isPlainObject(element)) {
        throw new Error(`Elements of array '${key}' should be objects`);
      }
      validateStateAgainstSchema(schemaValue[0] as Schema, element);
    } else if (typeof schemaValue[0] === "string") {
      validatePrimitive(schemaValue[0], element, key);
    }
  }
}

export type { Schema, MappedSchema } from "./types";
