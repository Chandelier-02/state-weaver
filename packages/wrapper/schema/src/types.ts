type SchemaPrimitiveType =
  | "string"
  | "number"
  | "boolean"
  | "symbol"
  | "bigint"
  | "null"
  | "undefined"
  | "array";

export type SchemaElement =
  | SchemaPrimitiveType
  | SchemaElement[]
  | ReadonlyArray<SchemaElement>
  | Schema;

export type Schema = {
  [key: string]: SchemaElement;
};

type MapElementType<T> = T extends "string"
  ? string
  : T extends "number"
  ? number
  : T extends "boolean"
  ? boolean
  : T extends "symbol"
  ? symbol
  : T extends "bigint"
  ? bigint
  : T extends "null"
  ? null
  : T extends "undefined"
  ? undefined
  : T extends "array"
  ? any[]
  : T extends [infer U]
  ? Array<MapElementType<U>>
  : T extends ReadonlyArray<infer U>
  ? Array<MapElementType<U>>
  : T extends Schema
  ? MappedSchema<T>
  : never;

export type MappedSchema<T extends Schema> = ImmutableTopLevel<{
  [P in keyof T]: MapElementType<T[P]>;
}>;

type ImmutableTopLevel<T> = {
  [K in keyof T]: T[K];
};
