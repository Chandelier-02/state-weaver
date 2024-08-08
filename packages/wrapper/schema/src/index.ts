import { Schema, SchemaElement } from "./types";

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

export { Schema, MappedSchema } from "./types";
