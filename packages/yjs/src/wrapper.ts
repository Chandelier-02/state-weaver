import { create, Patch, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import { assertSupportedYType, createYTypes, isSupportedYType } from "./util";
import {
  MappedSchema,
  Schema,
  validateSchema,
  validateStateAgainstSchema,
} from "@crdt-wrapper/schema";
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
  readonly #schema: S;
  #state: T;

  constructor(schema: S, initialData: T | Uint8Array[], clientId?: number) {
    validateSchema(schema);

    this.#yDoc = new Y.Doc() as D;
    if (clientId) {
      // @ts-ignore
      this.#yDoc.clientID = clientId;
    }
    this.#schema = schema;

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
      const couldApplyUpdates = this.applyUpdates(initialData, true);
      if (!couldApplyUpdates) {
        this.#yDoc.destroy();
        throw new Error(
          `Failed to apply updates. Object generated from updates did not match schema!`
        );
      }
      this.#state = this.#getState();
    } else {
      try {
        this.#state = this.#initializeObject(initialData);
      } catch (e) {
        this.#yDoc.destroy();
        throw e;
      }
    }
  }

  get yDoc(): Readonly<D> {
    return this.#yDoc;
  }

  // TODO: Speed this up in a way such that it only emits differences
  get state(): Readonly<T> {
    return Object.freeze(this.#state);
  }

  // NOTE: This may be suboptimal for extremely large numbers of updates.
  // We won't get back our object until it has been completely constructed.
  applyUpdates(updates: Uint8Array[], validate?: boolean): boolean {
    const previousState = this.#state;
    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.#yDoc, update);
      }
    });
    const newState = this.#getState();

    if (!validate) {
      this.#state = newState;
      return true;
    }

    try {
      validateStateAgainstSchema(this.#schema, newState);
      this.#state = newState;
      return true;
    } catch (e) {
      this.update(() => previousState, false);
      return false;
    }
  }

  update(changeFn: (value: T) => void, validate?: boolean): boolean {
    const previousState = this.#state;
    this.#yDoc.transact(() => {
      const [, patches] = create(previousState, changeFn, {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });
    const newState = this.#getState();

    if (!validate) {
      this.#state = newState;
      return true;
    }

    try {
      validateStateAgainstSchema(this.#schema, newState);
      this.#state = newState;
      return true;
    } catch (e) {
      this.update(() => newState, false);
      return false;
    }
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

    const state = this.#getState();
    validateStateAgainstSchema(this.#schema, state);
    return state;
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
}
