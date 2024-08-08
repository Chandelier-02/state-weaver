import { create, Patch, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import { assertSupportedEvent, toPojo } from "./util";

type Primitive = bigint | boolean | null | number | string | symbol | undefined;

type JSONValue = Primitive | JSONObject | JSONArray;

type JSONObject = { [key: string]: JSONValue };

type JSONArray = Array<JSONValue>;

function isYType(element: any): boolean {
  return element instanceof Y.AbstractType;
}

type PrimitiveType =
  | "string"
  | "number"
  | "boolean"
  | "symbol"
  | "bigint"
  | "null"
  | "undefined"
  | "array";

type DocElementTypeDescription =
  | PrimitiveType
  | DocElementTypeDescription[]
  | ReadonlyArray<DocElementTypeDescription>
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
  : T extends "array"
  ? any[]
  : T extends [infer U]
  ? Array<MapElementType<U>>
  : T extends ReadonlyArray<infer U>
  ? Array<MapElementType<U>>
  : T extends DocTypeDescription
  ? MappedTypeDescription<T>
  : never;

export type MappedTypeDescription<T extends DocTypeDescription> =
  ImmutableTopLevel<{
    [P in keyof T]: MapElementType<T[P]>;
  }>;

type ImmutableTopLevel<T> = {
  [K in keyof T]: T[K];
};

type Path = (string | number)[];

type RecurseIntoObject<T, P extends Path> = P extends [
  infer Head,
  ...infer Tail extends Path
]
  ? Head extends keyof T
    ? RecurseIntoObject<T[Head], Tail>
    : never
  : T;

type SubStructure<T> = RecurseIntoObject<T, (string | number)[]>;

export function defineSchema<T extends DocTypeDescription>(schema: T): T {
  return schema;
}

function validateSchema<T extends DocTypeDescription>(typeDescription: T) {
  function validate(description: DocElementTypeDescription) {
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
      validateState(schemaValue as DocTypeDescription, stateValue);
    } else if (schemaValue === null && stateValue !== null) {
      throw new Error(`Key '${key}' should be 'null'`);
    }
  }
  return true;
}

function validateArray(
  schemaValue: DocElementTypeDescription[],
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
      validateArray(
        schemaValue[0] as DocElementTypeDescription[],
        element,
        key
      );
    } else if (typeof schemaValue[0] === "object") {
      validateState(schemaValue[0] as DocTypeDescription, element);
    }
  }
}

function createYTypes(value: any, yDoc: Y.Doc): Y.AbstractType<any> | any {
  if (typeof value === "string") {
    const yText = new Y.Text();
    yText.insert(0, value);
    return yText;
  } else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    value === null ||
    value === undefined
  ) {
    return value;
  } else if (Array.isArray(value)) {
    const yArray = new Y.Array();
    for (const item of value) {
      yArray.push([createYTypes(item, yDoc)]);
    }
    return yArray;
  } else if (typeof value === "object") {
    const yMap = new Y.Map();
    for (const [key, val] of Object.entries(value)) {
      yMap.set(key, createYTypes(val, yDoc));
    }
    return yMap;
  }
}

function recurseIntoObject<T, P extends Path>(
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

function assertSupportedYType(yType: Y.AbstractType<any>): void {
  if (
    !(
      yType instanceof Y.Text ||
      yType instanceof Y.Array ||
      yType instanceof Y.Map
    )
  ) {
    throw new Error(`Cannot handle yType ${yType.constructor.name}`);
  }
}

export interface CRDTWrapper<
  S extends DocTypeDescription,
  U,
  T = MappedTypeDescription<S>
> {
  yDoc: Readonly<Y.Doc>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): void;

  update(changeFn: (value: T) => void, validate?: boolean): void;

  update(changeFn: (value: T) => T, validate?: boolean): void;

  subscribe(listener: (state: Readonly<T>) => void): void;

  unsubscribe(listener: (state: Readonly<T>) => void): void;

  dispose(): void;
}

export type SupportedYType = Y.Text | Y.Array<any> | Y.Map<any>;

// TODO: Create a factory function.
export class YjsWrapper<
  S extends DocTypeDescription,
  U extends Uint8Array = Uint8Array,
  T = MappedTypeDescription<S>
