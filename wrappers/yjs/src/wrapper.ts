import { create, Patch, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import {
  assertSupportedEvent,
  assertSupportedYType,
  createYTypes,
  isSupportedYType,
  toPojo,
} from "./util";
import {
  MappedSchema,
  Schema,
  validateSchema,
  validateStateAgainstSchema,
} from "../../schema";
import { CRDTWrapper } from "@crdt-wrapper/interface";
import {
  isPlainObject,
  isUint8ArrayArray,
  recurseIntoObject,
  SubStructure,
  JSONObject,
} from "../../shared/src";
import { SupportedYType } from "./types";

export function createYjsWrapper<S extends Schema>(
  schema: S,
  initialData: MappedSchema<S> | Uint8Array[]
): YjsWrapper<S, Uint8Array, Y.Doc, MappedSchema<S>> {
  if (
    Array.isArray(initialData) &&
    initialData.every((item) => item instanceof Uint8Array)
  ) {
    return new YjsWrapper<S, Uint8Array, Y.Doc, MappedSchema<S>>(
      schema,
      initialData as Uint8Array[]
    );
  } else {
    return new YjsWrapper<S, Uint8Array, Y.Doc, MappedSchema<S>>(
      schema,
      initialData as MappedSchema<S>
    );
  }
}

export class YjsWrapper<
  S extends Schema,
  U extends Uint8Array = Uint8Array,
  D extends Y.Doc = Y.Doc,
  T = MappedSchema<S>
> implements CRDTWrapper<S, U, D, T>
{
  readonly #yDoc: Readonly<D>;
  readonly #subscriptions: Set<(value: T) => void>;
  readonly #schema: S;

  readonly #observeDeepFunc = (events: Y.YEvent<any>[]): void => {
    const nonLocalEvents = events.filter(
      (event) => event.currentTarget.doc?.clientID !== this.#yDoc.clientID
    );
    const updatedValue = this.#applyYEvents(nonLocalEvents);
    for (const subscription of this.#subscriptions) {
      subscription(Object.freeze(updatedValue));
    }
  };

  constructor(schema: S, initialObject: T);
  constructor(schema: S, fromUpdates: U[]);
  constructor(schema: S, initialData: T | U[]) {
    validateSchema(schema);

    this.#yDoc = new Y.Doc() as D;
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

    if (isUint8ArrayArray(initialData)) {
      this.applyUpdates(initialData, true);
    } else {
      this.#initializeObject(initialData as T);
    }
  }

  get yDoc(): Readonly<D> {
    return this.#yDoc;
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
        validateStateAgainstSchema(this.#schema, this.state);
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
        validateStateAgainstSchema(this.#schema, this.state);
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

    validateStateAgainstSchema(this.#schema, this.state);
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
          if (isSupportedYType(nextTarget)) {
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

  // I need to fix this function signature
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
