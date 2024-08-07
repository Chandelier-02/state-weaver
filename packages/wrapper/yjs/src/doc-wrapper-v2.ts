// import * as Y from "yjs";

// // Primitive types excluding string
// export type SchemaPrimitiveNoString = "boolean" | "number" | "null";

// // Base interface for CRDT and Non-CRDT types
// interface BaseSchema {
//   crdt: boolean;
// }

// // CRDT Types
// export interface CRDTObject extends BaseSchema {
//   crdt: true;
//   value: { [key: string]: SchemaValue };
// }

// export interface CRDTArray extends BaseSchema {
//   crdt: true;
//   values: [];
// }

// export interface CRDTString extends BaseSchema {
//   crdt: true;
//   value: string;
// }

// // Non-CRDT Types
// export interface NonCRDTObject extends BaseSchema {
//   crdt: false;
//   value: { [key: string]: NonCRDTValue };
// }

// export interface NonCRDTArray extends BaseSchema {
//   crdt: false;
//   values: NonCRDTValue[];
// }

// export interface NonCRDTString extends BaseSchema {
//   crdt: false;
//   value: string;
// }

// export type NonCRDTValue =
//   | NonCRDTObject
//   | NonCRDTArray
//   | NonCRDTString
//   | SchemaPrimitiveNoString;

// export type SchemaValue = CRDTObject | CRDTArray | CRDTString;

// type ReadonlyTopLevel<T> = {
//   readonly [K in keyof T]: T[K];
// };

// export type SupportedTopLevelSchemaValue = ReadonlyTopLevel<{
//   [key: string]: SchemaValue;
// }>;

// type ConvertSchema<S> = S extends { crdt: true }
//   ? S extends CRDTObject
//     ? { [K in keyof S["value"]]: ConvertSchema<S["value"][K]> }
//     : S extends CRDTArray
//     ? ConvertSchema<S["values"][number]>[]
//     : S extends CRDTString
//     ? string
//     : never
//   : S extends { crdt: false }
//   ? S extends NonCRDTObject
//     ? { [K in keyof S["value"]]: ConvertSchema<S["value"][K]> }
//     : S extends NonCRDTArray
//     ? NonCRDTValue[]
//     : S extends NonCRDTString
//     ? string
//     : never
//   : never;

// type PathType<T, P extends (keyof any)[]> = P extends [infer K, ...infer Rest]
//   ? K extends keyof T
//     ? Rest extends (keyof T[K])[]
//       ? PathType<T[K], Rest>
//       : T[K]
//     : never
//   : T;

// type IsCRDT<T> = T extends { crdt: true } ? true : false;

// type CRDTPath<T, P extends (keyof any)[]> = IsCRDT<PathType<T, P>> extends true
//   ? P
//   : never;

// // SubscriptionMap type definition
// type SubscriptionMap = Map<string, Set<(value: any) => void>>;

// type SharedTypeMap = Map<string, Y.Map<any> | Y.Array<any> | Y.Text>;

// export interface CRDTWrapper<S, T, U> {
//   getState<P extends (keyof T)[]>(path: P): PathType<T, P>;

//   applyUpdate(update: U): void;

//   update<P extends (keyof T)[]>(
//     path: P,
//     changeFn: (value: PathType<T, P>) => void
//   ): void;

//   update<P extends (keyof T)[]>(
//     path: P,
//     changeFn: (value: PathType<T, P>) => PathType<T, P>
//   ): void;

//   subscribe<P extends (keyof T)[]>(
//     path: CRDTPath<T, P>,
//     callback: (value: PathType<T, P>) => void
//   ): void;

//   unsubscribe<P extends (keyof T)[]>(
//     path: CRDTPath<T, P>,
//     callback: (value: PathType<T, P>) => void
//   ): void;

//   dispose(): void;
// }

// export class YjsDocWrapper<
//   S extends SupportedTopLevelSchemaValue,
//   U,
//   T = ConvertSchema<S>
// > implements CRDTWrapper<S, U, T>
// {
//   readonly #yDoc: Y.Doc;
//   readonly #subscriptions: SubscriptionMap;
//   readonly #sharedTypeMap: SharedTypeMap;

//   public static create<
//     S extends SupportedTopLevelSchemaValue,
//     U,
//     T = ConvertSchema<S>
//   >(schema: S, initialObject: T): YjsDocWrapper<S, U, T>;
//   public static create<
//     S extends SupportedTopLevelSchemaValue,
//     U,
//     T = ConvertSchema<S>
//   >(fromUpdates: U[]): YjsDocWrapper<S, U, T>;

//   public static create<
//     S extends SupportedTopLevelSchemaValue,
//     U,
//     T = ConvertSchema<S>
//   >(arg0: T | U[]): YjsDocWrapper<S, U, T> {}

//   constructor(yDoc: Y.Doc, schema: S) {
//     this.#yDoc = yDoc;
//     this.#subscriptions = new Map();
//     this.#sharedTypeMap = new Map();

//     // Initialize the Yjs structures based on the schema
//     this.initializeSharedTypes(schema, [], null);
//   }

//   #initializeSharedTypes(schema: S): void {
//     for (const [key, value] of Object.entries(schema)) {
//       const topLevelValue = value as SchemaValue;
//       // Value is an object and should be converted to a Y.Map
//       if ("value" in topLevelValue && typeof topLevelValue.value === "object") {
//         const yMap = this.#yDoc.getMap(key);
//         this.#sharedTypeMap.set(key, yMap);

//         // Start recursively going through the object to convert values into Y.Map, Y.Array, or Y.Text
//         for (const [nestedKey, nestedValue] of Object.entries(topLevelValue)) {
//           yMap.set(
//             nestedKey,
//             initializeNestedSharedTypes(nestedValue, [key, nestedKey])
//           );
//         }
//         // Value is a string and should be converted to a Y.Text
//       } else if (
//         "value" in topLevelValue &&
//         typeof topLevelValue.value === "string"
//       ) {
//         const yText = this.#yDoc.getText(key);
//         this.#sharedTypeMap.set(key, yText);
//         // Value is an array and should be converted to a Y.Array
//         // YTypes inserted into array will be tracked at runtime
//       } else if ("values" in topLevelValue) {
//         const yArray = this.#yDoc.getArray(key);
//         this.#sharedTypeMap.set(key, yArray);
//       }
//     }

//     function initializeNestedSharedTypes(
//       schema: SchemaValue | NonCRDTValue,
//       path: (string | number)[]
//     ): SchemaValue | NonCRDTValue {}
//   }

//   private getPathKey(path: (string | number)[]): string {
//     return path.join(".");
//   }

//   // Other methods such as getState, applyUpdate, update, subscribe, unsubscribe, and dispose...
// }