> implements CRDTWrapper<S, U, T>
{
  readonly #yDoc: Y.Doc;
  readonly #subscriptions: Set<(value: T) => void>;
  readonly #schema: S;

  readonly #observeDeepFunc = (events: Y.YEvent<any>[]): void => {
    const updatedValue = this.#applyYEvents(events);
    for (const subscription of this.#subscriptions) {
      subscription(Object.freeze(updatedValue));
    }
  };

  constructor(schema: S, initialObject: T);
  constructor(schema: S, fromUpdates: U[]);
  constructor(schema: S, initialData: T | U[]) {
    validateSchema(schema);

    this.#yDoc = new Y.Doc();
    this.#schema = schema;
    this.#subscriptions = new Set();

    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === "object" && !Array.isArray(value)) {
        const yMap = this.#yDoc.getMap(key);
        yMap.observeDeep(this.#observeDeepFunc);
      } else if (typeof value === "object" && Array.isArray(value)) {
        const yArray = this.#yDoc.getArray(key);
        yArray.observeDeep(this.#observeDeepFunc);
      } else {
        const yText = this.#yDoc.getText(key);
        yText.observeDeep(this.#observeDeepFunc);
      }
    }

    if (Array.isArray(initialData)) {
      this.applyUpdates(initialData, true);
    } else {
      this.#initializeObject(initialData);
    }
  }

  get yDoc(): Readonly<Y.Doc> {
    return Object.freeze(this.#yDoc);
  }

  get state(): Readonly<T> {
    return Object.fromEntries(
      Array.from(this.#yDoc.share.entries()).map(([key, sharedType]) => [
        key,
        sharedType.toJSON(),
      ])
    ) as T;
  }

  applyUpdates(updates: U[], validate?: boolean): void {
    const state = this.state;
    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.#yDoc, update);
      }
    });
    if (validate) {
      try {
        validateState(this.#schema, this.state);
      } catch (e) {
        this.update(() => state, false);
        throw e;
      }
    }
  }

  update(changeFn: (value: T) => void, validate?: boolean): void {
    const state = this.state;
    this.#yDoc.transact(() => {
      const [, patches] = create(state, changeFn, {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });

    if (validate) {
      try {
        validateState(this.#schema, this.state);
      } catch (e) {
        this.update(() => state, false);
        throw e;
      }
    }
  }

  public subscribe(listener: (value: Readonly<T>) => void): void {
    this.#subscriptions.add(listener);
  }

  public unsubscribe(listener: (value: Readonly<T>) => void): void {
    this.#subscriptions.delete(listener);
  }

  public dispose(): void {
    this.#yDoc.destroy();
  }

  #initializeObject(object: T): void {
    this.#yDoc.transact(() => {
      const [, patches] = create({}, () => rawReturn(object as object), {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });

    validateState(this.#schema, this.state);
  }
  #applyPatch(patch: Patch): void {
    const { path, op, value } = patch;

    if (typeof path === "string") {
      throw new Error("Cannot handle non-array paths. Check mutative config.");
    }

    const updateYTypesFromScratch = (
      target: SupportedYType,
      value: [] | {} | string
    ) => {
      if (target instanceof Y.Map && isPlainObject(value)) {
        target.clear();
        for (const k in value) {
          target.set(k, createYTypes(value[k], this.#yDoc));
        }
      } else if (target instanceof Y.Array && Array.isArray(value)) {
        target.delete(0, target.length);
        for (let i = 0; i < value.length; i++) {
          target.push([createYTypes(value[i], this.#yDoc)]);
        }
      } else if (target instanceof Y.Text && typeof value === "string") {
        const string = target.toJSON();
        const patches = createStringPatches(string, value);
        this.#applyStringPatches(target, patches);
      }
    };

    if (path.length === 0) {
      if (op !== "replace") {
        throw new Error("Cannot add or remove elements from top level object!");
      }

      for (const [subKey, subValue] of Object.entries(value)) {
        let target: SupportedYType;
        if (isPlainObject(subValue)) {
          target = this.#yDoc.getMap(subKey);
        } else if (typeof subValue === "object" && Array.isArray(subValue)) {
          target = this.#yDoc.getArray(subKey);
        } else if (typeof subValue === "string") {
          target = this.#yDoc.getText(subKey);
        } else {
          throw new Error("I have no idea how you got here");
        }
        updateYTypesFromScratch(target, subValue);
      }
    } else if (path.length === 1) {
      for (let i = 0; i < path.length; i++) {
        const target = this.#yDoc.get(path[i] as string);
        assertSupportedYType(target);
        updateYTypesFromScratch(target as SupportedYType, value);
      }
    } else {
      let target = this.#yDoc.get(path[0] as string);
      for (let i = 1; i < path.length - 1; i++) {
        if (target instanceof Y.Map) {
          target = target.get(path[i] as string);
        } else if (target instanceof Y.Array) {
          const nextTarget = target.get(path[i] as number);
          if (isYType(nextTarget)) {
            target = nextTarget as SupportedYType;
          } else {
            break;
          }
        }
      }
      const property = path[path.length - 1];
      if (target instanceof Y.Text) {
        const string = target.toJSON();
        const patches = createStringPatches(string, value);
        this.#applyStringPatches(target, patches);
      } else if (target instanceof Y.Map && typeof property === "string") {
        switch (op) {
          case "add":
          case "replace":
            target.set(property, createYTypes(value, this.#yDoc));
            break;
          case "remove":
            target.delete(property);
            break;
        }
      } else if (target instanceof Y.Array && typeof property === "number") {
        switch (op) {
          case "add":
            target.insert(property, [createYTypes(value, this.#yDoc)]);
            break;
          case "replace":
            target.delete(property);
            target.insert(property, [createYTypes(value, this.#yDoc)]);
            break;
          case "remove":
            target.delete(property);
            break;
        }
      } else if (target instanceof Y.Array && property === "length") {
        if (value < target.length) {
          const diff = target.length - value;
          target.delete(value, diff);
        }
      } else {
        throw new Error(
          `Cannot handle patch ${patch} on instance of ${target.constructor.name}`
        );
      }
    }
  }

  #applyStringPatches(target: Y.Text, patches: Change[]): void {
    let cursor = 0;
    for (const change of patches) {
      if (change[0] === -1) {
        target.delete(cursor, change[1]);
      } else if (change[0] === 0) {
        cursor += change[1];
      } else if (change[0] === 1) {
        target.insert(cursor, change[1]);
        cursor += change[1].length;
      }
    }
  }

  #applyYEvents(events: Y.YEvent<any>[]): T {
    return create(this.state, (target) => {
      for (const event of events) {
        assertSupportedEvent(event);
        let base: any = target;
        for (const [key, yType] of this.#yDoc.share) {
          if (yType === event.currentTarget) {
            base = base[key];
            break;
          }
        }
        if (event.path.length > 2) {
          base = recurseIntoObject(
            base,
            event.path.slice(1)
          ) as SubStructure<T>;
        }
        this.#applyYEvent(base, event);
      }
    });
  }

  // I need to check if the event is from a remote source. If so, all top-level array
  // modifications need to clear the state and then replace it.
  // I am worried about the performance implications of this.

  // TODO: I need to fix this signature
  #applyYEvent(base: T, event: Y.YEvent<any>): T {
    if (event instanceof Y.YMapEvent && isPlainObject(base)) {
      const source = event.target as Y.Map<any>;

      for (const [key, change] of event.changes.keys) {
        switch (change.action) {
          case "add":
          case "update":
            (base as JSONObject)[key] = toPojo(source.get(key));
            break;
          case "delete":
            delete (base as JSONObject)[key];
            break;
        }
      }
    } else if (event instanceof Y.YArrayEvent && Array.isArray(base)) {
      const arr = base as any[];

      let retain = 0;
      for (const change of event.changes.delta) {
        if (change.retain) {
          retain += change.retain;
        }
        if (change.delete) {
          arr.splice(retain, change.delete);
        }
        if (change.insert) {
          if (Array.isArray(change.insert)) {
            arr.splice(retain, 0, ...change.insert.map(toPojo));
          } else {
            arr.splice(retain, 0, toPojo(change.insert));
          }
          retain += change.insert.length;
        }
      }
    } else if (event instanceof Y.YTextEvent && typeof base === "string") {
      base = this.#applyYTextEvent(base, event) as any;
    }

    return base;
  }

  #applyYTextEvent(base: string, event: Y.YTextEvent): string {
    let text = base;

    let retain = 0;
    for (const change of event.changes.delta) {
      if (change.retain) {
        retain += change.retain;
      }
      if (change.delete) {
        const deleteLength = change.delete;
        text = text.slice(0, retain) + text.slice(retain + deleteLength);
      }
      if (change.insert) {
        const insertText = Array.isArray(change.insert)
          ? change.insert.join("")
          : change.insert;
        text = text.slice(0, retain) + insertText + text.slice(retain);
        text = insertText;
        retain += insertText.length;
      }
    }
    return text;
  }
}
