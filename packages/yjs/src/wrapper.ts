import { create, Patch, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import { createYTypes } from "./util";
import { MappedSchema, Schema } from "@crdt-wrapper/schema";
import { CRDTWrapper } from "@crdt-wrapper/interface";
import { isPlainObject, isUint8ArrayArray } from "../../shared/src";
import { SupportedYType } from "./types";

export class YjsWrapper<
  S extends Schema,
  T extends MappedSchema<S>,
  D extends Y.Doc = Y.Doc
> implements CRDTWrapper<S, T, D, Uint8Array>
{
  readonly #yDoc: Readonly<D>;
  #state: Readonly<T>;

  constructor(schema: S, initialData: T | Uint8Array[], clientId?: number) {
    this.#yDoc = new Y.Doc() as D;
    if (clientId) {
      // @ts-ignore
      this.#yDoc.clientID = clientId;
    }

    // Need to do this or else loading the document from updates gives
    // only Y.AbstractTypes that don't go to JSON
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === "object" && !Array.isArray(value)) {
        this.#yDoc.getMap(key);
      } else if (typeof value === "object" && Array.isArray(value)) {
        this.#yDoc.getArray(key);
      } else {
        this.#yDoc.getText(key);
      }
    }

    if (isUint8ArrayArray(initialData)) {
      this.applyUpdates(initialData);
      this.#state = this.#getState();
    } else {
      this.#state = this.#initializeObject(initialData);
    }
  }

  get yDoc(): Readonly<D> {
    return this.#yDoc;
  }

  get state(): Readonly<T> {
    return Object.freeze(this.#state);
  }

  applyUpdates(updates: Uint8Array[]): void {
    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.#yDoc, update);
      }
    });
    this.#state = this.#getState();
  }

  update(changeFn: (value: T) => void): void {
    this.#yDoc.transact(() => {
      const [, patches] = create(this.#state, changeFn, {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });
    this.#state = this.#getState();
  }

  public dispose(): void {
    this.#yDoc.destroy();
  }

  #getState(): Readonly<T> {
    return Object.freeze(
      Object.fromEntries(
        Array.from(this.#yDoc.share.entries()).map(([key, sharedType]) => [
          key,
          sharedType.toJSON(),
        ])
      )
    ) as Readonly<T>;
  }

  #initializeObject(object: T): T {
    this.#yDoc.transact(() => {
      const [, patches] = create({}, () => rawReturn(object as object), {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });

    return this.#getState();
  }

  #applyPatch(patch: Patch): void {
    const { path, op, value } = patch;

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
        } else {
          target = this.#yDoc.getText(subKey);
        }
        updateYTypesFromScratch(target, subValue as string | {} | []);
      }
    } else if (path.length === 1) {
      for (let i = 0; i < path.length; i++) {
        const target = this.#yDoc.get(path[i] as string);
        updateYTypesFromScratch(target as SupportedYType, value);
      }
    } else {
      let target = this.#yDoc.get(path[0] as string);
      for (let i = 1; i < path.length - 1; i++) {
        if (target instanceof Y.Map) {
          target = target.get(path[i] as string);
        } else if (target instanceof Y.Array) {
          const nextTarget = target.get(path[i] as number);
          if (nextTarget instanceof Y.AbstractType) {
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
}
