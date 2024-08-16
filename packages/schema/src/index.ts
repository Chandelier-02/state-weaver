import { Schema } from "./types";

export function defineSchema<T extends Schema>(schema: T): T {
  return schema;
}

export type { Schema, MappedSchema } from "./types";
