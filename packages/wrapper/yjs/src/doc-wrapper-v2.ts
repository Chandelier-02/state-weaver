import * as Y from "yjs";

export type Primitive =
  | bigint
  | boolean
  | null
  | number
  | string
  | symbol
  | undefined;

export type JSONValue = Primitive | JSONObject | JSONArray;

export type JSONObject = { [key: string]: JSONValue };

export type JSONArray = Array<JSONValue>;

export function isYType(element: any): boolean {
  return element instanceof Y.AbstractType;
}

export type PrimitiveType =
  | "string"
  | "number"
  | "boolean"
  | "symbol"
  | "bigint"
  | "null"
  | "undefined";

export type DocElementTypeDescription =
  | PrimitiveType
  | DocElementTypeDescription[]
  | DocTypeDescription;

export type DocTypeDescription = {
  [key: string]: DocElementTypeDescription;
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
  : T extends DocElementTypeDescription[]
  ? ReadonlyArray<MapElementType<T[number]>>
  : T extends DocTypeDescription
  ? MappedTypeDescription<T>
  : never;

export type MappedTypeDescription<T extends DocTypeDescription> =
  MakeTopLevelReadonly<{
    [P in keyof T]: MapElementType<T[P]>;
  }>;

type DeepReadonlyIfObject<T> = T extends JSONObject
  ? { readonly [K in keyof T]: DeepReadonlyIfObject<T[K]> }
  : T;

type MakeTopLevelReadonly<T> = {
  readonly [K in keyof T]: T[K] extends JSONObject
    ? DeepReadonlyIfObject<T[K]>
    : T[K];
};

function validateSchema<T extends DocTypeDescription>(typeDescription: T) {
  function validate(description: DocElementTypeDescription) {
    if (Array.isArray(description)) {
      if (description.length !== 1) {
        throw new Error(
          "Array initializer must have exactly one element to define its type."
        );
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

function isPlainObject(value: unknown): value is JSONObject {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateState<
  S extends DocTypeDescription,
  T = MappedTypeDescription<S>
>(schema: S, state: unknown): state is T {
  if (typeof state !== "object" || state === null) {
    throw new Error(`State is not an object or is null`);
  }

  for (const [key, schemaValue] of Object.entries(schema)) {
    if (!(key in state)) {
      throw new Error(`Key '${key}' is missing in the state`);
    }

    const stateValue: unknown = (state as Record<string, unknown>)[key];

    if (schemaValue === "string" && typeof stateValue !== "string") {
      throw new Error(`Key '${key}' should be of type 'string'`);
    } else if (Array.isArray(schemaValue)) {
      if (!Array.isArray(stateValue)) {
        throw new Error(`Key '${key}' should be an array`);
      }
      for (const element of stateValue as unknown[]) {
        if (schemaValue[0] === "string") {
          if (typeof element !== "string") {
            throw new Error(
              `Elements of array '${key}' should be of type 'string'`
            );
          }
        } else if (typeof schemaValue[0] === "object") {
          validateState(schemaValue[0] as DocTypeDescription, element);
        } else if (
          [
            "string",
            "number",
            "boolean",
            "symbol",
            "bigint",
            "undefined",
          ].includes(typeof schemaValue[0])
        ) {
          if (typeof element !== typeof schemaValue[0]) {
            throw new Error(
              `Elements of array '${key}' should be of type '${typeof schemaValue[0]}'`
            );
          }
        } else if (schemaValue[0] === null) {
          if (element !== null) {
            throw new Error(`Elements of array '${key}' should be 'null'`);
          }
        }
      }
    } else if (typeof schemaValue === "object") {
      if (!isPlainObject(stateValue)) {
        throw new Error(`Key '${key}' should be a plain object`);
      }
      validateState(schemaValue as DocTypeDescription, stateValue);
    } else if (
      ["string", "number", "boolean", "symbol", "bigint", "undefined"].includes(
        typeof schemaValue
      )
    ) {
      if (typeof stateValue !== typeof schemaValue) {
        throw new Error(
          `Key '${key}' should be of type '${typeof schemaValue}'`
        );
      }
    } else if (schemaValue === null) {
      if (stateValue !== null) {
        throw new Error(`Key '${key}' should be 'null'`);
      }
    }
  }
  return true;
}

export interface CRDTWrapper<
  S extends DocTypeDescription,
  U,
  T = MappedTypeDescription<S>
> {
  yDoc: Readonly<Y.Doc>;

  state: Readonly<T>;

  applyUpdate(update: U): void;

  update(changeFn: (value: T) => void): void;

  update(changeFn: (value: T) => T): void;

  subscribe(listener: (state: Readonly<T>) => void): void;

  unsubscribe(listener: (state: Readonly<T>) => void): void;

  dispose(): void;
}

export class YjsWrapper<
  S extends DocTypeDescription,
  U extends Uint8Array,
  T = MappedTypeDescription<S>
> implements CRDTWrapper<S, U, T>
{
  readonly #yDoc: Y.Doc;
  readonly #subscriptions: Set<(value: T) => void>;
  readonly #schema: S;
  #state: T;

  readonly #observeDeepFunc = (events: Y.YEvent<any>[]): void => {
    const updatedValue = this.#applyYEvents(events);
    this.#state = updatedValue;
    for (const subscription of this.#subscriptions) {
      subscription(this.#state);
    }
  };

  constructor(schema: S, initialObject: T);
  constructor(schema: S, fromUpdates: U[]);
  constructor(schema: S, initialData: T | U[]) {
    validateSchema(schema);

    this.#yDoc = new Y.Doc();
    this.#schema = schema;

    let state;
    if (Array.isArray(initialData)) {
      this.#yDoc.transact(() => {
        for (const update of initialData) {
          Y.applyUpdate(this.#yDoc, update);
        }
      });
      state = Object.fromEntries(
        Array.from(this.#yDoc.share.entries()).map(([key, sharedType]) => [
          key,
          sharedType.toJSON(),
        ])
      );
    } else {
      this.update(() => initialData);
    }

    validateState(schema, state);
    this.#state = state as T;
  }

  get yDoc(): Readonly<Y.Doc> {
    return Object.freeze(this.#yDoc);
  }

  get state(): T {
    return this.#state;
  }

  applyUpdates(updates: U[], validate: boolean): void {
    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.#yDoc, update);
      }
    });
    if (validate) {
      validateState(this.#schema, this.#state);
    }
  }

  update(changeFn: (value: T) => void): void;

  update(changeFn: (value: T) => T): void;

  update(changeFn: ((value: T) => void) | ((value: T) => T)) {
    const updatedValue = changeFn(this.#state);

    this.#yDoc.transact(() => {
      // We are modifying a string
      if (typeof updatedValue !== "undefined") {
      }

      // We are modifying an object or array
    });
  }
}
